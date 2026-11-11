/**
 * ArchiveViewer – All-in-One (Đã tích hợp Spotify Wrapped Story & Recap Insights)
 *
 * Tự động phân tích dữ liệu ZIP, dải bong bóng Story, phát recap âm thanh Web Audio,
 * biểu đồ insight thời gian thực và thẻ tổng kết Ticket năm học.
 */
import { useState, useCallback, useMemo, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import JSZip from "jszip";
import {
  format,
  differenceInCalendarWeeks,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  X,
  Upload,
  AlertTriangle,
  Users,
  Database,
  FileArchive,
  Image,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  School,
  CalendarDays,
  Search,
  Eye,
  HardDrive,
  Cloud,
  Sparkles,
  TrendingUp,
  Flame,
  Award,
  Smile,
  Camera,
  Play,
  RotateCcw,
  ArrowRight,
  Clock,
  Layers,
  Volume2,
  VolumeX,
  Share2,
  Check,
} from "lucide-react";
import { normalizeClassName } from "./lib/utils";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const SLIDE_MS = 6500;
const CLOSE_MS = 250;
const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
const WEEKDAYS_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/* ═══════════════════════════════ Web Audio FX ═══════════════════════════════ */

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  playPop() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  playFanfare() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = this.ctx.currentTime + idx * 0.08;
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {}
  }
}

const sfx = new SoundEffects();

/* ═══════════════════════════════ Date & Academic Helpers ═══════════════════════════════ */

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

function toAcademicWeek(
  rawWeek: number,
  breakWindow: ReturnType<typeof getBreakWindow>
) {
  if (!breakWindow) return rawWeek;
  if (rawWeek < breakWindow.startWeekIndex) return rawWeek;
  return Math.max(1, rawWeek - breakWindow.skippedWeeks);
}

function toCalendarWeek(
  academicWeek: number,
  breakWindow: ReturnType<typeof getBreakWindow>
) {
  if (!breakWindow) return academicWeek;
  if (academicWeek < breakWindow.startWeekIndex) return academicWeek;
  return academicWeek + breakWindow.skippedWeeks;
}

function getSettingValue(settings: any[], key: string): string | null {
  const row = settings.find((s) => s.key === key);
  if (row?.value == null) return null;
  return String(row.value);
}

function resolveWeekSettings(data: ArchiveData) {
  const weekBaseDate =
    data.metadata.weekBaseDate ??
    getSettingValue(data.settings, "weekBaseDate") ??
    new Date().toISOString().slice(0, 10);
  const holidayBreakStartDate =
    data.metadata.holidayBreakStartDate ??
    getSettingValue(data.settings, "holidayBreakStartDate");
  const holidayBreakEndDate =
    data.metadata.holidayBreakEndDate ??
    getSettingValue(data.settings, "holidayBreakEndDate");
  const breakWindow = getBreakWindow(
    weekBaseDate,
    holidayBreakStartDate,
    holidayBreakEndDate
  );
  return { weekBaseDate, breakWindow };
}

function getViolationTimestamp(v: any): number {
  const t = v?.violationDate ? new Date(v.violationDate).getTime() : NaN;
  if (Number.isFinite(t)) return t;
  return typeof v?._creationTime === "number" ? v._creationTime : 0;
}

function getAcademicWeek(
  violation: any,
  weekBaseDate: string,
  breakWindow: ReturnType<typeof getBreakWindow>
): number {
  const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
  const vDate = new Date(getViolationTimestamp(violation));
  const rawWeek = differenceInCalendarWeeks(vDate, base, { weekStartsOn: 1 }) + 1;
  return toAcademicWeek(rawWeek, breakWindow);
}

function getWeekDateRangeLabel(
  week: number,
  weekBaseDate: string,
  breakWindow: ReturnType<typeof getBreakWindow>
): string {
  const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
  const monday = startOfWeek(base, { weekStartsOn: 1 });
  const calendarWeek = toCalendarWeek(week, breakWindow);
  const start = new Date(monday.getTime() + (calendarWeek - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return `${format(start, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`;
}

function displayStudentHeading(violation: any): string {
  const name =
    typeof violation?.studentName === "string" ? violation.studentName.trim() : "";
  if (name) return name;
  if (violation?.targetType === "class") return "Vi phạm cấp lớp";
  return "Không có tên";
}

function getViolationGrade(v: any): number {
  if (typeof v.grade === "number" && v.grade >= 10 && v.grade <= 12) return v.grade;
  const match = String(v.violatingClass ?? "").match(/^(10|11|12)/);
  return match ? parseInt(match[1], 10) : 0;
}

function compareClassNames(a: string, b: string): number {
  return normalizeClassName(a).localeCompare(normalizeClassName(b), "vi", {
    numeric: true,
  });
}

type GroupedViolations = Map<number, Map<string, Map<number, any[]>>>;

function groupViolations(
  violations: any[],
  weekBaseDate: string,
  breakWindow: ReturnType<typeof getBreakWindow>
): GroupedViolations {
  const grouped: GroupedViolations = new Map();

  for (const v of violations) {
    const grade = getViolationGrade(v);
    const className = normalizeClassName(v.violatingClass || "?");
    const week = getAcademicWeek(v, weekBaseDate, breakWindow);

    if (!grouped.has(grade)) grouped.set(grade, new Map());
    const byClass = grouped.get(grade)!;
    if (!byClass.has(className)) byClass.set(className, new Map());
    const byWeek = byClass.get(className)!;
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week)!.push(v);
  }

  for (const byClass of grouped.values()) {
    for (const byWeek of byClass.values()) {
      for (const list of byWeek.values()) {
        list.sort((a, b) => getViolationTimestamp(b) - getViolationTimestamp(a));
      }
    }
  }

  return grouped;
}

/* ═══════════════════════════════ Recap Calculation ═══════════════════════════════ */

export type Counted = { name: string; count: number };

export interface RecapStats {
  total: number;
  studentTargets: number;
  classTargets: number;
  firstTs: number;
  lastTs: number;
  weeks: { week: number; count: number }[];
  peakWeek: { week: number; count: number } | null;
  quietWeek: { week: number; count: number } | null;
  avgPerWeek: number;
  weekday: number[];
  peakWeekday: number;
  timeSlot: { morningEarly: number; morningClass: number; noon: number; afternoon: number };
  peakTimeSlot: { label: string; count: number; pct: number } | null;
  grades: { grade: number; count: number; pct: number }[];
  types: Counted[];
  classes: Counted[];
  exemplary: { zero: string[]; lowest: Counted[] } | null;
  cleanStudents: { clean: number; total: number; pct: number } | null;
  evidence: { withEvidence: number; pct: number; files: number };
  reporters: Counted[];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const tally = (items: string[]): Counted[] => {
  const m = new Map<string, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi", { numeric: true }));
};

const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function computeRecapStats(input: {
  violations: any[];
  studentRoster: any[];
  userProfiles: any[];
  evidenceFileCount: number;
  getWeek: (v: any) => number;
  getTimestamp: (v: any) => number;
}): RecapStats {
  const { violations, studentRoster, userProfiles, evidenceFileCount, getWeek, getTimestamp } = input;
  const total = violations.length;

  let studentTargets = 0;
  let classTargets = 0;
  let firstTs = Infinity;
  let lastTs = 0;
  let withEvidence = 0;
  const weekMap = new Map<number, number>();
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const timeSlot = { morningEarly: 0, morningClass: 0, noon: 0, afternoon: 0 };
  const gradeCounts = new Map<number, number>([[10, 0], [11, 0], [12, 0]]);

  const typeList: string[] = [];
  const classList: string[] = [];
  const reporterList: string[] = [];
  const violatedStudents = new Set<string>();

  const profileName = new Map<string, string>();
  for (const p of userProfiles) {
    if (p?.userId) profileName.set(String(p.userId), String(p.fullName ?? p.name ?? "").trim());
  }

  for (const v of violations) {
    if (v.targetType === "class") classTargets++;
    else studentTargets++;

    const cls = normalizeClassName(v.violatingClass || "");
    if (cls) classList.push(cls);

    const grade = getViolationGrade(v);
    if (gradeCounts.has(grade)) {
      gradeCounts.set(grade, gradeCounts.get(grade)! + 1);
    }

    const ts = getTimestamp(v);
    if (ts > 0) {
      firstTs = Math.min(firstTs, ts);
      lastTs = Math.max(lastTs, ts);
      const dateInTz = toZonedTime(new Date(ts), TIME_ZONE);
      const day = dateInTz.getDay();
      weekday[(day + 6) % 7]++;

      const timeVal = dateInTz.getHours() * 60 + dateInTz.getMinutes();
      if (timeVal >= 390 && timeVal <= 450) timeSlot.morningEarly++;
      else if (timeVal > 450 && timeVal < 690) timeSlot.morningClass++;
      else if (timeVal >= 690 && timeVal <= 780) timeSlot.noon++;
      else timeSlot.afternoon++;
    }

    const w = getWeek(v);
    if (Number.isFinite(w) && w >= 1 && w <= 80) weekMap.set(w, (weekMap.get(w) ?? 0) + 1);

    if (v.violationType) typeList.push(String(v.violationType));

    if (v.targetType !== "class" && v.studentName && cls) {
      violatedStudents.add(`${cls}|${fold(String(v.studentName))}`);
    }

    if ((v.evidenceR2Keys?.length ?? 0) > 0 || (v.evidenceFileIds?.length ?? 0) > 0) withEvidence++;

    const reporter = v.customReporterName || profileName.get(String(v.reporterId));
    if (reporter) reporterList.push(String(reporter).trim());
  }

  const weeks: { week: number; count: number }[] = [];
  if (weekMap.size > 0) {
    const keys = [...weekMap.keys()];
    const lo = Math.min(...keys);
    const hi = Math.max(...keys);
    for (let w = lo; w <= hi; w++) weeks.push({ week: w, count: weekMap.get(w) ?? 0 });
  }

  const peakWeek = weeks.reduce<{ week: number; count: number } | null>(
    (best, w) => (!best || w.count > best.count ? w : best),
    null
  );
  const quietWeek = weeks.reduce<{ week: number; count: number } | null>(
    (best, w) => (!best || w.count < best.count ? w : best),
    null
  );

  const peakDayCount = Math.max(...weekday);
  const peakWeekday = peakDayCount > 0 ? weekday.indexOf(peakDayCount) : -1;

  const slots = [
    { label: "Đầu giờ sáng (6h30-7h30)", count: timeSlot.morningEarly },
    { label: "Trong giờ học sáng", count: timeSlot.morningClass },
    { label: "Giờ nghỉ trưa", count: timeSlot.noon },
    { label: "Buổi chiều & tan học", count: timeSlot.afternoon },
  ];
  const maxSlot = slots.reduce((best, cur) => (cur.count > best.count ? cur : best), slots[0]);
  const peakTimeSlot =
    maxSlot.count > 0 ? { ...maxSlot, pct: pctOf(maxSlot.count, total) } : null;

  const grades = [10, 11, 12].map((g) => {
    const c = gradeCounts.get(g) ?? 0;
    return { grade: g, count: c, pct: pctOf(c, total) };
  });

  const classes = tally(classList);

  let exemplary: RecapStats["exemplary"] = null;
  const rosterClasses = new Set<string>();
  for (const s of studentRoster) {
    const c = normalizeClassName(s?.className || "");
    if (c) rosterClasses.add(c);
  }
  if (rosterClasses.size > 0) {
    const counts = new Map(classes.map((c) => [c.name, c.count]));
    const all = [...rosterClasses]
      .map((name) => ({ name, count: counts.get(name) ?? 0 }))
      .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name, "vi", { numeric: true }));
    exemplary = {
      zero: all.filter((c) => c.count === 0).map((c) => c.name),
      lowest: all.slice(0, 3),
    };
  }

  let cleanStudents: RecapStats["cleanStudents"] = null;
  if (studentRoster.length > 0) {
    let clean = 0;
    for (const s of studentRoster) {
      const key = `${normalizeClassName(s?.className || "")}|${fold(String(s?.fullName ?? s?.name ?? ""))}`;
      if (!violatedStudents.has(key)) clean++;
    }
    const matched = studentRoster.length - clean;
    if (!(matched === 0 && studentTargets > 0)) {
      cleanStudents = { clean, total: studentRoster.length, pct: pctOf(clean, studentRoster.length) };
    }
  }

  return {
    total,
    studentTargets,
    classTargets,
    firstTs: Number.isFinite(firstTs) ? firstTs : 0,
    lastTs,
    weeks,
    peakWeek,
    quietWeek,
    avgPerWeek: weeks.length ? total / weeks.length : 0,
    weekday,
    peakWeekday,
    timeSlot,
    peakTimeSlot,
    grades,
    types: tally(typeList),
    classes,
    exemplary,
    cleanStudents,
    evidence: { withEvidence, pct: pctOf(withEvidence, total), files: evidenceFileCount },
    reporters: tally(reporterList),
  };
}

