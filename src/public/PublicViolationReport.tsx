import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format, startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown, ChevronUp, Eye, Calendar, AlertCircle, AlertTriangle,
  FileText, Loader2, Trophy, X, User, Users, FileWarning, Download, ShieldCheck, Award, Moon, Sun, Printer, Play
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

// --- TYPES ---
type ModalMedia = {
  url: string;
  type: "image" | "video";
  violationInfo: {
    student: string;
    class: string;
    details: string;
  };
};

type TuCategoryId = "tuGiac" | "tuTrong" | "tuChu" | "tuCan" | "tuRen";
type GradeFilter = "all" | 10 | 11 | 12;

type WeeklyRank = {
  label: string;
  shortLabel: string;
  tone: "excellent" | "good" | "fair" | "needsWork";
};

const BASE_SCORE = 120;

const shellStyles = `
  .public-report-shell {
    font-feature-settings: "tnum" 1, "lnum" 1;
  }
  .public-report-shell.theme-dark {
    background: #0f172a;
    color: #f8fafc;
  }
  .glass-header {
    background-color: rgba(255, 255, 255, 0.97) !important;
  }
  .public-report-shell.theme-dark .glass-header {
    background-color: rgba(15, 23, 42, 0.97) !important;
    border-bottom-color: rgba(148, 163, 184, 0.22) !important;
  }
  .glass-card {
    background-color: #ffffff !important;
    border-color: rgba(226, 232, 240, 0.9) !important;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
    border-radius: 10px !important;
    padding: 0 !important;
  }
  .public-report-shell .glass-card.p-8 {
    padding: 2rem !important;
  }
  .public-report-shell .glass-card.px-4 {
    padding: 0.75rem 1rem !important;
  }
  .public-report-shell.theme-dark .glass-card {
    background-color: #1e293b !important;
    border-color: rgba(51, 65, 85, 0.9) !important;
    box-shadow: none !important;
  }
  .glass-day-expanded {
    background: #eef2ff !important;
    color: #1e293b !important;
  }
  .public-report-shell.theme-dark .glass-day-expanded {
    background: rgba(49, 46, 129, 0.35) !important;
    color: #f1f5f9 !important;
  }
  .glass-row { background-color: transparent !important; }
  .glass-row:hover { background-color: rgba(248, 250, 252, 0.9) !important; }
  .public-report-shell.theme-dark .glass-row:hover {
    background-color: rgba(51, 65, 85, 0.45) !important;
  }
  .glass-details { background-color: #f8fafc !important; }
  .public-report-shell.theme-dark .glass-details { background-color: #0f172a !important; }
  .public-report-shell.theme-dark .bg-white { background-color: #1e293b !important; }
  .public-report-shell.theme-dark .bg-slate-50,
  .public-report-shell.theme-dark .bg-slate-50\\/80,
  .public-report-shell.theme-dark .bg-slate-50\\/50,
  .public-report-shell.theme-dark .bg-slate-100,
  .public-report-shell.theme-dark .bg-slate-100\\/80 {
    background-color: #334155 !important;
  }
  .public-report-shell.theme-dark .text-slate-900,
  .public-report-shell.theme-dark .text-slate-800,
  .public-report-shell.theme-dark .text-slate-700 {
    color: #e2e8f0 !important;
  }
  .public-report-shell.theme-dark .text-slate-600,
  .public-report-shell.theme-dark .text-slate-500,
  .public-report-shell.theme-dark .text-slate-400 {
    color: #94a3b8 !important;
  }
  .public-report-shell.theme-dark .border-slate-100,
  .public-report-shell.theme-dark .border-slate-200,
  .public-report-shell.theme-dark .border-slate-300,
  .public-report-shell.theme-dark .border-slate-200\\/60,
  .public-report-shell.theme-dark .border-slate-200\\/80 {
    border-color: rgba(148, 163, 184, 0.26) !important;
  }
  .public-report-shell.theme-dark .reporter-badge {
    background-color: #334155 !important;
    border-color: rgba(148, 163, 184, 0.35) !important;
    box-shadow: none !important;
  }
  .public-report-shell.theme-dark .reporter-badge-inner {
    background-color: #1e293b !important;
  }
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-500),
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-600) {
    background-color: rgba(245, 158, 11, 0.15) !important;
    border-color: rgba(251, 191, 36, 0.42) !important;
  }
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-500) .text-slate-700,
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-600) .text-slate-700 {
    color: #f8fafc !important;
  }
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-500) .text-amber-600,
  .public-report-shell.theme-dark .reporter-badge:has(.text-amber-600) .text-amber-600 {
    color: #fcd34d !important;
    border-color: rgba(251, 191, 36, 0.55) !important;
  }
  .public-report-shell.theme-dark .reporter-badge:has(.text-indigo-500) .text-slate-700 {
    color: #f1f5f9 !important;
  }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .public-report-shell.theme-dark .reporter-label {
    color: #e2e8f0 !important;
    border-color: rgba(148, 163, 184, 0.45) !important;
  }
  .public-report-shell.theme-dark .admin-shield { color: #bfdbfe !important; }
  .tabular-nums { font-variant-numeric: tabular-nums; }

  @media print {
    .no-print, .glass-header button, .public-report-shell button[title] { display: none !important; }
    .public-report-shell { background: #fff !important; color: #0f172a !important; }
    .glass-header, .glass-card { background: #fff !important; box-shadow: none !important; }
    .sticky { position: static !important; }
    a[href]::after { content: none !important; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
`;

const TU_META: Record<TuCategoryId, { label: string; badge: string; className: string }> = {
  tuGiac: {
    label: "I. Tự giác",
    badge: "Tự Giác",
    className: "bg-sky-100 text-sky-900 border-sky-300 font-bold",
  },
  tuTrong: {
    label: "II. Tự trọng",
    badge: "Tự Trọng",
    className: "bg-violet-100 text-violet-900 border-violet-300 font-bold",
  },
  tuChu: {
    label: "III. Tự chủ",
    badge: "Tự Chủ",
    className: "bg-teal-100 text-teal-900 border-teal-300 font-bold",
  },
  tuCan: {
    label: "IV. Tự cẩn",
    badge: "Tự Cẩn",
    className: "bg-rose-100 text-rose-900 border-rose-300 font-bold",
  },
  tuRen: {
    label: "V. Tự rèn",
    badge: "Tự Rèn",
    className: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
  },
};

function tuBadgeClass(category: TuCategoryId, isDarkMode: boolean) {
  if (isDarkMode) {
    switch (category) {
      case "tuGiac":
        return "bg-sky-500/20 text-sky-200 border-sky-400/40 font-semibold";
      case "tuTrong":
        return "bg-violet-500/20 text-violet-200 border-violet-400/40 font-semibold";
      case "tuChu":
        return "bg-teal-500/20 text-teal-200 border-teal-400/40 font-semibold";
      case "tuCan":
        return "bg-rose-500/20 text-rose-200 border-rose-400/40 font-semibold";
      case "tuRen":
        return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40 font-semibold";
    }
  }
  switch (category) {
    case "tuGiac":
      return "bg-sky-100 text-sky-900 border-sky-300 font-bold";
    case "tuTrong":
      return "bg-violet-100 text-violet-900 border-violet-300 font-bold";
    case "tuChu":
      return "bg-teal-100 text-teal-900 border-teal-300 font-bold";
    case "tuCan":
      return "bg-rose-100 text-rose-900 border-rose-300 font-bold";
    case "tuRen":
      return "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold";
  }
}

