import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  throw new Error("Missing R2 environment variables for migration");
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Get all violations with Convex storage files that need migration
export const getViolationsForMigration = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("violations"),
    evidenceFileIds: v.optional(v.array(v.id("_storage"))),
    evidenceR2Keys: v.array(v.string())
  })),
  handler: async (ctx) => {
    const violations = await ctx.db
      .query("violations")
      .filter((q) => q.and(
        q.neq(q.field("evidenceFileIds"), undefined),
        q.neq(q.field("evidenceFileIds"), [])
      ))
      .collect();

    return violations.map(v => ({
      _id: v._id,
      evidenceFileIds: v.evidenceFileIds,
      evidenceR2Keys: v.evidenceR2Keys || []
    }));
  }
});

// Migrate a single violation's files from Convex to R2
export const migrateViolationToR2 = internalMutation({
  args: {
    violationId: v.id("violations"),
    fileId: v.id("_storage"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    r2Key: v.optional(v.string())
  }),
  handler: async (ctx, args) => {
    try {
      // Get the file URL from Convex storage
      const fileUrl = await ctx.storage.getUrl(args.fileId);
      if (!fileUrl) {
        console.error(`File not found: ${args.fileId}`);
        return { success: false, error: "File not found" };
      }

      // Fetch the file content
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      
      // Generate R2 key
      const timestamp = Date.now();
      const key = `evidence/migrated-${timestamp}-${args.fileId}.jpg`;

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: "image/jpeg",
      });

      await s3Client.send(command);

      // Update violation with R2 key
      const violation = await ctx.db.get(args.violationId);
      if (violation) {
        const currentR2Keys = violation.evidenceR2Keys || [];
        await ctx.db.patch(args.violationId, {
          evidenceR2Keys: [...currentR2Keys, key]
        });
      }

      console.log(`Successfully migrated file ${args.fileId} to R2 key ${key}`);
      return { success: true, r2Key: key };
    } catch (error) {
      console.error(`Error migrating file ${args.fileId}:`, error);
      return { success: false, error: String(error) };
    }
  }
});

// Batch migrate all violations
export const batchMigrateToR2 = internalMutation({
  args: {},
  returns: v.object({
    totalProcessed: v.number(),
    successful: v.number(),
    failed: v.number(),
    results: v.array(v.object({
      violationId: v.id("violations"),
      fileId: v.id("_storage"),
      success: v.boolean(),
      error: v.optional(v.string()),
      r2Key: v.optional(v.string())
    }))
  }),
  handler: async (ctx) => {
    const violations = await ctx.runQuery(internal.migrateToR2.getViolationsForMigration);
    const results: Array<{
      violationId: Id<"violations">;
      fileId: Id<"_storage">;
      success: boolean;
      error?: string;
      r2Key?: string;
    }> = [];

    for (const violation of violations) {
      if (violation.evidenceFileIds) {
        for (const fileId of violation.evidenceFileIds) {
          const result = await ctx.runMutation(internal.migrateToR2.migrateViolationToR2, {
            violationId: violation._id,
            fileId: fileId
          });
          results.push({ violationId: violation._id, fileId, ...result });
        }
      }
    }

    return {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
});
