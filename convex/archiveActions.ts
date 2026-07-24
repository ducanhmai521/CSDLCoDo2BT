"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Helper: resolveSchoolYear
// ---------------------------------------------------------------------------

/**
 * Resolves the Vietnamese school year label for a given date (UTC+7).
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
// Helper: buildZipFileName
// ---------------------------------------------------------------------------

/**
 * Builds the ZIP file name in format: archive-{schoolYear}-{YYYY}-{MM}-{DD}.zip
 * Date is converted to UTC+7.
 */
export function buildZipFileName(schoolYear: string, date: Date): string {
  const utcPlus7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = utcPlus7.getUTCFullYear();
  const mm = String(utcPlus7.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utcPlus7.getUTCDate()).padStart(2, "0");
  return `archive-${schoolYear}-${yyyy}-${mm}-${dd}.zip`;
}

// ---------------------------------------------------------------------------
// Helper: sanitizeUsers
// ---------------------------------------------------------------------------

/**
 * Maps each user to only include _id and username, removing sensitive fields
 * like betterAuthId, tokenIdentifier, and email.
 */
export function sanitizeUsers(
  users: any[]
): Array<{ _id: string; username?: string }> {
  return users.map((u) => ({
    _id: u._id as string,
    ...(u.username !== undefined ? { username: u.username } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Internal Action: buildArchiveZip
// ---------------------------------------------------------------------------

const CONCURRENCY_LIMIT = 5;
const APP_VERSION = "0.0.0"; // fallback; package.json version

export const buildArchiveZip = internalAction({
  args: { jobId: v.id("archiveJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    try {
      // Step 1: Mark job as processing
      await ctx.runMutation(internal.archive.startArchiveJob, { jobId });

      // Step 2: Fetch all data
      const data = await ctx.runQuery(internal.archive.getAllDataForArchive);

      // Step 3: Initialize JSZip
      const zip = new JSZip();

      // Step 4: Serialize each table into data/{tableName}.json
      const tables: Record<string, any[]> = {
        violations: data.violations,
        violationLogs: data.violationLogs,
        userProfiles: data.userProfiles,
        users: sanitizeUsers(data.users as any[]),
        studentRoster: data.studentRoster,
        classes: data.classes,
        settings: data.settings,
        reportingPoints: data.reportingPoints,
      };

      for (const [tableName, rows] of Object.entries(tables)) {
        zip.file(`data/${tableName}.json`, JSON.stringify(rows, null, 2));
      }

      // Step 5: Collect all evidenceR2Keys from violations
      const allKeys: string[] = [];
      for (const violation of data.violations as any[]) {
        if (
          violation.evidenceR2Keys &&
          Array.isArray(violation.evidenceR2Keys)
        ) {
          for (const key of violation.evidenceR2Keys) {
            if (typeof key === "string" && key.trim() !== "") {
              allKeys.push(key);
            }
          }
        }
      }

      // Step 6 & 7 & 8: Fetch evidence files with concurrency limit = 5
      const r2PublicUrl = process.env.R2_PUBLIC_URL ?? "";
      const evidenceErrors: Array<{ r2Key: string; error: string }> = [];
      let totalEvidenceFiles = 0;

      for (let i = 0; i < allKeys.length; i += CONCURRENCY_LIMIT) {
        const batch = allKeys.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.allSettled(
          batch.map(async (key) => {
            const url = `${r2PublicUrl}/${key}`;
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return { key, buffer: Buffer.from(arrayBuffer) };
          })
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const key = batch[j];
          if (result.status === "fulfilled") {
            // Basename = part after last '/'
            const basename = key.includes("/")
              ? key.substring(key.lastIndexOf("/") + 1)
              : key;
            zip.file(`evidence/${basename}`, result.value.buffer);
            totalEvidenceFiles++;
          } else {
            const errorMessage =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
            evidenceErrors.push({ r2Key: key, error: errorMessage });
          }
        }
      }

      // Step 8: Write evidence_errors.json if any errors
      if (evidenceErrors.length > 0) {
        zip.file(
          "evidence_errors.json",
          JSON.stringify(evidenceErrors, null, 2)
        );
      }

      // Step 9: Create metadata.json (include week settings for offline archive viewer)
      const archivedAt = new Date();
      const schoolYear = resolveSchoolYear(archivedAt);
      const settingValue = (key: string) => {
        const row = (data.settings as Array<{ key: string; value: unknown }>).find(
          (s) => s.key === key
        );
        return row?.value ?? null;
      };
      const metadata = {
        schoolYear,
        archivedAt: archivedAt.toISOString(),
        totalViolations: data.violations.length,
        totalEvidenceFiles,
        appVersion: APP_VERSION,
        weekBaseDate:
          (settingValue("weekBaseDate") as string | null) ??
          archivedAt.toISOString().slice(0, 10),
        holidayBreakStartDate: settingValue("holidayBreakStartDate") as string | null,
        holidayBreakEndDate: settingValue("holidayBreakEndDate") as string | null,
      };
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));

      // Step 10: Generate ZIP buffer
      const buffer: Buffer = await zip.generateAsync({ type: "nodebuffer" });

      // Step 11: Store ZIP in Convex file storage
      // Copy into a plain ArrayBuffer to satisfy BlobPart's type constraint
      // (Buffer may use SharedArrayBuffer internally which BlobPart doesn't accept)
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      const storageId = await ctx.storage.store(
        new Blob([arrayBuffer], { type: "application/zip" })
      );

      // Step 12: Get download URL
      const downloadUrl = await ctx.storage.getUrl(storageId);
      if (!downloadUrl) {
        throw new Error("Storage URL not available after storing ZIP");
      }

      // Step 13: Mark job as completed
      await ctx.runMutation(internal.archive.completeArchiveJob, {
        jobId,
        downloadUrl,
        totalViolations: data.violations.length,
        totalEvidenceFiles,
      });
    } catch (e) {
      // On any failure, mark job as failed
      await ctx.runMutation(internal.archive.failArchiveJob, {
        jobId,
        errorMessage: String(e),
      });
    }

    return null;
  },
});
