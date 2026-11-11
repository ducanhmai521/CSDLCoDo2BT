import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  differenceInCalendarWeeks,
  startOfDay,
} from "date-fns";
import { vi } from "date-fns/locale";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Calendar, AlertCircle, AlertTriangle,
  FileText, Loader2, Trophy, X, User, Users, FileWarning, Download, ShieldCheck, Shield, Award,
  Moon, Sun, Play, Paperclip, ArrowUp
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/* ============================================================================
 * TYPES & CONSTANTS
 * ========================================================================== */

type TuCategoryId = "tuGiac" | "tuTrong" | "tuChu" | "tuCan" | "tuRen";
type GradeFilter = "all" | 10 | 11 | 12;
type TabId = "violations" | "scores" | "classSummary";
type Tone =
  | "sky" | "violet" | "teal" | "rose" | "emerald" | "blue"
  | "amber" | "orange" | "slate" | "indigo" | "danger";

type WeeklyRank = {
  label: string;
  shortLabel: string;
  tone: "excellent" | "good" | "fair" | "needsWork";
};

type EvidenceItem = { url: string; type: "image" | "video" };
type ViewerState = {
  items: EvidenceItem[];
  index: number;
  info: { student: string; className: string; details: string };
};

const BASE_SCORE = 120;
const MAX_WEEK = 99;
const ACK_KEY = "violationReportUnderstood_v2";
const CLASS_KEY = "selectedClassSummary";
const THEME_KEY = "publicReportTheme";
const SCORES_PATH = "/bang-diem-thi-dua-tho";
const VIOLATIONS_PATH = "/bang-bao-cao-vi-pham";

const TU_META: Record<TuCategoryId, { label: string; badge: string; tone: Tone }> = {
  tuGiac: { label: "I. Tự giác", badge: "Tự Giác", tone: "sky" },
  tuTrong: { label: "II. Tự trọng", badge: "Tự Trọng", tone: "violet" },
  tuChu: { label: "III. Tự chủ", badge: "Tự Chủ", tone: "teal" },
  tuCan: { label: "IV. Tự cẩn", badge: "Tự Cẩn", tone: "rose" },
  tuRen: { label: "V. Tự rèn", badge: "Tự Rèn", tone: "emerald" },
};

const TAB_META: Record<TabId, { label: string; icon: typeof FileText; acc: string }> = {
  violations: { label: "Vi phạm", icon: FileText, acc: "acc-indigo" },
  scores: { label: "Bảng điểm", icon: Trophy, acc: "acc-amber" },
  classSummary: { label: "Theo lớp", icon: Users, acc: "acc-emerald" },
};
const TAB_ORDER: TabId[] = ["violations", "scores", "classSummary"];

/* ============================================================================
 * STYLES (CSS variables -> light/dark không cần override từng class Tailwind)
 * ========================================================================== */

// [bgLight, fgLight, bdLight, bgDark, fgDark, bdDark]
const TONES: Record<Tone, [string, string, string, string, string, string]> = {
  sky: ["#e0f2fe", "#075985", "#bae6fd", "rgba(14,165,233,.16)", "#7dd3fc", "rgba(56,189,248,.35)"],
  violet: ["#ede9fe", "#5b21b6", "#ddd6fe", "rgba(139,92,246,.18)", "#c4b5fd", "rgba(167,139,250,.38)"],
  teal: ["#ccfbf1", "#115e59", "#99f6e4", "rgba(20,184,166,.16)", "#5eead4", "rgba(45,212,191,.35)"],
  rose: ["#ffe4e6", "#9f1239", "#fecdd3", "rgba(244,63,94,.16)", "#fda4af", "rgba(251,113,133,.38)"],
  emerald: ["#d1fae5", "#065f46", "#a7f3d0", "rgba(16,185,129,.16)", "#6ee7b7", "rgba(52,211,153,.35)"],
  blue: ["#dbeafe", "#1e40af", "#bfdbfe", "rgba(59,130,246,.18)", "#93c5fd", "rgba(96,165,250,.38)"],
  amber: ["#fef3c7", "#92400e", "#fde68a", "rgba(245,158,11,.16)", "#fcd34d", "rgba(251,191,36,.38)"],
  orange: ["#ffedd5", "#9a3412", "#fed7aa", "rgba(249,115,22,.2)", "#fdba74", "rgba(251,146,60,.4)"],
  slate: ["#f1f5f9", "#475569", "#e2e8f0", "rgba(148,163,184,.14)", "#cbd5e1", "rgba(148,163,184,.3)"],
  indigo: ["#e0e7ff", "#3730a3", "#c7d2fe", "rgba(99,102,241,.2)", "#a5b4fc", "rgba(129,140,248,.4)"],
  danger: ["#e11d48", "#ffffff", "#be123c", "#e11d48", "#ffffff", "#fb7185"],
};

const toneCssLight = (Object.keys(TONES) as Tone[])
  .map((n) => `.tone-${n}{--c-bg:${TONES[n][0]};--c-fg:${TONES[n][1]};--c-bd:${TONES[n][2]}}`)
  .join("");
const toneCssDark = (Object.keys(TONES) as Tone[])
  .map((n) => `.pr-root.dark .tone-${n}{--c-bg:${TONES[n][3]};--c-fg:${TONES[n][4]};--c-bd:${TONES[n][5]}}`)
  .join("");

