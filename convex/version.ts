import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getWebVer = query({
  args: {},
  handler: async (ctx) => {
    const webVerSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "webVer"))
      .first();
    return webVerSetting?.value ?? 0;
  },
});

export const updateMyWebVer = mutation({
  args: { webVer: v.number() },
  handler: async (ctx, { webVer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.patch(user._id, { webVer });
  },
});

export const setWebVer = mutation({
  args: { version: v.number() },
  handler: async (ctx, { version }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
        throw new Error("Not authenticated");
    }
    const user = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

    if (user?.role !== 'admin') {
        throw new Error("Unauthorized");
    }

    const webVerSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "webVer"))
      .first();

    if (webVerSetting) {
      await ctx.db.patch(webVerSetting._id, { value: version });
    } else {
      await ctx.db.insert("settings", { key: "webVer", value: version });
    }
  },
});