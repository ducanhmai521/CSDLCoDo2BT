import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const ATTENDANCE_VIOLATIONS = [
  "Nghỉ học có phép",
  "Đi học muộn có phép",
  "Đi học muộn/nghỉ học không phép",
];

/**
 * Returns the current server timestamp and time window information
 * Used by the public absence request form to ensure accurate time validation
 * All times are in Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7)
 */
export const getCurrentServerTime = query({
  args: {},
  returns: v.object({
    timestamp: v.number(),
    isBeforeMorningCutoff: v.boolean(),
    isInAfternoonWindow: v.boolean(),
    currentHour: v.number(),
    currentMinute: v.number(),
    isDebugMode: v.boolean(),
    actualIsBeforeMorningCutoff: v.optional(v.boolean()),
    actualIsInAfternoonWindow: v.optional(v.boolean()),
  }),
  handler: async (ctx) => {
    // Check if debug mode is enabled
    const debugSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isAbsentDebugging"))
      .unique();
    
    const isDebugMode = debugSetting?.value === true;
    
    // Get current time in Vietnam timezone (UTC+7)
    const now = new Date();
    
    // Get hour and minute in Vietnam timezone
    const vietnamHour = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      hour: "2-digit", 
      hour12: false 
    }));
    const vietnamMinute = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      minute: "2-digit" 
    }));
    
    // Calculate actual time windows
    const actualIsBeforeMorningCutoff = vietnamHour < 7 || (vietnamHour === 7 && vietnamMinute < 15);
    const actualIsInAfternoonWindow = vietnamHour >= 12;
    
    // Morning window: before 7:15 AM (for today)
    let isBeforeMorningCutoff = actualIsBeforeMorningCutoff;
    
    // Afternoon window: 12:00 PM to 11:59 PM (for tomorrow)
    let isInAfternoonWindow = actualIsInAfternoonWindow;
    
    // If debug mode is enabled, always allow access (simulate morning window)
    if (isDebugMode) {
      isBeforeMorningCutoff = true;
      isInAfternoonWindow = false;
    }
    
    return {
      timestamp: now.getTime(),
      isBeforeMorningCutoff,
      isInAfternoonWindow,
      currentHour: vietnamHour,
      currentMinute: vietnamMinute,
      isDebugMode,
      actualIsBeforeMorningCutoff: isDebugMode ? actualIsBeforeMorningCutoff : undefined,
      actualIsInAfternoonWindow: isDebugMode ? actualIsInAfternoonWindow : undefined,
    };
  },
});

/**
 * Debug query to test time validation with a custom time offset
 * Offset is in hours (can be negative or positive)
 * All times are in Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7)
 */
export const getDebugServerTime = query({
  args: { offsetHours: v.number() },
  returns: v.object({
    timestamp: v.number(),
    isBeforeMorningCutoff: v.boolean(),
    isInAfternoonWindow: v.boolean(),
    currentHour: v.number(),
    currentMinute: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get current time in Vietnam timezone (UTC+7) with offset
    const now = new Date();
    now.setHours(now.getHours() + args.offsetHours);
    
    // Get hour and minute in Vietnam timezone
    const vietnamHour = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      hour: "2-digit", 
      hour12: false 
    }));
    const vietnamMinute = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      minute: "2-digit" 
    }));
    
    const isBeforeMorningCutoff = vietnamHour < 7 || (vietnamHour === 7 && vietnamMinute < 15);
    const isInAfternoonWindow = vietnamHour >= 12;
    
    return {
      timestamp: now.getTime(),
      isBeforeMorningCutoff,
      isInAfternoonWindow,
      currentHour: vietnamHour,
      currentMinute: vietnamMinute,
    };
  },
});

/**
 * Check if a student already has an attendance-related violation for the given date
 */
