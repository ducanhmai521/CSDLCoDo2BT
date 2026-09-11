"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import * as XLSX from "xlsx";
import { api, internal, components } from "./_generated/api";
import { createAuth, authComponent } from "./betterAuth/auth";

function normalizeBulkUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

async function ensureBetterAuthAdminRole(
  ctx: { runQuery: typeof api extends never ? never : any; runMutation: any },
  adminAppUserId: string
) {
  const callerAuthId = await ctx.runQuery(internal.adminMaintenance.getBetterAuthId, {
    userId: adminAppUserId,
  });
  if (callerAuthId) {
    await ctx.runMutation((components as any).betterAuth.users.setRole, {
      betterAuthId: callerAuthId,
      role: "admin",
    });
  }
}

function resolveBetterAuthUserId(baUser: {
  id?: string;
  _id?: string;
  userId?: string;
}): string | null {
  return baUser.id ?? baUser._id ?? baUser.userId ?? null;
}

async function createBetterAuthUser(
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
  entry: { username: string; password: string; displayName?: string }
): Promise<{ betterAuthId: string; username: string; email: string }> {
  const username = normalizeBulkUsername(entry.username);
  const email = `${username}@internal.local`;
  const name = entry.displayName?.trim() || username;

  const response = await auth.api.createUser({
    headers,
    body: {
      email,
      password: entry.password,
      name,
      role: "user",
      data: { username },
    },
  });

  if (!response || !(response as { user?: { id: string } }).user) {
    throw new Error("Không thể tạo tài khoản Better Auth.");
  }

  const betterAuthId = (response as { user: { id: string } }).user.id;

  const pwResult = await auth.api.setUserPassword({
    headers,
    body: {
      userId: betterAuthId,
      newPassword: entry.password,
    },
  });
  if (!pwResult.status) {
    throw new Error("Không thể đặt mật khẩu cho tài khoản mới.");
  }

  return { betterAuthId, username, email };
}

async function setBetterAuthUserPassword(
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
  betterAuthUserId: string,
  password: string
) {
  const pwResult = await auth.api.setUserPassword({
    headers,
    body: {
      userId: betterAuthUserId,
      newPassword: password,
    },
  });
  if (!pwResult.status) {
    throw new Error("Không thể đặt lại mật khẩu.");
  }
}

export const clearStoredFiles = action({
  args: { kind: v.optional(v.union(v.literal("all"), v.literal("evidence"), v.literal("excel"))) },
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") throw new Error("Bạn không có quyền thực hiện hành động này.");
    await ctx.runMutation(internal.adminMaintenance.clearStoredFilesMutation, { kind: args.kind ?? "all" });
  }
});

// Cache key used to avoid re-generating the roster template on every request.
const ROSTER_TEMPLATE_CACHE_KEY = "rosterTemplateStorageId";

export const exportRosterTemplate = action({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx): Promise<string | null> => {
    // Auth check — only admins may download the template
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }

    // Return cached URL if the file already exists in storage
    const cached: string | null = await ctx.runQuery(api.users.getSetting, {
      key: ROSTER_TEMPLATE_CACHE_KEY,
    }) as string | null;

    if (cached) {
      const url = await ctx.storage.getUrl(cached as any);
      if (url) return url;
      // File was deleted from storage — fall through to regenerate
    }

    // Generate the template workbook
    const classes: Array<string> = [];
    for (const grade of [10, 11, 12]) {
      for (let i = 1; i <= 8; i++) {
        classes.push(`${grade}A${i}`);
      }
    }
    const sheetData = [classes];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Danh_Sach");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const storageId = await ctx.storage.store(blob);

    // Persist the storageId so future calls reuse the same file
    await ctx.runMutation(api.users.setSetting, {
      key: ROSTER_TEMPLATE_CACHE_KEY,
      value: storageId,
    });

    return await ctx.storage.getUrl(storageId);
  },
});

export const importRoster = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền.");
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Không tìm thấy tệp.");
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Array<Record<string, any>> = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const headers = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })[0] as string[];
    const normalizeClass = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, '');
    const classNames = headers.map(h => normalizeClass(h)).filter(Boolean);
    const toSave: Array<{ className: string; fullName: string }> = [];
    for (const row of rows) {
      for (const col of classNames) {
        const fullName = String(row[col] ?? "").trim();
        if (!fullName) continue;
        toSave.push({ className: col, fullName });
      }
    }
    if (toSave.length > 0) {
      await ctx.runMutation(internal.adminMaintenance.saveRosterRows, { rows: toSave });
    }
  }
});




