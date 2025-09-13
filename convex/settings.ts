import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
    args: { key: v.string() },
    handler: async (ctx, { key }) => {
        return await ctx.db
            .query("settings")
            .withIndex("by_key", (q) => q.eq("key", key))
            .first();
    },
});

export const create = mutation({
    args: { key: v.string(), value: v.any() },
    handler: async (ctx, { key, value }) => {
        await ctx.db.insert("settings", { key, value });
    },
});

export const update = mutation({
    args: { id: v.id("settings") , value: v.any() },
    handler: async (ctx, { id, value }) => {
        await ctx.db.patch(id, { value });
    },
});