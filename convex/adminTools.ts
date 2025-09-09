"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import * as XLSX from "xlsx";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

export const clearStoredFiles = action({
  args: { kind: v.optional(v.union(v.literal("all"), v.literal("evidence"), v.literal("excel"))) },
  handler: async (ctx, args) => {
    const myProfile = await ctx.runQuery(api.users.getMyProfile);
    if (myProfile?.role !== "admin") throw new Error("Bạn không có quyền thực hiện hành động này.");
    await ctx.runMutation(internal.adminMaintenance.clearStoredFilesMutation, { kind: args.kind ?? "all" });
  }
});

export const exportRosterTemplate = action({
  args: {},
  handler: async (ctx) => {
    const classes: Array<string> = [];
    for (const grade of [10, 11, 12]) {
      for (let i = 1; i <= 8; i++) {
        classes.push(`${grade}A${i}`);
      }
    }
    const columns = classes;
    const sheetData = [columns];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Danh_Sach");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const storageId = await ctx.storage.store(blob);
    return await ctx.storage.getUrl(storageId);
  }
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