/* ═══════════════════════════════ Types ═══════════════════════════════ */

interface ArchiveMetadata {
  schoolYear: string;
  archivedAt: string;
  totalViolations: number;
  totalEvidenceFiles: number;
  appVersion: string;
  weekBaseDate?: string;
  holidayBreakStartDate?: string | null;
  holidayBreakEndDate?: string | null;
}

interface ArchiveData {
  metadata: ArchiveMetadata;
  violations: any[];
  violationLogs: any[];
  userProfiles: any[];
  users: any[];
  studentRoster: any[];
  classes: any[];
  settings: any[];
  reportingPoints: any[];
  evidenceLoader: EvidenceLoader;
  evidenceErrors: Array<{ r2Key: string; error: string }>;
}

interface EvidenceLoader {
  has: (basename: string) => boolean;
  list: () => string[];
  getUrl: (basename: string) => Promise<string | null>;
  revokeAll: () => void;
}

interface ArchiveLoadedInfo {
  sourceLabel: string;
  zipSizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeFromBasename(basename: string): string {
  const ext = basename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "application/octet-stream";
}

function isVideoBasename(basename: string): boolean {
  return /\.(mp4|webm|mov|avi)$/i.test(basename);
}

function evidenceBasenamesFromViolation(v: any): string[] {
  return (v.evidenceR2Keys ?? []).map((key: string) =>
    key.includes("/") ? key.substring(key.lastIndexOf("/") + 1) : key
  );
}

function createEvidenceLoader(zip: JSZip): EvidenceLoader {
  const index = new Map<string, string>();
  const cache = new Map<string, string>();
  const evidenceFolder = zip.folder("evidence");
  if (evidenceFolder) {
    evidenceFolder.forEach((relativePath, file) => {
      if (!file.dir) index.set(relativePath, `evidence/${relativePath}`);
    });
  }

  return {
    has: (basename) => index.has(basename),
    list: () => Array.from(index.keys()),
    getUrl: async (basename) => {
      if (cache.has(basename)) return cache.get(basename)!;
      const path = index.get(basename);
      if (!path) return null;
      const file = zip.file(path);
      if (!file) return null;
      const blob = await file.async("blob");
      const typed =
        blob.type && blob.type !== "application/octet-stream"
          ? blob
          : new Blob([blob], { type: mimeFromBasename(basename) });
      const url = URL.createObjectURL(typed);
      cache.set(basename, url);
      return url;
    },
    revokeAll: () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    },
  };
}

/* ═══════════════════════════════ Recap Story CSS ═══════════════════════════════ */

const RECAP_CSS = `
@keyframes ar-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ar-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes ar-card-in { from { opacity: 0; transform: translateY(28px) scale(.95); } to { opacity: 1; transform: none; } }
@keyframes ar-card-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(14px) scale(.97); } }
.ar-overlay { animation: ar-fade-in .25s ease-out both; }
.ar-overlay[data-closing="true"] { animation: ar-fade-out ${CLOSE_MS}ms ease-in both; }
.ar-card { animation: ar-card-in .38s cubic-bezier(.16,1,.3,1) both; }
.ar-card[data-closing="true"] { animation: ar-card-out ${CLOSE_MS}ms cubic-bezier(.32,0,.67,0) both; }
.ar-slide { animation: ar-fade-in .35s ease-out both; }

@keyframes ar-rise { from { opacity: 0; transform: translateY(14px); filter: blur(5px); } to { opacity: 1; transform: none; filter: blur(0); } }
.ar-rise { animation: ar-rise .75s var(--d, 0s) cubic-bezier(.16,1,.3,1) both; }
@keyframes ar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.ar-grow { transform-origin: bottom; animation: ar-grow .8s var(--d, 0s) cubic-bezier(.16,1,.3,1) both; }
@keyframes ar-growx { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.ar-growx { transform-origin: left; animation: ar-growx .8s var(--d, 0s) cubic-bezier(.16,1,.3,1) both; }
@keyframes ar-ring { from { stroke-dashoffset: 100; } to { stroke-dashoffset: var(--off, 0); } }
.ar-ring { animation: ar-ring 1.3s .3s cubic-bezier(.16,1,.3,1) both; }

@keyframes ar-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.ar-fill { animation-name: ar-fill; animation-timing-function: linear; animation-fill-mode: forwards; }

@keyframes ar-float { from { transform: translate(-6%, -5%) scale(1); } to { transform: translate(7%, 6%) scale(1.15); } }
.ar-blob {
  position: absolute; width: 85%; aspect-ratio: 1; border-radius: 9999px; filter: blur(75px); opacity: .55;
  transition: background-color 1s cubic-bezier(.16,1,.3,1);
  animation: ar-float 12s ease-in-out infinite alternate;
}
.ar-grad { background: linear-gradient(120deg, #fff, #fde68a 60%, #fbcfe8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ar-kicker { font-size: 11px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.7); }

@keyframes ar-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(236,72,153,.55); } 100% { box-shadow: 0 0 0 10px rgba(236,72,153,0); } }
.ar-pulse { animation: ar-pulse-ring 2.2s ease-out infinite; }

@keyframes ar-confetti {
  0%   { opacity: 0; transform: translate(0, 0) rotate(0); }
  10%  { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 380px)) rotate(var(--r)); }
}
.ar-confetti { position: absolute; border-radius: 2px; animation: ar-confetti 2.6s cubic-bezier(.2,.7,.3,1) both; }

@media (prefers-reduced-motion: reduce) {
  .ar-overlay, .ar-card, .ar-slide, .ar-rise, .ar-grow, .ar-growx, .ar-ring, .ar-blob, .ar-pulse, .ar-confetti {
    animation-duration: .01ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important;
  }
}
`;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const rise = (d: number) => ({ "--d": `${d}s` }) as React.CSSProperties;
const fmtDate = (ts: number) => format(toZonedTime(new Date(ts), TIME_ZONE), "dd/MM/yyyy");

