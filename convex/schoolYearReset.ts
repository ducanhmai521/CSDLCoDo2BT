import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal, api, components } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const CONFIRM_PHRASE = "XOA-NAM-HOC-MOI";

/** Settings kept across school-year reset (AI provider config). */
const PRESERVED_SETTING_KEYS = new Set([
  "aiModels",
  "aiModel",
  "geminiModels",
  "openrouterModels",
]);

/** Settings whose string value is a Convex `_storage` id. */
const STORAGE_SETTING_KEYS = new Set(["rosterTemplateStorageId"]);

async function filterStorageIds(
  ctx: { db: { system: { get: (id: Id<"_storage">) => Promise<unknown | null> } } },
  candidates: Set<string>
): Promise<Array<Id<"_storage">>> {
  const valid: Array<Id<"_storage">> = [];
  for (const id of candidates) {
    try {
      const meta = await ctx.db.system.get(id as Id<"_storage">);
      if (meta) valid.push(id as Id<"_storage">);
    } catch {
      // Not a storage id — skip
    }
  }
  return valid;
}

export const wipeDatabaseForNewYear = internalMutation({
  args: {
    actingAdminUserId: v.id("users"),
  },
  returns: v.object({
    deletedViolations: v.number(),
    deletedUsers: v.number(),
    betterAuthIdsToDelete: v.array(v.string()),
    storageIdsToDelete: v.array(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const storageIdSet = new Set<string>();
    const betterAuthIdsToDelete: Array<string> = [];

    const adminProfiles = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    const adminUserIds = new Set(adminProfiles.map((p) => p.userId));

    if (!adminUserIds.has(args.actingAdminUserId)) {
      throw new Error("Chỉ tài khoản admin mới được chạy thao tác này.");
    }

    // Violation logs
    for (const row of await ctx.db.query("violationLogs").collect()) {
      await ctx.db.delete(row._id);
    }

    // Violations (+ legacy Convex evidence ids)
    let deletedViolations = 0;
    for (const row of await ctx.db.query("violations").collect()) {
      if (row.evidenceFileIds) {
        for (const fid of row.evidenceFileIds) {
          storageIdSet.add(fid);
        }
      }
      await ctx.db.delete(row._id);
      deletedViolations++;
    }

    // Stored file registry
    for (const row of await ctx.db.query("storedFiles").collect()) {
      storageIdSet.add(row.storageId);
      await ctx.db.delete(row._id);
    }

    // Archive jobs (metadata only; blobs cleaned via storage id scan in settings + storedFiles)
    for (const row of await ctx.db.query("archiveJobs").collect()) {
      await ctx.db.delete(row._id);
    }

    // Roster & classes
    for (const row of await ctx.db.query("studentRoster").collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("classes").collect()) {
      await ctx.db.delete(row._id);
    }

    // Reporting & shop purchases
    for (const row of await ctx.db.query("reportingPoints").collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("userPurchases").collect()) {
      await ctx.db.delete(row._id);
    }

    // Settings — wipe year-specific config; keep AI provider settings
    for (const row of await ctx.db.query("settings").collect()) {
      if (PRESERVED_SETTING_KEYS.has(row.key)) continue;

      if (
        STORAGE_SETTING_KEYS.has(row.key) &&
        typeof row.value === "string"
      ) {
        storageIdSet.add(row.value);
      }

      await ctx.db.delete(row._id);
    }

    // Non-admin profiles
    for (const profile of await ctx.db.query("userProfiles").collect()) {
      if (adminUserIds.has(profile.userId)) continue;
      await ctx.db.delete(profile._id);
    }

    // Non-admin app users (+ Better Auth ids)
    let deletedUsers = 0;
    for (const user of await ctx.db.query("users").collect()) {
      if (adminUserIds.has(user._id)) continue;
      if (user.betterAuthId) {
        betterAuthIdsToDelete.push(user.betterAuthId);
      }
      await ctx.db.delete(user._id);
      deletedUsers++;
    }

    const storageIdsToDelete = await filterStorageIds(ctx, storageIdSet);

    return {
      deletedViolations,
      deletedUsers,
      betterAuthIdsToDelete,
      storageIdsToDelete,
    };
  },
});

export const resetForNewSchoolYear = action({
  args: {
    confirmPhrase: v.string(),
  },
  returns: v.object({
    deletedViolations: v.number(),
    deletedUsers: v.number(),
    deletedBetterAuthUsers: v.number(),
    deletedR2Objects: v.number(),
    failedR2Deletes: v.number(),
    deletedStorageFiles: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    deletedViolations: number;
    deletedUsers: number;
    deletedBetterAuthUsers: number;
    deletedR2Objects: number;
    failedR2Deletes: number;
    deletedStorageFiles: number;
  }> => {
    if (args.confirmPhrase.trim() !== CONFIRM_PHRASE) {
      throw new Error(`Nhập đúng mã xác nhận: ${CONFIRM_PHRASE}`);
    }

    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Không có quyền thực hiện thao tác này.");
    }

    const wipeResult: {
      deletedViolations: number;
      deletedUsers: number;
      betterAuthIdsToDelete: string[];
      storageIdsToDelete: Id<"_storage">[];
    } = await ctx.runMutation(
      internal.schoolYearReset.wipeDatabaseForNewYear,
      { actingAdminUserId: myProfile.userId }
    );

    const r2Result = await ctx.runAction(
      internal.r2Actions.deleteAllEvidencePrefix,
      {}
    );

    let deletedBetterAuthUsers = 0;
    for (const authUserId of wipeResult.betterAuthIdsToDelete) {
      try {
        await ctx.runMutation(
          (components as any).betterAuth.users.deleteByAuthUserId,
          { authUserId }
        );
        deletedBetterAuthUsers++;
      } catch (error) {
        console.error("deleteByAuthUserId failed:", authUserId, error);
      }
    }

    let deletedStorageFiles = 0;
    for (const storageId of wipeResult.storageIdsToDelete) {
      try {
        await ctx.storage.delete(storageId);
        deletedStorageFiles++;
      } catch (_) {
        // File may already be gone
      }
    }

    return {
      deletedViolations: wipeResult.deletedViolations,
      deletedUsers: wipeResult.deletedUsers,
      deletedBetterAuthUsers,
      deletedR2Objects: r2Result.deleted,
      failedR2Deletes: r2Result.failed,
      deletedStorageFiles,
    };
  },
});
