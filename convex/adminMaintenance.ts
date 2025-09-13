import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const clearStoredFilesMutation = internalMutation({
  args: {
    kind: v.optional(v.union(v.literal("all"), v.literal("evidence"), v.literal("excel"))),
  },
  handler: async (ctx, args) => {
    const kinds: Array<"evidence" | "excel"> =
      args.kind === "evidence" || args.kind === "excel" ? [args.kind] : ["evidence", "excel"];

    // Delete files recorded in storedFiles by kind
    if (kinds.includes("excel")) {
      const items = await ctx.db
        .query("storedFiles")
        .withIndex("by_kind", (q) => q.eq("kind", "excel"))
        .collect();
      for (const item of items) {
        try {
          await ctx.storage.delete(item.storageId);
        } catch (_) {}
        await ctx.db.delete(item._id);
      }
    }

    // Delete evidence files referenced from violations
    if (kinds.includes("evidence")) {
      const violations = await ctx.db.query("violations").collect();
      for (const vDoc of violations) {
        if (vDoc.evidenceFileIds && vDoc.evidenceFileIds.length > 0) {
          const fileIds = vDoc.evidenceFileIds as Array<Id<"_storage">>;
          for (const fid of fileIds) {
            try {
              await ctx.storage.delete(fid);
            } catch (_) {}
          }
          await ctx.db.patch(vDoc._id, { evidenceFileIds: [] });
        }
      }
      // Also remove any 'evidence' records in storedFiles
      const storedEvidence = await ctx.db
        .query("storedFiles")
        .withIndex("by_kind", (q) => q.eq("kind", "evidence"))
        .collect();
      for (const item of storedEvidence) {
        await ctx.db.delete(item._id);
      }
    }
  },
});

export const saveRosterRows = internalMutation({
  args: {
    rows: v.array(v.object({ className: v.string(), fullName: v.string() })),
  },
  handler: async (ctx, args) => {
    // Remove all existing roster entries to avoid duplicates
    const existing = await ctx.db.query("studentRoster").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    // Insert new entries
    for (const row of args.rows) {
      await ctx.db.insert("studentRoster", { className: row.className, fullName: row.fullName });
    }
  },
});

export const recordStoredFile = internalMutation({
  args: {
    storageId: v.id("_storage"),
    kind: v.union(v.literal("evidence"), v.literal("excel")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("storedFiles", {
      storageId: args.storageId,
      kind: args.kind,
      timestamp: Date.now(),
    });
  },
});

