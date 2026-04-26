import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { mutation, query, internalQuery } from "./_generated/server";
import { getUserId } from "./lib/auth";

export const getMyProfile = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.id("users"),
      fullName: v.string(),
      className: v.string(),
      grade: v.number(),
      role: v.union(
        v.literal("admin"),
        v.literal("gradeManager"),
        v.literal("pending")
      ),
      isSuperUser: v.optional(v.boolean()),
      webVer: v.optional(v.number()),
      aiRequestCount: v.optional(v.number()),
      lastAiRequestDate: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return null;
    }
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile;
  },
});

export const createMyProfile = mutation({
  args: {
    fullName: v.string(),
    className: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Bạn phải đăng nhập để tạo hồ sơ.");
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile) {
      throw new Error("Hồ sơ đã tồn tại.");
    }

    const gradeMatch = args.className.match(/^(\d+)/);
    if (!gradeMatch || !["10", "11", "12"].includes(gradeMatch[1])) {
      throw new Error("Tên lớp không hợp lệ. Ví dụ: 10A1, 11B2, 12C3.");
    }
    const grade = parseInt(gradeMatch[1], 10);

    await ctx.db.insert("userProfiles", {
      userId,
      fullName: args.fullName,
      className: args.className,
      grade,
      role: "pending",
    });

    return null;
  },
});

export const getPendingUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.id("users"),
      fullName: v.string(),
      className: v.string(),
      grade: v.number(),
      role: v.union(
        v.literal("admin"),
        v.literal("gradeManager"),
        v.literal("pending")
      ),
      isSuperUser: v.optional(v.boolean()),
      webVer: v.optional(v.number()),
      aiRequestCount: v.optional(v.number()),
      lastAiRequestDate: v.optional(v.string()),
      email: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      return [];
    }

    const pendingProfiles = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("role"), "pending"))
      .collect();

    const users = await Promise.all(
      pendingProfiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        return {
          ...profile,
          email: user?.email,
        };
      })
    );
    return users;
  },
});

export const verifyUser = mutation({
  args: {
    profileId: v.id("userProfiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Không có quyền truy cập.");
    }
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (myProfile?.role !== "admin") {
      throw new Error("Không có quyền truy cập.");
    }

    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("Không tìm thấy hồ sơ.");
    }

    if (profile.userId === userId) {
      throw new Error("Không thể verify chính mình.");
    }

    const admins = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    if (admins.length === 0) {
      await ctx.db.patch(args.profileId, { role: "admin" });
    } else {
      await ctx.db.patch(args.profileId, { role: "gradeManager" });
    }

    return null;
  },
});

export const getLoggedInUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      betterAuthId: v.optional(v.string()),
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      tokenIdentifier: v.optional(v.string()),
      profile: v.union(
        v.object({
          _id: v.id("userProfiles"),
          _creationTime: v.number(),
          userId: v.id("users"),
          fullName: v.string(),
          className: v.string(),
          grade: v.number(),
          role: v.union(
            v.literal("admin"),
            v.literal("gradeManager"),
            v.literal("pending")
          ),
          isSuperUser: v.optional(v.boolean()),
          webVer: v.optional(v.number()),
          aiRequestCount: v.optional(v.number()),
          lastAiRequestDate: v.optional(v.string()),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return { ...user, profile: profile ?? null };
  },
});

export const getAllStudents = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("studentRoster"),
      _creationTime: v.number(),
      fullName: v.string(),
      className: v.string(),
    })
  ),
  handler: async (ctx) => {
    const students = await ctx.db.query("studentRoster").collect();
    return students;
  },
});