async function checkForDuplicateAbsence(
  ctx: any,
  studentName: string,
  className: string,
  violationDate: number
): Promise<boolean> {
  const startOfDay = new Date(violationDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(violationDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await ctx.db
    .query("violations")
    .withIndex("by_violatingClass", (q: any) => q.eq("violatingClass", className))
    .filter((q: any) =>
      q.and(
        q.gte(q.field("violationDate"), startOfDay.getTime()),
        q.lte(q.field("violationDate"), endOfDay.getTime()),
        q.eq(q.field("studentName"), studentName),
        q.or(
          ...ATTENDANCE_VIOLATIONS.map((v) =>
            q.eq(q.field("violationType"), v)
          )
        )
      )
    )
    .first();

  return existing !== null;
}

/**
 * Submit a public absence request for one or more students
 * Creates violation records with type "Nghỉ học có phép" or "Đi học muộn có phép"
 * Accepts requests in two time windows:
 * - Before 7:15 AM: for today
 * - After 12:00 PM: for tomorrow
 */
export const submitPublicAbsenceRequest = mutation({
  args: {
    requesterName: v.string(),
    students: v.array(
      v.object({
        name: v.string(),
        className: v.string(),
        absenceType: v.union(
          v.literal("Nghỉ học có phép"),
          v.literal("Đi học muộn có phép")
        ),
        reason: v.string(),
        evidenceR2Keys: v.array(v.string()),
      })
    ),
  },
  returns: v.object({
    successCount: v.number(),
    skippedCount: v.number(),
    successfulStudents: v.array(v.string()),
    skippedStudents: v.array(
      v.object({
        name: v.string(),
        className: v.string(),
        reason: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Check if debug mode is enabled
    const debugSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isAbsentDebugging"))
      .unique();
    
    const isDebugMode = debugSetting?.value === true;
    
    // Validate time windows using Vietnam timezone (UTC+7)
    const now = new Date();
    
    // Get hour and minute in Vietnam timezone
    const vietnamHour = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      hour: "2-digit", 
      hour12: false 
    }));
    const vietnamMinute = parseInt(now.toLocaleString("en-US", { 
      timeZone: "Asia/Ho_Chi_Minh", 
      minute: "2-digit" 
    }));
    
    const isBeforeMorningCutoff = vietnamHour < 7 || (vietnamHour === 7 && vietnamMinute < 15);
    const isInAfternoonWindow = vietnamHour >= 12;
    
    // Skip time validation if debug mode is enabled
    if (!isDebugMode && !isBeforeMorningCutoff && !isInAfternoonWindow) {
      throw new Error("Đã quá thời gian xin phép. Vui lòng quay lại sau 12h trưa để xin phép cho ngày mai.");
    }

    // Validate inputs
    const trimmedRequesterName = args.requesterName.trim();
    if (!trimmedRequesterName || trimmedRequesterName.length < 2) {
      throw new Error("Tên người xin phép không hợp lệ");
    }
    if (trimmedRequesterName.length > 100) {
      throw new Error("Tên người xin phép quá dài");
    }

    if (args.students.length === 0) {
      throw new Error("Vui lòng chọn ít nhất một học sinh");
    }

    // Get system user ID from settings
    const systemUserIdSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "publicAbsenceSystemUserId"))
      .unique();

    if (!systemUserIdSetting || !systemUserIdSetting.value) {
      throw new Error(
        "Hệ thống chưa được cấu hình. Vui lòng liên hệ quản trị viên."
      );
    }

    const systemUserId = systemUserIdSetting.value as Id<"users">;

    // Set violation date based on time window (using Vietnam timezone)
    // Get the current date in Vietnam timezone
    const vietnamDateStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const violationDate = new Date(vietnamDateStr);
    
    // If in afternoon window (after 12 PM), set date to tomorrow
    if (isInAfternoonWindow) {
      violationDate.setDate(violationDate.getDate() + 1);
    }
    
    violationDate.setHours(0, 0, 0, 0);
    const violationTimestamp = violationDate.getTime();

    const successfulStudents: string[] = [];
    const skippedStudents: Array<{ name: string; className: string; reason: string }> = [];

    // Process each student
    for (const student of args.students) {
      const trimmedStudentName = student.name.trim();
      const rawClass = student.className.trim();
      const upperNoSpace = rawClass.toUpperCase().replace(/\s+/g, "");

      // Validate class name format
      const classMatch = upperNoSpace.match(/^(10|11|12)[A-Z]\d{1,2}$/);
      if (!classMatch) {
        skippedStudents.push({
          name: trimmedStudentName,
          className: rawClass,
          reason: "Tên lớp không hợp lệ",
        });
        continue;
      }

      const grade = parseInt(classMatch[1], 10);

      // Check for duplicate
      const isDuplicate = await checkForDuplicateAbsence(
        ctx,
        trimmedStudentName,
        upperNoSpace,
        violationTimestamp
      );

      if (isDuplicate) {
        skippedStudents.push({
          name: trimmedStudentName,
          className: upperNoSpace,
          reason: "Đã có đơn xin phép hôm nay",
        });
        continue;
      }

      // Create violation record with student's specific reason and absence type
      const studentReason = student.reason.trim();

      await ctx.db.insert("violations", {
        reporterId: systemUserId,
        targetType: "student",
        studentName: trimmedStudentName,
        violatingClass: upperNoSpace,
        violationDate: violationTimestamp,
        violationType: student.absenceType,
        details: studentReason,
        status: "reported",
        grade,
        evidenceFileIds: [],
        evidenceR2Keys: student.evidenceR2Keys,
        requesterName: trimmedRequesterName,
      });

      successfulStudents.push(`${trimmedStudentName} (${upperNoSpace})`);
    }

    return {
      successCount: successfulStudents.length,
      skippedCount: skippedStudents.length,
      successfulStudents,
      skippedStudents,
    };
  },
});