const styles = `
.pr-root{
  --bg:#f4f6fb;--surface:#ffffff;--surface-2:#f8fafc;--surface-3:#eef2f7;
  --border:#e2e8f0;--border-soft:#edf1f6;
  --text:#0f172a;--text-2:#334155;--muted:#64748b;--faint:#94a3b8;
  --hover:rgba(15,23,42,.035);--header-bg:rgba(255,255,255,.86);
  --shadow:0 1px 2px rgba(15,23,42,.05),0 1px 3px rgba(15,23,42,.04);
  --ring:rgba(79,70,229,.55);--overlay:rgba(15,23,42,.5);
  background:var(--bg);color:var(--text);color-scheme:light;
  font-feature-settings:"tnum" 1,"lnum" 1;
  -webkit-tap-highlight-color:transparent;
  -webkit-text-size-adjust:100%;
}
.pr-root .t1{color:var(--text)}
.pr-root .t2{color:var(--text-2)}
.pr-root .tm{color:var(--muted)}
.pr-root .tf{color:var(--faint)}
.pr-root .s1{background-color:var(--surface)}
.pr-root .s2{background-color:var(--surface-2)}
.pr-root .s3{background-color:var(--surface-3)}
.pr-root .bd{border-color:var(--border)}
.pr-root .bd-soft{border-color:var(--border-soft)}
.pr-root .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow)}
.pr-root .divide-soft>*+*{border-top:1px solid var(--border-soft)}
.pr-root .row-hover{transition:background-color .15s ease}
.pr-root .row-hover:hover{background:var(--hover)}
.pr-root .row-hover:active{background:var(--surface-3)}
.pr-root .header{background:var(--header-bg);-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid var(--border)}
.pr-root .icon-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);background:var(--surface);color:var(--text-2);border-radius:10px;transition:background-color .15s,border-color .15s,transform .1s}
.pr-root .icon-btn:hover{background:var(--surface-3)}
.pr-root .icon-btn:active{transform:scale(.95)}
.pr-root .icon-btn:disabled{opacity:.4;pointer-events:none}
.pr-root :focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.pr-root .chip{background:var(--c-bg);color:var(--c-fg);border:1px solid var(--c-bd)}
.pr-root .sev{box-shadow:inset 3px 0 0 #f43f5e}
.pr-root .cv-auto{content-visibility:auto;contain-intrinsic-size:auto 220px}
.pr-root .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
.pr-root .no-scrollbar::-webkit-scrollbar{display:none}

/* Tab accents */
.acc-indigo{--tab:#4f46e5}.acc-amber{--tab:#d97706}.acc-emerald{--tab:#059669}
.pr-root .tab-ind{background:var(--tab);transition:transform .32s cubic-bezier(.4,0,.2,1),background-color .32s}
.pr-root .tab-btn{transition:color .2s}
.pr-root .tab-btn[aria-selected="true"]{color:var(--tab)}
.pr-root .tab-btn[aria-selected="false"]{color:var(--muted)}
.pr-root .tab-btn[aria-selected="false"]:hover{color:var(--text)}

/* Smooth collapse (animates height without JS measuring) */
.collapse{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .28s cubic-bezier(.4,0,.2,1),visibility 0s linear .28s}
.collapse.open{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .28s cubic-bezier(.4,0,.2,1),visibility 0s}
.collapse>.collapse-inner{overflow:hidden;min-height:0}

/* Motion */
@keyframes pr-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes pr-fade-out{to{opacity:0}}
@keyframes pr-pop{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}
@keyframes pr-sheet{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:none}}
@keyframes pr-shimmer{0%{background-position:-420px 0}100%{background-position:420px 0}}
@keyframes pr-progress{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
.pr-root .anim-tab{animation:pr-fade .26s ease-out both}
.pr-root .anim-backdrop{animation:pr-fade .18s ease-out both}
.pr-root .anim-backdrop.closing{animation:pr-fade-out .16s ease-in both}
.pr-root .anim-panel{animation:pr-sheet .28s cubic-bezier(.2,.8,.2,1) both}
@media (min-width:640px){.pr-root .anim-panel{animation-name:pr-pop}}
.pr-root .skeleton{background:linear-gradient(90deg,var(--surface-3) 0,var(--surface-2) 40%,var(--surface-3) 80%);background-size:840px 100%;animation:pr-shimmer 1.4s linear infinite;border-radius:8px}
.pr-root .progress{position:absolute;left:0;right:0;bottom:-1px;height:2px;overflow:hidden}
.pr-root .progress::after{content:"";position:absolute;inset:0;width:40%;background:var(--tab,#4f46e5);animation:pr-progress 1s ease-in-out infinite}
.pr-root .stale{opacity:.55;transition:opacity .2s;pointer-events:none}
.pr-root .fresh{opacity:1;transition:opacity .2s}

@media (prefers-reduced-motion:reduce){
  .pr-root *,.pr-root *::before,.pr-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}

${toneCssLight}

/* Dark theme (không áp dụng khi in) */
@media not print{
  .pr-root.dark{
    --bg:#0a1020;--surface:#111a2e;--surface-2:#0e1627;--surface-3:#1a2540;
    --border:#25314d;--border-soft:#1c2740;
    --text:#f1f5f9;--text-2:#cbd5e1;--muted:#94a3b8;--faint:#64748b;
    --hover:rgba(148,163,184,.08);--header-bg:rgba(10,16,32,.82);
    --shadow:none;--ring:rgba(165,180,252,.7);--overlay:rgba(2,6,16,.66);
    color-scheme:dark;
  }
  .pr-root.dark .acc-indigo,.pr-root.dark.acc-indigo{--tab:#a5b4fc}
  .pr-root.dark .acc-amber{--tab:#fbbf24}
  .pr-root.dark .acc-emerald{--tab:#6ee7b7}
  ${toneCssDark}
}

@media print{
  .no-print{display:none!important}
  .pr-root{background:#fff!important}
  .pr-root .header{position:static!important;-webkit-backdrop-filter:none;backdrop-filter:none}
  .pr-root .card{box-shadow:none}
  .pr-root .cv-auto{content-visibility:visible}
  .pr-root .collapse{grid-template-rows:1fr!important;visibility:visible!important}
  .pr-root .anim-tab{animation:none}
  .pr-root *{break-inside:avoid}
}
`;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage đầy: bỏ qua */
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

const RANK_TONE: Record<WeeklyRank["tone"], Tone> = {
  excellent: "emerald",
  good: "blue",
  fair: "amber",
  needsWork: "rose",
};

function pointsTone(points: number): Tone {
  if (points <= 0) return "slate";
  if (points >= 20) return "danger";
  if (points >= 10) return "orange";
  if (points >= 5) return "amber";
  return "slate";
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

function fileExt(url: string) {
  return url.split("#")[0].split("?")[0].split(".").pop()?.toLowerCase() || "";
}
function isImageUrl(url: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(fileExt(url));
}
function isVideoUrl(url: string) {
  return ["mp4", "webm", "ogg", "mov"].includes(fileExt(url));
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
  if ([baseWeekStart, breakStart, breakEnd].some((d) => Number.isNaN(d.getTime()))) return null;
  const start = breakStart <= breakEnd ? breakStart : breakEnd;
  const end = breakStart <= breakEnd ? breakEnd : breakStart;
  const overlapStart = start < baseWeekStart ? baseWeekStart : start;
  if (overlapStart > end) return null;
  const startWeekIndex = differenceInCalendarWeeks(overlapStart, baseWeekStart, { weekStartsOn: 1 }) + 1;
  const skippedWeeks = differenceInCalendarWeeks(end, overlapStart, { weekStartsOn: 1 }) + 1;
  return { startWeekIndex, skippedWeeks };
}
type BreakWindow = ReturnType<typeof getBreakWindow>;

function toAcademicWeek(rawWeek: number, bw: BreakWindow) {
  if (!bw) return rawWeek;
  if (rawWeek < bw.startWeekIndex) return rawWeek;
  // Đang trong tuần nghỉ: gộp vào tuần học gần nhất trước kỳ nghỉ
  if (rawWeek < bw.startWeekIndex + bw.skippedWeeks) return Math.max(1, bw.startWeekIndex - 1);
  return rawWeek - bw.skippedWeeks;
}

function toCalendarWeek(academicWeek: number, bw: BreakWindow) {
  if (!bw) return academicWeek;
  if (academicWeek < bw.startWeekIndex) return academicWeek;
  return academicWeek + bw.skippedWeeks;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================================================================
 * HOOKS
 * ========================================================================== */

/** Giữ dữ liệu cũ trong lúc query mới đang tải -> đổi tuần không bị nháy skeleton. */
function useKeepPrevious<T>(value: T | undefined, key: string, enabled: boolean) {
  const ref = useRef<{ key: string; value: T | undefined }>({ key, value: undefined });
  if (value !== undefined) ref.current = { key, value };
  else if (ref.current.key !== key) ref.current = { key, value: undefined };
  const data = value !== undefined ? value : ref.current.value;
  return { data, isRefreshing: enabled && value === undefined && data !== undefined };
}

let scrollLocks = 0;
let prevBodyOverflow = "";
function useLockBodyScroll() {
  useEffect(() => {
    if (scrollLocks === 0) {
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks++;
    return () => {
      scrollLocks--;
      if (scrollLocks === 0) document.body.style.overflow = prevBodyOverflow;
    };
  }, []);
}

function useEscape(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, enabled]);
}

/* ============================================================================
 * SMALL UI PIECES
 * ========================================================================== */

const Collapse = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div className={`collapse ${open ? "open" : ""}`} aria-hidden={!open}>
    <div className="collapse-inner">{children}</div>
  </div>
);

const TuBadge = ({ category }: { category: TuCategoryId | null }) => {
  if (!category) return null;
  const meta = TU_META[category];
  return (
    <span className={`chip tone-${meta.tone} inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none`}>
      {meta.badge}
    </span>
  );
};

const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