export const getAllUserProfiles = query({
  args: {},
  returns: v.array(
    v.object({
      profileId: v.id("userProfiles"),
      userId: v.id("users"),
      fullName: v.string(),
      className: v.string(),
      role: v.union(
        v.literal("pending"),
        v.literal("gradeManager"),
        v.literal("admin")
      ),
      isSuperUser: v.optional(v.boolean()),
      lastActiveAt: v.optional(v.number()),
      purchasedItems: v.array(v.string()),
      purchaseCount: v.number(),
      reportCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return [];
    }
    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!myProfile?.isSuperUser) {
      return [];
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    const result: Array<{
      profileId: typeof profiles[0]["_id"];
      userId: typeof profiles[0]["userId"];
      fullName: string;
      className: string;
      role: "pending" | "gradeManager" | "admin";
      isSuperUser?: boolean;
      lastActiveAt?: number;
      purchasedItems: Array<string>;
      purchaseCount: number;
      reportCount: number;
    }> = [];

    for (const p of profiles) {
      const purchases = await ctx.db
        .query("userPurchases")
        .withIndex("by_userId", (q) => q.eq("userId", p.userId))
        .collect();
      const purchaseDates = purchases.map((x) => x.purchaseDate);

      const purchasedItemNames = new Set<string>();
      for (const purchase of purchases) {
        const item = await ctx.db.get(purchase.itemId);
        if (item?.name) {
          purchasedItemNames.add(item.name);
        }
      }

      const violations = await ctx.db
        .query("violations")
        .withIndex("by_reporterId", (q) => q.eq("reporterId", p.userId))
        .collect();
      const reportCount = violations.length;
      const latestViolationAt =
        violations.length > 0
          ? Math.max(...violations.map((v) => v._creationTime))
          : undefined;

      const lastActiveCandidates = [
        p._creationTime,
        latestViolationAt,
        ...purchaseDates,
      ].filter((x): x is number => typeof x === "number");
      const lastActiveAt =
        lastActiveCandidates.length > 0
          ? Math.max(...lastActiveCandidates)
          : undefined;

      result.push({
        profileId: p._id,
        userId: p.userId,
        fullName: p.fullName,
        className: p.className,
        role: p.role,
        isSuperUser: p.isSuperUser,
        lastActiveAt,
        purchasedItems: Array.from(purchasedItemNames),
        purchaseCount: purchases.length,
        reportCount,
      });
    }
    return result;
  },
});

export const deleteUserProfile = mutation({
  args: {
    profileId: v.id("userProfiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.getMyProfile);
    if (!me || (me.role !== "admin" && !me.isSuperUser)) {
      throw new Error("Không có quyền.");
    }

    const target = await ctx.db.get(args.profileId);
    if (!target) {
      throw new Error("Không tìm thấy hồ sơ user.");
    }

    if (target.userId === me.userId) {
      throw new Error("Không thể tự xóa hồ sơ của chính mình.");
    }

    const violationsByTarget = await ctx.db
      .query("violations")
      .withIndex("by_reporterId", (q) => q.eq("reporterId", target.userId))
      .collect();
    if (violationsByTarget.length > 0) {
      throw new Error(
        "User đã có dữ liệu báo cáo, không thể xóa hồ sơ để tránh mất liên kết."
      );
    }

    const pointsRows = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", target.userId))
      .collect();
    for (const row of pointsRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(target._id);
    return null;
  },
});

export const migrateUserDataAndDeleteProfile = mutation({
  args: {
    fromProfileId: v.id("userProfiles"),
    toProfileId: v.id("userProfiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.getMyProfile);
    if (!me || (me.role !== "admin" && !me.isSuperUser)) {
      throw new Error("Không có quyền.");
    }

    if (args.fromProfileId === args.toProfileId) {
      throw new Error("Tài khoản nguồn và đích không được trùng nhau.");
    }

    const fromProfile = await ctx.db.get(args.fromProfileId);
    const toProfile = await ctx.db.get(args.toProfileId);
    if (!fromProfile || !toProfile) {
      throw new Error("Không tìm thấy hồ sơ nguồn hoặc đích.");
    }

    if (fromProfile.userId === me.userId) {
      throw new Error("Không thể migrate từ chính tài khoản đang đăng nhập.");
    }

    // 1) Move violation ownership
    const sourceViolations = await ctx.db
      .query("violations")
      .withIndex("by_reporterId", (q) =>
        q.eq("reporterId", fromProfile.userId)
      )
      .collect();
    for (const row of sourceViolations) {
      await ctx.db.patch(row._id, { reporterId: toProfile.userId });
    }

    // 2) Merge reporting points
    const fromPointsRows = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", fromProfile.userId))
      .collect();
    const toPointsRows = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", toProfile.userId))
      .collect();

    const fromPoints = fromPointsRows.reduce((acc, r) => acc + r.points, 0);
    const fromReports = fromPointsRows.reduce(
      (acc, r) => acc + r.totalReports,
      0
    );
    const toPoints = toPointsRows.reduce((acc, r) => acc + r.points, 0);
    const toReports = toPointsRows.reduce(
      (acc, r) => acc + r.totalReports,
      0
    );

    if (toPointsRows.length > 0) {
      const targetRow = toPointsRows[0];
      await ctx.db.patch(targetRow._id, {
        points: toPoints + fromPoints,
        totalReports: toReports + fromReports,
      });
      for (const extra of toPointsRows.slice(1)) {
        await ctx.db.delete(extra._id);
      }
    } else if (fromPoints > 0 || fromReports > 0) {
      await ctx.db.insert("reportingPoints", {
        userId: toProfile.userId,
        points: fromPoints,
        totalReports: fromReports,
      });
    }

    for (const row of fromPointsRows) {
      await ctx.db.delete(row._id);
    }

    // 3) Move user purchases
    const fromPurchases = await ctx.db
      .query("userPurchases")
      .withIndex("by_userId", (q) => q.eq("userId", fromProfile.userId))
      .collect();
    for (const p of fromPurchases) {
      await ctx.db.patch(p._id, { userId: toProfile.userId });
    }

    // 3.5) Move violation logs ownership
    const sourceLogs = await ctx.db
      .query("violationLogs")
      .filter((q) => q.eq(q.field("editorUserId"), fromProfile.userId))
      .collect();
    for (const log of sourceLogs) {
      await ctx.db.patch(log._id, { editorUserId: toProfile.userId });
    }

    // 4) Delete source profile
    await ctx.db.delete(fromProfile._id);
    return null;
  },
});

export const searchStudents = query({
  args: {
    q: v.string(),
  },
  returns: v.array(
    v.object({
      fullName: v.string(),
      className: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const normQ = args.q.trim().toLowerCase();
    if (!normQ) {
      return [];
    }

    const classRegex = /\b(1[0-2][a-z]\d{1,2})\b/i;
    const classMatch = normQ.match(classRegex);

    let classNameFilter: string | undefined;
    let nameQuery = normQ;

    if (classMatch) {
      classNameFilter = classMatch[0].toUpperCase();
      nameQuery = nameQuery.replace(classMatch[0], "").trim();
    }

    let rows = await ctx.db.query("studentRoster").collect();

    if (classNameFilter) {
      const classKey = classNameFilter.replace(/\s+/g, "");
      rows = rows.filter(
        (r) => r.className.toUpperCase().replace(/\s+/g, "") === classKey
      );
    }

    if (nameQuery) {
      const searchTerms = nameQuery.split(/\s+/).filter(Boolean);
      rows = rows.filter((r) => {
        const fullNameLower = r.fullName.toLowerCase();
        return searchTerms.every((term) => fullNameLower.includes(term));
      });
    }

    const results = rows.slice(0, 10);
    return results.map((r) => ({
      fullName: r.fullName,
      className: r.className,
    }));
  },
});

export const listRoster = query({
  args: {},
  returns: v.array(
    v.object({
      className: v.string(),
      students: v.array(v.string()),
    })
  ),
  handler: async (ctx) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      return [] as Array<{ className: string; students: Array<string> }>;
    }
    const rows = await ctx.db.query("studentRoster").collect();
    const map = new Map<string, Array<string>>();
    for (const r of rows) {
      const key = r.className.toUpperCase().replace(/\s+/g, "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r.fullName);
    }
    const result: Array<{ className: string; students: Array<string> }> = [];
    for (const [className, students] of map) {
      students.sort((a, b) => a.localeCompare(b, "vi"));
      result.push({ className, students });
    }
    result.sort((a, b) => a.className.localeCompare(b.className, "vi"));
    return result;
  },
});

export const getSetting = query({
  args: { key: v.string() },
  returns: v.union(v.string(), v.number(), v.boolean(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.value ?? null;
  },
});

export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await ctx.runQuery(api.users.getMyProfile);
    if (me?.role !== "admin") throw new Error("Không có quyền.");
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }
    return null;
  },
});

export const switchRole = mutation({
  args: {},
  returns: v.union(v.literal("admin"), v.literal("gradeManager")),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Bạn phải đăng nhập để thực hiện hành động này.");
    }

    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!myProfile || !myProfile.isSuperUser) {
      throw new Error("Không có quyền truy cập.");
    }

    const newRole = myProfile.role === "admin" ? "gradeManager" : "admin";

    await ctx.db.patch(myProfile._id, { role: newRole });

    return newRole;
  },
});

