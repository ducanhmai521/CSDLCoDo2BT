import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { query }from "./_generated/server";

export const checkReporterPassword = mutation({
    args: { password: v.string() },
    handler: async (ctx, args) => {
        const passwordSetting = await ctx.db
            .query("settings")
            .filter((q) => q.eq(q.field("key"), "reporternamepass"))
            .first();

        if (!passwordSetting) {
            return false;
        }

        return passwordSetting.value === args.password;
    },
});