function normalizeVi(text: string) {
  return text.toLowerCase().normalize("NFC");
}

function categorizeViolation(violationType?: string, details?: string): TuCategoryId | null {
  const haystack = normalizeVi(`${violationType || ""} ${details || ""}`);
  if (!haystack.trim()) return null;

  const groups: Array<{ id: TuCategoryId; keywords: string[] }> = [
    {
      id: "tuCan",
      keywords: [
        "atgt", "an toàn giao thông", "mũ bảo hiểm", "thuốc lá", "thuốc lào", "hút thuốc",
        "đánh nhau", "bạo lực", "chất cấm", "đội mũ", "biển số", "pô chế", "phân khối",
        "để xe", "mã qr",
      ],
    },
    {
      id: "tuChu",
      keywords: [
        "ăn vặt", "đồ ăn", "hàng rào", "hành lang", "ồn", "nô đùa", "mxh", "mạng xã hội",
        "đăng/chia sẻ", "kích động", "xúc phạm",
      ],
    },
    {
      id: "tuTrong",
      keywords: [
        "đồng phục", "đầu tóc", "móng tay", "xăm", "khuyên", "nói tục", "chửi thề",
        "tác phong", "thái độ", "xếp hàng", "chào cờ", "thể dục", "ngoại khóa",
      ],
    },
    {
      id: "tuRen",
      keywords: [
        "trực nhật", "vệ sinh", "rác", "điện", "nước", "tài sản", "hư hỏng", "thư viện",
        "cờ đỏ", "trực tuần", "dụng cụ vệ sinh", "khu tự quản",
      ],
    },
    {
      id: "tuGiac",
      keywords: [
        "đi muộn", "đi học muộn", "chuyên cần", "đồ dùng", "truy bài", "nộp danh sách",
        "văn bản", "kế hoạch", "cuộc thi", "nghỉ học", "thiếu ghế",
      ],
    },
  ];

  for (const group of groups) {
    if (group.keywords.some((kw) => haystack.includes(kw))) return group.id;
  }
  return null;
}

function getWeeklyRank(totalScore: number): WeeklyRank {
  if (totalScore >= 115) return { label: "Xuất sắc", shortLabel: "XS", tone: "excellent" };
  if (totalScore >= 105) return { label: "Tốt", shortLabel: "Tốt", tone: "good" };
  if (totalScore >= 90) return { label: "Khá", shortLabel: "Khá", tone: "fair" };
  return { label: "Trung bình / Cần chấn chỉnh", shortLabel: "TB", tone: "needsWork" };
}

function rankToneClass(tone: WeeklyRank["tone"], isDarkMode: boolean) {
  switch (tone) {
    case "excellent":
      return isDarkMode ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" : "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "good":
      return isDarkMode ? "bg-blue-500/20 text-blue-200 border-blue-400/40" : "bg-blue-50 text-blue-800 border-blue-200";
    case "fair":
      return isDarkMode ? "bg-amber-500/20 text-amber-200 border-amber-400/40" : "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return isDarkMode ? "bg-rose-500/20 text-rose-200 border-rose-400/40" : "bg-rose-50 text-rose-800 border-rose-200";
  }
}

function pointsBadgeClass(points: number, isDarkMode: boolean) {
  if (points >= 20) {
    return isDarkMode
      ? "bg-rose-600 text-white border-rose-400"
      : "bg-rose-600 text-white border-rose-700";
  }
  if (points >= 10) {
    return isDarkMode
      ? "bg-orange-500/25 text-orange-200 border-orange-400/40"
      : "bg-orange-100 text-orange-800 border-orange-200";
  }
  if (points >= 5) {
    return isDarkMode
      ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
      : "bg-amber-50 text-amber-800 border-amber-200";
  }
  return isDarkMode
    ? "bg-slate-700 text-slate-200 border-slate-500/60"
    : "bg-slate-100 text-slate-700 border-slate-200";
}

function isSevereViolation(violation: { points?: number; violationType?: string; details?: string }) {
  if ((violation.points ?? 0) >= 20) return true;
  const haystack = normalizeVi(`${violation.violationType || ""} ${violation.details || ""}`);
  return ["atgt", "thuốc lá", "hút thuốc", "đánh nhau", "bạo lực", "chất cấm"].some((kw) => haystack.includes(kw));
}

function getClassGrade(className: string): 10 | 11 | 12 | null {
  const match = className.match(/^(10|11|12)/);
  if (!match) return null;
  return Number(match[1]) as 10 | 11 | 12;
}