export const checkAndIncrementAiRequest = mutation({
  args: {},
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId)
      return { allowed: false, remaining: 0, error: "Chưa đăng nhập" };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile)
      return { allowed: false, remaining: 0, error: "Không tìm thấy hồ sơ" };

    if (profile.isSuperUser) {
      return { allowed: true, remaining: 999 };
    }

    const today = new Date();
    today.setUTCHours(today.getUTCHours() + 7); // GMT+7
    const todayStr = today.toISOString().split("T")[0];

    let count = profile.aiRequestCount || 0;
    if (profile.lastAiRequestDate !== todayStr) {
      count = 0;
    }

    if (count >= 5) {
      return {
        allowed: false,
        remaining: 0,
        error:
          "Bạn đã hết lượt dùng AI hôm nay (tối đa 5 lượt/ngày). Lượt dùng sẽ được reset vào 0h.",
      };
    }

    await ctx.db.patch(profile._id, {
      aiRequestCount: count + 1,
      lastAiRequestDate: todayStr,
    });

    return { allowed: true, remaining: 5 - (count + 1) };
  },
});

export const getAiRequestStatus = query({
  args: {},
  returns: v.object({
    count: v.number(),
    remaining: v.number(),
    isSuperUser: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return { count: 0, remaining: 0, isSuperUser: false };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return { count: 0, remaining: 0, isSuperUser: false };

    if (profile.isSuperUser) {
      return { count: 0, remaining: 999, isSuperUser: true };
    }

    const today = new Date();
    today.setUTCHours(today.getUTCHours() + 7);
    const todayStr = today.toISOString().split("T")[0];

    let count = profile.aiRequestCount || 0;
    if (profile.lastAiRequestDate !== todayStr) {
      count = 0;
    }

    return { count, remaining: Math.max(0, 5 - count), isSuperUser: false };
  },
});

export const syncBetterAuthUser = mutation({
  args: {
    betterAuthId: v.string(),
    username: v.string(),
    email: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_betterAuthId", (q) =>
        q.eq("betterAuthId", args.betterAuthId)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      betterAuthId: args.betterAuthId,
      username: args.username,
      email: args.email,
    });
  },
});