function useCountUp(to: number, { ms = 1100, delay = 250, decimals = 0 } = {}) {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setV(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const t = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / ms);
        setV(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [to, ms, delay]);
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function CountUp({ to, decimals = 0, delay = 250 }: { to: number; decimals?: number; delay?: number }) {
  const s = useCountUp(to, { decimals, delay });
  return <span className="tabular-nums">{s}</span>;
}

function Chip({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span
      className="ar-rise rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/95 backdrop-blur-sm shadow-sm"
      style={rise(delay)}
    >
      {children}
    </span>
  );
}

function Bars({
  values,
  hot,
  labels,
  className = "h-40",
}: {
  values: number[];
  hot: number;
  labels?: string[];
  className?: string;
}) {
  const max = Math.max(...values, 1);
  const step = Math.min(0.03, 0.8 / Math.max(values.length, 1));
  return (
    <div>
      <div className={`flex items-end gap-[3px] ${className}`}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="ar-grow w-full rounded-t-[4px]"
              style={{
                ...rise(0.3 + i * step),
                height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1.5)}%`,
                background: i === hot ? "linear-gradient(to top,#fbbf24,#fff)" : "rgba(255,255,255,.32)",
              }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-2.5 flex gap-[3px] text-[11px] text-white/60">
          {labels.map((l, i) => (
            <span key={i} className={`flex-1 text-center ${i === hot ? "font-bold text-amber-200" : ""}`}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RankRows({ rows, prefix = "", base = 0.35 }: { rows: Counted[]; prefix?: string; base?: number }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="mt-5 space-y-3">
      {rows.map((r, i) => (
        <div key={r.name} className="ar-rise" style={rise(base + i * 0.1)}>
          <div className="mb-1 flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-start gap-2">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                {i + 1}
              </span>
              <span className="line-clamp-2 font-medium leading-snug">
                {prefix}
                {r.name}
              </span>
            </span>
            <span className="shrink-0 font-bold tabular-nums">{r.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="ar-growx h-full rounded-full bg-gradient-to-r from-amber-200 to-rose-300"
              style={{ ...rise(base + 0.15 + i * 0.1), width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Ring({ pct, c1, c2, children }: { pct: number; c1: string; c2: string; children: React.ReactNode }) {
  const id = useId().replace(/:/g, "");
  const off = 100 - Math.min(100, Math.max(0, pct));
  return (
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          className="ar-ring"
          style={{ "--off": off } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        x: (Math.random() - 0.5) * 360,
        y: -(100 + Math.random() * 200),
        r: Math.random() * 720 - 360,
        d: Math.random() * 0.35,
        c: ["#fbbf24", "#f472b6", "#818cf8", "#34d399", "#38bdf8", "#fff"][i % 6],
        w: 6 + Math.random() * 6,
      })),
    []
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[30%] z-0">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ar-confetti"
          style={
            {
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--r": `${p.r}deg`,
              animationDelay: `${0.2 + p.d}s`,
              background: p.c,
              width: p.w,
              height: p.w * 1.6,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════ Slides Builder ═══════════════════════════════ */

interface SlideCtx {
  goTo: (i: number) => void;
  close: () => void;
  viewDetails: () => void;
}
interface SlideDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  theme: [string, string, string];
  body: (c: SlideCtx) => React.ReactNode;
}

const ic = "h-5 w-5";

function buildSlides(
  s: RecapStats,
  schoolYear: string,
  weekLabel: (week: number) => string
): SlideDef[] {
  const slides: SlideDef[] = [];

  slides.push({
    id: "intro",
    label: "Recap",
    icon: <Sparkles className={ic} />,
    theme: ["#4f46e5", "#d946ef", "#f59e0b"],
    body: () => (
      <>
        <p className="ar-rise ar-kicker" style={rise(0.1)}>
          Archive Recap • Điểm nhìn một năm
        </p>
        <h2 className="ar-rise mt-3 text-[44px] font-black leading-[1.05] tracking-tight" style={rise(0.25)}>
          Năm học
          <br />
          <span className="ar-grad">{schoolYear}</span>
        </h2>
        <p className="ar-rise mt-5 max-w-[19rem] text-sm leading-relaxed text-white/80" style={rise(0.5)}>
          Bản tổng kết phong cách Wrapped: Những con số biết nói, những lớp dẫn đầu và khoảnh khắc đáng nhớ.
        </p>
        {s.firstTs > 0 && (
          <p className="ar-rise mt-8 text-xs font-mono text-white/50" style={rise(0.8)}>
            Ghi nhận từ {fmtDate(s.firstTs)} → {fmtDate(s.lastTs)}
          </p>
        )}
        <p className="ar-rise absolute inset-x-0 bottom-6 text-center text-[11px] text-white/45" style={rise(1.1)}>
          Chạm nửa phải để xem tiếp • Giữ để tạm dừng
        </p>
      </>
    ),
  });

  slides.push({
    id: "total",
    label: "Tổng quan",
    icon: <TrendingUp className={ic} />,
    theme: ["#0284c7", "#6366f1", "#9333ea"],
    body: () => (
      <>
        <p className="ar-rise ar-kicker" style={rise(0.1)}>
          Toàn bộ năm học ghi nhận
        </p>
        <div className="ar-rise mt-3 text-[92px] font-black leading-none" style={rise(0.2)}>
          <span className="ar-grad">
            <CountUp to={s.total} />
          </span>
        </div>
        <p className="ar-rise mt-2 text-xl font-bold" style={rise(0.35)}>
          lượt nhắc nhở & vi phạm
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {s.avgPerWeek > 0 && <Chip delay={0.65}>~{s.avgPerWeek.toFixed(1)} vụ/tuần</Chip>}
          <Chip delay={0.75}>{s.studentTargets} cá nhân</Chip>
          <Chip delay={0.85}>{s.classTargets} cấp lớp</Chip>
        </div>
      </>
    ),
  });

  const sortedGrades = [...s.grades].sort((a, b) => b.count - a.count);
  const leadingGrade = sortedGrades[0];
  slides.push({
    id: "grades",
    label: "Khối lớp",
    icon: <Layers className={ic} />,
    theme: ["#8b5cf6", "#ec4899", "#3b82f6"],
    body: () => (
      <>
        <p className="ar-rise ar-kicker" style={rise(0.1)}>
          Tỉ lệ theo khối
        </p>
        <h2 className="ar-rise mt-2 text-[32px] font-black leading-tight" style={rise(0.2)}>
          Khối <span className="ar-grad">{leadingGrade?.grade ?? 10}</span> &quot;chiếm sóng&quot; nhất
        </h2>
        <p className="ar-rise mt-1 text-sm text-white/70" style={rise(0.3)}>
          Chiếm {leadingGrade?.pct ?? 0}% tổng số vi phạm toàn trường.
        </p>
        <div className="mt-6 space-y-4">
          {s.grades.map((g, idx) => (
            <div key={g.grade} className="ar-rise" style={rise(0.4 + idx * 0.1)}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold">Khối {g.grade}</span>
                <span className="font-mono text-white/80">{g.count} vụ ({g.pct}%)</span>
              </div>
              <div className="h-3 w-full bg-white/15 rounded-full overflow-hidden">
                <div
                  className="ar-growx h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                  style={{ ...rise(0.5 + idx * 0.1), width: `${g.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  });

  if (s.weeks.length >= 2 && s.peakWeek) {
    const peak = s.peakWeek;
    const hot = s.weeks.findIndex((w) => w.week === peak.week);
    const first = s.weeks[0].week;
    const last = s.weeks[s.weeks.length - 1].week;
    slides.push({
      id: "weeks",
      label: "Cao điểm",
      icon: <Flame className={ic} />,
      theme: ["#ef4444", "#f97316", "#eab308"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Nhịp đập tuần học
          </p>
          <h2 className="ar-rise mt-2 text-[32px] font-extrabold leading-tight" style={rise(0.2)}>
            Tuần {peak.week} bùng nổ nhất!
          </h2>
          <p className="ar-rise mt-1.5 text-xs text-white/75" style={rise(0.35)}>
            {weekLabel(peak.week)} · Đạt mốc {peak.count} vi phạm
          </p>
          <div className="mt-7">
            <Bars values={s.weeks.map((w) => w.count)} hot={hot} />
            <div className="mt-2 flex justify-between text-[11px] text-white/50">
              <span>Tuần {first}</span>
              <span>Tuần {last}</span>
            </div>
          </div>
          {s.quietWeek && (
            <p className="ar-rise mt-5 text-xs text-white/70" style={rise(1.0)}>
              Thanh bình nhất: tuần {s.quietWeek.week} ({s.quietWeek.count} vụ)
            </p>
          )}
        </>
      ),
    });
  }

  if (s.peakWeekday >= 0) {
    const pk = s.peakWeekday;
    slides.push({
      id: "timing",
      label: "Thời điểm",
      icon: <Clock className={ic} />,
      theme: ["#059669", "#0284c7", "#6366f1"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Khung giờ & Ngày nóng
          </p>
          <h2 className="ar-rise mt-2 text-[32px] font-extrabold leading-tight" style={rise(0.2)}>
            <span className="ar-grad">{WEEKDAYS[pk]}</span> là ngày căng thẳng nhất
          </h2>
          <p className="ar-rise mt-1.5 text-xs text-white/75" style={rise(0.35)}>
            {pctOf(s.weekday[pk], s.total)}% số lần ghi nhận rơi vào {WEEKDAYS[pk].toLowerCase()}
          </p>
          <div className="mt-6">
            <Bars values={s.weekday} hot={pk} labels={WEEKDAYS_SHORT} className="h-36" />
          </div>
          {s.peakTimeSlot && (
            <div className="ar-rise mt-4 rounded-xl border border-white/15 bg-white/10 p-3" style={rise(0.9)}>
              <p className="text-[11px] font-bold text-amber-300">Khung giờ vàng:</p>
              <p className="text-xs text-white/90">
                {s.peakTimeSlot.label} ({s.peakTimeSlot.count} vụ · {s.peakTimeSlot.pct}%)
              </p>
            </div>
          )}
        </>
      ),
    });
  }

  if (s.types.length > 0) {
    const top = s.types[0];
    slides.push({
      id: "types",
      label: "Lỗi phổ biến",
      icon: <AlertTriangle className={ic} />,
      theme: ["#9333ea", "#ec4899", "#f43f5e"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Nội quy hay bị quên
          </p>
          <h2 className="ar-rise mt-2 line-clamp-2 text-2xl font-black leading-snug" style={rise(0.2)}>
            <span className="ar-grad">{top.name}</span>
          </h2>
          <p className="ar-rise mt-1 text-xs text-white/75" style={rise(0.3)}>
            {top.count} lượt · chiếm {pctOf(top.count, s.total)}% tổng số
          </p>
          <RankRows rows={s.types.slice(0, 4)} />
        </>
      ),
    });
  }

  if (s.exemplary) {
    const ex = s.exemplary;
    slides.push({
      id: "exemplary",
      label: "Lớp gương mẫu",
      icon: <Award className={ic} />,
      theme: ["#059669", "#10b981", "#06b6d4"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Tuyên dương nề nếp
          </p>
          {ex.zero.length > 0 ? (
            <>
              <div className="ar-rise mt-3 text-[88px] font-black leading-none" style={rise(0.2)}>
                <span className="ar-grad">
                  <CountUp to={ex.zero.length} />
                </span>
              </div>
              <p className="ar-rise mt-1 text-xl font-bold" style={rise(0.35)}>
                lớp giữ thành tích 0 vi phạm
              </p>
              <div className="mt-5 flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {ex.zero.slice(0, 10).map((n, i) => (
                  <Chip key={n} delay={0.6 + i * 0.05}>
                    Lớp {n}
                  </Chip>
                ))}
                {ex.zero.length > 10 && <Chip delay={1.1}>+{ex.zero.length - 10} lớp khác</Chip>}
              </div>
            </>
          ) : (
            <>
              <h2 className="ar-rise mt-2 text-[30px] font-black leading-tight" style={rise(0.2)}>
                Các lớp nề nếp nhất
              </h2>
              <p className="ar-rise mt-1 text-xs text-white/75" style={rise(0.3)}>
                Số lượt vi phạm thấp nhất toàn trường
              </p>
              <RankRows rows={ex.lowest} prefix="Lớp " base={0.4} />
            </>
          )}
        </>
      ),
    });
  }

  if (s.cleanStudents) {
    const cs = s.cleanStudents;
    slides.push({
      id: "clean",
      label: "Học sinh tốt",
      icon: <Smile className={ic} />,
      theme: ["#16a34a", "#0284c7", "#6366f1"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Nề nếp học sinh
          </p>
          <div className="mt-6">
            <Ring pct={cs.pct} c1="#fde68a" c2="#34d399">
              <span className="text-5xl font-black tabular-nums">
                <CountUp to={cs.pct} delay={300} />
                <span className="text-2xl">%</span>
              </span>
              <span className="mt-0.5 text-xs text-white/70">học sinh</span>
            </Ring>
          </div>
          <p className="ar-rise mt-6 text-center text-lg font-bold" style={rise(0.75)}>
            chưa từng có tên trong sổ nề nếp!
          </p>
          <p className="ar-rise mt-1 text-center text-xs text-white/60" style={rise(0.9)}>
            {cs.clean}/{cs.total} học sinh gương mẫu suốt năm học
          </p>
        </>
      ),
    });
  }

  if (s.evidence.withEvidence > 0) {
    const ev = s.evidence;
    slides.push({
      id: "evidence",
      label: "Bằng chứng",
      icon: <Camera className={ic} />,
      theme: ["#0284c7", "#818cf8", "#e879f9"],
      body: () => (
        <>
          <p className="ar-rise ar-kicker" style={rise(0.1)}>
            Minh bạch & Trực quan
          </p>
          <div className="mt-6">
            <Ring pct={ev.pct} c1="#7dd3fc" c2="#f0abfc">
              <span className="text-5xl font-black tabular-nums">
                <CountUp to={ev.pct} delay={300} />
                <span className="text-2xl">%</span>
              </span>
              <span className="mt-0.5 text-xs text-white/70">báo cáo</span>
            </Ring>
          </div>
          <p className="ar-rise mt-6 text-center text-lg font-bold" style={rise(0.75)}>
            có đính kèm ảnh / video
          </p>
          <p className="ar-rise mt-1 text-center text-xs text-white/60" style={rise(0.9)}>
            Đã lưu {ev.files} tệp bằng chứng trong kho archive
          </p>
        </>
      ),
    });
  }

  const topType = s.types[0];
  const topClass = s.classes[0];
  slides.push({
    id: "outro",
    label: "Tấm vé Recap",
    icon: <Sparkles className={ic} />,
    theme: ["#4f46e5", "#d946ef", "#f59e0b"],
    body: ({ goTo, viewDetails }) => (
      <OutroSlideBody
        schoolYear={schoolYear}
        stats={s}
        topType={topType}
        topClass={topClass}
        goTo={goTo}
        viewDetails={viewDetails}
      />
    ),
  });

  return slides;
}

