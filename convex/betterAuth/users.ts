import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * List all Better Auth users directly from the component's user table.
 * This bypasses the admin plugin's role check.
 * Only callable from the parent app via ctx.runQuery(components.betterAuth.users.list)
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("user")
      .order("desc")
      .take(args.limit ?? 200);
    return users;
  },
});

/**
 * Set role for a Better Auth user by their _id (betterAuthId).
 */
export const setRole = mutation({
  args: {
    betterAuthId: v.string(),
    role: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("_id"), args.betterAuthId))
      .unique();
    if (!user) return false;
    await ctx.db.patch(user._id, { role: args.role });
    return true;
  },
});

/**
 * Remove a Better Auth user and related sessions/accounts (called from parent app).
 */
export const deleteByAuthUserId = mutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const uid = args.authUserId;

    const sessions = await ctx.db
      .query("session")
      .withIndex("userId", (q) => q.eq("userId", uid))
      .collect();
    for (const row of sessions) {
      await ctx.db.delete(row._id);
    }

    const accounts = await ctx.db
      .query("account")
      .withIndex("userId", (q) => q.eq("userId", uid))
      .collect();
    for (const row of accounts) {
      await ctx.db.delete(row._id);
    }

    const twoFactorRows = await ctx.db
      .query("twoFactor")
      .withIndex("userId", (q) => q.eq("userId", uid))
      .collect();
    for (const row of twoFactorRows) {
      await ctx.db.delete(row._id);
    }

    const authUsers = await ctx.db.query("user").collect();
    for (const row of authUsers) {
      if (String(row._id) === uid || row.userId === uid) {
        await ctx.db.delete(row._id);
      }
    }

    return null;
  },
});
