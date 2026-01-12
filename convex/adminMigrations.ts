import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Define return types to avoid circular references
type MigrationResult = {
  success: boolean;
  migratedCount: number;
  message: string;
  timestamp: number;
};

type StatusResult = {
  totalCustomizations: number;
  publicCustomizations: number;
  needsMigration: boolean;
  timestamp: number;
};

/**
 * Public mutation to run the customization migration
 * This can be called once during deployment to clean up existing data
 * Safe to run multiple times - will only update records that need it
 */
export const runCustomizationMigration = mutation({
  args: {
    adminKey: v.optional(v.string()), // Optional admin verification
  },
  returns: v.object({
    success: v.boolean(),
    migratedCount: v.number(),
    message: v.string(),
    timestamp: v.number(),
  }),
  handler: async (ctx, args): Promise<MigrationResult> => {
    // Optional: Add admin key verification for production safety
    // if (args.adminKey !== process.env.ADMIN_MIGRATION_KEY) {
    //   throw new Error("Unauthorized migration attempt");
    // }

    try {
      // Run the internal migration
      const result: {
        success: boolean;
        migratedCount: number;
        message: string;
      } = await ctx.runMutation(
        internal.migrations.migrateCustomizationsToAlwaysPublic,
        {}
      );

      return {
        ...result,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Migration runner failed:", error);
      return {
        success: false,
        migratedCount: 0,
        message: `Migration runner failed: ${error}`,
        timestamp: Date.now(),
      };
    }
  },
});

/**
 * Check the current status of customizations
 */
export const checkMigrationStatus = mutation({
  args: {},
  returns: v.object({
    totalCustomizations: v.number(),
    publicCustomizations: v.number(),
    needsMigration: v.boolean(),
    timestamp: v.number(),
  }),
  handler: async (ctx): Promise<StatusResult> => {
    const result: {
      totalCustomizations: number;
      publicCustomizations: number;
      needsMigration: boolean;
    } = await ctx.runMutation(
      internal.migrations.checkCustomizationMigrationStatus,
      {}
    );

    return {
      ...result,
      timestamp: Date.now(),
    };
  },
});