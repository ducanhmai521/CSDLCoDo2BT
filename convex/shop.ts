import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getShopItems = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("shopItems"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    isActive: v.boolean(),
    metadata: v.optional(v.any()),
  })),
  handler: async (ctx) => {
    return await ctx.db
      .query("shopItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getUserPurchases = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("userPurchases"),
    _creationTime: v.number(),
    userId: v.id("users"),
    itemId: v.id("shopItems"),
    purchaseDate: v.number(),
    isActive: v.boolean(),
    customization: v.optional(v.any()),
    item: v.optional(v.object({
      name: v.string(),
      description: v.string(),
      category: v.string(),
    })),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const purchases = await ctx.db
      .query("userPurchases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const purchasesWithItems = await Promise.all(
      purchases.map(async (purchase) => {
        const item = await ctx.db.get(purchase.itemId);
        return {
          ...purchase,
          item: item ? {
            name: item.name,
            description: item.description,
            category: item.category,
          } : undefined,
        };
      })
    );

    return purchasesWithItems;
  },
});

export const purchaseItem = mutation({
  args: {
    itemId: v.id("shopItems"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    purchaseId: v.optional(v.id("userPurchases")),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user points
    const userPoints = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!userPoints) {
      return { success: false, message: "Không tìm thấy thông tin điểm của bạn" };
    }

    // Get item details
    const item = await ctx.db.get(args.itemId);
    if (!item || !item.isActive) {
      return { success: false, message: "Sản phẩm không tồn tại hoặc đã ngừng bán" };
    }

    // Check if user has enough points
    if (userPoints.points < item.price) {
      return { success: false, message: `Bạn cần ${item.price} điểm để mua sản phẩm này (hiện có ${userPoints.points} điểm)` };
    }

    // Check if user already owns this item (for unique items)
    if (item.category === "customization") {
      const existingPurchase = await ctx.db
        .query("userPurchases")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("itemId"), args.itemId))
        .first();

      if (existingPurchase) {
        return { success: false, message: "Bạn đã sở hữu sản phẩm này rồi" };
      }
    }

    // Deduct points
    await ctx.db.patch(userPoints._id, {
      points: userPoints.points - item.price,
    });

    // Create purchase record
    const purchaseId = await ctx.db.insert("userPurchases", {
      userId,
      itemId: args.itemId,
      purchaseDate: Date.now(),
      isActive: true,
    });

    return {
      success: true,
      message: `Đã mua thành công "${item.name}" với ${item.price} điểm!`,
      purchaseId,
    };
  },
});

export const updateCustomization = mutation({
  args: {
    purchaseId: v.id("userPurchases"),
    customization: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.userId !== userId) {
      return { success: false, message: "Không tìm thấy giao dịch mua hàng" };
    }

    await ctx.db.patch(args.purchaseId, {
      customization: args.customization,
    });

    return { success: true, message: "Đã cập nhật tùy chỉnh thành công!" };
  },
});

// Initialize shop items (run once)
export const initializeShopItems = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Check if items already exist
    const existingItems = await ctx.db.query("shopItems").collect();
    if (existingItems.length > 0) return null;

    // Create the custom badge item
    await ctx.db.insert("shopItems", {
      name: "Tùy chỉnh thẻ tên người báo cáo",
      description: "Tự chọn màu sắc và icon cho thẻ tên của bạn khi báo cáo vi phạm.",
      price: 200,
      category: "customization",
      isActive: true,
      metadata: {
        type: "reporter_badge",
        allowedIcons: ["Star", "Heart", "Zap", "Crown", "Diamond", "Flame", "Sparkles", "Award", "Badge"],
        allowedColors: [
          { name: "Emerald", from: "emerald-500", to: "emerald-600" },
          { name: "Blue", from: "blue-500", to: "blue-600" },
          { name: "Purple", from: "purple-500", to: "purple-600" },
          { name: "Pink", from: "pink-500", to: "pink-600" },
          { name: "Orange", from: "orange-500", to: "orange-600" },
          { name: "Red", from: "red-500", to: "red-600" },
          { name: "Yellow", from: "yellow-500", to: "yellow-600" },
          { name: "Teal", from: "teal-500", to: "teal-600" },
        ],
        forbiddenCombos: [
          { icon: "ShieldCheck", colorFrom: "indigo-600", colorTo: "indigo-600" }, // Admin combo
        ],
      },
    });

    return null;
  },
});