import { VIOLATION_CATEGORIES } from "./violationPoints";
import { v } from "convex/values";
import { mutation, query, QueryCtx, internalMutation, internalQuery, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const ATTENDANCE_VIOLATIONS = [
  "Nghỉ học có phép",
  "Đi học muộn có phép",
  "Đi học muộn/nghỉ học không phép",
];

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

  const isAttendanceViolation =
    args.targetType === "student" &&
    ATTENDANCE_VIOLATIONS.includes(args.violationType);

  let query = ctx.db
    .query("violations")
    .withIndex("by_violatingClass", (q) =>
      q.eq("violatingClass", args.violatingClass)
    )
    .filter((q) => {
      const dateFilter = q.and(
        q.gte(q.field("violationDate"), startOfDay.getTime()),
        q.lte(q.field("violationDate"), endOfDay.getTime())
      );

      if (isAttendanceViolation) {
        return q.and(
          dateFilter,
          q.or(
            ...ATTENDANCE_VIOLATIONS.map((v) =>
              q.eq(q.field("violationType"), v)
            )
          )
        );
      }

      // Original logic
      return q.and(
        dateFilter,
        q.eq(q.field("violationType"), args.violationType)
      );
    });

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
    evidenceFileIds: v.optional(v.array(v.id("_storage"))), // Keep for backward compatibility
    evidenceR2Keys: v.optional(v.array(v.string())), // New field for R2 keys
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
        throw new Error(`Lỗi trùng lặp: ${target} đã có vi phạm '${duplicate.violationType}' trong ngày, không thể thêm '${args.violationType}'.`);
    }

    const violationId = await ctx.db.insert("violations", {
      reporterId: userId,
      status: "reported",
      grade,
      ...args,
      violatingClass: upperNoSpace,
    });
    
    // Handle legacy Convex storage files
    if (args.evidenceFileIds && args.evidenceFileIds.length > 0) {
      for (const fileId of args.evidenceFileIds) {
        await ctx.db.insert('storedFiles', { storageId: fileId, kind: 'evidence', timestamp: Date.now() });
      }
    }
    
    // R2 keys are stored directly in the violation record, no need for separate tracking
  },
});

export type ViolationWithDetails = Doc<"violations"> & {
    reporterName: string;
    evidenceUrls: (string | null)[];
    points: number;
};

async function resolveViolationDetails(ctx: QueryCtx, v: Doc<"violations">): Promise<ViolationWithDetails> {
    const reporterProfile = await ctx.db.query('userProfiles').withIndex('by_userId', q => q.eq('userId', v.reporterId)).unique();
    
    // Get evidence URLs from both Convex storage (legacy) and R2
    const evidenceUrls: (string | null)[] = [];
    
    // Legacy Convex storage URLs
    if (v.evidenceFileIds && v.evidenceFileIds.length > 0) {
        const convexUrls = await Promise.all(v.evidenceFileIds.map(fileId => ctx.storage.getUrl(fileId)));
        evidenceUrls.push(...convexUrls);
    }
    
    // R2 URLs
    if (v.evidenceR2Keys && v.evidenceR2Keys.length > 0) {
        const r2Urls = await Promise.all(v.evidenceR2Keys.map(async (key) => {
            try {
                return await ctx.runQuery(api.r2.getR2PublicUrl, { key });
            } catch (error) {
                console.error("Error getting R2 URL for key:", key, error);
                return null;
            }
        }));
        evidenceUrls.push(...r2Urls);
    }

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

// Internal mutation to delete violation from database
export const deleteViolationFromDb = internalMutation({
    args: { 
        violationId: v.id("violations"),
        evidenceFileIds: v.optional(v.array(v.id("_storage"))),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Delete legacy Convex storage files
        if (args.evidenceFileIds && args.evidenceFileIds.length > 0) {
            await Promise.all(args.evidenceFileIds.map(fileId => ctx.storage.delete(fileId)));
        }
        
        await ctx.db.delete(args.violationId);
        return null;
    }
});

// Public action to delete violation and all its evidence
export const deleteViolation = action({
    args: { violationId: v.id("violations") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== 'admin') {
            throw new Error("Bạn không có quyền thực hiện hành động này.");
        }
        
        const violation = await ctx.runQuery(internal.violations.getViolationById, { 
            violationId: args.violationId 
        });
        
        if (!violation) {
            throw new Error("Không tìm thấy vi phạm.");
        }
        
        // Delete R2 evidence files
        if (violation.evidenceR2Keys && violation.evidenceR2Keys.length > 0) {
            await Promise.all(violation.evidenceR2Keys.map(key => 
                ctx.runAction(internal.r2Actions.deleteR2Object, { key })
            ));
        }

        // Delete violation from database (including legacy Convex storage files)
        await ctx.runMutation(internal.violations.deleteViolationFromDb, { 
            violationId: args.violationId,
            evidenceFileIds: violation.evidenceFileIds,
        });
        
        return null;
    }
});

