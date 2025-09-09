"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import * as XLSX from "xlsx-js-style";
import { ViolationWithDetails } from "./violations";

export const exportEmulationScores = action({
    args: {
        dateRange: v.optional(v.object({ start: v.number(), end: v.number() })),
    },
    handler: async (ctx, args) => {
        const emulationScores = await ctx.runQuery(api.violations.getEmulationScores, args);

        // Sort classes in ascending order
        emulationScores.sort((a, b) => a.className.localeCompare(b.className, 'vi', { numeric: true }));

        const headerRow = [
            "Lớp",
            "Tổng Điểm Trừ",
            "Chi Tiết Vi Phạm",
        ];

        const rows: Array<Array<string | number>> = [headerRow];

        for (const score of emulationScores) {
            const violationDetails = score.violations.map(v =>
                `${v.violationType}${v.details ? `: ${v.details}` : ''} (${new Date(v.violationDate).toLocaleDateString('vi-VN')})`
            ).join("\n");

            rows.push([
                score.className,
                score.totalPoints > 0 ? `-${score.totalPoints}` : 0,
                violationDetails,
            ]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(rows);

        // Style header
        const range = XLSX.utils.decode_range((worksheet as any)["!ref"] || "A1:A1");
        for (let c = 0; c <= 2; c++) {
            const addr = XLSX.utils.encode_cell({ c, r: 0 });
            if (!(worksheet as any)[addr]) continue;
            (worksheet as any)[addr].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "CCCCCC" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        // Apply wrap text to the "Chi Tiết Vi Phạm" column (column C)
        for (let i = 1; i < rows.length; i++) {
            const cellAddress = XLSX.utils.encode_cell({ r: i, c: 2 });
            if ((worksheet as any)[cellAddress]) {
                (worksheet as any)[cellAddress].s = {
                    alignment: { wrapText: true, vertical: "top" }
                };
            }
        }


        // Set column widths
        (worksheet as any)["!cols"] = [
            { wch: 10 },  // Lớp
            { wch: 15 },  // Tổng Điểm Trừ
            { wch: 100 }, // Chi Tiết Vi Phạm
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Điểm_thi_đua");

        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const storageId = await ctx.storage.store(blob);
        try {
            const { internal } = await import("./_generated/api.js");
            await ctx.runMutation((internal as any).adminMaintenance.recordStoredFile, { storageId, kind: "excel" });
        } catch (_) {}

        const url = await ctx.storage.getUrl(storageId);
        return url;
    },
});

export const exportViolations = action({
    args: {
        grade: v.optional(v.number()),
        className: v.optional(v.string()),
        dateRange: v.optional(v.object({ start: v.number(), end: v.number() })),
        targetType: v.optional(v.union(v.literal("student"), v.literal("class"))),
        weekLabel: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { weekLabel, ...filters } = args as any;
        const violations: ViolationWithDetails[] = await ctx.runQuery(api.violations.getAllViolationsForAdmin, filters);

        // Build an array-of-arrays grouped by weekdays (Mon-Sat)
        const headerRow = [
            "Ngày Vi Phạm",
            "Đối tượng",
            "Tên Học Sinh",
            "Lớp Vi Phạm",
            "Loại Vi Phạm",
            "Chi Tiết",
            "Người Báo Cáo",
            "Trạng Thái",
            "Lý Do Kháng Cáo",
            "Bằng Chứng URLs",
        ];

        const dayNameVi: Record<number, string> = {
            1: "Thứ Hai",
            2: "Thứ Ba",
            3: "Thứ Tư",
            4: "Thứ Năm",
            5: "Thứ Sáu",
            6: "Thứ Bảy",
        };

        const startTime = args.dateRange?.start ?? 0;
        const endTime = args.dateRange?.end ?? Date.now();

        // Helper: normalize to start/end of day in local time
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const endOfDayTs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

        // Iterate days from start to end, include only Mon-Sat (1..6)
        const rows: Array<Array<string>> = [];
        if (weekLabel && (weekLabel as string).trim().length > 0) {
            rows.push([weekLabel as string]);
            rows.push([]);
        }
        let cursor = new Date(startTime);
        while (cursor.getTime() <= endTime) {
            const day = cursor.getDay(); // 0=Sun..6=Sat
            if (day >= 1 && day <= 6) {
                const dayStart = startOfDay(cursor);
                const dayEnd = endOfDayTs(cursor);
                const dayDisplay = `${dayNameVi[day]} (${new Date(dayStart).toLocaleDateString('vi-VN')})`;

                // Section header
                rows.push([dayDisplay]);
                // Column headers
                rows.push(headerRow);

                const dayViolations = violations
                    .filter(v => v.violationDate >= dayStart && v.violationDate <= dayEnd)
                    .sort((a, b) => {
                        const clsA = (a.violatingClass || "");
                        const clsB = (b.violatingClass || "");
                        if (clsA !== clsB) return clsA.localeCompare(clsB, 'vi');
                        // Individual (student) first, then class-level
                        const rank = (t: string) => (t === 'student' ? 0 : 1);
                        const rA = rank(a.targetType as string);
                        const rB = rank(b.targetType as string);
                        if (rA !== rB) return rA - rB;
                        return a.violationDate - b.violationDate;
                    });
                if (dayViolations.length === 0) {
                    rows.push(["(Không có vi phạm)"]);
                } else {
                    for (const v of dayViolations) {
                        rows.push([
                            new Date(v.violationDate).toLocaleString('vi-VN'),
                            v.targetType === 'student' ? 'Học sinh' : 'Lớp',
                            v.studentName ?? '',
                            v.violatingClass,
                            v.violationType,
                            v.details ?? "",
                            v.reporterName,
                            v.status,
                            v.appealReason ?? '',
                            v.evidenceUrls.filter(url => url !== null).join(", "),
                        ]);
                    }
                }

                // Blank row between days
                rows.push([]);
            }

            // Move to next day
            cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }

        // Fallback: if no rows generated (e.g., date range only Sunday), create a placeholder
        if (rows.length === 0) {
            rows.push(["Không có ngày hợp lệ (Thứ Hai đến Thứ Bảy) trong khoảng đã chọn."]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        // Bold styling for headers and section titles
        try {
            const range = XLSX.utils.decode_range((worksheet as any)["!ref"] || "A1:A1");
            const maxCols = headerRow.length;
            const boldRow = (r: number) => {
                for (let c = 0; c < maxCols; c++) {
                    const addr = XLSX.utils.encode_cell({ c, r });
                    if (!(worksheet as any)[addr]) continue;
                    (worksheet as any)[addr].s = {
                        font: { bold: true }
                    };
                }
            };
            for (let r = range.s.r; r <= range.e.r; r++) {
                const firstAddr = XLSX.utils.encode_cell({ c: 0, r });
                const cell = (worksheet as any)[firstAddr];
                const text = (cell && typeof cell.v === 'string') ? cell.v : '';
                if (!text) continue;
                if (text === headerRow[0]) boldRow(r);
                if (text.startsWith('Thứ ') || text.startsWith('Tuần ') || text.startsWith('Tháng ') || text.startsWith('Khoảng ngày')) boldRow(r);
            }
        } catch {}
        // Optional: set column widths for readability (applies where headers exist)
        (worksheet as any)["!cols"] = [
            { wch: 19 }, // Ngày Vi Phạm
            { wch: 10 }, // Đối tượng
            { wch: 20 }, // Tên Học Sinh
            { wch: 12 }, // Lớp Vi Phạm
            { wch: 20 }, // Loại Vi Phạm
            { wch: 40 }, // Chi Tiết
            { wch: 20 }, // Người Báo Cáo
            { wch: 12 }, // Trạng Thái
            { wch: 25 }, // Lý Do Kháng Cáo
            { wch: 40 }, // Bằng Chứng URLs
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vi_pham_theo_ngay");

        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

        // Ensure a valid content type so Convex sets a proper Content-Type header
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const storageId = await ctx.storage.store(blob);
        // Optionally record stored excel file via internal mutation (actions can't access db directly)
        try {
            const { internal } = await import("./_generated/api.js");
            await ctx.runMutation((internal as any).adminMaintenance.recordStoredFile, { storageId, kind: "excel" });
        } catch (_) {}
        // Note: Actions cannot access DB; tracking of stored files is skipped here

        const url = await ctx.storage.getUrl(storageId);
        return url;
    },
});