const SkeletonList = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" role="status" aria-label="Đang tải dữ liệu">
    {Array.from({ length: 2 }, (_, c) => (
      <div key={c} className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="divide-soft border-t bd-soft">
          {Array.from({ length: rows - c }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-7" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) => (
  <div className="card mt-6 px-6 py-12 text-center anim-tab">
    <div className="s3 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full tf">{icon}</div>
    <p className="text-base font-semibold t1">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-sm text-sm tm">{hint}</p>}
  </div>
);

const Overlay = ({
  children,
  onBackdrop,
  closing = false,
}: {
  children: ReactNode;
  onBackdrop?: () => void;
  closing?: boolean;
}) => {
  useLockBodyScroll();
  return (
    <div
      className={`anim-backdrop ${closing ? "closing" : ""} fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4`}
      style={{ background: "var(--overlay)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onBackdrop?.();
      }}
    >
      {children}
    </div>
  );
};

/* ---------------- Reporter badge ---------------- */

const ReporterBadge = ({ violation, compact }: { violation: any; compact: boolean }) => {
  const reporterName: string | undefined = violation.requesterName || violation.reporterName;
  const imported = Boolean(violation.requesterName);
  const isAdmin = Boolean(violation.reporterIsSuperUser);

  let tone: Tone = "rose";
  let label = "Đội cờ đỏ";
  let compactLabel = "Đội cờ đỏ";
  let icon: ReactNode = <Shield className="h-3 w-3 shrink-0" strokeWidth={2.5} />;

  if (imported) {
    tone = "emerald";
    label = "Đơn xin nghỉ";
    compactLabel = "Xin nghỉ";
    icon = <FileText className="h-3 w-3 shrink-0" strokeWidth={2.5} />;
  } else if (isAdmin) {
    tone = "indigo";
    label = "Admin nhập";
    compactLabel = "Admin nhập";
    icon = <ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={2.5} />;
  }

  const tooltip = reporterName ? `${label} (${reporterName})` : label;

  if (compact) {
    return (
      <span
        className={`chip tone-${tone} sm:hidden ml-auto inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none`}
        title={tooltip}
      >
        {icon}
        <span>{compactLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`chip tone-${tone} hidden flex-shrink-0 items-center gap-1.5 rounded-full py-1 px-2.5 text-xs font-semibold sm:inline-flex`}
      title={tooltip}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};

/* ---------------- Detail item ---------------- */

const DetailItem = ({
  icon,
  label,
  children,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  wide?: boolean;
}) => (
  <div className={`flex gap-2.5 ${wide ? "sm:col-span-2" : ""}`}>
    <div className="mt-0.5 flex-shrink-0 tf">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-medium tm">{label}</p>
      <div className="mt-0.5 text-sm leading-relaxed t2 break-words">{children}</div>
    </div>
  </div>
);

/* ============================================================================
 * VIOLATION ROW
 * ========================================================================== */

const ViolationRow = memo(function ViolationRow({
  violation,
  onOpenEvidence,
}: {
  violation: any;
  onOpenEvidence: (v: any, url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const timestamp = (() => {
    const t = violation?.violationDate ? new Date(violation.violationDate).getTime() : NaN;
    if (Number.isFinite(t)) return t;
    return typeof violation?._creationTime === "number" ? violation._creationTime : null;
  })();

  const hasDetails = Boolean(violation.details && String(violation.details).trim() !== "");
  const evidenceUrls: string[] = (violation.evidenceUrls || []).filter(Boolean);
  const reporterName: string | undefined = violation.requesterName || violation.reporterName;
  const category = categorizeViolation(violation.violationType, violation.details);
  const severe = isSevereViolation(violation);
  const points = Number(violation.points) || 0;

  const toggle = () => setOpen((v) => !v);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={`w-full ${severe ? "sev" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="row-hover group flex cursor-pointer select-none items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4"
      >
        <div className="flex min-w-[2.9rem] flex-col items-center gap-1">
          <span className="text-xs font-bold tabular-nums t2 sm:text-sm">{violation.violatingClass}</span>
          <span className={`chip tone-${pointsTone(points)} inline-flex h-5 min-w-[1.9rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold tabular-nums`}>
            {points > 0 ? `-${points}` : points}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold t1">{displayStudentHeading(violation)}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <TuBadge category={category} />
            <span className="truncate text-xs tm">{violation.violationType || "Vi phạm khác"}</span>
            <ReporterBadge violation={violation} compact />
          </div>
        </div>

        {evidenceUrls.length > 0 && (
          <>
            <div className="hidden flex-shrink-0 items-center gap-1.5 sm:flex" onClick={(e) => e.stopPropagation()}>
              {evidenceUrls.slice(0, 2).map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => onOpenEvidence(violation, url)}
                  className="s3 bd h-10 w-10 overflow-hidden rounded-lg border transition-transform hover:scale-105 active:scale-95"
                  title="Xem bằng chứng"
                  aria-label={`Xem bằng chứng ${i + 1}`}
                >
                  {isImageUrl(url) ? (
                    <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center tm">
                      {isVideoUrl(url) ? <Play className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </span>
                  )}
                </button>
              ))}
              {evidenceUrls.length > 2 && <span className="text-[11px] font-semibold tm">+{evidenceUrls.length - 2}</span>}
            </div>
            <span className="chip tone-slate inline-flex flex-shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:hidden">
              <Paperclip className="h-3 w-3" />
              {evidenceUrls.length}
            </span>
          </>
        )}

        {reporterName && (
          <div className="hidden flex-shrink-0 md:block">
            <ReporterBadge violation={violation} compact={false} />
          </div>
        )}

        <ChevronDown className={`h-5 w-5 flex-shrink-0 tf transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </div>

      <Collapse open={open}>
        <div className="s2 border-t bd-soft grid gap-3.5 px-4 py-4 sm:grid-cols-2 sm:gap-x-6">
          {timestamp && (
            <DetailItem icon={<Calendar className="h-4 w-4" />} label="Ngày vi phạm">
              {capitalize(format(new Date(timestamp), "iiii, dd/MM", { locale: vi }))}
            </DetailItem>
          )}
          <DetailItem icon={<AlertTriangle className="h-4 w-4" />} label="Loại vi phạm">
            {violation.violationType || "Vi phạm khác"}
          </DetailItem>
          <DetailItem icon={<FileWarning className="h-4 w-4" />} label="Chi tiết vi phạm" wide>
            {hasDetails ? violation.details : <span className="tm">Không có mô tả chi tiết.</span>}
          </DetailItem>
          {reporterName && (
            <DetailItem icon={<User className="h-4 w-4" />} label="Người báo cáo">
              {reporterName}
            </DetailItem>
          )}
          <DetailItem icon={<Eye className="h-4 w-4" />} label="Bằng chứng" wide={!reporterName}>
            {evidenceUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {evidenceUrls.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEvidence(violation, url);
                    }}
                    className="chip tone-indigo inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-transform active:scale-95"
                  >
                    {isVideoUrl(url) ? <Play className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    Xem bằng chứng {i + 1}
                  </button>
                ))}
              </div>
            ) : (
              <span className="italic tf">Không có bằng chứng đính kèm</span>
            )}
          </DetailItem>
        </div>
      </Collapse>
    </div>
  );
});

/* ============================================================================
 * MEDIA VIEWER (pointer-based zoom/pan, pinch, double-tap, keyboard, gallery)
 * ========================================================================== */

const ZoomableImage = ({ src, onLoad, onError }: { src: string; onLoad: () => void; onError: () => void }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const tf = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const lastType = useRef("mouse");
  const moved = useRef(false);
  const raf = useRef(0);
  const [grabbing, setGrabbing] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const paint = useCallback((animated = false) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = innerRef.current;
      if (!el) return;
      const { x, y, scale } = tf.current;
      el.style.transition = animated ? "transform .22s cubic-bezier(.2,.8,.2,1)" : "none";
      el.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    });
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number, animated = false) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;
      const cur = tf.current;
      const s = Math.min(Math.max(nextScale, 1), 8);
      const ratio = s / cur.scale;
      cur.x = cx - (cx - cur.x) * ratio;
      cur.y = cy - (cy - cur.y) * ratio;
      cur.scale = s;
      if (s === 1) {
        cur.x = 0;
        cur.y = 0;
      }
      setZoomed(s > 1);
      paint(animated);
    },
    [paint]
  );

  const toggleZoom = useCallback(
    (x: number, y: number) => {
      if (tf.current.scale > 1) zoomAt(x, y, 1, true);
      else zoomAt(x, y, 2.5, true);
    },
    [zoomAt]
  );

  // Wheel phải là non-passive để preventDefault -> dùng native listener
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, tf.current.scale * Math.exp(-e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
    if (pointers.current.size === 0) setGrabbing(false);

    if (e.type === "pointerup" && e.pointerType === "touch" && !moved.current) {
      const now = Date.now();
      const lt = lastTap.current;
      if (now - lt.t < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
        toggleZoom(e.clientX, e.clientY);
        lastTap.current = { t: 0, x: 0, y: 0 };
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
    }
  };

  return (
    <div
      ref={wrapRef}
      className="flex h-full w-full select-none items-center justify-center overflow-hidden"
      style={{ touchAction: "none", cursor: zoomed ? (grabbing ? "grabbing" : "grab") : "zoom-in" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        lastType.current = e.pointerType;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved.current = false;
        if (pointers.current.size === 2) {
          const [a, b] = Array.from(pointers.current.values());
          pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
        }
        setGrabbing(true);
      }}
      onPointerMove={(e) => {
        const p = pointers.current.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
        p.x = e.clientX;
        p.y = e.clientY;
        if (pointers.current.size === 2) {
          const [a, b] = Array.from(pointers.current.values());
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist.current > 0) {
            zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, tf.current.scale * (dist / pinchDist.current));
          }
          pinchDist.current = dist;
        } else if (tf.current.scale > 1) {
          tf.current.x += dx;
          tf.current.y += dy;
          paint();
        }
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={(e) => {
        if (lastType.current === "touch") return; // đã xử lý bằng double-tap
        toggleZoom(e.clientX, e.clientY);
      }}
    >
      <div ref={innerRef} className="flex h-full w-full items-center justify-center will-change-transform">
        <img
          src={src}
          alt="Bằng chứng"
          draggable={false}
          onLoad={onLoad}
          onError={onError}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
};

const MediaViewer = ({ state, onClose }: { state: ViewerState; onClose: () => void }) => {
  const [index, setIndex] = useState(state.index);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const total = state.items.length;
  const item = state.items[index];

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 160);
  }, [onClose]);

  const go = useCallback(
    (d: number) => {
      if (total < 2) return;
      setLoading(true);
      setFailed(false);
      setIndex((i) => (i + d + total) % total);
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go]);

  if (!item) return null;

  const done = () => setLoading(false);
  const fail = () => {
    setLoading(false);
    setFailed(true);
  };

  return (
    <Overlay onBackdrop={close} closing={closing}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xem bằng chứng"
        className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-black/90 text-white"
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between px-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tabular-nums">
            {total > 1 ? `${index + 1} / ${total}` : item.type === "video" ? "Video" : "Hình ảnh"}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={item.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-xs font-semibold transition-colors hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Tải xuống</span>
            </a>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-white/70" />
            </div>
          )}
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="h-10 w-10 text-white/60" />
              <p className="text-sm text-white/80">Không tải được tệp này.</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20">
                Mở trong tab mới
              </a>
            </div>
          ) : (
            <div key={item.url} className={`h-full w-full transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}>
              {item.type === "image" ? (
                <ZoomableImage src={item.url} onLoad={done} onError={fail} />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2">
                  <video
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full rounded-lg object-contain"
                    onLoadedData={done}
                    onError={fail}
                  >
                    Trình duyệt của bạn không hỗ trợ video.
                  </video>
                </div>
              )}
            </div>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Bằng chứng trước"
                className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Bằng chứng sau"
                className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-xl rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-slate-300" />{state.info.student}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-300" />{state.info.className}</span>
            </div>
            {state.info.details && (
              <p className="mt-2 flex items-start justify-center gap-2 border-t border-white/15 pt-2 text-xs text-slate-200">
                <FileWarning className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                <span>{state.info.details}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ============================================================================
 * MODALS
 * ========================================================================== */

const WELCOME_ITEMS: Array<{ icon: typeof FileText; tone: Tone; title: string; text: string }> = [
  { icon: FileText, tone: "indigo", title: "Vi phạm", text: "Xem vi phạm theo từng ngày trong tuần; mở dòng để xem chi tiết và bằng chứng." },
  { icon: Users, tone: "emerald", title: "Tổng hợp theo lớp", text: "Chọn lớp để xem toàn bộ vi phạm từ đầu năm học, gom theo tuần." },
  { icon: Trophy, tone: "amber", title: "Bảng điểm", text: "Theo dõi điểm thi đua trên nền 120 điểm chuẩn theo tuần." },
  { icon: Eye, tone: "teal", title: "Ẩn nghỉ có phép", text: "Dùng nút “Ẩn nghỉ CP” để lọc nhanh các trường hợp nghỉ có phép." },
];

const WelcomeModal = ({ onConfirm }: { onConfirm: (dontShowAgain: boolean) => void }) => {
  const [mode, setMode] = useState<"welcome" | "mustAgree">("welcome");
  const [dontShow, setDontShow] = useState(false);

  const checkbox = (id: string) => (
    <label htmlFor={id} className="flex cursor-pointer select-none items-center gap-2.5 border-t bd-soft pt-3 text-sm t2">
      <input
        id={id}
        type="checkbox"
        checked={dontShow}
        onChange={(e) => setDontShow(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      Không hiện lại thông báo này
    </label>
  );

  return (
    <Overlay>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="anim-panel s1 bd max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {mode === "welcome" ? (
          <>
            <div className="flex items-center gap-3">
              <div className="chip tone-blue flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 id="welcome-title" className="text-lg font-bold t1">CSDLCoDo2BT</h2>
                <p className="text-xs tm">Thông báo và hướng dẫn sử dụng</p>
              </div>
            </div>

            <p className="text-sm font-medium t2">Cổng thông tin phục vụ GVCN, BCH Đoàn trường và BGH.</p>

            <ul className="space-y-3">
              {WELCOME_ITEMS.map(({ icon: Icon, tone, title, text }) => (
                <li key={title} className="flex gap-3">
                  <div className={`chip tone-${tone} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold t1">{title}</p>
                    <p className="text-xs leading-relaxed tm">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="chip tone-blue rounded-lg px-3 py-2.5 text-xs leading-relaxed">
              <strong>Lưu ý:</strong> Hệ thống ghi nhớ lớp đã chọn ở tab “Tổng hợp theo lớp” cho lần truy cập sau.
            </p>

            {checkbox("dontShowAgain")}

            <div className="flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => onConfirm(dontShow)}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 active:scale-[.98]"
              >
                Tôi đã hiểu
              </button>
              <button
                type="button"
                onClick={() => setMode("mustAgree")}
                className="rounded-xl px-4 py-3 font-medium tm transition-colors hover:text-[color:var(--text)]"
              >
                Đóng
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="chip tone-amber flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 id="welcome-title" className="text-lg font-bold t1">Xác nhận</h2>
            </div>
            <p className="text-sm t2">Vui lòng xác nhận đã đọc hướng dẫn để tiếp tục sử dụng hệ thống.</p>
            {checkbox("dontShowAgain2")}
            <button
              type="button"
              autoFocus
              onClick={() => onConfirm(dontShow)}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 active:scale-[.98]"
            >
              Xác nhận
            </button>
          </>
        )}
      </div>
    </Overlay>
  );
};

