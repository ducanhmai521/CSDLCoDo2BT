import { VIOLATION_CATEGORIES } from "./violationPoints";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

async function checkForDuplicate(
  ctx: QueryCtx,
  args: {
    violationDate: number;
    violationType: string;
    violatingClass: string;
    studentName?: string;
    targetType: "student" | "class";
  }
) {
  const startOfDay = new Date(args.violationDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(args.violationDate);
  endOfDay.setHours(23, 59, 59, 999);

  let query = ctx.db
    .query("violations")
    .withIndex("by_violatingClass", (q) =>
      q.eq("violatingClass", args.violatingClass)
    )
    .filter((q) =>
      q.and(
        q.gte(q.field("violationDate"), startOfDay.getTime()),
        q.lte(q.field("violationDate"), endOfDay.getTime()),
        q.eq(q.field("violationType"), args.violationType)
      )
    );

  if (args.targetType === "student" && args.studentName) {
    query = query.filter((q) => q.eq(q.field("studentName"), args.studentName));
  } else {
    query = query.filter((q) => q.eq(q.field("targetType"), "class"));
  }

  const existing = await query.first();
  return existing;
}

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const reportViolation = mutation({
  args: {
    targetType: v.union(v.literal("student"), v.literal("class")),
    studentName: v.optional(v.string()),
    violatingClass: v.string(),
    violationDate: v.number(),
    violationType: v.string(),
    details: v.string(),
    evidenceFileIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Bạn phải đăng nhập để báo cáo vi phạm.");
    }

    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!myProfile || myProfile.role === "pending") {
      throw new Error("Bạn không có quyền báo cáo vi phạm.");
    }

    const rawClass = (args.violatingClass || '').trim();
    const upperNoSpace = rawClass.toUpperCase().replace(/\s+/g, '');
    const classMatch = upperNoSpace.match(/^(10|11|12)[A-Z]\d{1,2}$/);
    if (!classMatch) {
      throw new Error("Tên lớp vi phạm không hợp lệ. Ví dụ: 10A1, 11A2, 12B3.");
    }
    const grade = parseInt(classMatch[1], 10);

    const duplicate = await checkForDuplicate(ctx, { ...args, violatingClass: upperNoSpace });
    if (duplicate) {
        const target = args.targetType === 'student' ? args.studentName : `Lớp ${args.violatingClass}`;
        throw new Error(`Lỗi trùng lặp: ${target} đã có vi phạm '${args.violationType}' trong ngày.`);
    }

    const violationId = await ctx.db.insert("violations", {
      reporterId: userId,
      status: "reported",
      grade,
      ...args,
      violatingClass: upperNoSpace,
    });
    if (args.evidenceFileIds && args.evidenceFileIds.length > 0) {
      for (const fileId of args.evidenceFileIds) {
        await ctx.db.insert('storedFiles', { storageId: fileId, kind: 'evidence', timestamp: Date.now() });
      }
    }
  },
});

export type ViolationWithDetails = Doc<"violations"> & {
    reporterName: string;
    evidenceUrls: (string | null)[];
    points: number;
};

async function resolveViolationDetails(ctx: QueryCtx, v: Doc<"violations">): Promise<ViolationWithDetails> {
    const reporterProfile = await ctx.db.query('userProfiles').withIndex('by_userId', q => q.eq('userId', v.reporterId)).unique();
    const evidenceUrls = v.evidenceFileIds ? await Promise.all(v.evidenceFileIds.map(fileId => ctx.storage.getUrl(fileId))) : [];

    const violationPointsMap = new Map<string, number>();
    VIOLATION_CATEGORIES.forEach(category => {
        category.violations.forEach(violationName => {
            violationPointsMap.set(violationName, category.points);
        });
    });
    const points = violationPointsMap.get(v.violationType) ?? 0;

    return {
        ...v,
        reporterName: reporterProfile?.fullName ?? 'Không rõ',
        evidenceUrls,
        points,
    }
}

export const getViolationsForGradeManager = query({
    args: {},
    handler: async (ctx): Promise<ViolationWithDetails[]> => {
        const myProfile: Doc<"userProfiles"> | null = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'gradeManager') {
            return [];
        }

        const violations = await ctx.db
            .query("violations")
            .withIndex("by_grade", q => q.eq("grade", myProfile.grade))
            .order("desc")
            .take(50);
        
        return Promise.all(violations.map(v => resolveViolationDetails(ctx, v)));
    }
});

export const appealViolation = mutation({
    args: {
        violationId: v.id("violations"),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        const violation = await ctx.db.get(args.violationId);

        if (!violation) {
            throw new Error("Không tìm thấy vi phạm.");
        }
        if (myProfile?.role !== 'gradeManager' || myProfile.grade !== violation.grade) {
            throw new Error("Bạn không có quyền kháng cáo vi phạm này.");
        }
        if (violation.status !== 'reported') {
            throw new Error("Chỉ có thể kháng cáo các vi phạm chưa được xử lý.");
        }

        await ctx.db.patch(args.violationId, {
            status: "appealed",
            appealReason: args.reason,
        });
    }
});