function isImageUrl(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

function isVideoUrl(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

function displayStudentHeading(violation: any): string {
  const name = typeof violation?.studentName === "string" ? violation.studentName.trim() : "";
  if (name) return name;
  if (violation?.targetType === "class") return "Vi phạm cấp lớp";
  return "Không có tên";
}

function getWeekStart(tsOrDate: number | Date) {
  return startOfWeek(new Date(tsOrDate), { weekStartsOn: 1 });
}

function getBreakWindow(baseDateISO: string, breakStartISO?: string | null, breakEndISO?: string | null) {
  if (!breakStartISO || !breakEndISO) return null;
  const baseWeekStart = getWeekStart(new Date(baseDateISO));
  const breakStart = getWeekStart(new Date(breakStartISO));
  const breakEnd = getWeekStart(new Date(breakEndISO));
  if (Number.isNaN(breakStart.getTime()) || Number.isNaN(breakEnd.getTime())) return null;
  const start = breakStart <= breakEnd ? breakStart : breakEnd;
  const end = breakStart <= breakEnd ? breakEnd : breakStart;
  const overlapStart = start < baseWeekStart ? baseWeekStart : start;
  if (overlapStart > end) return null;
  const startWeekIndex = differenceInCalendarWeeks(overlapStart, baseWeekStart, { weekStartsOn: 1 }) + 1;
  const skippedWeeks = differenceInCalendarWeeks(end, overlapStart, { weekStartsOn: 1 }) + 1;
  return { startWeekIndex, skippedWeeks };
}

function toAcademicWeek(rawWeek: number, breakWindow: ReturnType<typeof getBreakWindow>) {
  if (!breakWindow) return rawWeek;
  if (rawWeek < breakWindow.startWeekIndex) return rawWeek;
  return Math.max(1, rawWeek - breakWindow.skippedWeeks);
}

function toCalendarWeek(academicWeek: number, breakWindow: ReturnType<typeof getBreakWindow>) {
  if (!breakWindow) return academicWeek;
  if (academicWeek < breakWindow.startWeekIndex) return academicWeek;
  return academicWeek + breakWindow.skippedWeeks;
}

function TuBadge({ category, isDarkMode = false }: { category: TuCategoryId | null; isDarkMode?: boolean }) {
  if (!category) return null;
  const meta = TU_META[category];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] tracking-wide whitespace-nowrap flex-shrink-0 ${tuBadgeClass(category, isDarkMode)}`}>
      {meta.badge}
    </span>
  );
}

// --- SUB-COMPONENT: VIOLATION ROW ---
const ViolationRow = ({
  violation,
  onOpenEvidence,
  isDarkMode,
}: {
  violation: any;
  onOpenEvidence: (v: any, url: string) => void;
  isDarkMode: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const violationTimestamp = (() => {
    const t = violation?.violationDate ? new Date(violation.violationDate).getTime() : NaN;
    if (!Number.isFinite(t)) return typeof violation?._creationTime === "number" ? violation._creationTime : null;
    return t;
  })();

  const hasDetails = violation.details && violation.details.trim() !== "";
  const evidenceUrls: string[] = (violation.evidenceUrls || []).filter(Boolean);
  const hasEvidence = evidenceUrls.length > 0;
  const reporterName = (violation as any).requesterName || violation.reporterName;
  const isImportedFromAbsenceRequest = Boolean((violation as any).requesterName);
  const reporterIsSuperUser = (violation as any).reporterIsSuperUser || false;
  const reporterCustomization = (violation as any).reporterCustomization || null;
  const isCustomReporter = Boolean(violation.customReporterName);
  const category = categorizeViolation(violation.violationType, violation.details);
  const severe = isSevereViolation(violation);
  const points = Number(violation.points) || 0;

  return (
    <div className={`glass-row transition-colors w-full ${severe ? "border-l-2 border-l-rose-500" : ""}`}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-1 min-w-[2.75rem]">
            <span className="font-bold text-slate-700 text-xs sm:text-sm tabular-nums">{violation.violatingClass}</span>
            <span className={`inline-flex items-center justify-center min-w-[1.75rem] h-5 border font-bold rounded-md text-[10px] px-1.5 tabular-nums ${pointsBadgeClass(points, isDarkMode)}`}>
              -{points}
            </span>
          </div>

          <div className="flex flex-col min-w-0 flex-1 gap-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
              {displayStudentHeading(violation)}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <TuBadge category={category} isDarkMode={isDarkMode} />
              <span className="text-xs text-slate-500 truncate">
                {violation.violationType || "Vi phạm khác"}
              </span>
              {/* Mobile-only compact reporter indicator */}
              {reporterName && (
                <span className="sm:hidden inline-flex items-center gap-0.5 flex-shrink-0 ml-auto">
                  {isImportedFromAbsenceRequest ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 leading-none flex-shrink-0">
                      <FileText className="w-2.5 h-2.5 shrink-0" strokeWidth={2.5} />
                      XN
                    </span>
                  ) : isCustomReporter ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none flex-shrink-0">
                      {reporterCustomization?.icon ? <span className="text-[10px] leading-none">{reporterCustomization.icon}</span> : null}
                      <span className="truncate max-w-[48px]">{reporterName}</span>
                    </span>
                  ) : reporterIsSuperUser ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5 leading-none flex-shrink-0">
                      <ShieldCheck className="w-2.5 h-2.5 shrink-0" strokeWidth={2.5} />
                      <span className="truncate max-w-[48px]">{reporterName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 leading-none flex-shrink-0">
                      <span className="truncate max-w-[48px]">{reporterName}</span>
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {hasEvidence && (
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {evidenceUrls.slice(0, 2).map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => onOpenEvidence(violation, url)}
                  className={`h-9 w-9 rounded-md overflow-hidden border border-slate-200/80 ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-slate-50"}`}
                  title="Xem bằng chứng"
                >
                  {isImageUrl(url) ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-indigo-500">
                      {isVideoUrl(url) ? <Play className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>
              ))}
              {evidenceUrls.length > 2 && (
                <span className="text-[10px] font-semibold text-slate-500">+{evidenceUrls.length - 2}</span>
              )}
            </div>
          )}

          {reporterName && (
            <div className="hidden sm:flex items-center ml-auto pl-2">
              {isImportedFromAbsenceRequest ? (
                <div className="reporter-badge relative inline-flex overflow-hidden rounded-full p-[0.5px] flex-shrink-0 cursor-default border border-emerald-200">
                  <div className="reporter-badge-inner relative flex items-center bg-white rounded-full py-0.5 px-1.5 pl-2 gap-1.5 h-full w-full">
                    <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                    <div className="flex flex-row items-baseline gap-1.5">
                      <span className="text-[9px] font-extrabold tracking-wider text-emerald-700 uppercase leading-none border-r border-emerald-100 pr-1.5">
                        Nhập từ trang xin nghỉ
                      </span>
                      <span className="text-xs font-bold text-slate-700 leading-none truncate max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isCustomReporter ? (
                <div className="reporter-badge relative inline-flex rounded-full flex-shrink-0 cursor-default border border-amber-200/70 bg-amber-50/60 overflow-hidden">
                  <div className="relative flex items-center rounded-full py-0.5 px-1.5 pl-2 gap-1.5">
                    <div className="flex flex-row items-baseline gap-1.5">
                      <span className="text-[9px] font-extrabold tracking-wider text-amber-600 uppercase leading-none border-r border-amber-200 pr-1.5">
                        Nguồn
                      </span>
                      <span className="text-xs font-bold text-slate-700 leading-none truncate max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : reporterIsSuperUser ? (
                <div className="reporter-badge relative inline-flex rounded-full flex-shrink-0 cursor-default border border-slate-200 bg-slate-50/80 overflow-hidden">
                  <div className="relative flex items-center rounded-full py-0.5 px-1.5 pl-2 gap-1.5">
                    <ShieldCheck className="admin-shield w-3.5 h-3.5 text-indigo-700 shrink-0" strokeWidth={2.5} />
                    <div className="flex flex-row items-baseline gap-1.5">
                      <span className="text-[9px] font-extrabold tracking-wider text-slate-700 uppercase leading-none border-r border-slate-200 pr-1.5">
                        Admin nhập
                      </span>
                      <span className="text-xs font-bold text-slate-700 leading-none truncate max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : reporterCustomization ? (
                <div className="reporter-badge relative inline-flex rounded-full flex-shrink-0 cursor-default overflow-hidden border border-slate-200 bg-white">
                  <div className="relative flex items-center rounded-full py-0.5 px-1.5 pl-2 gap-1.5">
                    {reporterCustomization.icon && (
                      <span className="text-sm leading-none shrink-0">{reporterCustomization.icon}</span>
                    )}
                    <div className="flex flex-row items-baseline gap-1.5">
                      <span className="reporter-label text-[9px] font-extrabold tracking-wider text-slate-500 uppercase leading-none border-r border-slate-200 pr-1.5">
                        {reporterCustomization.label || "Nhập bởi"}
                      </span>
                      <span className="text-xs font-bold text-slate-700 leading-none truncate max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="reporter-badge relative inline-flex rounded-full flex-shrink-0 cursor-default border border-slate-200 bg-white overflow-hidden">
                  <div className="relative flex items-center rounded-full py-0.5 px-1.5 pl-2 gap-1.5">
                    <div className="flex flex-row items-baseline gap-1.5">
                      <span className="reporter-label text-[9px] font-extrabold tracking-wider text-slate-500 uppercase leading-none border-r border-slate-200 pr-1.5">
                        Nhập bởi
                      </span>
                      <span className="text-xs font-bold text-slate-700 leading-none truncate max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-slate-400 pl-2 flex-shrink-0">
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="glass-details p-3 sm:p-4 text-sm space-y-3 border-t border-slate-200/80">
          {violationTimestamp && (
            <div className="flex gap-3">
              <div className="mt-0.5 min-w-[20px]"><Calendar className="w-4 h-4 text-slate-400" /></div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày vi phạm</span>
                <p className="text-slate-700 mt-0.5 font-medium">
                  {format(new Date(violationTimestamp), "iiii, dd/MM", { locale: vi })}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="mt-0.5 min-w-[20px]"><AlertTriangle className="w-4 h-4 text-slate-400" /></div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loại vi phạm</span>
              <p className="text-slate-700 mt-0.5 font-medium leading-snug">
                {violation.violationType || "Vi phạm khác"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="mt-0.5 min-w-[20px]"><FileWarning className="w-4 h-4 text-slate-400" /></div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết vi phạm</span>
              <p className="text-slate-700 mt-0.5 leading-relaxed">
                {hasDetails ? violation.details : "Không có mô tả chi tiết."}
              </p>
            </div>
          </div>

          {reporterName && (
            <div className="flex gap-3">
              <div className="mt-0.5 min-w-[20px]"><User className="w-4 h-4 text-slate-400" /></div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người báo cáo</span>
                <p className="text-slate-700 mt-0.5 font-medium">{reporterName}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <div className="mt-1.5 min-w-[20px]"><Eye className="w-4 h-4 text-slate-400" /></div>
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Bằng chứng</span>
              {hasEvidence ? (
                <div className="flex flex-wrap gap-2">
                  {evidenceUrls.map((url: string, i: number) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvidence(violation, url);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors text-xs font-medium ${isDarkMode
                        ? "bg-slate-800 border-indigo-900/50 text-indigo-400 hover:bg-indigo-950/30"
                        : "bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem bằng chứng {i + 1}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Không có bằng chứng đính kèm</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PublicViolationReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"violations" | "scores" | "classSummary">(() => {
    if (location.pathname === "/bang-diem-thi-dua-tho") return "scores";
    return "violations";
  });

  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState("1");
  const [debouncedWeekInput, setDebouncedWeekInput] = useState("1");
  const [selectedClass, setSelectedClass] = useState<string | null>(() => {
    return localStorage.getItem("selectedClassSummary") || null;
  });
  const [isClassSelectorOpen, setIsClassSelectorOpen] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<{ [key: number]: boolean }>({});
  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [hideExcusedAbsence, setHideExcusedAbsence] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    return localStorage.getItem("violationReportUnderstood_v2") === "true";
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [modalState, setModalState] = useState<"welcome" | "mustAgree">("welcome");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");

  const [modalMedia, setModalMedia] = useState<ModalMedia | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [startInteraction, setStartInteraction] = useState({ x: 0, y: 0 });
  const initialPinchDistance = useRef(0);

  const baseDateStr = useQuery(api.users.getSetting, { key: "weekBaseDate" });
  const breakStartDateStr = useQuery(api.users.getSetting, { key: "holidayBreakStartDate" });
  const breakEndDateStr = useQuery(api.users.getSetting, { key: "holidayBreakEndDate" });
  const violations = useQuery(
    api.violations.getPublicViolations,
    dateRange && hasAcknowledged ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const emulationScores = useQuery(
    api.violations.getPublicEmulationScores,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const classViolations = useQuery(
    api.violations.getViolationsByClass,
    activeTab === "classSummary" && selectedClass ? { className: selectedClass } : "skip"
  );

  const violationsByDay = useMemo(() => {
    if (!violations) return new Map();
    const grouped = new Map<number, typeof violations>();
    violations.forEach((v: any) => {
      const dayStart = startOfDay(new Date(v.violationDate)).getTime();
      if (!grouped.has(dayStart)) grouped.set(dayStart, []);
      grouped.get(dayStart)!.push(v);
    });
    return grouped;
  }, [violations]);

  const sortedDays = Array.from(violationsByDay.keys()).sort((a, b) => a - b);
  const breakWindow = useMemo(
    () => (baseDateStr ? getBreakWindow(baseDateStr, breakStartDateStr || null, breakEndDateStr || null) : null),
    [baseDateStr, breakStartDateStr, breakEndDateStr]
  );

  useEffect(() => {
    if (sortedDays.length > 0 && Object.keys(expandedDays).length === 0) {
      const allExpanded: { [key: number]: boolean } = {};
      sortedDays.forEach((day) => {
        allExpanded[day] = true;
      });
      setExpandedDays(allExpanded);
    }
  }, [sortedDays.length]);

  useEffect(() => {
    if (weekNumber && sortedDays.length > 0) {
      setExpandedDays({});
    }
  }, [weekNumber]);

  const currentWeekNumber = useMemo(() => {
    if (!baseDateStr) return 1;
    const base = new Date(baseDateStr);
    const now = new Date();
    const rawWeek = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
    return toAcademicWeek(rawWeek, breakWindow);
  }, [baseDateStr, breakWindow]);

  const classViolationsByWeek = useMemo(() => {
    if (!classViolations || !baseDateStr) return [];

    const base = new Date(baseDateStr);
    const grouped = new Map<number, any[]>();

    classViolations.forEach((v: any) => {
      if (hideExcusedAbsence && v.violationType === "Nghỉ học có phép") return;

      const vDate = new Date(v.violationDate);
      const diffTime = vDate.getTime() - base.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const rawWeek = Math.floor(diffDays / 7) + 1;
      const w = toAcademicWeek(rawWeek, breakWindow);

      if (!grouped.has(w)) grouped.set(w, []);
      grouped.get(w)!.push(v);
    });

    for (const [, rows] of grouped) {
      rows.sort((a: any, b: any) => {
        const at = a?.violationDate ? new Date(a.violationDate).getTime() : (typeof a?._creationTime === "number" ? a._creationTime : 0);
        const bt = b?.violationDate ? new Date(b.violationDate).getTime() : (typeof b?._creationTime === "number" ? b._creationTime : 0);
        return at - bt;
      });
    }

    const weeks: { week: number; violations: any[] }[] = [];
    for (let i = currentWeekNumber; i >= 1; i--) {
      weeks.push({ week: i, violations: grouped.get(i) || [] });
    }
    return weeks;
  }, [classViolations, baseDateStr, currentWeekNumber, hideExcusedAbsence, breakWindow]);

  const classSummaryMetrics = useMemo(() => {
    const allRows = classViolationsByWeek.flatMap((w) => w.violations);
    const totalLost = allRows.reduce((sum, v) => sum + (Number(v.points) || 0), 0);
    const counts: Partial<Record<TuCategoryId, number>> = {};
    for (const v of allRows) {
      const cat = categorizeViolation(v.violationType, v.details);
      if (!cat) continue;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const top = (Object.entries(counts) as Array<[TuCategoryId, number]>).sort((a, b) => b[1] - a[1])[0];
    return {
      totalLost,
      count: allRows.length,
      mostFrequentLabel: top ? TU_META[top[0]].label : "Chưa xác định",
    };
  }, [classViolationsByWeek]);

  const filteredEmulationScores = useMemo(() => {
    if (!emulationScores) return [];
    if (gradeFilter === "all") return emulationScores;
    return emulationScores.filter((score) => getClassGrade(score.className) === gradeFilter);
  }, [emulationScores, gradeFilter]);

  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const now = new Date();
      const rawWeek = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      const academicWeek = toAcademicWeek(rawWeek, breakWindow);
      setWeekNumber(academicWeek);
      setWeekInput(academicWeek.toString());
      setDebouncedWeekInput(academicWeek.toString());
    }
  }, [baseDateStr, breakWindow]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWeekInput(weekInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [weekInput]);

  useEffect(() => {
    if (debouncedWeekInput.trim() === "") {
      setWeekError("Tuần không được để trống");
      return;
    }
    const num = parseInt(debouncedWeekInput, 10);
    if (isNaN(num) || num <= 0) {
      setWeekError("Tuần phải là một số dương hợp lệ");
    } else {
      setWeekError(null);
      setWeekNumber(num);
    }
  }, [debouncedWeekInput]);

  useEffect(() => {
    if (modalMedia) {
      const timer = setTimeout(() => setIsModalVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [modalMedia]);

  useEffect(() => {
    if (baseDateStr && !weekError) {
      const base = new Date(baseDateStr);
      const monday = startOfWeek(base, { weekStartsOn: 1 });
      const calendarWeek = toCalendarWeek(weekNumber, breakWindow);
      const start = new Date(monday.getTime() + (calendarWeek - 1) * 7 * 24 * 60 * 60 * 1000);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      setDateRange({ start: start.getTime(), end: end.getTime() });
    } else {
      setDateRange(undefined);
    }
  }, [weekNumber, baseDateStr, weekError, breakWindow]);

  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  };

  const handleOpenModal = (violation: any, url: string) => {
    resetTransform();
    setIsMediaLoading(true);
    const videoExtensions = ["mp4", "webm", "ogg", "mov"];
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    const extension = url.split(".").pop()?.toLowerCase() || "";

    let type: "image" | "video" | null = null;
    if (videoExtensions.includes(extension)) type = "video";
    else if (imageExtensions.includes(extension)) type = "image";
    else {
      window.open(url, "_blank");
      return;
    }

    setModalMedia({
      url,
      type,
      violationInfo: {
        student: displayStudentHeading(violation),
        class: violation.violatingClass,
        details: violation.details ? `${violation.violationType}: ${violation.details}` : violation.violationType,
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setTimeout(() => setModalMedia(null), 300);
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeekInput(e.target.value);
  };

  const handleClassSelect = (cls: string) => {
    setSelectedClass(cls);
    localStorage.setItem("selectedClassSummary", cls);
    setIsClassSelectorOpen(false);
  };

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleTabChange = (tab: "violations" | "scores" | "classSummary") => {
    setActiveTab(tab);
    if (tab === "scores") {
      navigate("/bang-diem-thi-dua-tho", { replace: true });
    } else if (tab === "violations") {
      navigate("/bang-bao-cao-vi-pham", { replace: true });
    }
  };

  useEffect(() => {
    if (location.pathname === "/bang-diem-thi-dua-tho") {
      setActiveTab("scores");
    } else if (location.pathname === "/bang-bao-cao-vi-pham" && activeTab === "scores") {
      setActiveTab("violations");
    }
  }, [location.pathname]);

  const handleUnderstood = () => {
    if (dontShowAgain) {
      localStorage.setItem("violationReportUnderstood_v2", "true");
    }
    setHasAcknowledged(true);
    setShowWelcomeModal(false);
  };

  const handleClose = () => {
    setModalState("mustAgree");
  };

  useEffect(() => {
    if (hasAcknowledged) {
      setShowWelcomeModal(false);
    }
  }, [hasAcknowledged]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = scale - e.deltaY * 0.005;
    setScale(Math.min(Math.max(newScale, 0.5), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsInteracting(true);
    setStartInteraction({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting) return;
    e.preventDefault();
    setPosition({ x: e.clientX - startInteraction.x, y: e.clientY - startInteraction.y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setIsInteracting(true);
      setStartInteraction({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    } else if (e.touches.length === 2) {
      initialPinchDistance.current = getDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isInteracting) {
      setPosition({ x: e.touches[0].clientX - startInteraction.x, y: e.touches[0].clientY - startInteraction.y });
    } else if (e.touches.length === 2 && initialPinchDistance.current > 0) {
      const newDistance = getDistance(e.touches);
      const newScale = scale * (newDistance / initialPinchDistance.current);
      setScale(Math.min(Math.max(newScale, 0.5), 10));
      initialPinchDistance.current = newDistance;
    }
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
    initialPinchDistance.current = 0;
  };

  const fieldClass = isDarkMode ? "text-slate-100" : "text-slate-800";

  return (
    <div className={`public-report-shell ${isDarkMode ? "theme-dark" : "theme-light"} min-h-screen pb-10 relative ${isDarkMode ? "bg-slate-950" : "bg-slate-50"}`}>
      <style>{shellStyles}</style>

      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-slate-900 border border-slate-700/80" : "bg-white"} rounded-xl shadow-lg max-w-md w-full p-6 space-y-4`}>
            {modalState === "welcome" ? (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-blue-500/20" : "bg-blue-100"}`}>
                    <AlertCircle className={`w-6 h-6 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${fieldClass}`}>CSDLCoDo2BT</h2>
                    <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Thông báo & Hướng dẫn sử dụng</p>
                  </div>
                </div>
                <div className={`space-y-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <p className={`font-medium ${isDarkMode ? "text-blue-300" : "text-blue-800"}`}>
                    Cổng thông tin phục vụ GVCN, BCH Đoàn trường và BGH.
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
                        <FileText className={`w-4 h-4 ${isDarkMode ? "text-indigo-300" : "text-indigo-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${fieldClass}`}>Vi phạm</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Xem vi phạm theo từng ngày trong tuần; mở dòng để xem chi tiết và bằng chứng.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-emerald-500/20" : "bg-emerald-50"}`}>
                        <Users className={`w-4 h-4 ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${fieldClass}`}>Tổng hợp theo lớp</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Chọn lớp để xem toàn bộ vi phạm từ đầu năm học, gom theo tuần.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-amber-500/20" : "bg-amber-50"}`}>
                        <Trophy className={`w-4 h-4 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${fieldClass}`}>Bảng điểm</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Theo dõi điểm thi đua trên nền 120 điểm chuẩn theo tuần.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-green-500/20" : "bg-green-50"}`}>
                        <Eye className={`w-4 h-4 ${isDarkMode ? "text-green-300" : "text-green-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${fieldClass}`}>Ẩn nghỉ có phép</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Sử dụng nút “Ẩn nghỉ CP” để lọc nhanh các trường hợp nghỉ có phép.</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 mt-2 ${isDarkMode ? "bg-blue-500/10 border border-blue-400/30" : "bg-blue-50 border border-blue-200"}`}>
                    <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-blue-200" : "text-blue-800"}`}>
                      <strong>Lưu ý:</strong> Hệ thống ghi nhớ lớp đã chọn tại tab “Tổng hợp theo lớp” cho lần truy cập sau.
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 pt-3 pb-2 ${isDarkMode ? "border-t border-slate-700" : "border-t border-slate-200"}`}>
                  <input
                    type="checkbox"
                    id="dontShowAgain"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dontShowAgain" className={`text-sm cursor-pointer select-none ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Không hiện lại thông báo này
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUnderstood}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Tôi đã hiểu
                  </button>
                  <button
                    onClick={handleClose}
                    className={`px-4 py-2.5 font-medium transition-colors ${isDarkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-800"}`}
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-amber-500/20" : "bg-amber-100"}`}>
                    <AlertCircle className={`w-6 h-6 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
                  </div>
                  <h2 className={`text-lg font-bold ${fieldClass}`}>Xác nhận</h2>
                </div>
                <div className={`space-y-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <p>Vui lòng xác nhận đã đọc hướng dẫn để tiếp tục sử dụng hệ thống.</p>
                </div>
                <div className={`flex items-center gap-2 pt-3 pb-2 ${isDarkMode ? "border-t border-slate-700" : "border-t border-slate-200"}`}>
                  <input
                    type="checkbox"
                    id="dontShowAgain2"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dontShowAgain2" className={`text-sm cursor-pointer select-none ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Không hiện lại thông báo này
                  </label>
                </div>
                <button
                  onClick={handleUnderstood}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
                >
                  Xác nhận
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {modalMedia && (
        <div
          className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-0 transition-opacity duration-300 ease-in-out ${isModalVisible ? "opacity-100" : "opacity-0"}`}
          onMouseMove={modalMedia.type === "image" ? handleMouseMove : undefined}
          onMouseUp={modalMedia.type === "image" ? handleInteractionEnd : undefined}
          onMouseLeave={modalMedia.type === "image" ? handleInteractionEnd : undefined}
        >
          <button onClick={handleCloseModal} className="absolute top-2 right-2 z-50 text-white flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-white/20 transition-colors" aria-label="Đóng">
            <X className="w-6 h-6" />
          </button>

          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[95%] md:max-w-xl bg-black/70 text-white rounded-lg text-sm transition-all duration-300 ease-in-out z-50 overflow-hidden ${!isMediaLoading ? "opacity-100" : "opacity-0"}`}>
            <div className="p-3">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-300" /><span>{modalMedia.violationInfo.student}</span></div>
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-300" /><span>{modalMedia.violationInfo.class}</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/20 text-xs text-slate-200 flex items-center justify-center gap-2">
                <FileWarning className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-left">{modalMedia.violationInfo.details}</span>
              </div>
            </div>
            <a
              href={modalMedia.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white/10 hover:bg-white/20 transition-colors py-2 text-xs font-semibold flex items-center justify-center gap-2 border-t border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              Tải xuống
            </a>
          </div>

          <div className={`transform-gpu transition-all duration-300 ease-in-out max-w-full max-h-full w-full h-full flex items-center justify-center relative ${isModalVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
            {isMediaLoading && (
              <div className="absolute">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              </div>
            )}
            <div className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ease-in-out ${isMediaLoading ? "opacity-0" : "opacity-100"}`}>
              {modalMedia.type === "image" ? (
                <div
                  className="w-full h-full"
                  style={{ touchAction: "none", cursor: isInteracting ? "grabbing" : "grab" }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={resetTransform}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleInteractionEnd}
                >
                  <div className="w-full h-full" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
                    <img src={modalMedia.url} alt="Bằng chứng" className="w-full h-full object-contain" onLoad={() => setIsMediaLoading(false)} />
                  </div>
                </div>
              ) : (
                <video
                  src={modalMedia.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-full object-contain"
                  onLoadedData={() => setIsMediaLoading(false)}
                >
                  Trình duyệt của bạn không hỗ trợ video.
                </video>
              )}
            </div>
          </div>
        </div>
      )}

      {isClassSelectorOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsClassSelectorOpen(false)}>
          <div className={`${isDarkMode ? "bg-slate-900 border border-slate-700" : "bg-white"} rounded-xl shadow-lg max-w-lg w-full p-6`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${fieldClass}`}>
                <Users className="w-5 h-5 text-emerald-600" />
                Chọn lớp
              </h3>
              <button onClick={() => setIsClassSelectorOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[10, 11, 12].map((grade) => (
                <div key={grade} className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-full h-px bg-slate-200"></span>
                    <span className="whitespace-nowrap">Khối {grade}</span>
                    <span className="w-full h-px bg-slate-200"></span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {Array.from({ length: 8 }, (_, i) => `${grade}A${i + 1}`).map((cls) => (
                      <button
                        key={cls}
                        onClick={() => handleClassSelect(cls)}
                        className={`px-2 py-2 text-sm font-medium rounded-lg transition-colors ${selectedClass === cls
                          ? "bg-emerald-600 text-white"
                          : isDarkMode
                            ? "bg-slate-800 text-slate-200 border border-slate-600 hover:border-emerald-400"
                            : "bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200"
                          }`}
                      >
                        {cls.substring(2)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`glass-header border-b ${isDarkMode ? "border-slate-700/60" : "border-slate-200/80"} sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto">
          <div className={`px-3 sm:px-4 py-2 border-b ${isDarkMode ? "border-slate-700/50" : "border-slate-100"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="flex items-center justify-center gap-2 min-w-0">
                <div className={`rounded-full p-1.5 ${isDarkMode ? "bg-slate-100/65" : "bg-white border border-slate-200/80"}`}>
                  <img
                    src="https://www.dropbox.com/scl/fi/qhdckf1zj8svntuz93gcq/csdl512.png?rlkey=ms93xygjfp7mzk727hij811po&st=lt8k0y9x&raw=1"
                    alt="logo"
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-full"
                  />
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <h1 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                    CSDLCoDo2BT
                  </h1>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 no-print">
                <button
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${isDarkMode ? "bg-slate-800 border-slate-600 text-amber-300" : "bg-white border-slate-200 text-indigo-600"
                    }`}
                  title={isDarkMode ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>

                {activeTab === "classSummary" ? (
                  <button
                    onClick={() => setIsClassSelectorOpen(true)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg border transition-colors group ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200 hover:border-emerald-300"
                      }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-0.5">Lớp</span>
                      <span className="text-sm font-bold text-slate-800 leading-none group-hover:text-emerald-700">
                        {selectedClass || "Chọn lớp"}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  </button>
                ) : (
                  <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border flex-shrink-0 ${isDarkMode ? "bg-slate-800/70 border-slate-600/80" : "bg-white border-slate-200"}`}>
                    <Calendar className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`} />
                    <div className="flex items-center gap-1.5">
                      <label className={`text-xs sm:text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Tuần:</label>
                      <input
                        type="text"
                        value={weekInput}
                        onChange={handleWeekChange}
                        className={`border px-1.5 sm:px-2 py-0.5 sm:py-1 w-10 sm:w-16 text-center text-xs sm:text-sm rounded font-medium tabular-nums ${weekError
                          ? isDarkMode
                            ? "border-red-500/80 bg-red-500/15 text-red-200"
                            : "border-red-400 bg-red-50"
                          : isDarkMode
                            ? "border-slate-500 bg-slate-900/70 text-slate-100"
                            : "border-slate-300"
                          }`}
                      />
                    </div>
                    {dateRange && (
                      <span className={`text-[10px] sm:text-xs whitespace-nowrap ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        ({format(new Date(dateRange.start), "dd/MM")} - {format(new Date(dateRange.end), "dd/MM")})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {weekError && (
              <div className="mt-1.5 flex items-center justify-center gap-1 text-red-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>{weekError}</span>
              </div>
            )}
          </div>

          <div className="px-3 sm:px-4 py-0 no-print">
            <div className={`flex items-end justify-center sm:justify-start border-b-2 ${isDarkMode ? "border-slate-700/50" : "border-slate-200"}`}>
              <button
                onClick={() => handleTabChange("violations")}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === "violations"
                  ? isDarkMode
                    ? "text-indigo-300 border-indigo-300"
                    : "text-indigo-600 border-indigo-600"
                  : "border-transparent " + (isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Vi phạm</span>
                </span>
              </button>
              <button
                onClick={() => handleTabChange("scores")}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === "scores"
                  ? isDarkMode
                    ? "text-amber-300 border-amber-300"
                    : "text-amber-600 border-amber-600"
                  : "border-transparent " + (isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Bảng điểm</span>
                </span>
              </button>
              <button
                onClick={() => handleTabChange("classSummary")}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === "classSummary"
                  ? isDarkMode
                    ? "text-emerald-300 border-emerald-300"
                    : "text-emerald-600 border-emerald-600"
                  : "border-transparent " + (isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Tổng hợp theo lớp</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`glass-header border-b no-print ${isDarkMode ? "border-slate-700/50" : "border-slate-200/80"}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed flex-1 min-w-[200px]">
            {activeTab === "violations" ? (
              <>Dữ liệu vi phạm được cập nhật bởi Ban Cờ đỏ. Nếu phát hiện sai sót, vui lòng phản ánh với thành viên Ban Cờ đỏ hoặc Quản trị viên.</>
            ) : activeTab === "scores" ? (
              <>Bảng điểm thi đua tính trên điểm chuẩn {BASE_SCORE}, dựa trên vi phạm đã ghi nhận. Chưa bao gồm điểm giờ học và điểm thưởng (nếu có).</>
            ) : (
              <>Tổng hợp vi phạm của lớp {selectedClass || "—"} từ đầu năm học đến nay, sắp xếp theo tuần mới nhất.</>
            )}
          </p>

          {(activeTab === "violations" || activeTab === "classSummary") && (
            <button
              onClick={() => setHideExcusedAbsence(!hideExcusedAbsence)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-[10px] sm:text-xs font-medium whitespace-nowrap flex-shrink-0 ${hideExcusedAbsence
                ? isDarkMode
                  ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/50"
                  : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                : isDarkMode
                  ? "bg-slate-700/60 text-slate-200 hover:bg-slate-600/70 border border-slate-500/70"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              title={hideExcusedAbsence ? "Đang ẩn nghỉ có phép" : "Đang hiện nghỉ có phép"}
            >
              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{hideExcusedAbsence ? "Ẩn nghỉ CP" : "Hiện tất cả"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-3">
        {activeTab === "violations" ? (
          <>
            {violations === undefined && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-base font-medium text-slate-700">Đang tải dữ liệu...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            )}
            {violations && violations.length === 0 && (
              <div className="glass-card border border-slate-200/80 rounded-lg p-8 text-center mt-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Không ghi nhận vi phạm</p>
                <p className="text-sm text-slate-500">Không có vi phạm nào trong tuần này (Bảo toàn {BASE_SCORE} điểm chuẩn)</p>
              </div>
            )}

            <div className="space-y-4 mt-2">
              {sortedDays.map((dayTimestamp) => {
                const allDayViolations = violationsByDay.get(dayTimestamp)!;
                const dayViolations = hideExcusedAbsence
                  ? allDayViolations.filter((v: { violationType: string }) => v.violationType !== "Nghỉ học có phép")
                  : allDayViolations;
                const isExpanded = expandedDays[dayTimestamp] === true;

                if (hideExcusedAbsence && dayViolations.length === 0) {
                  const excusedAbsenceCount = allDayViolations.filter((v: { violationType: string }) => v.violationType === "Nghỉ học có phép").length;
                  if (excusedAbsenceCount === 0) return null;
                  return (
                    <div key={dayTimestamp} className="w-full glass-card text-slate-500 !px-4 !py-3 rounded-xl flex items-center justify-between border border-slate-200/80">
                      <span className="font-semibold text-sm">{format(new Date(dayTimestamp), "iiii, dd/MM", { locale: vi })}</span>
                      <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200">Chỉ có {excusedAbsenceCount} nghỉ CP</span>
                    </div>
                  );
                }

                if (dayViolations.length === 0) return null;

                return (
                  <div key={dayTimestamp} className="glass-card !p-0 border border-slate-200/80 overflow-hidden mb-3">
                    <button
                      onClick={() => toggleDay(dayTimestamp)}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${isExpanded ? "glass-day-expanded" : "glass-row " + (isDarkMode ? "text-slate-200" : "text-slate-800")
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm sm:text-base capitalize ${isExpanded ? (isDarkMode ? "text-slate-100" : "text-slate-800") : ""}`}>
                          {format(new Date(dayTimestamp), "iiii", { locale: vi })}
                        </span>
                        <span className={`text-xs sm:text-sm font-medium px-2 py-0.5 rounded-full tabular-nums ${isExpanded
                          ? isDarkMode ? "bg-slate-700/50 text-slate-200" : "bg-slate-200 text-slate-700"
                          : isDarkMode ? "bg-slate-700/50 text-slate-300" : "bg-slate-100 text-slate-600"
                          }`}>
                          {format(new Date(dayTimestamp), "dd/MM")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded tabular-nums ${isExpanded
                          ? isDarkMode ? "bg-slate-700/50 text-slate-200" : "bg-slate-200 text-slate-700"
                          : isDarkMode ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/30" : "bg-indigo-50 text-indigo-600"
                          }`}>
                          {dayViolations.length} vi phạm
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    <div className={`overflow-hidden ${isExpanded ? "max-h-[9999px]" : "max-h-0"}`}>
                      <div className="border-t border-slate-200/80">
                        <div className="divide-y divide-slate-200/80">
                          {dayViolations.map((v: any) => (
                            <ViolationRow
                              key={v._id}
                              violation={v}
                              onOpenEvidence={handleOpenModal}
                              isDarkMode={isDarkMode}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : activeTab === "scores" ? (
          <>
            {emulationScores === undefined && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-base font-medium text-slate-700">Đang tải dữ liệu...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            )}

            {emulationScores && emulationScores.length === 0 && (
              <div className="glass-card rounded-lg border border-slate-200/80 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Award className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Chưa có dữ liệu</p>
                <p className="text-sm text-slate-500">Chưa có điểm thi đua cho tuần này</p>
              </div>
            )}

            {emulationScores && emulationScores.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                  <div className="inline-flex rounded-lg border border-slate-200/80 overflow-hidden">
                    {([
                      ["all", "Tất cả"],
                      [10, "Khối 10"],
                      [11, "Khối 11"],
                      [12, "Khối 12"],
                    ] as Array<[GradeFilter, string]>).map(([value, label]) => (
                      <button
                        key={String(value)}
                        onClick={() => setGradeFilter(value)}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${gradeFilter === value
                          ? isDarkMode
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-amber-50 text-amber-800"
                          : isDarkMode
                            ? "text-slate-300 hover:bg-slate-800"
                            : "text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    In bảng điểm
                  </button>
                </div>

                {filteredEmulationScores.length === 0 ? (
                  <div className="glass-card rounded-lg border border-slate-200/80 p-8 text-center">
                    <p className="text-sm text-slate-500">Không có lớp thuộc khối đã chọn trong tuần này.</p>
                  </div>
                ) : (
                  <div className="glass-card !p-0 rounded-lg overflow-hidden border border-slate-200/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className={`${isDarkMode ? "bg-slate-800/80 border-b border-slate-600/80" : "bg-slate-50 border-b border-slate-200"}`}>
                            <th className={`px-2 py-3 text-center font-semibold w-16 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Lớp</th>
                            <th className={`px-2 py-3 text-center font-semibold w-20 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Điểm trừ</th>
                            <th className={`px-2 py-3 text-center font-semibold w-20 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Tổng điểm</th>
                            <th className={`px-2 py-3 text-center font-semibold w-36 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Xếp loại tuần</th>
                            <th className={`px-2 py-3 text-left font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Chi tiết vi phạm</th>
                          </tr>
                        </thead>
                        <tbody className={`${isDarkMode ? "divide-y divide-slate-700/60" : "divide-y divide-slate-100"}`}>
                          {filteredEmulationScores.map((score) => {
                            const totalScore = BASE_SCORE - score.totalPoints;
                            const rank = getWeeklyRank(totalScore);
                            return (
                              <tr key={score.className} className="glass-row">
                                <td className="px-2 py-3 text-center align-top">
                                  <span className={`font-semibold tabular-nums ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{score.className}</span>
                                </td>
                                <td className="px-2 py-3 text-center align-top">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded font-bold text-sm tabular-nums ${score.totalPoints > 0
                                    ? isDarkMode ? "bg-red-500/20 text-red-200" : "bg-red-100 text-red-700"
                                    : isDarkMode ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-100 text-emerald-700"
                                    }`}>
                                    {score.totalPoints > 0 ? `-${score.totalPoints}` : score.totalPoints}
                                  </span>
                                </td>
                                <td className="px-2 py-3 text-center align-top">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded font-bold text-sm tabular-nums ${rankToneClass(rank.tone, isDarkMode)}`}>
                                    {totalScore}
                                  </span>
                                </td>
                                <td className="px-2 py-3 text-center align-top">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md border text-[11px] font-semibold ${rankToneClass(rank.tone, isDarkMode)}`}>
                                    {rank.label}
                                  </span>
                                </td>
                                <td className="px-2 py-3 align-top">
                                  {score.violations.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {score.violations.map((v) => {
                                        const cat = categorizeViolation(v.violationType, v.details);
                                        const severe = isSevereViolation(v);
                                        return (
                                          <li
                                            key={v._id}
                                            className={`flex items-start gap-2 rounded-md px-1.5 py-1 ${severe ? (isDarkMode ? "bg-rose-500/15 border border-rose-400/30" : "bg-rose-50 border border-rose-200") : ""
                                              }`}
                                          >
                                            <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"} mt-0.5`}>•</span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <TuBadge category={cat} isDarkMode={isDarkMode} />
                                                {severe && (
                                                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "border-rose-400/40 text-rose-200" : "border-rose-200 text-rose-700 bg-white"
                                                    }`}>
                                                    Vi phạm nghiêm trọng
                                                  </span>
                                                )}
                                                <span className={`inline-flex rounded border px-1 py-0.5 text-[10px] font-bold tabular-nums ${pointsBadgeClass(v.points ?? 0, isDarkMode)}`}>
                                                  -{v.points ?? 0}
                                                </span>
                                              </div>
                                              <div className="mt-0.5">
                                                <span className={`font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{v.violationType}</span>
                                                {v.studentName && (
                                                  <span className={`${isDarkMode ? "text-slate-300" : "text-slate-600"}`}> ({v.studentName})</span>
                                                )}
                                                {v.details && (
                                                  <span className={`${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>: {v.details}</span>
                                                )}
                                                <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"} text-xs ml-2`}>
                                                  ({format(new Date(v.violationDate), "dd/MM")})
                                                </span>
                                              </div>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <span className="text-slate-400 italic text-sm">Lớp không ghi nhận vi phạm trong tuần này (Bảo toàn {BASE_SCORE} điểm chuẩn)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {!selectedClass ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-slate-800">Chưa chọn lớp</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Vui lòng chọn một lớp để xem tổng hợp vi phạm.
                  </p>
                  <button
                    onClick={() => setIsClassSelectorOpen(true)}
                    className="mt-4 px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Chọn lớp
                  </button>
                </div>
              </div>
            ) : classViolations === undefined ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-base font-medium text-slate-700">Đang tải dữ liệu lớp {selectedClass}...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            ) : classViolations && classViolationsByWeek.length === 0 ? (
              <div className="glass-card rounded-lg border border-slate-200/80 p-8 text-center mt-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Chưa có dữ liệu</p>
                <p className="text-sm text-slate-500">Không tìm thấy dữ liệu vi phạm cho lớp này</p>
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="glass-card border border-slate-200/80 !px-4 !py-3">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Tổng số vi phạm</p>
                    <p className="text-lg font-bold tabular-nums text-slate-800 mt-0.5">{classSummaryMetrics.count}</p>
                  </div>
                  <div className="glass-card border border-slate-200/80 !px-4 !py-3">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Tổng điểm trừ</p>
                    <p className="text-lg font-bold tabular-nums text-rose-700 mt-0.5">-{classSummaryMetrics.totalLost}</p>
                  </div>
                  <div className="glass-card border border-slate-200/80 !px-4 !py-3">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Nhóm vi phạm thường gặp</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{classSummaryMetrics.mostFrequentLabel}</p>
                  </div>
                </div>

                {classViolationsByWeek.map(({ week, violations }) => (
                  <div key={week} className="glass-card !p-0 border border-slate-200/80 overflow-hidden mb-3">
                    <div className={`w-full px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? "border-slate-600/70" : "border-slate-200/80"} glass-row`}>
                      <span className={`font-bold text-sm sm:text-base ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Tuần {week}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded tabular-nums ${violations.length > 0
                        ? isDarkMode ? "bg-red-500/20 text-red-200 border border-red-400/40" : "bg-red-50 text-red-600 border border-red-100"
                        : isDarkMode ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        }`}>
                        {violations.length > 0 ? `${violations.length} vi phạm` : "Không có vi phạm"}
                      </span>
                    </div>

                    {violations.length > 0 ? (
                      <div className={`${isDarkMode ? "divide-y divide-slate-700/60" : "divide-y divide-slate-200/80"}`}>
                        {violations.map((v: any) => (
                          <ViolationRow
                            key={v._id}
                            violation={v}
                            onOpenEvidence={handleOpenModal}
                            isDarkMode={isDarkMode}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={`p-4 text-center text-sm ${isDarkMode ? "text-slate-300 glass-row" : "text-slate-500 glass-row"}`}>
                        Lớp không ghi nhận vi phạm trong tuần này (Bảo toàn {BASE_SCORE} điểm chuẩn)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PublicViolationReport;