const ClassSelector = ({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null;
  onSelect: (cls: string) => void;
  onClose: () => void;
}) => {
  useEscape(onClose);
  return (
    <Overlay onBackdrop={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-title"
        className="anim-panel s1 bd max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="class-title" className="flex items-center gap-2 text-lg font-bold t1">
            <Users className="h-5 w-5 text-emerald-600" />
            Chọn lớp
          </h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="icon-btn h-9 w-9">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5">
          {[10, 11, 12].map((grade) => (
            <section key={grade} className="space-y-2">
              <h4 className="flex items-center gap-3 text-xs font-semibold tm">
                <span className="h-px flex-1 s3" />
                Khối {grade}
                <span className="h-px flex-1 s3" />
              </h4>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {Array.from({ length: 8 }, (_, i) => `${grade}A${i + 1}`).map((cls) => {
                  const active = selected === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => onSelect(cls)}
                      aria-pressed={active}
                      className={`h-11 rounded-xl border text-sm font-semibold transition active:scale-95 ${active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "s2 bd t2 hover:border-emerald-500 hover:text-emerald-600"
                        }`}
                    >
                      {cls.substring(2)}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Overlay>
  );
};

/* ============================================================================
 * HEADER CONTROLS
 * ========================================================================== */

const WeekPicker = ({
  weekInput,
  weekNumber,
  currentWeek,
  weekError,
  dateRange,
  onInput,
  onStep,
  onCommit,
  onToday,
}: {
  weekInput: string;
  weekNumber: number;
  currentWeek: number;
  weekError: string | null;
  dateRange?: { start: number; end: number };
  onInput: (v: string) => void;
  onStep: (delta: number) => void;
  onCommit: () => void;
  onToday: () => void;
}) => (
  <div className="flex w-full items-center gap-2 sm:w-auto">
    <div className={`s1 flex flex-1 items-center gap-1 rounded-xl border p-1 sm:flex-initial ${weekError ? "border-red-400" : "bd"}`}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={weekNumber <= 1}
        aria-label="Tuần trước"
        className="icon-btn h-9 w-9 border-transparent bg-transparent"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center px-1 leading-tight sm:flex-initial">
        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium tm">Tuần</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={weekInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onInput(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onFocus={(e) => e.target.select()}
            aria-invalid={Boolean(weekError)}
            aria-label="Số tuần"
            className="w-10 rounded-md bg-transparent text-center text-base font-bold tabular-nums t1 outline-none focus:bg-[var(--surface-3)]"
          />
        </label>
        {dateRange && (
          <span className="text-[11px] tabular-nums tm">
            {format(new Date(dateRange.start), "dd/MM")} – {format(new Date(dateRange.end), "dd/MM")}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label="Tuần sau"
        className="icon-btn h-9 w-9 border-transparent bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    {weekNumber !== currentWeek && (
      <button
        type="button"
        onClick={onToday}
        className="chip tone-indigo h-11 flex-shrink-0 rounded-xl px-3 text-xs font-semibold transition active:scale-95"
      >
        Tuần này
      </button>
    )}
  </div>
);

const BackToTop = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShow(window.scrollY > 700);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`icon-btn no-print fixed right-4 z-20 h-11 w-11 rounded-full shadow-lg transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};

/* ============================================================================
 * TAB: VIOLATIONS
 * ========================================================================== */

type DayGroup = { day: number; all: any[]; shown: any[]; excused: number };

const ViolationsTab = ({
  violations,
  refreshing,
  hideExcused,
  onOpenEvidence,
}: {
  violations: any[] | undefined;
  refreshing: boolean;
  hideExcused: boolean;
  onOpenEvidence: (v: any, url: string) => void;
}) => {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const groups = useMemo<DayGroup[]>(() => {
    if (!violations) return [];
    const map = new Map<number, any[]>();
    for (const v of violations) {
      const day = startOfDay(new Date(v.violationDate)).getTime();
      const list = map.get(day);
      if (list) list.push(v);
      else map.set(day, [v]);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, all]) => {
        const shown = hideExcused ? all.filter((v) => v.violationType !== "Nghỉ học có phép") : all;
        return { day, all, shown, excused: all.length - shown.length };
      });
  }, [violations, hideExcused]);

  const visibleGroups = groups.filter((g) => g.shown.length > 0);
  const totalShown = visibleGroups.reduce((s, g) => s + g.shown.length, 0);
  const allCollapsed = visibleGroups.length > 0 && visibleGroups.every((g) => collapsed[g.day]);

  const toggleAll = () => {
    if (allCollapsed) setCollapsed({});
    else setCollapsed(Object.fromEntries(visibleGroups.map((g) => [g.day, true])));
  };

  if (violations === undefined) return <SkeletonList />;

  if (violations.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="Không ghi nhận vi phạm"
        hint={`Không có vi phạm nào trong tuần này (bảo toàn ${BASE_SCORE} điểm chuẩn).`}
      />
    );
  }

  return (
    <div className={`space-y-3 ${refreshing ? "stale" : "fresh"}`}>
      {visibleGroups.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs tm tabular-nums">
            {totalShown} vi phạm trong {visibleGroups.length} ngày
          </p>
          <button type="button" onClick={toggleAll} className="rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--hover)]" style={{ color: "var(--tab)" }}>
            {allCollapsed ? "Mở tất cả" : "Thu gọn tất cả"}
          </button>
        </div>
      )}

      {groups.map(({ day, shown, excused }) => {
        if (shown.length === 0) {
          if (!hideExcused || excused === 0) return null;
          return (
            <div key={day} className="card flex items-center justify-between px-4 py-3 tm">
              <span className="text-sm font-semibold">{capitalize(format(new Date(day), "iiii, dd/MM", { locale: vi }))}</span>
              <span className="chip tone-slate rounded-md px-2 py-1 text-xs">Chỉ có {excused} nghỉ CP</span>
            </div>
          );
        }
        const open = !collapsed[day];
        return (
          <section key={day} className="card cv-auto overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed((p) => ({ ...p, [day]: open }))}
              aria-expanded={open}
              className={`row-hover flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${open ? "s3" : ""}`}
              style={open ? { background: "var(--surface-3)" } : undefined}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-sm font-bold t1 sm:text-base">{capitalize(format(new Date(day), "iiii", { locale: vi }))}</span>
                <span className="chip tone-slate rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">{format(new Date(day), "dd/MM")}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="chip tone-indigo rounded-md px-2 py-1 text-xs font-medium tabular-nums">{shown.length} vi phạm</span>
                <ChevronDown className={`h-4 w-4 tm transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
              </div>
            </button>
            <Collapse open={open}>
              <div className="divide-soft border-t bd-soft">
                {shown.map((v: any) => (
                  <ViolationRow key={v._id} violation={v} onOpenEvidence={onOpenEvidence} />
                ))}
              </div>
            </Collapse>
          </section>
        );
      })}
    </div>
  );
};

