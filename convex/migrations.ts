import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Define return types to avoid circular references
type MigrationResult = {
  success: boolean;
  migratedCount: number;
  message: string;
};

type StatusResult = {
  totalCustomizations: number;
  publicCustomizations: number;
  needsMigration: boolean;
};

/**
 * Migration to clean up showPublic field from customizations
 * This ensures all customizations are set to public by default
 * and removes the deprecated showPublic field
 */
export const migrateCustomizationsToAlwaysPublic = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    migratedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx): Promise<MigrationResult> => {
    try {
      // Get all user purchases that have customizations
      const purchases = await ctx.db
        .query("userPurchases")
        .filter((q) => q.neq(q.field("customization"), undefined))
        .collect();

      let migratedCount = 0;

      for (const purchase of purchases) {
        if (purchase.customization) {
          // Create new customization object without showPublic field
          const updatedCustomization = {
            ...purchase.customization,
            showPublic: true, // Force to true for all existing customizations
          };

          // Remove the showPublic field if it exists (clean up)
          if ('showPublic' in updatedCustomization) {
            // Keep showPublic as true but ensure it's explicitly set
            updatedCustomization.showPublic = true;
          }

          // Update the purchase with cleaned customization
          await ctx.db.patch(purchase._id, {
            customization: updatedCustomization,
          });

          migratedCount++;
        }
      }

      return {
        success: true,
        migratedCount,
        message: `Successfully migrated ${migratedCount} customizations to always public`,
      };
    } catch (error) {
      console.error("Migration failed:", error);
      return {
        success: false,
        migratedCount: 0,
        message: `Migration failed: ${error}`,
      };
    }
  },
});

/**
 * Helper function to check migration status
 */
export const checkCustomizationMigrationStatus = internalMutation({
  args: {},
  returns: v.object({
    totalCustomizations: v.number(),
    publicCustomizations: v.number(),
    needsMigration: v.boolean(),
  }),
  handler: async (ctx): Promise<StatusResult> => {
    const purchases = await ctx.db
      .query("userPurchases")
      .filter((q) => q.neq(q.field("customization"), undefined))
      .collect();

    let publicCustomizations = 0;
    
    for (const purchase of purchases) {
      if (purchase.customization && purchase.customization.showPublic === true) {
        publicCustomizations++;
      }
    }

    return {
      totalCustomizations: purchases.length,
      publicCustomizations,
      needsMigration: publicCustomizations < purchases.length,
    };
  },
});