function OutroSlideBody({
  schoolYear,
  stats,
  topType,
  topClass,
  goTo,
  viewDetails,
}: {
  schoolYear: string;
  stats: RecapStats;
  topType?: Counted;
  topClass?: Counted;
  goTo: (i: number) => void;
  viewDetails: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    sfx.playFanfare();
  }, []);

  const handleShare = () => {
    const text = `🏆 Recap Nề Nếp Năm Học ${schoolYear}:\n- Tổng vi phạm: ${stats.total}\n- Học sinh gương mẫu: ${stats.cleanStudents?.pct ?? 0}%\n- Lớp dẫn đầu nề nếp: ${stats.exemplary?.zero?.[0] ? stats.exemplary.zero[0] : "Xem chi tiết"}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Confetti />
      <div className="relative z-10 text-center">
        <p className="ar-rise ar-kicker" style={rise(0.1)}>
          Tổng kết năm học • {schoolYear}
        </p>
        <h2 className="ar-rise mt-1 text-2xl font-black" style={rise(0.2)}>
          Tấm vé <span className="ar-grad">lưu trữ</span>
        </h2>
      </div>

      <div
        className="ar-rise relative z-10 mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-2xl text-xs space-y-2.5"
        style={rise(0.35)}
      >
        <div className="flex justify-between items-center border-b border-white/15 pb-2">
          <span className="font-bold tracking-wider text-amber-300">ARCHIVE TICKET</span>
          <span className="font-mono text-[10px] text-white/60">NH {schoolYear}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="bg-black/20 rounded-lg p-2">
            <span className="text-[10px] text-white/50 block">TỔNG GHI NHẬN</span>
            <span className="text-base font-black text-rose-300">{stats.total} vụ</span>
          </div>
          <div className="bg-black/20 rounded-lg p-2">
            <span className="text-[10px] text-white/50 block">HỌC SINH TỐT</span>
            <span className="text-base font-black text-emerald-300">{stats.cleanStudents?.pct ?? 100}%</span>
          </div>
          <div className="bg-black/20 rounded-lg p-2">
            <span className="text-[10px] text-white/50 block">LỖI HAY GẶP</span>
            <span className="font-bold truncate block">{topType?.name ?? "—"}</span>
          </div>
          <div className="bg-black/20 rounded-lg p-2">
            <span className="text-[10px] text-white/50 block">LỚP SÔI NỔI</span>
            <span className="font-bold truncate block">Lớp {topClass?.name ?? "—"}</span>
          </div>
        </div>
        <div className="pt-1 flex items-center justify-between opacity-40 font-mono text-[9px]">
          <span>||||| | |||| ||| |||||</span>
          <span>VERIFIED ARCHIVE</span>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex flex-col gap-2">
        <button
          type="button"
          data-nopress
          onClick={viewDetails}
          className="ar-rise inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-lg active:scale-95 transition-transform"
          style={rise(0.6)}
        >
          Xem chi tiết vi phạm <ArrowRight className="h-4 w-4" />
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            data-nopress
            onClick={handleShare}
            className="ar-rise flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white active:scale-95"
            style={rise(0.7)}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Đã chép text" : "Sao chép tóm tắt"}
          </button>
          <button
            type="button"
            data-nopress
            onClick={() => goTo(0)}
            className="ar-rise flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white active:scale-95"
            style={rise(0.8)}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Xem lại
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════ Recap Story Viewer ═══════════════════════════════ */

const BLOB_POS: React.CSSProperties[] = [
  { left: "-25%", top: "-10%" },
  { right: "-25%", top: "25%", animationDelay: "-4s" },
  { left: "5%", bottom: "-25%", animationDelay: "-8s" },
];

function RecapStory({
  slides,
  startIndex,
  schoolYear,
  onSeen,
  onClose,
  onViewViolations,
}: {
  slides: SlideDef[];
  startIndex: number;
  schoolYear: string;
  onSeen: (id: string) => void;
  onClose: () => void;
  onViewViolations: () => void;
}) {
  const last = slides.length - 1;
  const autoplay = useMemo(() => !reducedMotion(), []);
  const [idx, setIdx] = useState(Math.min(startIndex, last));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [closing, setClosing] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const closeTimer = useRef<number | undefined>(undefined);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const next = useCallback(() => {
    sfx.playPop();
    setIdx((i) => Math.min(i + 1, last));
  }, [last]);

  const prev = useCallback(() => {
    sfx.playPop();
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    onSeen(slides[idx].id);
  }, [idx, slides, onSeen]);

  useEffect(() => {
    cardRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, next, prev]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !soundOn;
    setSoundOn(nextState);
    sfx.enabled = nextState;
    if (nextState) sfx.playPop();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-nopress]")) return;
    press.current = { t: Date.now(), x: e.clientX, y: e.clientY };
    setPaused(true);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    setPaused(false);
    const dt = Date.now() - p.t;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dt < 280 && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.35) prev();
      else next();
    } else if (dy > 80 && dy > Math.abs(dx) * 1.5) {
      requestClose();
    }
  };

  const slide = slides[idx];
  const running = autoplay && idx < last;
  const ctx: SlideCtx = {
    goTo: (i) => {
      sfx.playPop();
      setIdx(i);
    },
    close: requestClose,
    viewDetails: () => {
      onViewViolations();
      requestClose();
    },
  };

  return createPortal(
    <div
      className="ar-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
      data-closing={closing}
      role="dialog"
      aria-modal="true"
      aria-label={`Archive Recap ${schoolYear}`}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        data-closing={closing}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setPaused(false)}
        className="ar-card relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-[#090d1a] text-white outline-none sm:h-[min(90dvh,800px)] sm:max-w-[420px] sm:rounded-[32px] sm:shadow-2xl sm:border sm:border-white/10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {slide.theme.map((c, i) => (
            <div key={i} className="ar-blob" style={{ ...BLOB_POS[i], backgroundColor: c }} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        </div>

        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3" aria-hidden="true">
          {slides.map((s, i) => {
            const active = i === idx && running;
            return (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full origin-left rounded-full bg-white ${active ? "ar-fill" : ""}`}
                  style={{
                    transform: active ? undefined : i <= idx ? "scaleX(1)" : "scaleX(0)",
                    animationDuration: `${SLIDE_MS}ms`,
                    animationPlayState: paused || hidden ? "paused" : "running",
                  }}
                  onAnimationEnd={active ? next : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className="absolute inset-x-0 top-6 z-20 flex items-center justify-between px-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Recap {schoolYear}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-nopress
              onClick={toggleSound}
              aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 active:scale-90 transition-transform"
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/50" />}
            </button>
            <button
              type="button"
              data-nopress
              onClick={requestClose}
              aria-label="Đóng"
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 active:scale-90 transition-transform"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          key={idx}
          className="ar-slide absolute inset-0 z-10 flex flex-col justify-center px-7 pb-16 pt-20"
          aria-live="polite"
        >
          {slide.body(ctx)}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════ Dải Nổi Bật ═══════════════════════════════ */

function ArchiveRecap({
  stats,
  schoolYear,
  weekLabel,
  onViewViolations,
}: {
  stats: RecapStats;
  schoolYear: string;
  weekLabel: (week: number) => string;
  onViewViolations: () => void;
}) {
  const slides = useMemo(() => buildSlides(stats, schoolYear, weekLabel), [stats, schoolYear, weekLabel]);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const markSeen = useCallback(
    (id: string) => setSeen((p) => (p.has(id) ? p : new Set(p).add(id))),
    []
  );

  if (stats.total === 0) return null;

  const bubbles = slides.map((s, i) => ({ s, i })).filter(({ s }) => s.id !== "outro");
  const firstUnseen = bubbles.findIndex(({ s }) => !seen.has(s.id));

  return (
    <section
      aria-label="Nổi bật năm học"
      className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-md"
    >
      <style>{RECAP_CSS}</style>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Sparkles className="h-4 w-4 text-fuchsia-600" />
          Nổi bật năm học {schoolYear}
        </div>
        <button
          type="button"
          onClick={() => {
            sfx.playPop();
            setOpenAt(0);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <Play className="h-3.5 w-3.5 fill-white" />
          Phát Story Recap
        </button>
      </div>

      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {bubbles.map(({ s, i }, bi) => {
          const isSeen = seen.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                sfx.playPop();
                setOpenAt(i);
              }}
              className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 focus:outline-none"
            >
              <span
                className={`rounded-full p-[3px] transition-[transform,background-color] duration-300 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-indigo-400 ${
                  isSeen ? "bg-slate-200" : "bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600"
                } ${bi === firstUnseen ? "ar-pulse" : ""}`}
              >
                <span
                  className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-white text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${s.theme[0]}, ${s.theme[2]})` }}
                >
                  {s.icon}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-semibold text-slate-700">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {openAt !== null && (
        <RecapStory
          slides={slides}
          startIndex={openAt}
          schoolYear={schoolYear}
          onSeen={markSeen}
          onClose={() => setOpenAt(null)}
          onViewViolations={onViewViolations}
        />
      )}
    </section>
  );
}

/* ═══════════════════════════════ Archive Insights ═══════════════════════════════ */

function InsightCard({
  title,
  hint,
  className = "",
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {hint && <span className="truncate text-xs text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function LightRank({ rows, prefix = "" }: { rows: Counted[]; prefix?: string }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.name}>
          <div className="mb-1 flex items-start justify-between gap-3 text-xs">
            <span className="line-clamp-2 font-medium text-slate-700">
              {prefix}
              {r.name}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-slate-800">{r.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="ar-growx h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500"
              style={{ ...rise(0.1 + i * 0.08), width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchiveInsights({
  stats,
  weekLabel,
}: {
  stats: RecapStats;
  weekLabel: (week: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (stats.total === 0) return null;

  const maxWeek = Math.max(...stats.weeks.map((w) => w.count), 1);
  const maxDay = Math.max(...stats.weekday, 1);
  const peakIdx = stats.peakWeek ? stats.weeks.findIndex((w) => w.week === stats.peakWeek!.week) : -1;
  const shown = hover ?? (peakIdx >= 0 ? peakIdx : null);
  const shownWeek = shown !== null ? stats.weeks[shown] : null;

  return (
    <div className="space-y-4">
      <style>{RECAP_CSS}</style>
      <div className="grid gap-4 lg:grid-cols-5">
        <InsightCard
          className="lg:col-span-3"
          title="Xu hướng nhịp độ theo tuần"
          hint={
            shownWeek
              ? `${hover === null ? "Cao điểm: " : ""}Tuần ${shownWeek.week} (${weekLabel(shownWeek.week)}) · ${shownWeek.count} vụ`
              : undefined
          }
        >
          {stats.weeks.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Chưa đủ dữ liệu tuần.</p>
          ) : (
            <div onMouseLeave={() => setHover(null)}>
              <div className="flex h-36 items-end gap-[3px]">
                {stats.weeks.map((w, i) => (
                  <button
                    key={w.week}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    className="flex h-full min-w-0 flex-1 items-end focus:outline-none"
                  >
                    <span
                      className={`ar-grow w-full rounded-t-[3px] transition-colors duration-150 ${
                        i === shown
                          ? "bg-gradient-to-t from-amber-500 to-amber-300"
                          : "bg-gradient-to-t from-indigo-500 to-pink-400 hover:opacity-85"
                      }`}
                      style={{
                        ...rise(Math.min(i * 0.02, 0.7)),
                        height: `${Math.max((w.count / maxWeek) * 100, w.count > 0 ? 4 : 1.5)}%`,
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>Tuần {stats.weeks[0].week}</span>
                <span>Tuần {stats.weeks[stats.weeks.length - 1].week}</span>
              </div>
            </div>
          )}
        </InsightCard>

        <InsightCard
          className="lg:col-span-2"
          title="Theo thứ trong tuần"
          hint={stats.peakWeekday >= 0 ? `Nhiều nhất: ${WEEKDAYS[stats.peakWeekday]}` : undefined}
        >
          <div className="flex h-36 items-end gap-2">
            {stats.weekday.map((n, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-600">{n}</span>
                <span
                  className={`ar-grow w-full rounded-t-md ${
                    i === stats.peakWeekday
                      ? "bg-gradient-to-t from-amber-500 to-amber-300"
                      : "bg-gradient-to-t from-indigo-500 to-purple-400"
                  }`}
                  style={{ ...rise(i * 0.05), height: `${Math.max((n / maxDay) * 75, n > 0 ? 4 : 1.5)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-[11px] text-slate-400">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} className="flex-1 text-center font-medium">
                {d}
              </span>
            ))}
          </div>
        </InsightCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InsightCard title="Lỗi phổ biến nhất" hint={`${stats.types.length} danh mục lỗi`}>
          <LightRank rows={stats.types.slice(0, 5)} />
        </InsightCard>
        <InsightCard title="Lớp có nhiều nhắc nhở nhất" hint={`${stats.classes.length} lớp có ghi nhận`}>
          <LightRank rows={stats.classes.slice(0, 5)} prefix="Lớp " />
        </InsightCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Main Component ═══════════════════════════════ */

export type ArchiveLaunch = { url?: string; label?: string };

interface ArchiveViewerProps {
  onExit: () => void;
  initialUrl?: string;
  initialLabel?: string;
}

export default function ArchiveViewer({ onExit, initialUrl, initialLabel }: ArchiveViewerProps) {
  const archiveJobs = useQuery(api.archive.listArchiveJobs);
  const [archiveData, setArchiveData] = useState<ArchiveData | null>(null);
  const [loadedInfo, setLoadedInfo] = useState<ArchiveLoadedInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const evidenceLoaderRef = useRef<EvidenceLoader | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "violations" | "roster" | "users" | "evidence"
  >("overview");

  const completedJobs = useMemo(
    () =>
      (archiveJobs ?? []).filter(
        (j) => j.status === "completed" && j.downloadUrl
      ),
    [archiveJobs]
  );

  const cleanupEvidence = useCallback(() => {
    evidenceLoaderRef.current?.revokeAll();
    evidenceLoaderRef.current = null;
  }, []);

  useEffect(() => () => cleanupEvidence(), [cleanupEvidence]);

  const loadFromArrayBuffer = useCallback(
    async (arrayBuffer: ArrayBuffer, sourceLabel: string) => {
      cleanupEvidence();
      setLoading(true);
      setLoadingLabel(sourceLabel);
      setError(null);
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const data = await parseZip(zip);
        evidenceLoaderRef.current = data.evidenceLoader;
        setArchiveData(data);
        setLoadedInfo({
          sourceLabel,
          zipSizeBytes: arrayBuffer.byteLength,
        });
        setActiveTab("overview");
      } catch (err) {
        setError(`Không thể đọc file archive: ${(err as Error).message}`);
      } finally {
        setLoading(false);
        setLoadingLabel(null);
      }
    },
    [cleanupEvidence]
  );

  const loadFromUrl = useCallback(
    async (url: string, sourceLabel: string) => {
      setLoading(true);
      setLoadingLabel(sourceLabel);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await loadFromArrayBuffer(arrayBuffer, sourceLabel);
      } catch (err) {
        setLoading(false);
        setLoadingLabel(null);
        setError(`Không thể tải archive: ${(err as Error).message}`);
      }
    },
    [loadFromArrayBuffer]
  );

  useEffect(() => {
    if (!initialUrl || archiveData || loading) return;
    const label = initialLabel ?? "Archive trên server";
    void loadFromUrl(initialUrl, label);
  }, [initialUrl, initialLabel, archiveData, loading, loadFromUrl]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      await loadFromArrayBuffer(arrayBuffer, file.name);
      e.target.value = "";
    },
    [loadFromArrayBuffer]
  );

  const { weekBaseDate, breakWindow } = useMemo(
    () => (archiveData ? resolveWeekSettings(archiveData) : { weekBaseDate: "", breakWindow: null }),
    [archiveData]
  );

  const recapStats = useMemo(() => {
    if (!archiveData) return null;
    return computeRecapStats({
      violations: archiveData.violations,
      studentRoster: archiveData.studentRoster,
      userProfiles: archiveData.userProfiles,
      evidenceFileCount: archiveData.evidenceLoader.list().length,
      getWeek: (v) => getAcademicWeek(v, weekBaseDate, breakWindow),
      getTimestamp: (v) => getViolationTimestamp(v),
    });
  }, [archiveData, weekBaseDate, breakWindow]);

  const getWeekLabel = useCallback(
    (week: number) => getWeekDateRangeLabel(week, weekBaseDate, breakWindow),
    [weekBaseDate, breakWindow]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-2 text-amber-950 font-semibold text-sm">
          <FileArchive className="w-4 h-4 shrink-0" />
          <span>
            Chế độ xem Archive
            {archiveData && (
              <span className="ml-2 font-normal opacity-80">
                — {archiveData.metadata.schoolYear} (lưu lúc{" "}
                {format(
                  toZonedTime(
                    new Date(archiveData.metadata.archivedAt),
                    TIME_ZONE
                  ),
                  "dd/MM/yyyy HH:mm"
                )}
                )
              </span>
            )}
          </span>
        </div>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Thoát xem Archive
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {!archiveData && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/70 bg-white/80 backdrop-blur-sm shadow p-6 sm:p-8 space-y-4">
              <div className="text-center space-y-2">
                <FileArchive className="w-12 h-12 text-slate-400 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-800">
                  Mở Archive để xem offline
                </h2>
                <p className="text-sm text-slate-500 max-w-lg mx-auto">
                  ZIP được giải nén trong trình duyệt (RAM). Bằng chứng chỉ tải khi bạn mở xem —
                  archive càng nặng càng tốn bộ nhớ; nên đóng tab sau khi xem xong.
                </p>
              </div>

              {loading && (
                <p className="text-sm text-indigo-600 text-center animate-pulse">
                  Đang tải{loadingLabel ? `: ${loadingLabel}` : "..."}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 font-medium text-center">{error}</p>
              )}

              {completedJobs.length > 0 && (
                <div className="text-left space-y-2 pt-2 border-t border-slate-200/80">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" />
                    Archive đã backup trên server (xem trực tiếp, không cần tải về)
                  </p>
                  <ul className="space-y-2">
                    {completedJobs.map((job) => (
                      <li
                        key={job._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2"
                      >
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold">{job.schoolYear}</span>
                          <span className="text-slate-500 ml-2">
                            {format(
                              toZonedTime(new Date(job.createdAt), TIME_ZONE),
                              "dd/MM/yyyy HH:mm"
                            )}
                          </span>
                          {job.totalViolations != null && (
                            <span className="text-xs text-slate-500 ml-2">
                              · {job.totalViolations} vi phạm
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void loadFromUrl(
                              job.downloadUrl!,
                              `${job.schoolYear} · ${format(toZonedTime(new Date(job.createdAt), TIME_ZONE), "dd/MM/yyyy HH:mm")}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem ngay
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-indigo-900/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors">
                  <Upload className="w-4 h-4" />
                  Chọn file ZIP trên máy
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {archiveData && loadedInfo && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950 flex flex-wrap items-center gap-x-3 gap-y-1">
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>
              Nguồn: <span className="font-medium">{loadedInfo.sourceLabel}</span>
            </span>
            <span>· ZIP ~{formatBytes(loadedInfo.zipSizeBytes)} trong RAM</span>
            <span>· {archiveData.evidenceLoader.list().length} file bằng chứng (tải lazy)</span>
          </div>
        )}

        {/* ── BONG BÓNG STORY SPOTIFY WRAPPED ── */}
        {archiveData && recapStats && (
          <ArchiveRecap
            stats={recapStats}
            schoolYear={archiveData.metadata.schoolYear}
            weekLabel={getWeekLabel}
            onViewViolations={() => setActiveTab("violations")}
          />
        )}

        {/* ── Tabs & Nội dung Archive ── */}
        {archiveData && (
          <>
            <div className="flex overflow-x-auto gap-2 p-1 rounded-2xl border border-white/30 bg-white/30 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: "overview", label: "Tổng quan & Recap" },
                  {
                    id: "violations",
                    label: `Vi phạm (${archiveData.violations.length})`,
                  },
                  {
                    id: "roster",
                    label: `Học sinh (${archiveData.studentRoster.length})`,
                  },
                  {
                    id: "users",
                    label: `Người dùng (${archiveData.users.length})`,
                  },
                  {
                    id: "evidence",
                    label: `Bằng chứng (${archiveData.evidenceLoader.list().length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-indigo-900/80 text-white shadow-md"
                      : "text-slate-700 hover:bg-white/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <label className="ml-auto shrink-0 inline-flex items-center gap-1.5 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/40 transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Đổi file
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {activeTab === "overview" && (
              <OverviewTab
                data={archiveData}
                stats={recapStats}
                weekLabel={getWeekLabel}
              />
            )}
            {activeTab === "violations" && (
              <ViolationsTab data={archiveData} />
            )}
            {activeTab === "roster" && <RosterTab data={archiveData} />}
            {activeTab === "users" && <UsersTab data={archiveData} />}
            {activeTab === "evidence" && <EvidenceTab data={archiveData} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Parse ZIP ═══════════════════════════════ */

async function parseZip(zip: JSZip): Promise<ArchiveData> {
  const readJson = async (path: string, fallback: any = []) => {
    const file = zip.file(path);
    if (!file) return fallback;
    try {
      return JSON.parse(await file.async("text"));
    } catch {
      return fallback;
    }
  };

  const [
    metadata,
    violations,
    violationLogs,
    userProfiles,
    users,
    studentRoster,
    classes,
    settings,
    reportingPoints,
    evidenceErrors,
  ] = await Promise.all([
    readJson("metadata.json", {
      schoolYear: "?",
      archivedAt: new Date().toISOString(),
      totalViolations: 0,
      totalEvidenceFiles: 0,
      appVersion: "?",
    }),
    readJson("data/violations.json"),
    readJson("data/violationLogs.json"),
    readJson("data/userProfiles.json"),
    readJson("data/users.json"),
    readJson("data/studentRoster.json"),
    readJson("data/classes.json"),
    readJson("data/settings.json"),
    readJson("data/reportingPoints.json"),
    readJson("evidence_errors.json", []),
  ]);

  const evidenceLoader = createEvidenceLoader(zip);

  return {
    metadata,
    violations,
    violationLogs,
    userProfiles,
    users,
    studentRoster,
    classes,
    settings,
    reportingPoints,
    evidenceLoader,
    evidenceErrors,
  };
}

/* ═══════════════════════════════ Evidence Lightbox ═══════════════════════════════ */

function EvidenceLightbox({
  url,
  basename,
  onClose,
}: {
  url: string;
  basename: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem bằng chứng"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Đóng"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        className="max-h-[92vh] max-w-[min(96vw,1200px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideoBasename(basename) ? (
          <video src={url} controls autoPlay className="max-h-[92vh] max-w-full rounded-lg" />
        ) : (
          <img
            src={url}
            alt={basename}
            className="max-h-[92vh] max-w-full rounded-lg object-contain"
          />
        )}
        <p className="mt-2 text-center text-xs text-white/70 truncate">{basename}</p>
      </div>
    </div>
  );
}

function LazyEvidencePreview({
  basename,
  loader,
  className = "max-h-40 max-w-full rounded-lg border border-slate-200 object-contain cursor-zoom-in hover:opacity-95",
  onOpen,
}: {
  basename: string;
  loader: EvidenceLoader;
  className?: string;
  onOpen?: (url: string, basename: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loader.getUrl(basename).then((u) => {
      if (cancelled) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [basename, loader]);

  if (failed) {
    return (
      <span className="text-xs text-amber-600">Không đọc được {basename}</span>
    );
  }
  if (!url) {
    return (
      <div className="h-24 w-32 rounded-lg border border-slate-200 bg-slate-100 animate-pulse" />
    );
  }

  if (isVideoBasename(basename)) {
    return (
      <video src={url} controls className="max-h-48 max-w-full rounded-lg border border-slate-200" />
    );
  }

  return (
    <button
      type="button"
      className="inline-block text-left"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(url, basename);
      }}
    >
      <img src={url} alt={basename} className={className} />
    </button>
  );
}

type EvidenceGroupItem = { basename: string; violation: any };

function buildEvidenceByClassAndStudent(data: ArchiveData) {
  const { evidenceLoader, violations } = data;
  const assigned = new Set<string>();
  const byClass = new Map<string, Map<string, EvidenceGroupItem[]>>();

  const push = (className: string, studentLabel: string, item: EvidenceGroupItem) => {
    const cn = normalizeClassName(className || "?");
    if (!byClass.has(cn)) byClass.set(cn, new Map());
    const byStudent = byClass.get(cn)!;
    if (!byStudent.has(studentLabel)) byStudent.set(studentLabel, []);
    byStudent.get(studentLabel)!.push(item);
    assigned.add(item.basename);
  };

  for (const v of violations) {
    const studentLabel = displayStudentHeading(v);
    for (const basename of evidenceBasenamesFromViolation(v)) {
      if (!evidenceLoader.has(basename)) continue;
      push(v.violatingClass, studentLabel, { basename, violation: v });
    }
  }

  const unassigned = evidenceLoader.list().filter((b) => !assigned.has(b));
  return { byClass, unassigned };
}

/* ═══════════════════════════════ Tab Panels ═══════════════════════════════ */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/70 bg-white/80 backdrop-blur-sm shadow-md p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  color = "indigo",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-xl p-4 flex items-center gap-3 ${colors[color] ?? colors.slate}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
    </div>
  );
}

function OverviewTab({
  data,
  stats,
  weekLabel,
}: {
  data: ArchiveData;
  stats: RecapStats | null;
  weekLabel: (week: number) => string;
}) {
  const { metadata, violations, studentRoster, users, evidenceLoader, evidenceErrors } = data;
  const { weekBaseDate } = resolveWeekSettings(data);
  const gradeCounts = [10, 11, 12].map((g) => ({
    grade: g,
    count: violations.filter((v) => getViolationGrade(v) === g).length,
  }));

  return (
    <div className="space-y-4">
      {stats && <ArchiveInsights stats={stats} weekLabel={weekLabel} />}

      <Card>
        <h3 className="font-semibold text-slate-800 mb-4 text-base">
          Thông tin Archive
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox
            icon={<AlertTriangle className="w-6 h-6" />}
            label="Vi phạm"
            value={violations.length}
            color="rose"
          />
          <StatBox
            icon={<Users className="w-6 h-6" />}
            label="Học sinh"
            value={studentRoster.length}
            color="indigo"
          />
          <StatBox
            icon={<Database className="w-6 h-6" />}
            label="Người dùng HT"
            value={users.length}
            color="slate"
          />
          <StatBox
            icon={<Image className="w-6 h-6" />}
            label="Bằng chứng"
            value={evidenceLoader.list().length}
            color="emerald"
          />
        </div>
      </Card>

      <Card>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Năm học</dt>
            <dd className="font-semibold text-slate-800">{metadata.schoolYear}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thời điểm lưu trữ</dt>
            <dd className="font-semibold text-slate-800">
              {format(
                toZonedTime(new Date(metadata.archivedAt), TIME_ZONE),
                "dd/MM/yyyy HH:mm:ss"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Tuần gốc (khi archive)</dt>
            <dd className="font-semibold text-slate-800">
              {format(toZonedTime(new Date(weekBaseDate), TIME_ZONE), "dd/MM/yyyy")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Phiên bản app</dt>
            <dd className="font-semibold text-slate-800">{metadata.appVersion}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Bằng chứng đính kèm</dt>
            <dd className="font-semibold text-slate-800">
              {metadata.totalEvidenceFiles} file
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">Vi phạm theo khối</h3>
        <div className="grid grid-cols-3 gap-3">
          {gradeCounts.map(({ grade, count }) => (
            <div
              key={grade}
              className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center"
            >
              <p className="text-xs text-slate-500 mb-1">Khối {grade}</p>
              <p className="text-xl font-bold text-slate-800">{count}</p>
            </div>
          ))}
        </div>
      </Card>

      {evidenceErrors.length > 0 && (
        <Card>
          <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Lỗi tải bằng chứng ({evidenceErrors.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {evidenceErrors.map((e, i) => (
              <div key={i} className="text-xs text-slate-700 bg-amber-50 rounded px-3 py-1.5">
                <span className="font-mono text-amber-800">{e.r2Key}</span>
                <span className="text-slate-500 ml-2">— {e.error}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ViolationsTab({ data }: { data: ArchiveData }) {
  const { violations, evidenceLoader } = data;
  const { weekBaseDate, breakWindow } = resolveWeekSettings(data);
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(() => new Set([10, 11, 12]));
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());

  const filteredViolations = useMemo(() => {
    let list = violations;
    if (gradeFilter) {
      const g = parseInt(gradeFilter, 10);
      list = list.filter((v) => getViolationGrade(v) === g);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          displayStudentHeading(v).toLowerCase().includes(q) ||
          normalizeClassName(v.violatingClass || "").toLowerCase().includes(q) ||
          String(v.violationType ?? "").toLowerCase().includes(q) ||
          String(v.details ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [violations, gradeFilter, search]);

  const grouped = useMemo(
    () => groupViolations(filteredViolations, weekBaseDate, breakWindow),
    [filteredViolations, weekBaseDate, breakWindow]
  );

  const sortedGrades = useMemo(
    () =>
      Array.from(grouped.keys())
        .filter((g) => g > 0)
        .sort((a, b) => a - b),
    [grouped]
  );

  const toggleGrade = (grade: number) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  };

  const toggleClass = (key: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (violations.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-4">
          Không có vi phạm nào.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm học sinh, lớp, loại vi phạm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/70 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Tất cả khối</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Tuần học tính từ{" "}
          <span className="font-medium text-slate-700">
            {format(toZonedTime(new Date(weekBaseDate), TIME_ZONE), "dd/MM/yyyy")}
          </span>
          {filteredViolations.length !== violations.length && (
            <span className="ml-2">
              · Hiển thị {filteredViolations.length}/{violations.length}
            </span>
          )}
        </p>
      </Card>

      {sortedGrades.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-4">
            Không tìm thấy vi phạm phù hợp.
          </p>
        </Card>
      ) : (
        sortedGrades.map((grade) => {
          const byClass = grouped.get(grade)!;
          const classNames = Array.from(byClass.keys()).sort(compareClassNames);
          const gradeTotal = classNames.reduce(
            (sum, cn) =>
              sum +
              Array.from(byClass.get(cn)!.values()).reduce((s, arr) => s + arr.length, 0),
            0
          );
          const gradeOpen = expandedGrades.has(grade);

          return (
            <Card key={grade} className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGrade(grade)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50/80 hover:bg-indigo-50 border-b border-indigo-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-700" />
                  <span className="font-bold text-indigo-900">Khối {grade}</span>
                  <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                    {gradeTotal} vi phạm · {classNames.length} lớp
                  </span>
                </div>
                {gradeOpen ? (
                  <ChevronUp className="w-4 h-4 text-indigo-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                )}
              </button>

              {gradeOpen && (
                <div className="divide-y divide-slate-100">
                  {classNames.map((className) => {
                    const byWeek = byClass.get(className)!;
                    const weeks = Array.from(byWeek.keys()).sort((a, b) => b - a);
                    const classTotal = weeks.reduce(
                      (sum, w) => sum + byWeek.get(w)!.length,
                      0
                    );
                    const classKey = `${grade}-${className}`;
                    const classOpen = expandedClasses.has(classKey);

                    return (
                      <div key={classKey}>
                        <button
                          type="button"
                          onClick={() => toggleClass(classKey)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <School className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="font-semibold text-slate-800 text-sm">
                              Lớp {className}
                            </span>
                            <span className="text-xs text-slate-500">
                              {classTotal} vi phạm · {weeks.length} tuần
                            </span>
                          </div>
                          {classOpen ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {classOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {weeks.map((week) => {
                              const weekViolations = byWeek.get(week)!;
                              return (
                                <div
                                  key={week}
                                  className="rounded-xl border border-slate-200 overflow-hidden bg-white/60"
                                >
                                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                                      <span className="font-semibold text-sm text-slate-800">
                                        Tuần {week}
                                      </span>
                                      <span className="text-xs text-slate-500 truncate">
                                        {getWeekDateRangeLabel(week, weekBaseDate, breakWindow)}
                                      </span>
                                    </div>
                                    <span className="text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100 rounded-full px-2 py-0.5 shrink-0">
                                      {weekViolations.length} vi phạm
                                    </span>
                                  </div>
                                  <div className="divide-y divide-slate-100">
                                    {weekViolations.map((v) => (
                                      <ArchiveViolationRow
                                        key={v._id}
                                        violation={v}
                                        evidenceLoader={evidenceLoader}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function ArchiveViolationRow({
  violation,
  evidenceLoader,
}: {
  violation: any;
  evidenceLoader: EvidenceLoader;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; basename: string } | null>(null);
  const evidenceBasenames = evidenceBasenamesFromViolation(violation);
  const availableEvidence = evidenceBasenames.filter((b) => evidenceLoader.has(b));
  const ts = getViolationTimestamp(violation);

  return (
    <div>
      {lightbox && (
        <EvidenceLightbox
          url={lightbox.url}
          basename={lightbox.basename}
          onClose={() => setLightbox(null)}
        />
      )}
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-slate-50/80 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">
              {displayStudentHeading(violation)}
            </span>
            <span className="text-xs bg-rose-100 text-rose-700 rounded px-2 py-0.5">
              {violation.violationType}
            </span>
            {violation.targetType === "student" && (
              <span className="text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5">
                Học sinh
              </span>
            )}
            {availableEvidence.length > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-700 rounded px-2 py-0.5 flex items-center gap-1">
                <Image className="w-3 h-3" />
                {availableEvidence.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {ts
              ? format(toZonedTime(new Date(ts), TIME_ZONE), "dd/MM/yyyy HH:mm")
              : "—"}
            {violation.details ? ` · ${violation.details}` : ""}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3 bg-slate-50/50">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">Lớp</dt>
              <dd className="font-medium text-slate-800">{violation.violatingClass}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Loại đối tượng</dt>
              <dd className="font-medium text-slate-800">
                {violation.targetType === "class" ? "Cả lớp" : "Học sinh"}
              </dd>
            </div>
            {violation.requesterName && (
              <div className="col-span-2">
                <dt className="text-slate-500">Người báo cáo</dt>
                <dd className="font-medium text-slate-800">{violation.requesterName}</dd>
              </div>
            )}
          </dl>
          {violation.details && (
            <p className="text-sm text-slate-700">{violation.details}</p>
          )}
          {availableEvidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">
                Bằng chứng ({availableEvidence.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {availableEvidence.map((basename) => (
                  <LazyEvidencePreview
                    key={basename}
                    basename={basename}
                    loader={evidenceLoader}
                    className="max-h-36 max-w-[220px] rounded-lg border border-slate-200 object-contain cursor-zoom-in hover:opacity-95"
                    onOpen={(url, name) => setLightbox({ url, basename: name })}
                  />
                ))}
              </div>
            </div>
          )}
          {(violation.evidenceR2Keys ?? []).length > availableEvidence.length && (
            <p className="text-xs text-amber-600">
              {(violation.evidenceR2Keys ?? []).length - availableEvidence.length} file bằng
              chứng không có trong archive.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RosterTab({ data }: { data: ArchiveData }) {
  const { studentRoster } = data;
  const [search, setSearch] = useState("");
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of studentRoster) {
      const className = normalizeClassName(s.className || "?");
      if (!map.has(className)) map.set(className, []);
      map.get(className)!.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        String(a.fullName ?? a.name ?? "").localeCompare(
          String(b.fullName ?? b.name ?? ""),
          "vi"
        )
      );
    }
    return map;
  }, [studentRoster]);

  const classNames = useMemo(() => {
    const names = Array.from(grouped.keys());
    if (!search.trim()) return names.sort(compareClassNames);
    const q = search.trim().toLowerCase();
    return names
      .filter((cn) => {
        if (cn.toLowerCase().includes(q)) return true;
        return grouped.get(cn)!.some((s) =>
          String(s.fullName ?? s.name ?? "").toLowerCase().includes(q)
        );
      })
      .sort(compareClassNames);
  }, [grouped, search]);

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-slate-800 shrink-0">
            Danh sách học sinh ({studentRoster.length})
          </h3>
          <input
            type="text"
            placeholder="Tìm lớp hoặc học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:ml-auto rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full sm:w-64"
          />
        </div>
      </Card>

      {classNames.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-4">
            Không tìm thấy kết quả.
          </p>
        </Card>
      ) : (
        classNames.map((className) => {
          const students = grouped.get(className)!;
          const gradeMatch = className.match(/^(10|11|12)/);
          const grade = gradeMatch ? gradeMatch[1] : "?";
          const isOpen = expandedClasses.has(className);

          return (
            <Card key={className} className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleClass(className)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <School className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {className}
                  </span>
                  <span className="text-xs text-slate-500">Khối {grade}</span>
                  <span className="text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                    {students.length} học sinh
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 overflow-x-auto max-h-[40vh]">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white/90 backdrop-blur-sm">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 px-3 text-left text-slate-600 font-medium w-12">#</th>
                        <th className="py-2 px-3 text-left text-slate-600 font-medium">Họ tên</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s: any, i: number) => (
                        <tr
                          key={s._id ?? `${className}-${i}`}
                          className="border-b border-slate-100 hover:bg-slate-50/60"
                        >
                          <td className="py-1.5 px-3 text-slate-400 text-xs">{i + 1}</td>
                          <td className="py-1.5 px-3 text-slate-800">
                            {s.fullName ?? s.name ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function UsersTab({ data }: { data: ArchiveData }) {
  const { users, userProfiles } = data;

  const profileByUserId = new Map(
    userProfiles.map((p: any) => [p.userId, p])
  );

  return (
    <Card>
      <h3 className="font-semibold text-slate-800 mb-4">
        Người dùng hệ thống ({users.length})
      </h3>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-sm">
            <tr className="border-b border-slate-200">
              <th className="py-2 px-3 text-left text-slate-600 font-medium">Username</th>
              <th className="py-2 px-3 text-left text-slate-600 font-medium">Họ tên</th>
              <th className="py-2 px-3 text-left text-slate-600 font-medium">Vai trò</th>
              <th className="py-2 px-3 text-left text-slate-600 font-medium">Lớp</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any, i: number) => {
              const profile = profileByUserId.get(u._id);
              return (
                <tr key={u._id ?? i} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="py-1.5 px-3 text-slate-700 font-mono text-xs">{u.username ?? "—"}</td>
                  <td className="py-1.5 px-3 text-slate-800">{profile?.fullName ?? profile?.name ?? "—"}</td>
                  <td className="py-1.5 px-3">
                    {profile?.role ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        profile.role === "admin"
                          ? "bg-indigo-100 text-indigo-700"
                          : profile.role === "gradeManager"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {profile.role}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600">{profile?.className ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EvidenceTab({ data }: { data: ArchiveData }) {
  const { evidenceLoader } = data;
  const [lightbox, setLightbox] = useState<{ url: string; basename: string } | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());

  const { byClass, unassigned } = useMemo(
    () => buildEvidenceByClassAndStudent(data),
    [data]
  );

  const classNames = useMemo(
    () => Array.from(byClass.keys()).sort(compareClassNames),
    [byClass]
  );

  const totalInArchive = evidenceLoader.list().length;

  if (totalInArchive === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-4">
          Không có file bằng chứng trong archive.
        </p>
      </Card>
    );
  }

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {lightbox && (
        <EvidenceLightbox
          url={lightbox.url}
          basename={lightbox.basename}
          onClose={() => setLightbox(null)}
        />
      )}

      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Bằng chứng được gom theo <span className="font-medium">lớp → học sinh</span>.
          Bấm ảnh để phóng to (không mở tab mới). Ảnh chỉ tải vào RAM khi bạn xem.
        </p>
      </Card>

      {classNames.map((className) => {
        const byStudent = byClass.get(className)!;
        const studentLabels = Array.from(byStudent.keys()).sort((a, b) =>
          a.localeCompare(b, "vi")
        );
        const fileCount = studentLabels.reduce(
          (sum, label) => sum + byStudent.get(label)!.length,
          0
        );
        const isOpen = expandedClasses.has(className);

        return (
          <Card key={className} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleClass(className)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50/60 hover:bg-indigo-50 border-b border-indigo-100/80 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <School className="w-4 h-4 text-indigo-700 shrink-0" />
                <span className="font-semibold text-slate-800">Lớp {className}</span>
                <span className="text-xs font-medium bg-white/80 text-indigo-800 rounded-full px-2 py-0.5 border border-indigo-100">
                  {fileCount} file · {studentLabels.length} nhóm
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="divide-y divide-slate-100">
                {studentLabels.map((studentLabel) => {
                  const items = byStudent.get(studentLabel)!;
                  return (
                    <div key={studentLabel} className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        {studentLabel}
                        <span className="text-xs font-normal text-slate-500">
                          ({items.length} ảnh/video)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {items.map(({ basename, violation }) => (
                          <div key={`${studentLabel}-${basename}-${violation._id}`} className="space-y-1 max-w-xs">
                            <LazyEvidencePreview
                              basename={basename}
                              loader={evidenceLoader}
                              className="max-h-56 w-auto max-w-full rounded-lg border border-slate-200 object-contain cursor-zoom-in hover:opacity-95"
                              onOpen={(url, name) => setLightbox({ url, basename: name })}
                            />
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {violation.violationType}
                              {" · "}
                              {format(
                                toZonedTime(new Date(getViolationTimestamp(violation)), TIME_ZONE),
                                "dd/MM/yyyy"
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {unassigned.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">
            File chưa gắn vi phạm ({unassigned.length})
          </h3>
          <div className="flex flex-wrap gap-3">
            {unassigned.map((basename) => (
              <div key={basename} className="space-y-1">
                <LazyEvidencePreview
                  basename={basename}
                  loader={evidenceLoader}
                  className="max-h-56 w-auto max-w-full rounded-lg border border-slate-200 object-contain cursor-zoom-in"
                  onOpen={(url, name) => setLightbox({ url, basename: name })}
                />
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]" title={basename}>
                  {basename}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
