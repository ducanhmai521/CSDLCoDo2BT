import { internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * Normalize class name: e.g. "10a3" -> "10A3", "12 b 1" -> "12B1"
 */
function normalizeClassName(input: string): string {
  const trimmed = (input || "").trim();
  const match = trimmed.match(/^(10|11|12)\s*([A-Za-z])\s*(\d{1,2})$/);
  if (!match) return trimmed.toUpperCase().replace(/\s+/g, "");
  const grade = match[1];
  const letter = match[2].toUpperCase();
  const idx = match[3];
  return `${grade}${letter}${idx}`;
}

/**
 * Internal query used by the Zalo bot webhook.
 * Fetches violations for a given class within a specific academic week.
 *
 * - className: raw input like "10a5" (will be normalized)
 * - weekNumber: optional; defaults to current academic week
 */
export const getViolationsForBot = internalQuery({
  args: {
    className: v.string(),
    weekNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Get the time range for the academic week
    const weekRange: { startTs: number; endTs: number; academicWeek: number } =
      await ctx.runQuery(internal.dateUtils.getWeekTimeRange, {
        weekNumber: args.weekNumber,
      });

    const { startTs, endTs, academicWeek } = weekRange;

    // 2. Normalize class name
    const normalizedClass = normalizeClassName(args.className);

    // 3. Query violations using the by_violatingClass index
    const allViolations: Doc<"violations">[] = await ctx.db
      .query("violations")
      .withIndex("by_violatingClass", (q) =>
        q.eq("violatingClass", normalizedClass)
      )
      .collect();

    // 4. Filter by date range
    const filtered = allViolations.filter(
      (v) => v.violationDate >= startTs && v.violationDate <= endTs
    );

    // 5. Sort by violation date ascending
    filtered.sort(
      (a: Doc<"violations">, b: Doc<"violations">) =>
        a.violationDate - b.violationDate
    );

    return {
      violations: filtered,
      academicWeek,
      className: normalizedClass,
    };
  },
});
