import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getUserId } from "./lib/auth";

// ---------------------------------------------------------------------------
// Helper: School Year Resolver (V8-safe, no Node built-ins needed)
// ---------------------------------------------------------------------------

/**
 * Resolves the Vietnamese school year label for a given date.
 * Uses UTC+7 (Asia/Ho_Chi_Minh) offset.
 * - Months 9–12 → "{year}-{year+1}"
 * - Months 1–8  → "{year-1}-{year}"
 */
export function resolveSchoolYear(date: Date): string {
  const utcPlus7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const month = utcPlus7.getUTCMonth() + 1; // 1-12
  const year = utcPlus7.getUTCFullYear();
  if (month >= 9) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

// ---------------------------------------------------------------------------
// Internal Query – collect all data for archive
// ---------------------------------------------------------------------------

export const getAllDataForArchive = internalQuery({
  args: {},
  returns: v.object({
    violations: v.array(v.any()),
    violationLogs: v.array(v.any()),
    userProfiles: v.array(v.any()),
    users: v.array(
      v.object({ _id: v.string(), username: v.optional(v.string()) })
    ),
    studentRoster: v.array(v.any()),
    classes: v.array(v.any()),
    settings: v.array(v.any()),
    reportingPoints: v.array(v.any()),
  }),
  handler: async (ctx) => {
    const [
      violations,
      violationLogs,
      userProfiles,
      allUsers,
      studentRoster,
      classes,
      settings,
      reportingPoints,
    ] = await Promise.all([
      ctx.db.query("violations").collect(),
      ctx.db.query("violationLogs").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("studentRoster").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("settings").collect(),
      ctx.db.query("reportingPoints").collect(),
    ]);

    // Only expose _id and username for users – no betterAuthId, tokenIdentifier, email
    const users = allUsers.map((u) => ({
      _id: u._id as string,
      username: u.username,
    }));

    return {
      violations,
      violationLogs,
      userProfiles,
      users,
      studentRoster,
      classes,
      settings,
      reportingPoints,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal Mutations – update archive job status
// ---------------------------------------------------------------------------

export const startArchiveJob = internalMutation({
  args: { jobId: v.id("archiveJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, { status: "processing" });
    return null;
  },
});

export const completeArchiveJob = internalMutation({
  args: {
    jobId: v.id("archiveJobs"),
    downloadUrl: v.string(),
    totalViolations: v.number(),
    totalEvidenceFiles: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      downloadUrl: args.downloadUrl,
      totalViolations: args.totalViolations,
      totalEvidenceFiles: args.totalEvidenceFiles,
    });
    return null;
  },
});

export const failArchiveJob = internalMutation({
  args: { jobId: v.id("archiveJobs"), errorMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, errorMessage }) => {
    await ctx.db.patch(jobId, { status: "failed", errorMessage });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Public Mutation – create a new archive job (admin only)
// ---------------------------------------------------------------------------

export const createArchiveJob = mutation({
  args: {},
  returns: v.id("archiveJobs"),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("Không có quyền");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") {
      throw new Error("Không có quyền");
    }

    const schoolYear = resolveSchoolYear(new Date());

    const jobId = await ctx.db.insert("archiveJobs", {
      schoolYear,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.archiveActions.buildArchiveZip,
      { jobId }
    );

    return jobId;
  },
});

// ---------------------------------------------------------------------------
// Public Mutation – delete an archive job (admin only)
// ---------------------------------------------------------------------------

export const deleteArchiveJob = mutation({
  args: { jobId: v.id("archiveJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Không có quyền");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "admin") throw new Error("Không có quyền");

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Không tìm thấy archive job");

    await ctx.db.delete(jobId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Public Query – list the 10 most recent archive jobs
// ---------------------------------------------------------------------------

export const listArchiveJobs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("archiveJobs"),
      _creationTime: v.number(),
      schoolYear: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      createdAt: v.number(),
      downloadUrl: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      totalViolations: v.optional(v.number()),
      totalEvidenceFiles: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("archiveJobs").order("desc").take(10);
  },
});
