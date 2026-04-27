import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

const TIME_ZONE_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/**
 * Get the Monday 00:00 (UTC+7) of the week containing the given UTC timestamp.
 */
function getWeekStartMs(utcMs: number): number {
  // Shift to UTC+7 space
  const localMs = utcMs + TIME_ZONE_OFFSET_MS;
  const localDate = new Date(localMs);
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = localDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayLocal = new Date(localMs);
  mondayLocal.setUTCDate(mondayLocal.getUTCDate() + diffToMonday);
  mondayLocal.setUTCHours(0, 0, 0, 0);
  // Shift back to UTC
  return mondayLocal.getTime() - TIME_ZONE_OFFSET_MS;
}

/**
 * Difference in calendar weeks (weekStartsOn=Monday) between two UTC timestamps,
 * evaluated in UTC+7 space.
 */
function differenceInCalendarWeeks(laterMs: number, earlierMs: number): number {
  const laterWeekStart = getWeekStartMs(laterMs);
  const earlierWeekStart = getWeekStartMs(earlierMs);
  return Math.round((laterWeekStart - earlierWeekStart) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Parse an ISO date string (YYYY-MM-DD) as midnight UTC+7, return UTC ms.
 */
function parseISOAsUTC7(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Create as UTC midnight, then shift back by 7h to get UTC equivalent of 00:00 UTC+7
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return utcMidnight - TIME_ZONE_OFFSET_MS;
}

/**
 * Calculate the break window (holiday skip) based on base date and break range.
 * Mirrors the AdminDashboard getBreakWindow logic.
 */
function getBreakWindow(
  baseDateISO: string,
  breakStartISO: string | null | undefined,
  breakEndISO: string | null | undefined
): { startWeekIndex: number; skippedWeeks: number } | null {
  if (!breakStartISO || !breakEndISO) return null;

  const baseWeekStart = getWeekStartMs(parseISOAsUTC7(baseDateISO));
  let breakStartWeekStart = getWeekStartMs(parseISOAsUTC7(breakStartISO));
  let breakEndWeekStart = getWeekStartMs(parseISOAsUTC7(breakEndISO));

  if (Number.isNaN(breakStartWeekStart) || Number.isNaN(breakEndWeekStart)) return null;

  // Ensure start <= end
  if (breakStartWeekStart > breakEndWeekStart) {
    [breakStartWeekStart, breakEndWeekStart] = [breakEndWeekStart, breakStartWeekStart];
  }

  // Overlap: clamp break start to base week start
  const overlapStart = breakStartWeekStart < baseWeekStart ? baseWeekStart : breakStartWeekStart;
  if (overlapStart > breakEndWeekStart) return null;

  const startWeekIndex = differenceInCalendarWeeks(overlapStart, baseWeekStart) + 1;
  const skippedWeeks = differenceInCalendarWeeks(breakEndWeekStart, overlapStart) + 1;

  return { startWeekIndex, skippedWeeks };
}

/**
 * Convert a raw calendar week number to an academic week number,
 * skipping over holiday break weeks.
 */
function toAcademicWeek(
  rawWeek: number,
  breakWindow: { startWeekIndex: number; skippedWeeks: number } | null
): number {
  if (!breakWindow) return rawWeek;
  if (rawWeek < breakWindow.startWeekIndex) return rawWeek;
  return Math.max(1, rawWeek - breakWindow.skippedWeeks);
}

/**
 * Convert an academic week number back to a raw calendar week number,
 * adding back the skipped holiday weeks.
 */
function toCalendarWeek(
  academicWeek: number,
  breakWindow: { startWeekIndex: number; skippedWeeks: number } | null
): number {
  if (!breakWindow) return academicWeek;
  if (academicWeek < breakWindow.startWeekIndex) return academicWeek;
  return academicWeek + breakWindow.skippedWeeks;
}

/**
 * Internal query: given an optional academic week number, return the
 * UTC timestamp range [startTs, endTs] for that week and the resolved academic week.
 *
 * If weekNumber is omitted, the current academic week (based on Date.now()) is used.
 */
export const getWeekTimeRange = internalQuery({
  args: {
    weekNumber: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ startTs: number; endTs: number; academicWeek: number }> => {
    // 1. Fetch settings from DB
    const weekBaseSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "weekBaseDate"))
      .unique();
    const breakStartSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "holidayBreakStartDate"))
      .unique();
    const breakEndSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "holidayBreakEndDate"))
      .unique();

    const weekBaseDate: string =
      (weekBaseSetting?.value as string) || new Date().toISOString().slice(0, 10);
    const holidayBreakStartDate: string | null =
      (breakStartSetting?.value as string) || null;
    const holidayBreakEndDate: string | null =
      (breakEndSetting?.value as string) || null;

    // 2. Compute break window
    const breakWindow = getBreakWindow(
      weekBaseDate,
      holidayBreakStartDate,
      holidayBreakEndDate
    );

    // 3. Determine the academic week to query
    let academicWeek: number;
    if (args.weekNumber !== undefined) {
      academicWeek = args.weekNumber;
    } else {
      // Calculate current academic week
      const nowMs = Date.now();
      const baseMs = parseISOAsUTC7(weekBaseDate);
      const rawWeek = differenceInCalendarWeeks(nowMs, baseMs) + 1;
      academicWeek = toAcademicWeek(rawWeek, breakWindow);
    }

    // 4. Convert academic week -> calendar week -> timestamp range
    const calendarWeek = toCalendarWeek(academicWeek, breakWindow);
    const baseMs = parseISOAsUTC7(weekBaseDate);
    const baseWeekStartMs = getWeekStartMs(baseMs);

    // Monday of the target week (UTC)
    const mondayMs = baseWeekStartMs + (calendarWeek - 1) * 7 * 24 * 60 * 60 * 1000;
    // Sunday end-of-day = Monday + 7 days - 1ms
    const sundayEndMs = mondayMs + 7 * 24 * 60 * 60 * 1000 - 1;

    return {
      startTs: mondayMs,
      endTs: sundayEndMs,
      academicWeek,
    };
  },
});