export const getAllViolationsForAdmin = query({
    args: {
        grade: v.optional(v.number()),
        className: v.optional(v.string()),
        dateRange: v.optional(v.object({ start: v.number(), end: v.number() })),
        targetType: v.optional(v.union(v.literal("student"), v.literal("class"))),
    },
    handler: async (ctx, args): Promise<ViolationWithDetails[]> => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            return [];
        }

        let query = ctx.db.query("violations").order("desc");

        if (args.className) {
            query = ctx.db.query("violations").withIndex("by_violatingClass", q => q.eq("violatingClass", args.className!)).order("desc");
        } else if (args.grade) {
            query = ctx.db.query("violations").withIndex("by_grade", q => q.eq("grade", args.grade!)).order("desc");
        }
        
        let violations = await query.collect();

        if (args.className && args.grade) {
            violations = violations.filter(v => v.grade === args.grade);
        }

        let filteredViolations = violations;

        if (args.dateRange) {
            filteredViolations = filteredViolations.filter(v => v.violationDate >= args.dateRange!.start && v.violationDate <= args.dateRange!.end);
        }
        if (args.targetType) {
            filteredViolations = filteredViolations.filter(v => v.targetType === args.targetType);
        }

        return Promise.all(filteredViolations.map(v => resolveViolationDetails(ctx, v)));
    }
});

export const resolveViolation = mutation({
    args: {
        violationId: v.id("violations"),
    },
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            throw new Error("Bạn không có quyền thực hiện hành động này.");
        }
        await ctx.db.patch(args.violationId, { status: "resolved" });
    }
});

export const deleteViolation = mutation({
    args: { violationId: v.id("violations") },
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            throw new Error("Bạn không có quyền thực hiện hành động này.");
        }
        
        const violation = await ctx.db.get(args.violationId);
        if (violation?.evidenceFileIds) {
            await Promise.all(violation.evidenceFileIds.map(fileId => ctx.storage.delete(fileId)));
        }

        await ctx.db.delete(args.violationId);
    }
});

export const getEmulationScores = query({
    args: {
        dateRange: v.optional(v.object({ start: v.number(), end: v.number() })),
    },
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            return [];
        }

        let violations = await ctx.db.query("violations").order("desc").collect();

        if (args.dateRange) {
            violations = violations.filter(v => v.violationDate >= args.dateRange!.start && v.violationDate <= args.dateRange!.end);
        }

        const violationPointsMap = new Map<string, number>();
        VIOLATION_CATEGORIES.forEach(category => {
            category.violations.forEach(violationName => {
                violationPointsMap.set(violationName, category.points);
            });
        });

        const classScores: Record<string, { totalPoints: number, violations: ViolationWithDetails[] }> = {};

        const detailedViolations = await Promise.all(violations.map(v => resolveViolationDetails(ctx, v)));

        for (const v of detailedViolations) {
            const points = violationPointsMap.get(v.violationType) ?? 0;
            if (!classScores[v.violatingClass]) {
                classScores[v.violatingClass] = { totalPoints: 0, violations: [] };
            }
            classScores[v.violatingClass].totalPoints += points;
            classScores[v.violatingClass].violations.push(v);
        }

        return Object.entries(classScores).map(([className, data]) => ({
            className,
            ...data
        })).sort((a, b) => a.className.localeCompare(b.className));
    }
});

export const editViolation = mutation({
    args: {
        violationId: v.id("violations"),
        targetType: v.optional(v.union(v.literal("student"), v.literal("class"))),
        studentName: v.optional(v.union(v.string(), v.null())),
        violatingClass: v.optional(v.string()),
        violationDate: v.optional(v.number()),
        violationType: v.optional(v.string()),
        details: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Bạn phải đăng nhập để chỉnh sửa.");
        }

        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        const violation = await ctx.db.get(args.violationId);
        if (!violation) {
            throw new Error("Không tìm thấy vi phạm.");
        }

        const isAdmin = myProfile?.role === 'admin';
        const isReporter = violation.reporterId === userId;
        if (!isAdmin && !isReporter) {
            throw new Error("Bạn không có quyền chỉnh sửa vi phạm này.");
        }

        const patch: Partial<Doc<'violations'>> = {};
        const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

        const applyField = <K extends keyof Doc<'violations'>>(field: K, value: Doc<'violations'>[K] | undefined) => {
            if (typeof value === 'undefined') return;
            const oldVal = violation[field] as unknown as string | number | null | undefined;
            const newVal = value as unknown as string | number | null | undefined;
            if (oldVal !== newVal) {
                (patch as any)[field] = value as any;
                changes.push({ field: String(field), oldValue: String(oldVal ?? ''), newValue: String(newVal ?? '') });
            }
        };

        applyField('targetType', args.targetType as any);
        applyField('studentName', (args.studentName === null ? undefined : args.studentName) as any);
        if (typeof args.violatingClass !== 'undefined') {
            const upperNoSpace = (args.violatingClass || '').toUpperCase().replace(/\s+/g, '');
            const classMatch = upperNoSpace.match(/^(10|11|12)[A-Z]\d{1,2}$/);
            if (!classMatch) {
                throw new Error('Tên lớp vi phạm không hợp lệ. Ví dụ: 10A1, 11A2, 12B3.');
            }
            applyField('violatingClass', upperNoSpace as any);
            applyField('grade', parseInt(classMatch[1], 10) as any);
        }
        applyField('violationDate', args.violationDate as any);
        applyField('violationType', args.violationType as any);
        applyField('details', args.details as any);

        if (Object.keys(patch).length === 0) {
            return;
        }

        await ctx.db.patch(args.violationId, patch);

        await ctx.db.insert('violationLogs', {
            violationId: args.violationId,
            editorUserId: userId,
            timestamp: Date.now(),
            changes,
        });
    }
});