export const listBetterAuthUsers = internalAction({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Query directly from component tables — bypasses Better Auth admin role check
    const users = await ctx.runQuery(
      (components as any).betterAuth.users.list,
      { limit: (args.limit ?? 100) + (args.offset ?? 0) }
    );
    const offset = args.offset ?? 0;
    return { users: users.slice(offset, offset + (args.limit ?? 100)), total: users.length };
  },
});

export const getBetterAuthUsers = action({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<any> => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }
    const result: any = await ctx.runAction(internal.adminTools.listBetterAuthUsers, {
      limit: args.limit,
      offset: args.offset,
    });
    return result;
  },
});

export const setUserPassword = action({
  args: {
    betterAuthUserId: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }
    
    await ensureBetterAuthAdminRole(ctx, myProfile.userId);

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx as any);
    await setBetterAuthUserPassword(auth, headers, args.betterAuthUserId, args.newPassword);
    return null;
  },
});

export const repairBulkUserPasswords = action({
  args: {
    users: v.array(
      v.object({
        username: v.string(),
        password: v.string(),
      })
    ),
  },
  returns: v.object({
    repaired: v.number(),
    failed: v.number(),
    results: v.array(
      v.object({
        username: v.string(),
        status: v.union(v.literal("repaired"), v.literal("failed")),
        reason: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }

    await ensureBetterAuthAdminRole(ctx, myProfile.userId);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx as any);
    const baList: { users: Array<any> } = await ctx.runAction(
      internal.adminTools.listBetterAuthUsers,
      { limit: 5000 }
    );

    let repaired = 0;
    let failed = 0;
    const results: Array<{
      username: string;
      status: "repaired" | "failed";
      reason?: string;
    }> = [];

    for (const entry of args.users) {
      const username = normalizeBulkUsername(entry.username);
      const baUser = baList.users.find((u: any) => {
        const candidate = (
          u.username ??
          u.name ??
          u.email?.split("@")[0] ??
          ""
        )
          .toString()
          .toLowerCase();
        return candidate === username;
      });

      if (!baUser) {
        failed++;
        results.push({
          username,
          status: "failed",
          reason: "Không tìm thấy tài khoản Better Auth.",
        });
        continue;
      }

      const betterAuthUserId = resolveBetterAuthUserId(baUser);
      if (!betterAuthUserId) {
        failed++;
        results.push({
          username,
          status: "failed",
          reason: "Không đọc được ID tài khoản.",
        });
        continue;
      }

      try {
        await setBetterAuthUserPassword(
          auth,
          headers,
          betterAuthUserId,
          entry.password
        );
        repaired++;
        results.push({ username, status: "repaired" });
      } catch (err: unknown) {
        failed++;
        results.push({
          username,
          status: "failed",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { repaired, failed, results };
  },
});

export const bulkCreateUsers = action({
  args: {
    users: v.array(
      v.object({
        username: v.string(),
        password: v.string(),
      })
    ),
  },
  returns: v.object({
    created: v.number(),
    failed: v.number(),
    results: v.array(
      v.object({
        username: v.string(),
        status: v.union(
          v.literal("created"),
          v.literal("duplicate"),
          v.literal("failed")
        ),
        reason: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }

    await ensureBetterAuthAdminRole(ctx, myProfile.userId);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx as any);
    const baList: { users: Array<any> } = await ctx.runAction(
      internal.adminTools.listBetterAuthUsers,
      { limit: 5000 }
    );

    let created = 0;
    let failed = 0;
    const results: Array<{
      username: string;
      status: "created" | "duplicate" | "failed";
      reason?: string;
    }> = [];

    for (const entry of args.users) {
      const username = normalizeBulkUsername(entry.username);
      const email = `${username}@internal.local`;
      try {
        const { betterAuthId } = await createBetterAuthUser(auth, headers, {
          username,
          password: entry.password,
        });

        await ctx.runMutation(api.users.syncBetterAuthUser, {
          betterAuthId,
          username,
          email,
        });

        created++;
        results.push({ username, status: "created" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isDuplicate =
          message.toLowerCase().includes("already exists") ||
          message.toLowerCase().includes("duplicate") ||
          message.toLowerCase().includes("unique") ||
          message.toLowerCase().includes("email") ||
          message.toLowerCase().includes("username");

        if (isDuplicate) {
          const baUser = baList.users.find((u: any) => {
            const candidate = (
              u.username ??
              u.name ??
              u.email?.split("@")[0] ??
              ""
            )
              .toString()
              .toLowerCase();
            return candidate === username;
          });
          const betterAuthUserId = baUser ? resolveBetterAuthUserId(baUser) : null;
          if (betterAuthUserId) {
            try {
              await setBetterAuthUserPassword(
                auth,
                headers,
                betterAuthUserId,
                entry.password
              );
              await ctx.runMutation(api.users.syncBetterAuthUser, {
                betterAuthId: betterAuthUserId,
                username,
                email,
              });
              created++;
              results.push({
                username,
                status: "created",
                reason: "Tài khoản đã tồn tại — đã đặt lại mật khẩu.",
              });
              continue;
            } catch (repairErr: unknown) {
              failed++;
              results.push({
                username,
                status: "duplicate",
                reason:
                  repairErr instanceof Error ? repairErr.message : String(repairErr),
              });
              continue;
            }
          }
        }

        failed++;
        results.push({
          username,
          status: isDuplicate ? "duplicate" : "failed",
          reason: message,
        });
      }
    }

    return { created, failed, results };
  },
});

/**
 * Migration: tự động tạo Better Auth accounts cho tất cả userProfiles
 * chưa có tài khoản Better Auth (users.betterAuthId bị dangling hoặc users doc bị xóa).
 *
 * - Username = fullName normalize (bỏ dấu, lowercase, thay space bằng dấu chấm)
 *   ví dụ: "Nguyễn Văn A" → "nguyen.van.a"
 * - Password tạm = username + "@" + className  (ví dụ: "nguyen.van.a@12A1")
 * - Sau khi chạy, admin vào tab "Tài khoản hệ thống" để đặt lại mật khẩu cho từng người
 *
 * Safe to run multiple times — bỏ qua profiles đã có Better Auth account.
 */
export const migrateProfilesToBetterAuth = action({
  args: {
    dryRun: v.optional(v.boolean()), // true = chỉ preview, không tạo thật
  },
  returns: v.object({
    total: v.number(),
    created: v.number(),
    skipped: v.number(),
    failed: v.number(),
    results: v.array(
      v.object({
        profileId: v.string(),
        fullName: v.string(),
        username: v.string(),
        tempPassword: v.string(),
        status: v.union(
          v.literal("created"),
          v.literal("skipped"),
          v.literal("failed"),
          v.literal("dry_run")
        ),
        reason: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }

    const isDryRun = args.dryRun ?? false;
    await ensureBetterAuthAdminRole(ctx, myProfile.userId);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx as any);

    // Lấy tất cả profiles
    const allProfiles: any[] = await ctx.runQuery(api.users.getAllUserProfiles);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const results: Array<{
      profileId: string;
      fullName: string;
      username: string;
      tempPassword: string;
      status: "created" | "skipped" | "failed" | "dry_run";
      reason?: string;
    }> = [];

    for (const profile of allProfiles) {
      // Check xem users doc của profile này có betterAuthId chưa
      const hasAuth: boolean = await ctx.runQuery(
        internal.users.checkUserHasBetterAuth,
        { userId: profile.userId }
      );

      if (hasAuth) {
        skipped++;
        results.push({
          profileId: profile.profileId,
          fullName: profile.fullName,
          username: "",
          tempPassword: "",
          status: "skipped",
          reason: "Đã có Better Auth account",
        });
        continue;
      }

      // Tạo username từ fullName (bỏ dấu)
      const username = normalizeVietnamese(profile.fullName);
      const tempPassword = `${username}@${profile.className}`;
      const email = `${username}@internal.local`;

      if (isDryRun) {
        results.push({
          profileId: profile.profileId,
          fullName: profile.fullName,
          username,
          tempPassword,
          status: "dry_run",
        });
        continue;
      }

      try {
        const { betterAuthId, username: createdUsername, email: createdEmail } =
          await createBetterAuthUser(auth, headers, {
            username,
            password: tempPassword,
            displayName: profile.fullName,
          });

        await ctx.runMutation(internal.adminMaintenance.patchUserBetterAuthId, {
          userId: profile.userId,
          betterAuthId,
          username: createdUsername,
          email: createdEmail,
        });

        created++;
        results.push({
          profileId: profile.profileId,
          fullName: profile.fullName,
          username: createdUsername,
          tempPassword,
          status: "created",
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.toLowerCase().includes("already") ||
          message.toLowerCase().includes("duplicate") ||
          message.toLowerCase().includes("exist")
        ) {
          const usernameAlt = `${username}.${profile.className.toLowerCase()}`;
          const tempPasswordAlt = `${usernameAlt}@${profile.className}`;
          try {
            const { betterAuthId, username: createdUsername, email: createdEmail } =
              await createBetterAuthUser(auth, headers, {
                username: usernameAlt,
                password: tempPasswordAlt,
                displayName: profile.fullName,
              });
            await ctx.runMutation(internal.adminMaintenance.patchUserBetterAuthId, {
              userId: profile.userId,
              betterAuthId,
              username: createdUsername,
              email: createdEmail,
            });
            created++;
            results.push({
              profileId: profile.profileId,
              fullName: profile.fullName,
              username: createdUsername,
              tempPassword: tempPasswordAlt,
              status: "created",
            });
          } catch (err2: unknown) {
            failed++;
            results.push({
              profileId: profile.profileId,
              fullName: profile.fullName,
              username,
              tempPassword,
              status: "failed",
              reason: err2 instanceof Error ? err2.message : String(err2),
            });
          }
        } else {
          failed++;
          results.push({
            profileId: profile.profileId,
            fullName: profile.fullName,
            username,
            tempPassword,
            status: "failed",
            reason: message,
          });
        }
      }
    }

    return {
      total: allProfiles.length,
      created,
      skipped,
      failed,
      results,
    };
  },
});

// Internal query lives in users.ts (non-Node file) — see internal.users.checkUserHasBetterAuth

// Helper: normalize Vietnamese to ASCII username
function normalizeVietnamese(str: string): string {
  const map: Record<string, string> = {
    à: "a", á: "a", ả: "a", ã: "a", ạ: "a",
    ă: "a", ắ: "a", ằ: "a", ẳ: "a", ẵ: "a", ặ: "a",
    â: "a", ấ: "a", ầ: "a", ẩ: "a", ẫ: "a", ậ: "a",
    è: "e", é: "e", ẻ: "e", ẽ: "e", ẹ: "e",
    ê: "e", ế: "e", ề: "e", ể: "e", ễ: "e", ệ: "e",
    ì: "i", í: "i", ỉ: "i", ĩ: "i", ị: "i",
    ò: "o", ó: "o", ỏ: "o", õ: "o", ọ: "o",
    ô: "o", ố: "o", ồ: "o", ổ: "o", ỗ: "o", ộ: "o",
    ơ: "o", ớ: "o", ờ: "o", ở: "o", ỡ: "o", ợ: "o",
    ù: "u", ú: "u", ủ: "u", ũ: "u", ụ: "u",
    ư: "u", ứ: "u", ừ: "u", ử: "u", ữ: "u", ự: "u",
    ỳ: "y", ý: "y", ỷ: "y", ỹ: "y", ỵ: "y",
    đ: "d",
    À: "a", Á: "a", Ả: "a", Ã: "a", Ạ: "a",
    Ă: "a", Ắ: "a", Ằ: "a", Ẳ: "a", Ẵ: "a", Ặ: "a",
    Â: "a", Ấ: "a", Ầ: "a", Ẩ: "a", Ẫ: "a", Ậ: "a",
    È: "e", É: "e", Ẻ: "e", Ẽ: "e", Ẹ: "e",
    Ê: "e", Ế: "e", Ề: "e", Ể: "e", Ễ: "e", Ệ: "e",
    Ì: "i", Í: "i", Ỉ: "i", Ĩ: "i", Ị: "i",
    Ò: "o", Ó: "o", Ỏ: "o", Õ: "o", Ọ: "o",
    Ô: "o", Ố: "o", Ồ: "o", Ổ: "o", Ỗ: "o", Ộ: "o",
    Ơ: "o", Ớ: "o", Ờ: "o", Ở: "o", Ỡ: "o", Ợ: "o",
    Ù: "u", Ú: "u", Ủ: "u", Ũ: "u", Ụ: "u",
    Ư: "u", Ứ: "u", Ừ: "u", Ử: "u", Ữ: "u", Ự: "u",
    Ỳ: "y", Ý: "y", Ỷ: "y", Ỹ: "y", Ỵ: "y",
    Đ: "d",
  };
  return str
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}