// Internal query to get violation by ID
export const getViolationById = internalQuery({
    args: { violationId: v.id("violations") },
    returns: v.union(
        v.object({
            _id: v.id("violations"),
            _creationTime: v.number(),
            reporterId: v.id("users"),
            targetType: v.union(v.literal("student"), v.literal("class")),
            studentName: v.optional(v.string()),
            violatingClass: v.string(),
            violationDate: v.number(),
            violationType: v.string(),
            details: v.optional(v.string()),
            evidenceFileIds: v.optional(v.array(v.id("_storage"))),
            evidenceR2Keys: v.optional(v.array(v.string())),
            status: v.union(
                v.literal("reported"),
                v.literal("appealed"),
                v.literal("resolved"),
                v.literal("pending")
            ),
            appealReason: v.optional(v.string()),
            grade: v.number(),
            requesterName: v.optional(v.string()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        return await ctx.db.get(args.violationId);
    }
});

export const getPublicEmulationScores = query({
    args: {
        start: v.optional(v.number()),
        end: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let startTime, endTime;

        if (args.start && args.end) {
            startTime = args.start;
            endTime = args.end;
        } else {
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            startTime = startOfWeek.getTime();
            endTime = endOfWeek.getTime();
        }

        const violations = await ctx.db
            .query("violations")
            .filter(q => q.and(
                q.gte(q.field("violationDate"), startTime),
                q.lte(q.field("violationDate"), endTime)
            ))
            .collect();
        
        const reporterUserIds = [...new Set(violations.map(v => v.reporterId))];
        const reporterProfiles = await Promise.all(
            reporterUserIds.map(userId => 
                ctx.db.query('userProfiles').withIndex('by_userId', q => q.eq('userId', userId)).unique()
            )
        );

        const reporterProfileMap = new Map();
        reporterProfiles.forEach(profile => {
            if (profile) { reporterProfileMap.set(profile.userId, profile); }
        });
        
        const violationPointsMap = new Map<string, number>();
        VIOLATION_CATEGORIES.forEach(category => {
            category.violations.forEach(violationName => {
                violationPointsMap.set(violationName, category.points);
            });
        });

        const scoresByClass: Record<string, { totalPoints: number; violations: any[] }> = {};
        for (const v of violations) {
            const points = violationPointsMap.get(v.violationType) ?? 0;
            const reporterProfile = reporterProfileMap.get(v.reporterId);
            const detailedViolation = { ...v, reporterName: reporterProfile?.fullName ?? 'Không rõ', points: points };
            if (!scoresByClass[v.violatingClass]) {
                scoresByClass[v.violatingClass] = { totalPoints: 0, violations: [] };
            }
            scoresByClass[v.violatingClass].totalPoints += points;
            scoresByClass[v.violatingClass].violations.push(detailedViolation);
        }
        
        const allClasses = await ctx.db.query("classes").collect();
        const allClassNames = allClasses.map(c => c.name);
        allClassNames.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

        const emulationScores = allClassNames.map(className => {
            if (scoresByClass[className]) {
                return {
                    className,
                    totalPoints: scoresByClass[className].totalPoints,
                    violations: scoresByClass[className].violations,
                };
            } else {
                return {
                    className,
                    totalPoints: 0,
                    violations: [],
                };
            }
        });

        return emulationScores;
    }
});

export const getPublicViolations = query({
    args: {
        start: v.optional(v.number()),
        end: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let startTime, endTime;
        if (args.start && args.end) {
            startTime = args.start;
            endTime = args.end;
        } else {
            const now = new Date();
            const startOfWeekDate = new Date(now.setDate(now.getDate() - now.getDay() + 1));
            startOfWeekDate.setHours(0, 0, 0, 0);
            const endOfWeekDate = new Date(startOfWeekDate);
            endOfWeekDate.setDate(endOfWeekDate.getDate() + 6);
            endOfWeekDate.setHours(23, 59, 59, 999);
            startTime = startOfWeekDate.getTime();
            endTime = endOfWeekDate.getTime();
        }

        const violations = await ctx.db
            .query("violations")
            .filter(q => q.and(
                q.gte(q.field("violationDate"), startTime),
                q.lte(q.field("violationDate"), endTime)
            ))
            .order("desc")
            .collect();

        const reporterUserIds = [...new Set(violations.map(v => v.reporterId))];
        const reporterProfiles = await Promise.all(
            reporterUserIds.map(userId => 
                ctx.db.query('userProfiles').withIndex('by_userId', q => q.eq('userId', userId)).unique()
            )
        );

        const reporterProfileMap = new Map();
        reporterProfiles.forEach(profile => {
            if (profile) { reporterProfileMap.set(profile.userId, profile.fullName); }
        });

        const violationPointsMap = new Map<string, number>();
        VIOLATION_CATEGORIES.forEach(category => {
            category.violations.forEach(violationName => {
                violationPointsMap.set(violationName, category.points);
            });
        });

        const detailedViolations = await Promise.all(violations.map(async v => {
            // Get evidence URLs from both Convex storage (legacy) and R2
            const evidenceUrls: (string | null)[] = [];
            
            // Legacy Convex storage URLs
            if (v.evidenceFileIds && v.evidenceFileIds.length > 0) {
                const convexUrls = await Promise.all(v.evidenceFileIds.map(fileId => ctx.storage.getUrl(fileId)));
                evidenceUrls.push(...convexUrls);
            }
            
            // R2 URLs
            if (v.evidenceR2Keys && v.evidenceR2Keys.length > 0) {
                const r2Urls = await Promise.all(v.evidenceR2Keys.map(async (key) => {
                    try {
                        return await ctx.runQuery(api.r2.getR2PublicUrl, { key });
                    } catch (error) {
                        console.error("Error getting R2 URL for key:", key, error);
                        return null;
                    }
                }));
                evidenceUrls.push(...r2Urls);
            }
            
            return {
                ...v,
                reporterName: reporterProfileMap.get(v.reporterId) ?? 'Không rõ',
                evidenceUrls,
                points: violationPointsMap.get(v.violationType) ?? 0,
            };
        }));

        return detailedViolations.sort((a, b) => {
            const classCompare = a.violatingClass.localeCompare(b.violatingClass, 'vi', { numeric: true });
            if (classCompare !== 0) {
                return classCompare;
            }
            return b.violationDate - a.violationDate;
        });
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
    violations: v.array(
      v.object({
        studentName: v.optional(v.string()),
        violatingClass: v.string(),
        violationType: v.string(),
        details: v.optional(v.string()),
        targetType: v.union(v.literal("student"), v.literal("class")),
        evidenceFileIds: v.optional(v.array(v.id("_storage"))), // Keep for backward compatibility
        evidenceR2Keys: v.optional(v.array(v.string())), // New field for R2 keys
      })
    ),
    customDate: v.optional(v.number()),
    customReporterId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }

    const myProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!myProfile || myProfile.role === "pending") {
      throw new Error("You do not have permission to report violations.");
    }

    // Check if user is superUser for custom reporter override
    const reporterId = (myProfile.isSuperUser && args.customReporterId) 
      ? args.customReporterId 
      : userId;

    const duplicates: string[] = [];
    let successCount = 0;
    const violationDate = args.customDate ?? Date.now();

    for (const v of args.violations) {
      const isDuplicate = await checkForDuplicate(ctx, {
        violationDate,
        violationType: v.violationType,
        violatingClass: v.violatingClass,
        studentName: v.studentName,
        targetType: v.targetType,
      });

      if (isDuplicate) {
        duplicates.push(
          `${v.studentName || v.violatingClass}: ${v.violationType}`
        );
      } else {
        const violationPointsMap = new Map<string, number>();
        VIOLATION_CATEGORIES.forEach(category => {
            category.violations.forEach(violationName => {
                violationPointsMap.set(violationName, category.points);
            });
        });
        const points = violationPointsMap.get(v.violationType) ?? 0;

        const rawClass = (v.violatingClass || '').trim();
        const upperNoSpace = rawClass.toUpperCase().replace(/\s+/g, '');
        const classMatch = upperNoSpace.match(/^(10|11|12)[A-Z]\d{1,2}$/);
        if (!classMatch) {
          // Skip invalid class names in bulk upload
          continue;
        }
        const grade = parseInt(classMatch[1], 10);

        await ctx.db.insert("violations", {
          reporterId: reporterId,
          violationDate,
          violationType: v.violationType,
          details: v.details,
          studentName: v.studentName,
          violatingClass: upperNoSpace,
          grade,
          targetType: v.targetType,
          evidenceFileIds: v.evidenceFileIds, // Legacy Convex storage
          evidenceR2Keys: v.evidenceR2Keys, // New R2 storage
          status: "reported",
        });
        successCount++;
      }
    }

    return {
      successCount,
      duplicateCount: duplicates.length,
      duplicates,
    };
  },
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

export const populateClassesTable = internalMutation({
  handler: async (ctx) => {
    const allStudentDocs = await ctx.db.query("studentRoster").collect();
    const allClassNames = [...new Set(allStudentDocs.map(s => s.className))];

    const existingClasses = await ctx.db.query("classes").collect();
    for (const cls of existingClasses) {
      await ctx.db.delete(cls._id);
    }
    
    for (const className of allClassNames) {
      const existing = await ctx.db.query("classes").withIndex("by_name", q => q.eq("name", className)).unique();
      if (!existing) {
        await ctx.db.insert("classes", { name: className });
      }
    }
    console.log(`Đã điền xong ${allClassNames.length} lớp vào bảng 'classes'.`);
  },
});