export const getViolationLogs = query({
    args: { violationId: v.id('violations') },
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            return [];
        }
        const logs = await ctx.db
            .query('violationLogs')
            .withIndex('by_violationId', q => q.eq('violationId', args.violationId))
            .order('desc')
            .collect();
        return logs;
    }
});
export const bulkReportViolations = mutation({
    args: {
        violations: v.array(v.object({
            targetType: v.union(v.literal("student"), v.literal("class")),
            studentName: v.optional(v.string()),
            violatingClass: v.string(),
            violationType: v.string(),
            details: v.optional(v.string()),
        })),
        customDate: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
          throw new Error("Bạn phải đăng nhập để báo cáo vi phạm.");
        }

        const reportDate = args.customDate ?? Date.now();
        const results = {
            successCount: 0,
            duplicateCount: 0,
            duplicates: [] as string[],
        };

        for (const violation of args.violations) {
            if (violation.targetType === "student" && !violation.studentName) {
                throw new Error("Student name is required for student violations.");
            }
            
            const rawClass = (violation.violatingClass || '').trim();
            const upperNoSpace = rawClass.toUpperCase().replace(/\s+/g, '');
            const classMatch = upperNoSpace.match(/^(10|11|12)[A-Z]\d{1,2}$/);
            if (!classMatch) {
              throw new Error(`Tên lớp không hợp lệ: ${violation.violatingClass}`);
            }
            const grade = parseInt(classMatch[1], 10);

            const duplicate = await checkForDuplicate(ctx, {
                ...violation,
                violatingClass: upperNoSpace,
                violationDate: reportDate,
            });

            if (duplicate) {
                const target = violation.targetType === 'student' ? violation.studentName : `Lớp ${violation.violatingClass}`;
                results.duplicateCount++;
                results.duplicates.push(`${target}: ${violation.violationType}`);
                continue;
            }

            await ctx.db.insert("violations", {
                reporterId: userId,
                status: "reported",
                grade,
                targetType: violation.targetType,
                studentName: violation.studentName,
                violatingClass: upperNoSpace,
                violationDate: reportDate,
                violationType: violation.violationType,
                details: violation.details || "",
                evidenceFileIds: [], // AI-parsed violations don't have evidence files
            });
            results.successCount++;
        }
        return results;
    }
});

export const getOverviewForDate = query({
    args: {
        start: v.number(),
        end: v.number(),
    },
    handler: async (ctx, args) => {
        const violations = await ctx.db
            .query('violations')
            .order('desc')
            .collect();

        const inRange = violations.filter(v => v.violationDate >= args.start && v.violationDate <= args.end);
        const withDetails = await Promise.all(inRange.map(v => resolveViolationDetails(ctx, v)));

        const byClass: Record<string, number> = {};
        const byStudent: Record<string, number> = {};
        const byReporter: Record<string, number> = {};

        for (const v of withDetails) {
            byClass[v.violatingClass] = (byClass[v.violatingClass] || 0) + 1;
            if (v.targetType === 'student' && v.studentName) {
                byStudent[v.studentName] = (byStudent[v.studentName] || 0) + 1;
            }
            const reporter = v.reporterName || String(v.reporterId);
            byReporter[reporter] = (byReporter[reporter] || 0) + 1;
        }

        const toSortedArray = (obj: Record<string, number>) => Object.entries(obj).sort((a,b) => b[1]-a[1]).map(([key, count]) => ({ key, count }));

        const details = withDetails.map(v => ({
            _id: v._id,
            violationDate: v.violationDate,
            violatingClass: v.violatingClass,
            targetType: v.targetType,
            studentName: v.studentName,
            violationType: v.violationType,
            reporterName: v.reporterName,
        }));

        return {
            total: withDetails.length,
            byClass: toSortedArray(byClass),
            byStudent: toSortedArray(byStudent).slice(0, 50),
            byReporter: toSortedArray(byReporter).slice(0, 50),
            details: details.slice(0, 200),
        };
    }
});
