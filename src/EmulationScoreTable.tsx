import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useMemo, useEffect } from "react";
import { DateRange } from "react-day-picker";
import {
  format,
  startOfWeek,
  endOfDay,
  differenceInCalendarWeeks,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Search,
  Award,
  Eye,
  X,
  Info,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  export5TuExcelWorkbook,
  CRITERIA_5_TU,
  matchViolationToCriterion,
  getWeeklyRank,
  computeClassRankings,
  ClassViolationData,
} from "./lib/excel5TuReport";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

function cn(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function getWeekStart(tsOrDate: number | Date) {
  return startOfWeek(new Date(tsOrDate), { weekStartsOn: 1 });
}

function getBreakWindow(
  baseDateISO: string,
  breakStartISO?: string | null,
  breakEndISO?: string | null
) {
  if (!breakStartISO || !breakEndISO) return null;
  const baseWeekStart = getWeekStart(new Date(baseDateISO));
  const breakStart = getWeekStart(new Date(breakStartISO));
  const breakEnd = getWeekStart(new Date(breakEndISO));
  if (Number.isNaN(breakStart.getTime()) || Number.isNaN(breakEnd.getTime())) return null;
  const start = breakStart <= breakEnd ? breakStart : breakEnd;
  const end = breakStart <= breakEnd ? breakEnd : breakStart;
  const overlapStart = start < baseWeekStart ? baseWeekStart : start;
  if (overlapStart > end) return null;
  const startWeekIndex =
    differenceInCalendarWeeks(overlapStart, baseWeekStart, { weekStartsOn: 1 }) + 1;
  const skippedWeeks =
    differenceInCalendarWeeks(end, overlapStart, { weekStartsOn: 1 }) + 1;
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

export default function EmulationScoreTable({ isDarkMode = false }: { isDarkMode?: boolean }) {
  // Current user info
  const currentUser = useQuery(api.users.getLoggedInUser);
  const creatorName =
    (currentUser as any)?.profile?.fullName ||
    currentUser?.name ||
    currentUser?.username ||
    "Quản trị viên";

  // Academic week settings from DB
  const savedWeekBase = useQuery(api.users.getSetting, { key: "weekBaseDate" });
  const savedBreakStart = useQuery(api.users.getSetting, { key: "holidayBreakStartDate" });
  const savedBreakEnd = useQuery(api.users.getSetting, { key: "holidayBreakEndDate" });
  const roster = useQuery(api.users.listRoster);

  // Filter mode: 'week' | 'custom'
  const [dateMode, setDateMode] = useState<"week" | "custom">("week");
  const [academicWeek, setAcademicWeek] = useState<number>(1);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [gradeFilter, setGradeFilter] = useState<"all" | "10" | "11" | "12">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "class">("rank");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Modal preview of a specific class
  const [previewClass, setPreviewClass] = useState<ClassViolationData | null>(null);

  const breakWindow = useMemo(() => {
    if (!savedWeekBase || typeof savedWeekBase !== "string") return null;
    return getBreakWindow(
      savedWeekBase,
      typeof savedBreakStart === "string" ? savedBreakStart : null,
      typeof savedBreakEnd === "string" ? savedBreakEnd : null
    );
  }, [savedWeekBase, savedBreakStart, savedBreakEnd]);

  // Compute current academic week from base date
  useEffect(() => {
    try {
      const baseDate = savedWeekBase && typeof savedWeekBase === "string" ? savedWeekBase : new Date().toISOString().slice(0, 10);
      const base = toZonedTime(new Date(baseDate), TIME_ZONE);
      const now = toZonedTime(new Date(), TIME_ZONE);
      const rawWeeks = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      const aw = toAcademicWeek(Math.max(1, rawWeeks), breakWindow);
      setAcademicWeek(aw);
    } catch {
      setAcademicWeek(1);
    }
  }, [savedWeekBase, breakWindow]);

  // Compute active date timestamps [start, end]
  const activeDateRange = useMemo(() => {
    if (dateMode === "custom") {
      if (customRange?.from) {
        return {
          start: customRange.from.getTime(),
          end: endOfDay(customRange.to ?? customRange.from).getTime(),
        };
      }
      return undefined;
    }

    // Week mode
    const baseDate = savedWeekBase && typeof savedWeekBase === "string" ? savedWeekBase : new Date().toISOString().slice(0, 10);
    const base = toZonedTime(new Date(baseDate), TIME_ZONE);
    const calendarWeek = toCalendarWeek(academicWeek, breakWindow);
    const mondayMs =
      startOfWeek(base, { weekStartsOn: 1 }).getTime() +
      (calendarWeek - 1) * 7 * 24 * 60 * 60 * 1000;
    const start = mondayMs;
    const end = endOfDay(new Date(mondayMs + 6 * 24 * 60 * 60 * 1000)).getTime();
    return { start, end };
  }, [dateMode, academicWeek, customRange, savedWeekBase, breakWindow]);

  // Query scores from Convex
  const rawScores = useQuery(
    api.violations.getPublicEmulationScores,
    activeDateRange ? { start: activeDateRange.start, end: activeDateRange.end } : "skip"
  );

  // Combine scores with all classes from roster so classes with 0 violations also appear
  const mergedScores = useMemo(() => {
    const scoreMap = new Map<string, ClassViolationData>();

    // 1. Fill from rawScores
    if (rawScores) {
      for (const item of rawScores) {
        scoreMap.set(item.className, {
          className: item.className,
          totalPoints: item.totalPoints,
          violations: item.violations || [],
        });
      }
    }

    // 2. Fill missing classes from student roster
    if (roster) {
      for (const r of roster) {
        if (r.className && !scoreMap.has(r.className)) {
          scoreMap.set(r.className, {
            className: r.className,
            totalPoints: 0,
            violations: [],
          });
        }
      }
    }

    return Array.from(scoreMap.values());
  }, [rawScores, roster]);

  // Compute dense ranking for all classes
  const rankedAllClasses = useMemo(() => {
    return computeClassRankings(mergedScores);
  }, [mergedScores]);

  // Filter and sort display list
  const displayScores = useMemo(() => {
    let list = [...rankedAllClasses];

    if (gradeFilter !== "all") {
      list = list.filter((item) => {
        const match = item.className.match(/^(10|11|12)/);
        return match && match[1] === gradeFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => item.className.toLowerCase().includes(q));
    }

    if (sortBy === "class") {
      list.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));
    } else {
      // Sort by rankOrder ascending
      list.sort((a, b) => {
        if (a.rankOrder !== b.rankOrder) return a.rankOrder - b.rankOrder;
        return a.className.localeCompare(b.className, "vi", { numeric: true });
      });
    }

    return list;
  }, [rankedAllClasses, gradeFilter, searchQuery, sortBy]);

  // Date range formatted label for display
  const dateRangeLabel = useMemo(() => {
    if (!activeDateRange) return "";
    const startDate = new Date(activeDateRange.start);
    const endDate = new Date(activeDateRange.end);
    return `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`;
  }, [activeDateRange]);

  // Handle local multi-sheet Excel export
  const handleExport5Tu = async () => {
    if (mergedScores.length === 0) {
      toast.error("Không có dữ liệu lớp học để xuất báo cáo.");
      return;
    }

    setIsExporting(true);
    setExportProgress("Đang chuẩn bị mẫu báo cáo...");

    try {
      // Small tick to allow React UI to render loading state
      await new Promise((r) => setTimeout(r, 100));

      const result = await export5TuExcelWorkbook({
        scores: mergedScores,
        weekNumber: academicWeek,
        dateRangeText: dateRangeLabel,
        creatorName,
        onProgress: (current, total) => {
          setExportProgress(`Đang tạo trang tính: Lớp ${current}/${total}...`);
        },
      });

      toast.success(
        `Đã xuất thành công tệp Excel "${result.filename}" với ${result.sheetCount} trang tính (Bao gồm Xếp hạng, Tổng hợp & các lớp)!`,
        { duration: 6000 }
      );
    } catch (error) {
      console.error("Lỗi khi xuất tệp Excel 5 Tự:", error);
      toast.error(`Xuất Excel thất bại: ${(error as Error).message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const getRankBadgeClass = (rank: string) => {
    switch (rank) {
      case "Xuất sắc":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Tốt":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Khá":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-rose-100 text-rose-800 border-rose-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Control Card ─── */}
      <div
        className={cn(
          "rounded-2xl border p-5 sm:p-6 backdrop-blur-xl shadow-sm transition-all",
          isDarkMode
            ? "border-slate-700/60 bg-slate-800/80 text-slate-100"
            : "border-white/80 bg-white/80 text-slate-900"
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2.5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Bảng Điểm Thi Đua (Mô hình 5 Tự)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Tổng hợp nề nếp thi đua trên nền 120 điểm chuẩn theo Quyết định số 01-QĐ/ĐTN.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Local Multi-sheet Excel Export */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleExport5Tu}
              disabled={isExporting || mergedScores.length === 0}
              className="relative inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md hover:shadow-lg transition-all rounded-xl px-5 py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>
                {isExporting ? exportProgress || "Đang xử lý..." : "Xuất Excel Báo Cáo Tuần"}
              </span>
            </Button>
          </div>
        </div>

        {/* ─── Week Selection & Controls Bar ─── */}
        <div
          className={cn(
            "mt-6 pt-5 border-t flex flex-col md:flex-row md:items-center justify-between gap-4",
            isDarkMode ? "border-slate-700/60" : "border-slate-200/80"
          )}
        >
          {/* Mode Switch: Theo tuần / Khoảng ngày */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "inline-flex p-1 rounded-xl border text-xs font-medium",
                isDarkMode ? "bg-slate-900/60 border-slate-700" : "bg-slate-100 border-slate-200"
              )}
            >
              <button
                type="button"
                onClick={() => setDateMode("week")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all font-semibold",
                  dateMode === "week"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Theo tuần học
              </button>
              <button
                type="button"
                onClick={() => setDateMode("custom")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all font-semibold",
                  dateMode === "custom"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Tùy chọn ngày
              </button>
            </div>

            {/* If in Week Mode */}
            {dateMode === "week" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAcademicWeek((w) => Math.max(1, w - 1))}
                  className={cn(
                    "h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
                    isDarkMode
                      ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  title="Tuần trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-sm",
                    isDarkMode
                      ? "border-teal-500/30 bg-teal-950/20 text-teal-300"
                      : "border-teal-200 bg-teal-50 text-teal-800"
                  )}
                >
                  <span>Tuần</span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={academicWeek}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) setAcademicWeek(val);
                    }}
                    className="w-12 text-center font-bold bg-transparent border-b border-teal-500/40 focus:outline-none focus:border-teal-600 tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAcademicWeek((w) => w + 1)}
                  className={cn(
                    "h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
                    isDarkMode
                      ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  title="Tuần tiếp theo"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <span className="text-xs text-slate-500 font-medium ml-1 hidden sm:inline">
                  ({dateRangeLabel})
                </span>
              </div>
            )}

            {/* If in Custom Date Mode */}
            {dateMode === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 justify-start text-left font-normal border text-xs sm:text-sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "dd/MM/yyyy", { locale: vi })} -{" "}
                          {format(customRange.to, "dd/MM/yyyy", { locale: vi })}
                        </>
                      ) : (
                        format(customRange.from, "dd/MM/yyyy", { locale: vi })
                      )
                    ) : (
                      <span>Chọn khoảng ngày</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from || new Date()}
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={2}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* ─── Disclaimer Banner ─── */}
      <div
        className={cn(
          "rounded-xl border p-3 flex items-center justify-between gap-3 text-xs",
          isDarkMode
            ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
            : "border-amber-200 bg-amber-50 text-amber-900"
        )}
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium">
            Chưa bao gồm điểm thưởng và điểm giờ học. Chi tiết vi phạm xem tại{" "}
            <a
              href="https://codo2bt.vercel.app/bang-bao-cao-vi-pham"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline hover:text-amber-700 inline-flex items-center gap-0.5"
            >
              codo2bt.vercel.app/bang-bao-cao-vi-pham
              <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        </div>
      </div>

      {/* ─── Filters & Search Strip ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Grade Filter Pills */}
        <div className="inline-flex rounded-xl border border-slate-200/80 bg-white/70 p-1 backdrop-blur-sm overflow-hidden text-xs font-semibold">
          {(
            [
              ["all", "Tất cả các khối"],
              ["10", "Khối 10"],
              ["11", "Khối 11"],
              ["12", "Khối 12"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setGradeFilter(val)}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                gradeFilter === val
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort & Search Controls */}
        <div className="flex items-center gap-2">
          {/* Sort By Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-white/70 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSortBy("rank")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all inline-flex items-center gap-1",
                sortBy === "rank" ? "bg-teal-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
              )}
              title="Xếp theo thứ tự điểm cao nhất"
            >
              <Award className="h-3 w-3" />
              <span>Xếp hạng</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy("class")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all inline-flex items-center gap-1",
                sortBy === "class" ? "bg-teal-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
              )}
              title="Xếp theo tên lớp 10A1, 10A2..."
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>Tên lớp</span>
            </button>
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên lớp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white/80 pl-9 pr-3 py-1.5 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
        </div>
      </div>

      {/* ─── Main Emulation Table ─── */}
      <div
        className={cn(
          "rounded-2xl border overflow-hidden backdrop-blur-xl shadow-sm",
          isDarkMode
            ? "border-slate-700/60 bg-slate-800/80 text-slate-100"
            : "border-white/80 bg-white/80 text-slate-900"
        )}
      >
        {rawScores === undefined && (
          <div className="py-16 text-center text-slate-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-r-transparent mb-3" />
            <p className="text-sm font-medium">Đang tải dữ liệu điểm thi đua...</p>
          </div>
        )}

        {rawScores !== undefined && displayScores.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            <Award className="h-10 w-10 mx-auto text-slate-400 mb-2 stroke-1" />
            <p className="text-base font-semibold text-slate-700">Không tìm thấy dữ liệu</p>
            <p className="text-xs text-slate-500 mt-1">
              Không có lớp nào phù hợp với bộ lọc trong khoảng thời gian đã chọn.
            </p>
          </div>
        )}

        {rawScores !== undefined && displayScores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr
                  className={cn(
                    "border-b text-xs uppercase font-bold tracking-wider",
                    isDarkMode
                      ? "bg-slate-900/60 border-slate-700 text-slate-400"
                      : "bg-slate-50/80 border-slate-200/80 text-slate-600"
                  )}
                >
                  <th className="py-3.5 px-4 text-center w-20">Hạng</th>
                  <th className="py-3.5 px-4 font-bold w-28">Lớp</th>
                  <th className="py-3.5 px-4 text-center w-32">Điểm tuần</th>
                  <th className="py-3.5 px-4 text-center w-28">Điểm chuẩn</th>
                  <th className="py-3.5 px-4 text-center w-28">Tổng trừ</th>
                  <th className="py-3.5 px-4 text-center w-36">Xếp loại</th>
                  <th className="py-3.5 px-4 text-center w-28">Số vi phạm</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  "divide-y",
                  isDarkMode ? "divide-slate-700/60" : "divide-slate-200/60"
                )}
              >
                {displayScores.map((item) => {
                  return (
                    <tr
                      key={item.className}
                      className={cn(
                        "transition-colors hover:bg-teal-50/40 dark:hover:bg-slate-700/40"
                      )}
                    >
                      {/* Cột Hạng: Cùng điểm cùng hạng */}
                      <td className="py-3 px-4 text-center tabular-nums">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-xs font-extrabold border",
                            item.rankOrder === 1
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : item.rankOrder === 2
                                ? "bg-slate-200 text-slate-800 border-slate-300"
                                : item.rankOrder === 3
                                  ? "bg-orange-100 text-orange-900 border-orange-300"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {item.rankOrder}
                        </span>
                      </td>

                      {/* Tên Lớp */}
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-slate-100 dark:bg-slate-700 text-xs font-extrabold text-teal-700 dark:text-teal-300">
                          {item.className}
                        </span>
                      </td>

                      {/* Điểm tuần */}
                      <td className="py-3 px-4 text-center font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                        <span
                          className={cn(
                            "text-sm",
                            item.finalScore >= 115
                              ? "text-emerald-600 dark:text-emerald-400"
                              : item.finalScore >= 105
                                ? "text-blue-600 dark:text-blue-400"
                                : item.finalScore >= 90
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {item.finalScore}
                        </span>
                      </td>

                      {/* Điểm chuẩn 120 */}
                      <td className="py-3 px-4 text-center font-semibold text-slate-500 tabular-nums">
                        120
                      </td>

                      {/* Tổng điểm trừ */}
                      <td className="py-3 px-4 text-center tabular-nums">
                        {item.totalPoints > 0 ? (
                          <span className="inline-flex items-center font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full text-xs">
                            -{item.totalPoints}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">0</span>
                        )}
                      </td>

                      {/* Xếp loại tuần */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                            getRankBadgeClass(item.rankLabel)
                          )}
                        >
                          {item.rankLabel}
                        </span>
                      </td>

                      {/* Số vi phạm */}
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300 tabular-nums font-medium">
                        {item.violations.length}
                      </td>

                      {/* Nút Xem chi tiết */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewClass(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5 text-teal-600" />
                          <span>Xem phiếu 5 Tự</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal Preview Phiếu 5 Tự của lớp ─── */}
      {previewClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={cn(
              "relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden",
              isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white font-bold text-sm">
                  {previewClass.className}
                </span>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                    Phiếu Chấm Điểm 5 Tự - Lớp {previewClass.className}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tuần {academicWeek} ({dateRangeLabel}) • Điểm đạt:{" "}
                    <strong className="text-teal-600 font-bold">
                      {Math.max(0, 120 - previewClass.totalPoints)} / 120
                    </strong>{" "}
                    • Xếp loại: <strong>{getWeeklyRank(Math.max(0, 120 - previewClass.totalPoints))}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClass(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: 5-Tự inspection layout */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="text-center pb-2 border-b border-slate-200/60">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  Trường THPT Số 2 Bảo Thắng - Ban Chấp Hành Đoàn Trường
                </p>
                <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 uppercase mt-0.5">
                  Phiếu Chấm Điểm Nề Nếp Thi Đua Học Sinh (Mô hình 5 Tự)
                </p>
                <p className="text-xs italic text-slate-500">
                  (Căn cứ Quyết định số 01-QĐ/ĐTN ngày 26/08/2026 của BCH Đoàn trường)
                </p>
                <p className="text-xs italic text-rose-600 font-medium mt-1">
                  * Lưu ý: Chưa bao gồm điểm thưởng và điểm giờ học. Chi tiết vi phạm xem tại codo2bt.vercel.app/bang-bao-cao-vi-pham
                </p>
              </div>

              {/* Info summary strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Lớp: {previewClass.className}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    Tuần học: <strong className="text-slate-800 dark:text-slate-200">{academicWeek}</strong>
                  </span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    Xếp loại tuần:{" "}
                    <strong className="text-teal-700 dark:text-teal-300 font-bold">
                      {getWeeklyRank(Math.max(0, 120 - previewClass.totalPoints))}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Table of 27 criteria grouped */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1F4E79] text-white font-bold text-center">
                      <th className="py-2.5 px-2 w-10">STT</th>
                      <th className="py-2.5 px-3 text-left">Nội dung vi phạm / Tiêu chí</th>
                      <th className="py-2.5 px-2 w-16">Mức trừ</th>
                      <th className="py-2.5 px-2 w-16">Số lượt</th>
                      <th className="py-2.5 px-2 w-20">Tổng trừ</th>
                      <th className="py-2.5 px-3 text-left">Tên HS vi phạm / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {[
                      { id: "I", title: "I. TỰ GIÁC (Chuyên cần, Giờ giấc, Học tập & Báo cáo)" },
                      { id: "II", title: "II. TỰ TRỌNG (Đồng phục, Tác phong cá nhân & Văn hóa ứng xử)" },
                      { id: "III", title: "III. TỰ CHỦ (Nề nếp giờ học, An toàn mạng & Văn minh học đường)" },
                      { id: "IV", title: "IV. TỰ CẨN (An toàn giao thông, Phòng chống bạo lực & Chất cấm)" },
                      { id: "V", title: "V. TỰ RÈN (Bảo vệ tài sản, Vệ sinh môi trường & Nhiệm vụ tập thể)" },
                    ].map((cat) => {
                      const catCriteria = CRITERIA_5_TU.filter((c) => c.category === cat.id);
                      return (
                        <div key={cat.id} style={{ display: "contents" }}>
                          <tr className="bg-[#2F5597] text-white font-bold">
                            <td colSpan={6} className="py-2 px-3">
                              {cat.title}
                            </td>
                          </tr>
                          {catCriteria.map((crit) => {
                            const matchedViolations = previewClass.violations.filter(
                              (v) => matchViolationToCriterion(v) === crit.stt
                            );
                            const count = matchedViolations.length;
                            const totalDeduction = count * crit.points;

                            return (
                              <tr
                                key={crit.stt}
                                className={cn(
                                  "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                                  count > 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                                )}
                              >
                                <td className="py-2 px-2 text-center text-slate-400 font-medium">
                                  {crit.stt}
                                </td>
                                <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                  {crit.name}
                                </td>
                                <td className="py-2 px-2 text-center font-semibold text-slate-600 dark:text-slate-400">
                                  {crit.points}
                                </td>
                                <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200 bg-[#D9E1F2]/40">
                                  {count}
                                </td>
                                <td className="py-2 px-2 text-center font-bold bg-[#E2EFDA]/40 text-rose-600">
                                  {totalDeduction > 0 ? `-${totalDeduction}` : 0}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                  {matchedViolations.length > 0 ? (
                                    <div className="space-y-1">
                                      {matchedViolations.map((m, mIdx) => (
                                        <div key={mIdx} className="text-[11px]">
                                          <strong className="text-slate-800 dark:text-slate-200">
                                            {m.studentName || "Vi phạm tập thể"}
                                          </strong>
                                          {m.violationDate && (
                                            <span className="text-slate-400 ml-1">
                                              ({format(new Date(m.violationDate), "dd/MM")})
                                            </span>
                                          )}
                                          {m.details && (
                                            <span className="text-slate-600 dark:text-slate-400 ml-1">
                                              : {m.details}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </div>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Watermark note */}
              <div className="text-right text-[11px] text-slate-400 italic pt-2">
                Báo cáo tạo bởi: {creatorName}, vào lúc {format(new Date(), "dd/MM/yyyy HH:mm:ss")} trên trang CSDLCoDo2BT
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
              <Button
                variant="outline"
                onClick={() => setPreviewClass(null)}
                className="px-4 py-2 text-sm rounded-xl"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}