/* ============================================================================
 * TAB: SCORES
 * ========================================================================== */

const ScoreDetails = ({ violations }: { violations: any[] }) => {
  if (violations.length === 0) {
    return <span className="text-sm italic tf">Lớp không ghi nhận vi phạm trong tuần này (bảo toàn {BASE_SCORE} điểm chuẩn)</span>;
  }
  return (
    <ul className="space-y-1.5">
      {violations.map((v) => {
        const cat = categorizeViolation(v.violationType, v.details);
        const severe = isSevereViolation(v);
        return (
          <li
            key={v._id}
            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${severe ? "chip tone-rose" : "s2"}`}
          >
            <div className="min-w-0 flex-1 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <TuBadge category={cat} />
                {severe && (
                  <span className="chip tone-rose rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none">Vi phạm nghiêm trọng</span>
                )}
                <span className={`chip tone-${pointsTone(v.points ?? 0)} rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none`}>
                  {(v.points ?? 0) > 0 ? `-${v.points}` : (v.points ?? 0)}
                </span>
                <span className="text-xs tabular-nums tf">{format(new Date(v.violationDate), "dd/MM")}</span>
              </div>
              <p className="leading-snug t1">
                <span className="font-medium">{v.violationType}</span>
                {v.studentName && <span className="tm"> ({v.studentName})</span>}
                {v.details && <span className="t2">: {v.details}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const ScoresTab = ({
  scores,
  refreshing,
  gradeFilter,
  setGradeFilter,
}: {
  scores: any[] | undefined;
  refreshing: boolean;
  gradeFilter: GradeFilter;
  setGradeFilter: (g: GradeFilter) => void;
}) => {
  const filtered = useMemo(() => {
    if (!scores) return [];
    if (gradeFilter === "all") return scores;
    return scores.filter((s) => getClassGrade(s.className) === gradeFilter);
  }, [scores, gradeFilter]);

  if (scores === undefined) return <SkeletonList rows={3} />;

  if (scores.length === 0) {
    return <EmptyState icon={<Award className="h-7 w-7" />} title="Chưa có dữ liệu" hint="Chưa có điểm thi đua cho tuần này." />;
  }

  const clean = filtered.filter((s) => s.totalPoints <= 0).length;
  const GRADES: Array<[GradeFilter, string]> = [
    ["all", "Tất cả"],
    [10, "Khối 10"],
    [11, "Khối 11"],
    [12, "Khối 12"],
  ];

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="no-scrollbar s1 bd flex max-w-full overflow-x-auto rounded-xl border p-1" role="tablist" aria-label="Lọc theo khối">
          {GRADES.map(([value, label]) => {
            const active = gradeFilter === value;
            return (
              <button
                key={String(value)}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setGradeFilter(value)}
                className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors sm:text-sm ${active ? "chip tone-amber" : "tm hover:bg-[var(--hover)]"
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Không có lớp thuộc khối đã chọn" hint="Thử chọn khối khác hoặc xem tất cả." />
      ) : (
        <div className={`card overflow-hidden ${refreshing ? "stale" : "fresh"}`}>
          <div className="px-4 py-2.5 text-xs tm tabular-nums border-b bd-soft s2">
            {filtered.length} lớp · {clean} lớp bảo toàn {BASE_SCORE} điểm
          </div>

          <div className="s2 bd-soft hidden border-b px-4 py-2.5 text-xs font-semibold tm md:flex md:gap-3">
            <div className="w-16 text-center">Lớp</div>
            <div className="w-20 text-center">Điểm trừ</div>
            <div className="w-20 text-center">Tổng điểm</div>
            <div className="w-40 text-center">Xếp loại tuần</div>
            <div className="flex-1">Chi tiết vi phạm</div>
          </div>

          <div className="divide-soft">
            {filtered.map((score) => {
              const totalScore = BASE_SCORE - score.totalPoints;
              const rank = getWeeklyRank(totalScore);
              const tone = RANK_TONE[rank.tone];
              return (
                <div key={score.className} className="row-hover space-y-3 px-3 py-3.5 md:flex md:items-start md:gap-3 md:space-y-0 md:px-4">
                  <div className="flex flex-wrap items-center gap-2 md:contents">
                    <div className="order-1 md:order-none md:flex md:w-16 md:justify-center">
                      <span className="text-base font-bold tabular-nums t1">{score.className}</span>
                    </div>
                    <div className="order-3 ml-auto md:order-none md:ml-0 md:flex md:w-20 md:justify-center">
                      <span
                        className={`chip tone-${score.totalPoints > 0 ? "rose" : "emerald"} inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums`}
                      >
                        <span className="text-[10px] font-medium opacity-70 md:hidden">Trừ</span>
                        {score.totalPoints > 0 ? `-${score.totalPoints}` : score.totalPoints}
                      </span>
                    </div>
                    <div className="order-4 md:order-none md:flex md:w-20 md:justify-center">
                      <span className={`chip tone-${tone} inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums`}>
                        <span className="text-[10px] font-medium opacity-70 md:hidden">Tổng</span>
                        {totalScore}
                      </span>
                    </div>
                    <div className="order-2 md:order-none md:flex md:w-40 md:justify-center">
                      <span className={`chip tone-${tone} inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold`}>
                        <span className="md:hidden">{rank.shortLabel === "TB" ? "Trung bình" : rank.label}</span>
                        <span className="hidden md:inline">{rank.label}</span>
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 md:flex-1">
                    <ScoreDetails violations={score.violations} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * TAB: CLASS SUMMARY
 * ========================================================================== */

const ClassSummaryTab = ({
  selectedClass,
  data,
  weeks,
  metrics,
  refreshing,
  onPickClass,
  onOpenEvidence,
}: {
  selectedClass: string | null;
  data: any[] | undefined;
  weeks: { week: number; violations: any[] }[];
  metrics: { totalLost: number; count: number; mostFrequentLabel: string };
  refreshing: boolean;
  onPickClass: () => void;
  onOpenEvidence: (v: any, url: string) => void;
}) => {
  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-16 anim-tab">
        <div className="chip tone-emerald flex h-16 w-16 items-center justify-center rounded-full">
          <Users className="h-8 w-8" />
        </div>
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-bold t1">Chưa chọn lớp</h3>
          <p className="mx-auto max-w-xs text-sm tm">Chọn một lớp để xem tổng hợp vi phạm.</p>
          <button
            type="button"
            onClick={onPickClass}
            className="mt-3 rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            Chọn lớp
          </button>
        </div>
      </div>
    );
  }

  if (data === undefined) return <SkeletonList />;

  if (weeks.length === 0) {
    return <EmptyState icon={<FileText className="h-7 w-7" />} title="Chưa có dữ liệu" hint="Không tìm thấy dữ liệu vi phạm cho lớp này." />;
  }

  return (
    <div className={`space-y-3 ${refreshing ? "stale" : "fresh"}`}>
      <div className="grid grid-cols-3 gap-2">
        <div className="card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium tm sm:text-xs">Tổng số vi phạm</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums t1">{metrics.count}</p>
        </div>
        <div className="card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium tm sm:text-xs">Tổng điểm trừ</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-rose-600">-{metrics.totalLost}</p>
        </div>
        <div className="card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium tm sm:text-xs">Nhóm thường gặp</p>
          <p className="mt-1 text-sm font-semibold leading-snug t1">{metrics.mostFrequentLabel}</p>
        </div>
      </div>

      {weeks.map(({ week, violations }) => (
        <section key={week} className="card cv-auto overflow-hidden">
          <div className="flex items-center justify-between border-b bd-soft px-4 py-3">
            <h3 className="text-sm font-bold t1 sm:text-base">Tuần {week}</h3>
            <span className={`chip tone-${violations.length > 0 ? "rose" : "emerald"} rounded-md px-2 py-1 text-xs font-medium tabular-nums`}>
              {violations.length > 0 ? `${violations.length} vi phạm` : "Không có vi phạm"}
            </span>
          </div>
          {violations.length > 0 ? (
            <div className="divide-soft">
              {violations.map((v: any) => (
                <ViolationRow key={v._id} violation={v} onOpenEvidence={onOpenEvidence} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-center text-sm tm">Lớp không ghi nhận vi phạm trong tuần này (bảo toàn {BASE_SCORE} điểm chuẩn)</p>
          )}
        </section>
      ))}
    </div>
  );
};

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

const PublicViolationReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

  /* ---------- Theme (lưu lựa chọn, theo hệ thống nếu chưa chọn) ---------- */
  const [themePref, setThemePref] = useState<"light" | "dark" | null>(() => {
    const v = readStored(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  });
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const isDarkMode = themePref ? themePref === "dark" : systemDark;
  const toggleTheme = () => {
    const next = isDarkMode ? "light" : "dark";
    setThemePref(next);
    writeStored(THEME_KEY, next);
  };
  // Đồng bộ màu nền body (tránh viền trắng khi overscroll trên mobile)
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = isDarkMode ? "#0a1020" : "#f4f6fb";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [isDarkMode]);

  /* ---------- UI state ---------- */
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    location.pathname === SCORES_PATH ? "scores" : "violations"
  );
  const [hasAcknowledged, setHasAcknowledged] = useState(() => readStored(ACK_KEY) === "true");
  const [selectedClass, setSelectedClass] = useState<string | null>(() => readStored(CLASS_KEY));
  const [isClassSelectorOpen, setIsClassSelectorOpen] = useState(false);
  const [hideExcusedAbsence, setHideExcusedAbsence] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  /* ---------- Week state ---------- */
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState("1");
  const [weekError, setWeekError] = useState<string | null>(null);
  const userChangedWeek = useRef(false);

  /* ---------- Data ---------- */
  const baseDateStr = useQuery(api.users.getSetting, { key: "weekBaseDate" });
  const breakStartDateStr = useQuery(api.users.getSetting, { key: "holidayBreakStartDate" });
  const breakEndDateStr = useQuery(api.users.getSetting, { key: "holidayBreakEndDate" });

  const breakWindow = useMemo(
    () => (baseDateStr ? getBreakWindow(baseDateStr, breakStartDateStr || null, breakEndDateStr || null) : null),
    [baseDateStr, breakStartDateStr, breakEndDateStr]
  );

  const currentWeekNumber = useMemo(() => {
    if (!baseDateStr) return 1;
    const base = new Date(baseDateStr);
    if (Number.isNaN(base.getTime())) return 1;
    const rawWeek = differenceInCalendarWeeks(new Date(), base, { weekStartsOn: 1 }) + 1;
    return Math.max(1, toAcademicWeek(rawWeek, breakWindow));
  }, [baseDateStr, breakWindow]);

  // Khởi tạo về tuần hiện tại (chỉ khi người dùng chưa tự đổi tuần)
  useEffect(() => {
    if (!baseDateStr || userChangedWeek.current) return;
    setWeekNumber(currentWeekNumber);
    setWeekInput(String(currentWeekNumber));
    setWeekError(null);
  }, [baseDateStr, currentWeekNumber]);

  const applyWeek = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return setWeekError("Tuần không được để trống");
    if (!/^\d+$/.test(trimmed)) return setWeekError("Tuần phải là một số dương hợp lệ");
    const n = parseInt(trimmed, 10);
    if (n <= 0 || n > MAX_WEEK) return setWeekError(`Tuần phải từ 1 đến ${MAX_WEEK}`);
    setWeekError(null);
    setWeekNumber(n);
  }, []);

  // Debounce khi gõ số tuần
  useEffect(() => {
    const t = window.setTimeout(() => applyWeek(weekInput), 350);
    return () => window.clearTimeout(t);
  }, [weekInput, applyWeek]);

  const handleWeekInput = (v: string) => {
    userChangedWeek.current = true;
    setWeekInput(v);
  };
  const handleWeekStep = (delta: number) => {
    userChangedWeek.current = true;
    const next = Math.min(MAX_WEEK, Math.max(1, weekNumber + delta));
    setWeekNumber(next);
    setWeekInput(String(next));
    setWeekError(null);
  };
  const handleWeekToday = () => {
    userChangedWeek.current = true;
    setWeekNumber(currentWeekNumber);
    setWeekInput(String(currentWeekNumber));
    setWeekError(null);
  };

  const dateRange = useMemo(() => {
    if (!baseDateStr || weekError) return undefined;
    const base = new Date(baseDateStr);
    if (Number.isNaN(base.getTime())) return undefined;
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    const start = addWeeks(monday, toCalendarWeek(weekNumber, breakWindow) - 1);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start: start.getTime(), end: end.getTime() };
  }, [baseDateStr, weekError, weekNumber, breakWindow]);

  const violationsEnabled = Boolean(dateRange && hasAcknowledged);
  const violationsRaw = useQuery(
    api.violations.getPublicViolations,
    dateRange && hasAcknowledged ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const scoresRaw = useQuery(
    api.violations.getPublicEmulationScores,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const classEnabled = activeTab === "classSummary" && Boolean(selectedClass);
  const classRaw = useQuery(
    api.violations.getViolationsByClass,
    classEnabled && selectedClass ? { className: selectedClass } : "skip"
  );

  const { data: violations, isRefreshing: violationsRefreshing } = useKeepPrevious(violationsRaw, "v", violationsEnabled);
  const { data: emulationScores, isRefreshing: scoresRefreshing } = useKeepPrevious(scoresRaw, "s", Boolean(dateRange));
  const { data: classViolations, isRefreshing: classRefreshing } = useKeepPrevious(classRaw, `c:${selectedClass}`, classEnabled);

  /* ---------- Derived: class summary ---------- */
  const classViolationsByWeek = useMemo(() => {
    if (!classViolations || !baseDateStr) return [];
    const base = new Date(baseDateStr);
    if (Number.isNaN(base.getTime())) return [];

    const grouped = new Map<number, any[]>();
    for (const v of classViolations as any[]) {
      if (hideExcusedAbsence && v.violationType === "Nghỉ học có phép") continue;
      const vDate = new Date(v.violationDate);
      if (Number.isNaN(vDate.getTime())) continue;
      const rawWeek = differenceInCalendarWeeks(vDate, base, { weekStartsOn: 1 }) + 1;
      const w = toAcademicWeek(rawWeek, breakWindow);
      if (w < 1) continue;
      const list = grouped.get(w);
      if (list) list.push(v);
      else grouped.set(w, [v]);
    }

    const time = (x: any) =>
      x?.violationDate ? new Date(x.violationDate).getTime() : typeof x?._creationTime === "number" ? x._creationTime : 0;
    grouped.forEach((rows) => rows.sort((a, b) => time(a) - time(b)));

    let top = currentWeekNumber;
    grouped.forEach((_, w) => {
      if (w > top) top = w;
    });
    top = Math.min(top, 200);

    const weeks: { week: number; violations: any[] }[] = [];
    for (let i = top; i >= 1; i--) weeks.push({ week: i, violations: grouped.get(i) || [] });
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

  /* ---------- Routing / tabs ---------- */
  useEffect(() => {
    if (location.pathname === SCORES_PATH) setActiveTab("scores");
    else if (location.pathname === VIOLATIONS_PATH) setActiveTab((prev) => (prev === "scores" ? "violations" : prev));
  }, [location.pathname]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "scores") navigate(SCORES_PATH, { replace: true });
    else if (tab === "violations") navigate(VIOLATIONS_PATH, { replace: true });
  };

  const onTabKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = TAB_ORDER.indexOf(activeTab);
    if (e.key === "ArrowRight") handleTabChange(TAB_ORDER[(i + 1) % TAB_ORDER.length]);
    else if (e.key === "ArrowLeft") handleTabChange(TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length]);
  };

  /* ---------- Handlers ---------- */
  const handleConfirmWelcome = (dontShowAgain: boolean) => {
    if (dontShowAgain) writeStored(ACK_KEY, "true");
    setHasAcknowledged(true);
  };

  const handleClassSelect = (cls: string) => {
    setSelectedClass(cls);
    writeStored(CLASS_KEY, cls);
    setIsClassSelectorOpen(false);
  };

  const closeClassSelector = useCallback(() => setIsClassSelectorOpen(false), []);
  const closeViewer = useCallback(() => setViewer(null), []);

  const handleOpenEvidence = useCallback((violation: any, url: string) => {
    const urls: string[] = (violation.evidenceUrls || []).filter(Boolean);
    const items: EvidenceItem[] = [];
    for (const u of urls) {
      if (isVideoUrl(u)) items.push({ url: u, type: "video" });
      else if (isImageUrl(u)) items.push({ url: u, type: "image" });
    }
    const index = items.findIndex((i) => i.url === url);
    if (index === -1) {
      // Định dạng không xem trực tiếp được (pdf, doc...) -> mở tab mới
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setViewer({
      items,
      index,
      info: {
        student: displayStudentHeading(violation),
        className: violation.violatingClass,
        details: violation.details ? `${violation.violationType}: ${violation.details}` : violation.violationType,
      },
    });
  }, []);

  /* ---------- Render ---------- */
  const settingMissing = baseDateStr === null;
  const refreshing =
    activeTab === "violations" ? violationsRefreshing : activeTab === "scores" ? scoresRefreshing : classRefreshing;
  const tabIndex = TAB_ORDER.indexOf(activeTab);
  const activeAcc = TAB_META[activeTab].acc;

  return (
    <div
      className={`pr-root ${isDarkMode ? "dark" : ""} ${activeAcc} min-h-screen`}
      style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
    >
      <style>{styles}</style>

      {!hasAcknowledged && <WelcomeModal onConfirm={handleConfirmWelcome} />}
      {viewer && <MediaViewer state={viewer} onClose={closeViewer} />}
      {isClassSelectorOpen && (
        <ClassSelector selected={selectedClass} onSelect={handleClassSelect} onClose={closeClassSelector} />
      )}

      {/* ------------------------------ HEADER ------------------------------ */}
      <header className="header sticky top-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-2 pt-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
              <div className="s1 bd flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border" style={isDarkMode ? { background: "rgba(241,245,249,.9)" } : undefined}>
                <img
                  src="https://www.dropbox.com/scl/fi/qhdckf1zj8svntuz93gcq/csdl512.png?rlkey=ms93xygjfp7mzk727hij811po&st=lt8k0y9x&raw=1"
                  alt="Logo"
                  className="h-8 w-8 rounded-full"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              </div>
              <h1 className="hidden sm:block truncate text-base font-bold leading-tight t1">CSDLCoDo2BT</h1>
            </div>

            <h1 className="sm:hidden flex-1 text-center truncate text-base font-bold leading-tight t1 px-1">
              CSDLCoDo2BT
            </h1>

            <div className="no-print order-2 flex-shrink-0 sm:order-3">
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkMode ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
                aria-label={isDarkMode ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
                className="icon-btn h-10 w-10"
              >
                {isDarkMode ? <Sun className="h-[18px] w-[18px] text-amber-400" /> : <Moon className="h-[18px] w-[18px] text-indigo-600" />}
              </button>
            </div>

            <div className="no-print order-3 w-full sm:order-2 sm:w-auto">
              {activeTab === "classSummary" ? (
                <button
                  type="button"
                  onClick={() => setIsClassSelectorOpen(true)}
                  className="s1 bd flex h-[46px] w-full items-center justify-between gap-3 rounded-xl border px-3 transition-colors hover:border-emerald-500 sm:w-auto"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="chip tone-emerald flex h-7 w-7 items-center justify-center rounded-full">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-[11px] font-medium tm">Lớp</span>
                      <span className="text-sm font-bold t1">{selectedClass || "Chọn lớp"}</span>
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 tm" />
                </button>
              ) : (
                <WeekPicker
                  weekInput={weekInput}
                  weekNumber={weekNumber}
                  currentWeek={currentWeekNumber}
                  weekError={weekError}
                  dateRange={dateRange}
                  onInput={handleWeekInput}
                  onStep={handleWeekStep}
                  onCommit={() => applyWeek(weekInput)}
                  onToday={handleWeekToday}
                />
              )}
            </div>

            {weekError && activeTab !== "classSummary" && (
              <p role="alert" className="order-4 flex w-full items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {weekError}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="no-print px-3 sm:px-4">
            <div
              role="tablist"
              aria-label="Chuyển mục"
              onKeyDown={onTabKeyDown}
              className="relative grid grid-cols-3 sm:max-w-md"
            >
              {TAB_ORDER.map((id) => {
                const { label, icon: Icon, acc } = TAB_META[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`tab-${id}`}
                    aria-selected={activeTab === id}
                    aria-controls="report-panel"
                    tabIndex={activeTab === id ? 0 : -1}
                    onClick={() => handleTabChange(id)}
                    className={`tab-btn ${acc} flex h-11 items-center justify-center gap-1.5 text-xs font-semibold sm:text-sm`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
              <span
                aria-hidden
                className="tab-ind absolute bottom-0 left-0 h-0.5 w-1/3 rounded-full"
                style={{ transform: `translateX(${tabIndex * 100}%)` }}
              />
            </div>
          </div>

          {/* Info bar */}
          <div className="bd-soft no-print flex items-center justify-between gap-3 border-t px-3 py-2 sm:px-4">
            <p className="min-w-0 flex-1 text-[11px] leading-snug tm sm:text-xs">
              {activeTab === "violations"
                ? "Dữ liệu do Đội Cờ đỏ cập nhật. Nếu phát hiện sai sót, vui lòng phản ánh với thành viên Đội Cờ đỏ hoặc Quản trị viên."
                : activeTab === "scores"
                  ? `Điểm thi đua tính trên điểm chuẩn ${BASE_SCORE}, dựa trên vi phạm đã ghi nhận. Chưa gồm điểm giờ học và điểm thưởng (nếu có).`
                  : `Tổng hợp vi phạm của lớp ${selectedClass || "—"} từ đầu năm học đến nay, tuần mới nhất ở trên cùng.`}
            </p>
            {activeTab !== "scores" && (
              <button
                type="button"
                onClick={() => setHideExcusedAbsence((v) => !v)}
                aria-pressed={hideExcusedAbsence}
                title={hideExcusedAbsence ? "Đang ẩn nghỉ có phép" : "Đang hiện nghỉ có phép"}
                className={`flex h-8 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition active:scale-95 ${hideExcusedAbsence ? "chip tone-emerald" : "chip tone-slate"
                  }`}
              >
                {hideExcusedAbsence ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Ẩn nghỉ CP
              </button>
            )}
          </div>
        </div>
        {refreshing && <div className="progress" aria-hidden />}
      </header>

      {/* ------------------------------ CONTENT ----------------------------- */}
      <main id="report-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <div key={activeTab} className="anim-tab">
          {settingMissing ? (
            <EmptyState
              icon={<Calendar className="h-7 w-7" />}
              title="Chưa cấu hình ngày bắt đầu tuần học"
              hint="Quản trị viên cần thiết lập “weekBaseDate” để hiển thị dữ liệu theo tuần."
            />
          ) : activeTab === "violations" ? (
            <ViolationsTab
              violations={violations as any[] | undefined}
              refreshing={violationsRefreshing}
              hideExcused={hideExcusedAbsence}
              onOpenEvidence={handleOpenEvidence}
            />
          ) : activeTab === "scores" ? (
            <ScoresTab
              scores={emulationScores as any[] | undefined}
              refreshing={scoresRefreshing}
              gradeFilter={gradeFilter}
              setGradeFilter={setGradeFilter}
            />
          ) : (
            <ClassSummaryTab
              selectedClass={selectedClass}
              data={classViolations as any[] | undefined}
              weeks={classViolationsByWeek}
              metrics={classSummaryMetrics}
              refreshing={classRefreshing}
              onPickClass={() => setIsClassSelectorOpen(true)}
              onOpenEvidence={handleOpenEvidence}
            />
          )}
        </div>
      </main>

      <BackToTop />
    </div>
  );
};

export default PublicViolationReport;