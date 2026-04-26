import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function getUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  // identity.subject = Better Auth user ID (betterAuthId)
  const user = await ctx.db
    .query("users")
    .withIndex("by_betterAuthId", (q) => q.eq("betterAuthId", identity.subject))
    .unique();
  return user?._id ?? null;
}