export const reassignAuthAccount = mutation({
  args: {
    targetProfileId: v.id("userProfiles"),
    newBetterAuthId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const callerId = await getUserId(ctx);
    if (!callerId) throw new Error("Không có quyền truy cập.");
    const callerProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (callerProfile?.role !== "admin") throw new Error("Không có quyền truy cập.");

    const newUser = await ctx.db
      .query("users")
      .withIndex("by_betterAuthId", (q) =>
        q.eq("betterAuthId", args.newBetterAuthId)
      )
      .unique();
    if (!newUser) throw new Error("Không tìm thấy tài khoản Better Auth.");

    // Check if this betterAuthId is already linked to a different profile
    const existingLink = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", newUser._id))
      .unique();
    if (existingLink && existingLink._id !== args.targetProfileId) {
      throw new Error(
        `Tài khoản này đã được liên kết với hồ sơ khác: ${existingLink._id}`
      );
    }

    await ctx.db.patch(args.targetProfileId, { userId: newUser._id });
    return null;
  },
});

export const getUsersByBetterAuthIds = query({
  args: { betterAuthIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      betterAuthId: v.optional(v.string()),
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      tokenIdentifier: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.betterAuthIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_betterAuthId", (q) => q.eq("betterAuthId", id))
        .unique();
      if (user) results.push(user);
    }
    return results;
  },
});

export const checkUserHasBetterAuth = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return !!(user && user.betterAuthId);
  },
});
