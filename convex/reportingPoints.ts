import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Add points for successful violation report (public mutation)
export const addReportingPoints = mutation({
  args: { 
    points: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.runMutation(internal.reportingPoints.addReportingPointsInternal, {
      userId,
      points: args.points,
    });
    return null;
  },
});

// Add points for successful violation report (internal)
export const addReportingPointsInternal = internalMutation({
  args: { 
    userId: v.id("users"),
    points: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        points: existing.points + args.points,
        totalReports: existing.totalReports + 1,
      });
    } else {
      await ctx.db.insert("reportingPoints", {
        userId: args.userId,
        points: args.points,
        totalReports: 1,
      });
    }
    return null;
  },
});

// Remove points when violation is deleted (internal)
export const removeReportingPointsInternal = internalMutation({
  args: { 
    userId: v.id("users"),
    points: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      const newPoints = Math.max(0, existing.points - args.points);
      const newTotalReports = Math.max(0, existing.totalReports - 1);
      
      await ctx.db.patch(existing._id, {
        points: newPoints,
        totalReports: newTotalReports,
      });
    }
    return null;
  },
});

// Get leaderboard of reporting points
export const getReportingLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    userId: v.id("users"),
    fullName: v.string(),
    className: v.string(),
    points: v.number(),
    totalReports: v.number(),
    rank: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const reportingPoints = await ctx.db
      .query("reportingPoints")
      .withIndex("by_points")
      .order("desc")
      .take(limit);

    const results = [];
    for (let i = 0; i < reportingPoints.length; i++) {
      const rp = reportingPoints[i];
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", rp.userId))
        .unique();

      if (userProfile) {
        results.push({
          userId: rp.userId,
          fullName: userProfile.fullName,
          className: userProfile.className,
          points: rp.points,
          totalReports: rp.totalReports,
          rank: i + 1,
        });
      }
    }

    return results;
  },
});

// Get current user's reporting points
export const getMyReportingPoints = query({
  args: {},
  returns: v.union(
    v.object({
      points: v.number(),
      totalReports: v.number(),
      rank: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const myPoints = await ctx.db
      .query("reportingPoints")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!myPoints) {
      return {
        points: 0,
        totalReports: 0,
        rank: 0,
      };
    }

    // Calculate rank by counting users with higher points
    const higherPointsCount = await ctx.db
      .query("reportingPoints")
      .withIndex("by_points")
      .filter((q) => q.gt(q.field("points"), myPoints.points))
      .collect();

    return {
      points: myPoints.points,
      totalReports: myPoints.totalReports,
      rank: higherPointsCount.length + 1,
    };
  },
});

// Migration script to add points for existing violations (public mutation for admin)
export const migrateExistingViolations = mutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    message: v.string(),
  }),
  handler: async (ctx): Promise<{ processed: number; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.role !== "admin") {
      throw new Error("Only admins can run migration");
    }

    return await ctx.runMutation(internal.reportingPoints.migrateExistingViolationsInternal);
  },
});

// Migration script to add points for existing violations (internal)
export const migrateExistingViolationsInternal = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    // Get all violations
    const violations = await ctx.db.query("violations").collect();
    
    // Group by reporter
    const reporterCounts = new Map<Id<"users">, number>();
    
    for (const violation of violations) {
      const currentCount = reporterCounts.get(violation.reporterId) || 0;
      reporterCounts.set(violation.reporterId, currentCount + 1);
    }

    // Update reporting points for each reporter
    for (const [userId, count] of reporterCounts) {
      const points = count * 10; // 10 points per violation
      
      const existing = await ctx.db
        .query("reportingPoints")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          points: points,
          totalReports: count,
        });
      } else {
        await ctx.db.insert("reportingPoints", {
          userId,
          points,
          totalReports: count,
        });
      }
    }

    return {
      processed: reporterCounts.size,
      message: `Đã cập nhật điểm cho ${reporterCounts.size} người báo cáo từ ${violations.length} vi phạm hiện có.`,
    };
  },
});