"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import * as XLSX from "xlsx-js-style";
import { ViolationWithDetails } from "./violations";

// --- Styling Constants ---
const titleStyle = {
  font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { fgColor: { rgb: "4F81BD" } },
};

const dateRangeStyle = {
  font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { fgColor: { rgb: "4F81BD" } },
};

const dayHeaderStyle = {
  font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  fill: { fgColor: { rgb: "8064A2" } },
};

const tableHeaderStyle = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "9BBB59" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const cellStyle = {
  font: { sz: 10 },
  alignment: { vertical: "top", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const cellStyleAlt = { ...cellStyle, fill: { fgColor: { rgb: "F2F2F2" } } };

const noViolationsStyle = {
    font: { italic: true, sz: 10, color: { rgb: "808080" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: cellStyle.border,
};

export const exportEmulationScores = action({
    args: {
        dateRange: v.optional(v.object({ start: v.number(), end: v.number() })),
    },
    handler: async (ctx, args) => {
        const emulationScores = await ctx.runQuery(api.violations.getEmulationScores, args);

        // Sort classes in ascending order
        emulationScores.sort((a, b) => a.className.localeCompare(b.className, 'vi', { numeric: true }));

        // Create Title and Date Range Rows
        const titleRow = ["BẢNG TỔNG HỢP ĐIỂM THI ĐUA"];
        let dateRangeRow = ["Áp dụng cho tuần hiện tại"];
        if (args.dateRange) {
            const { start, end } = args.dateRange;
            const startDate = new Date(start).toLocaleDateString('vi-VN');
            const endDate = new Date(end).toLocaleDateString('vi-VN');
            dateRangeRow = [`Từ ngày ${startDate} đến ngày ${endDate}`];
        }

        const headerRow = [
            "Lớp",
            "Tổng Điểm Trừ",
            "Chi Tiết Vi Phạm",
        ];

        const dataRows: Array<Array<string | number>> = [];
        for (const score of emulationScores) {
            const violationDetails = score.violations.map(v => {
                const studentInfo = v.studentName ? ` (${v.studentName})` : '';
                const detailsInfo = v.details ? `: ${v.details}` : '';
                const dateInfo = new Date(v.violationDate).toLocaleDateString('vi-VN');
                return `${v.violationType}${studentInfo}${detailsInfo} [${dateInfo}]`;
            }).join("\n");

            dataRows.push([
                score.className,
                score.totalPoints > 0 ? `-${score.totalPoints}` : 0,
                violationDetails,
            ]);
        }

        const rows = [
            titleRow,
            dateRangeRow,
            [], // Empty row for spacing
            headerRow,
            ...dataRows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(rows);

        // Merge cells for title and date range
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Merge for title
            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Merge for date range
        );

        // Style title
        if (worksheet['A1']) worksheet['A1'].s = {
            font: { bold: true, sz: 16 },
            alignment: { horizontal: "center", vertical: "center" }
        };

        // Style date range
        if (worksheet['A2']) worksheet['A2'].s = {
            font: { italic: true, sz: 12 },
            alignment: { horizontal: "center", vertical: "center" }
        };

        // Style header (now at row index 3)
        const headerStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "CCCCCC" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        for (let c = 0; c <= 2; c++) {
            const addr = XLSX.utils.encode_cell({ c, r: 3 });
            if (!worksheet[addr]) continue;
            worksheet[addr].s = headerStyle;
        }

        // Apply wrap text to the "Chi Tiết Vi Phạm" column (column C) starting from data row
        for (let i = 0; i < dataRows.length; i++) {
            const cellAddress = XLSX.utils.encode_cell({ r: i + 4, c: 2 });
            if (worksheet[cellAddress]) {
                if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
                (worksheet[cellAddress].s as any).alignment = { wrapText: true, vertical: "top" };
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

        const worksheet = XLSX.utils.aoa_to_sheet([]);
        const merges: XLSX.Range[] = [];
        let R = 0; // Current row index

        const header = [
            "STT",
            "Đối tượng",
            "Tên/Lớp",
            "Chi tiết vi phạm",
            "Điểm trừ",
            "Người báo cáo",
            "Trạng thái",
        ];
        const colWidths = [5, 10, 22, 45, 8, 22, 12];

        // --- Main Title & Date Range --- 
        worksheet['A1'] = { v: "BÁO CÁO VI PHẠM CHI TIẾT", t: 's', s: titleStyle };
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } });
        R++;

        worksheet['A2'] = { v: weekLabel || "Toàn bộ thời gian", t: 's', s: dateRangeStyle };
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } });
        R++;
        R++; // Blank row

        // --- Group Violations by Day --- 
        const violationsByDay = new Map<number, ViolationWithDetails[]>();
        const dayNameVi: Record<number, string> = { 1: "Thứ Hai", 2: "Thứ Ba", 3: "Thứ Tư", 4: "Thứ Năm", 5: "Thứ Sáu", 6: "Thứ Bảy" };

        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        
        violations.forEach(v => {
            const dayStart = startOfDay(new Date(v.violationDate));
            if (!violationsByDay.has(dayStart)) {
                violationsByDay.set(dayStart, []);
            }
            violationsByDay.get(dayStart)!.push(v);
        });

        const sortedDays = Array.from(violationsByDay.keys()).sort((a, b) => a - b);

        // --- Iterate Through Days and Build Sheet --- 
        for (const dayStart of sortedDays) {
            const day = new Date(dayStart).getDay();
            if (day < 1 || day > 6) continue; // Skip Sunday

            const dayDisplay = `${dayNameVi[day]}, ngày ${new Date(dayStart).toLocaleDateString('vi-VN')}`;
            const dayViolations = violationsByDay.get(dayStart)!;

            // Day Header Row
            worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })] = { v: dayDisplay, t: 's', s: dayHeaderStyle };
            merges.push({ s: { r: R, c: 0 }, e: { r: R, c: header.length - 1 } });
            R++;

            // Table Header Row
            header.forEach((h, C) => {
                worksheet[XLSX.utils.encode_cell({ r: R, c: C })] = { v: h, t: 's', s: tableHeaderStyle };
            });
            R++;

            if (dayViolations.length === 0) {
                // No violations row
                worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })] = { v: "(Không có vi phạm)", t: 's', s: noViolationsStyle };
                merges.push({ s: { r: R, c: 0 }, e: { r: R, c: header.length - 1 } });
                R++;
            } else {
                // Data Rows
                dayViolations.sort((a, b) => a.violatingClass.localeCompare(b.violatingClass, 'vi') || (a.studentName || '').localeCompare(b.studentName || '', 'vi'))
                    .forEach((v, i) => {
                        const style = i % 2 === 0 ? cellStyle : cellStyleAlt;
                        const rowData = [
                            { v: i + 1, t: 'n', s: { ...style, alignment: { ...style.alignment, horizontal: 'center' } } },
                            { v: v.targetType === 'student' ? 'Học sinh' : 'Lớp', t: 's', s: style },
                            { v: v.targetType === 'student' ? `${v.studentName} (${v.violatingClass})` : v.violatingClass, t: 's', s: style },
                            { v: `${v.violationType}${v.details ? `: ${v.details}` : ''}`, t: 's', s: style },
                            { v: v.points, t: 'n', s: { ...style, alignment: { ...style.alignment, horizontal: 'center' } } },
                            { v: v.reporterName, t: 's', s: style },
                            { v: v.status, t: 's', s: style },
                        ];
                        rowData.forEach((cell, C) => {
                            worksheet[XLSX.utils.encode_cell({ r: R, c: C })] = cell;
                        });
                        R++;
                    });
            }
            R++; // Blank row between days
        }

        if (sortedDays.length === 0) {
            worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })] = { v: "Không có vi phạm nào trong khoảng thời gian đã chọn.", t: 's' };
            merges.push({ s: { r: R, c: 0 }, e: { r: R, c: header.length - 1 } });
            R++;
        }

        // --- Finalize Worksheet --- 
        worksheet['!merges'] = merges;
        worksheet['!cols'] = colWidths.map(wch => ({ wch }));
        const range = { s: { r: 0, c: 0 }, e: { r: R, c: header.length - 1 } };
        worksheet["!ref"] = XLSX.utils.encode_range(range);

        // --- Create and Return File --- 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao_ViPham");

        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const storageId = await ctx.storage.store(blob);
        try {
            const { internal } = await import("./_generated/api.js");
            await ctx.runMutation((internal as any).adminMaintenance.recordStoredFile, { storageId, kind: "excel" });
        } catch (_) {}

        const url = await ctx.storage.getUrl(storageId);
        return url;
    },
});