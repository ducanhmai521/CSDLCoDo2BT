import { v } from "convex/values";
    import { api } from "./_generated/api";
    import { mutation, query } from "./_generated/server";
    import { getAuthUserId } from "@convex-dev/auth/server";

    export const getMyProfile = query({
      args: {},
      handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
          return null;
        }
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();
        return profile;
      },
    });

    export const getAllStudents = query({
      args: {},
      handler: async (ctx) => {
        const students = await ctx.db.query("studentRoster").collect();
        return students;
      },
    });

    export const createMyProfile = mutation({
      args: {
        fullName: v.string(),
        className: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
          throw new Error("Bạn phải đăng nhập để tạo hồ sơ.");
        }

        const existingProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();

        if (existingProfile) {
          throw new Error("Hồ sơ đã tồn tại.");
        }

        const gradeMatch = args.className.match(/^(\d+)/);
        if (!gradeMatch || !["10", "11", "12"].includes(gradeMatch[1])) {
          throw new Error("Tên lớp không hợp lệ. Ví dụ: 10A1, 11B2, 12C3.");
        }
        const grade = parseInt(gradeMatch[1], 10);

        await ctx.db.insert("userProfiles", {
          userId,
          fullName: args.fullName,
          className: args.className,
          grade,
          role: "pending",
        });
      },
    });

    export const getPendingUsers = query({
      args: {},
      handler: async (ctx) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== "admin") {
          return [];
        }

        const pendingProfiles = await ctx.db
          .query("userProfiles")
          .filter((q) => q.eq(q.field("role"), "pending"))
          .collect();
        
        const users = await Promise.all(
          pendingProfiles.map(async (profile) => {
            const user = await ctx.db.get(profile.userId);
            return {
              ...profile,
              email: user?.email,
            };
          })
        );
        return users;
      },
    });

    export const verifyUser = mutation({
      args: {
        profileId: v.id("userProfiles"),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
          throw new Error("Không có quyền truy cập.");
        }
        const myProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();

        if (myProfile?.role !== "admin") {
          throw new Error("Không có quyền truy cập.");
        }

        const profile = await ctx.db.get(args.profileId);
        if (!profile) {
          throw new Error("Không tìm thấy hồ sơ.");
        }
        
        const admins = await ctx.db.query("userProfiles").filter(q => q.eq(q.field("role"), "admin")).collect();
        if (admins.length === 0) {
          await ctx.db.patch(args.profileId, { role: "admin" });
        } else {
          await ctx.db.patch(args.profileId, {
            role: "gradeManager",
          });
        }
      },
    });

    export const getLoggedInUser = query({
      handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const user = await ctx.db.get(userId);
        if (!user) return null;

        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();

        if (!profile) return { ...user, profile: null };

        return { ...user, ...profile };
      },
    });

    export const searchStudents = query({
      args: {
        className: v.optional(v.string()),
        q: v.string(),
      },
      handler: async (ctx, args) => {
        const normQ = args.q.trim().toLowerCase();
        const pick = (s: string) => s.toLowerCase();
        let rows = await ctx.db.query('studentRoster').collect();
        if (args.className) {
          const classKey = args.className.toUpperCase().replace(/\s+/g, '');
          rows = rows.filter(r => r.className.toUpperCase().replace(/\s+/g, '') === classKey);
        }
        const results = rows.filter(r => {
          const parts = r.fullName.split(/\s+/).map(pick);
          const joined = r.fullName.toLowerCase();
          return joined.includes(normQ) || parts.some(p => p.startsWith(normQ));
        }).slice(0, 20);
        return results.map(r => ({ fullName: r.fullName, className: r.className }));
      }
    });

    export const listRoster = query({
      args: {},
      handler: async (ctx) => {
        const myProfile = await ctx.runQuery(api.users.getMyProfile);
        if (myProfile?.role !== "admin") {
          return [] as Array<{ className: string; students: Array<string> }>;
        }
        const rows = await ctx.db.query('studentRoster').collect();
        const map = new Map<string, Array<string>>();
        for (const r of rows) {
          const key = r.className.toUpperCase().replace(/\s+/g, '');
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(r.fullName);
        }
        const result: Array<{ className: string; students: Array<string> }> = [];
        for (const [className, students] of map) {
          students.sort((a, b) => a.localeCompare(b, 'vi'));
          result.push({ className, students });
        }
        result.sort((a, b) => a.className.localeCompare(b.className, 'vi'));
        return result;
      }
    });

    export const getSetting = query({
      args: { key: v.string() },
      handler: async (ctx, args) => {
        const row = await ctx.db.query('settings').withIndex('by_key', q => q.eq('key', args.key)).unique();
        return row?.value ?? null;
      }
    });

    export const setSetting = mutation({
      args: { key: v.string(), value: v.string() },
      handler: async (ctx, args) => {
        const me = await ctx.runQuery(api.users.getMyProfile);
        if (me?.role !== 'admin') throw new Error('Không có quyền.');
        const existing = await ctx.db.query('settings').withIndex('by_key', q => q.eq('key', args.key)).unique();
        if (existing) {
          await ctx.db.patch(existing._id, { value: args.value });
        } else {
          await ctx.db.insert('settings', { key: args.key, value: args.value });
        }
      }
    });
