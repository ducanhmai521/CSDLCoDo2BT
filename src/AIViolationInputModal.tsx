import { useState, useMemo, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { normalizeClassName } from "./lib/utils";
import { stringSimilarity } from "string-similarity-js";
import imageCompression from "browser-image-compression";
import React from "react";
import { TriangleAlert } from "lucide-react";
import { ViolationTypePicker } from "./components/ViolationTypePicker";

/* ──────────────────────────────────────────────────────────────────────────
 * Motion system
 * - Không thêm dependency mới: chỉ Tailwind (tailwindcss-animate đã có sẵn
 *   vì file gốc đã dùng `animate-in`) + vài keyframes bên dưới.
 * - Mọi animation tôn trọng `prefers-reduced-motion`.
 * ────────────────────────────────────────────────────────────────────────── */
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
/** Thời lượng animation đóng modal (khớp CSS `.aivm[data-state="closed"]`). */
const DIALOG_CLOSE_MS = 240;

const MODAL_CSS = `
/* ══════════ Dialog mở/đóng: MỘT hệ animation duy nhất, chạy theo data-state của Radix ══════════
 * Radix Presence chỉ unmount SAU khi animation của trạng thái "closed" kết thúc → không còn nháy / biến mất đột ngột.
 * Chỉ animate transform + opacity (GPU). Mở: ease-out expo. Đóng: ease-in nhanh gọn.
 * Thời lượng đóng (240ms) phải khớp DIALOG_CLOSE_MS ở trên (dùng để reset form sau khi đã khuất). */
@keyframes aivm-modal-in {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 18px)) scale(0.965); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes aivm-modal-out {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to   { opacity: 0; transform: translate(-50%, calc(-50% + 10px)) scale(0.98); }
}
/* Mobile (full màn hình): trượt lên như bottom-sheet, không scale */
@keyframes aivm-sheet-in {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 28px)); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
@keyframes aivm-sheet-out {
  from { opacity: 1; transform: translate(-50%, -50%); }
  to   { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
}
.aivm[data-state="open"]   { animation: aivm-modal-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.aivm[data-state="closed"] { animation: aivm-modal-out 240ms cubic-bezier(0.32, 0, 0.67, 0) both; pointer-events: none; }
@media (max-width: 639px) {
  .aivm[data-state="open"]   { animation-name: aivm-sheet-in; }
  .aivm[data-state="closed"] { animation-name: aivm-sheet-out; }
}

@keyframes aivm-backdrop-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes aivm-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
.aivm-backdrop[data-state="open"]   { animation: aivm-backdrop-in 320ms ease-out both; }
.aivm-backdrop[data-state="closed"] { animation: aivm-backdrop-out 240ms ease-in both; }

@keyframes aivm-pop { 0% { opacity: 0; transform: scale(.6); } 100% { opacity: 1; transform: scale(1); } }
.aivm-pop { animation: aivm-pop 320ms cubic-bezier(.34,1.56,.64,1) both; }

@keyframes aivm-flash { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,.55); } 100% { box-shadow: 0 0 0 10px rgba(59,130,246,0); } }
.aivm-flash { animation: aivm-flash 1100ms ease-out 1; }

@keyframes aivm-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(260%); } }
.aivm-sweep { animation: aivm-sweep 1.6s cubic-bezier(.4,0,.2,1) infinite; }

@keyframes aivm-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
.aivm-bar { animation: aivm-bar 1.2s ease-in-out infinite; }

@keyframes aivm-draw { to { stroke-dashoffset: 0; } }
.aivm-draw { stroke-dasharray: 24; stroke-dashoffset: 24; animation: aivm-draw 380ms 80ms ease-out forwards; }

/* ══════════ Submit overlay: đang gửi → thành công / thất bại (luôn light mode) ══════════
 * Easing chủ đạo: cubic-bezier(.16,1,.3,1) (ease-out expo). Chuyển phase bằng transition
 * (không remount) nên spinner thu lại và orb kết quả nở ra liền mạch. */
@keyframes aivm-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes aivm-appear { to { opacity: var(--o, .3); } }

.aivm-cel {
  --a1: #a5b4fc; --a2: #7dd3fc;                          /* aurora */
  --r1: #7dd3fc; --r2: #a5b4fc; --r3: #c4b5fd;           /* viền */
  --rc: rgba(99,102,241,.4);                             /* sóng lan */
  background: radial-gradient(ellipse at 50% 38%, rgba(255,255,255,.97), rgba(244,247,255,.96) 78%);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  animation: aivm-fade-in .45s cubic-bezier(.16,1,.3,1) both;
}
.aivm-cel[data-phase="success"] { --a1: #86efac; --a2: #7dd3fc; --r1: #6ee7b7; --r2: #7dd3fc; --r3: #a5b4fc; --rc: rgba(16,185,129,.45); }
.aivm-cel[data-phase="error"]   { --a1: #fda4af; --a2: #fdba74; --r1: #fda4af; --r2: #fdba74; --r3: #fecdd3; --rc: rgba(244,63,94,.4); }

/* Aurora pastel, trôi chậm, đổi màu mượt theo phase */
@keyframes aivm-drift {
  0%   { transform: translate(-8%, -6%) scale(1); }
  100% { transform: translate(10%, 8%) scale(1.15); }
}
.aivm-aurora {
  position: absolute; width: 70%; aspect-ratio: 1; border-radius: 9999px;
  filter: blur(80px); opacity: 0; pointer-events: none;
  transition: background-color 1s cubic-bezier(.16,1,.3,1);
  animation: aivm-appear 1.4s .05s cubic-bezier(.16,1,.3,1) forwards, aivm-drift 9s ease-in-out infinite alternate;
}
.aivm-aurora-1 { --o: .45; left: -20%; top: -15%; background-color: var(--a1); }
.aivm-aurora-2 { --o: .38; right: -25%; top: 15%; background-color: var(--a2); animation-delay: .2s, -3s; }

/* Viền mảnh lướt 1 lần khi có kết quả (mount lúc phase đổi) */
@keyframes aivm-ring-sweep { from { transform: rotate(-70deg); } to { transform: rotate(110deg); } }
.aivm-ring, .aivm-ring-glow {
  position: absolute; inset: 0; border-radius: inherit; padding: 2px; overflow: hidden; pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  opacity: 0; --o: .85;
  animation: aivm-appear 1s .05s cubic-bezier(.16,1,.3,1) forwards;
}
.aivm-ring-glow { padding: 6px; filter: blur(14px); --o: .4; }
.aivm-ring-spin {
  position: absolute; left: 50%; top: 50%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax;
  background: conic-gradient(from 0deg, var(--r1), var(--r2), var(--r3), var(--r1));
  animation: aivm-ring-sweep 2s cubic-bezier(.16,1,.3,1) forwards;
}

/* Stage: spinner ⇄ orb thành công ⇄ orb lỗi */
.aivm-stage { position: relative; width: 88px; height: 88px; }
.aivm-layer {
  position: absolute; inset: 0; opacity: 0; transform: scale(.7);
  transition: opacity .55s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1);
}
.aivm-spin { opacity: 1; transform: none; }
.aivm-cel:not([data-phase="sending"]) .aivm-spin { opacity: 0; transform: scale(.6); }
@keyframes aivm-spin-rot { to { transform: rotate(360deg); } }
.aivm-spin svg { animation: aivm-spin-rot 1.1s cubic-bezier(.5,.15,.5,.85) infinite; }
@keyframes aivm-breathe { 0%, 100% { transform: scale(.88); opacity: .75; } 50% { transform: scale(1.04); opacity: 1; } }
.aivm-breathe { animation: aivm-breathe 1.8s ease-in-out infinite; }

.aivm-orb-ok, .aivm-orb-err { border-radius: 9999px; transition-delay: .12s; }
.aivm-orb-ok {
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.45), transparent 55%), linear-gradient(135deg, #34d399, #2dd4bf);
  box-shadow: 0 8px 28px rgba(16,185,129,.35), 0 0 70px 10px rgba(52,211,153,.2);
}
.aivm-orb-err {
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.4), transparent 55%), linear-gradient(135deg, #fb7185, #fb923c);
  box-shadow: 0 8px 28px rgba(244,63,94,.32), 0 0 70px 10px rgba(251,113,133,.2);
}
.aivm-cel[data-phase="success"] .aivm-orb-ok,
.aivm-cel[data-phase="error"] .aivm-orb-err { opacity: 1; transform: scale(1); }

.aivm-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.aivm-mark path { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset .55s cubic-bezier(.16,1,.3,1); }
.aivm-cel[data-phase="success"] .aivm-mark-ok path,
.aivm-cel[data-phase="error"] .aivm-mark-err path { stroke-dashoffset: 0; transition-delay: .4s; }

/* 1 vòng sóng nhẹ khi có kết quả */
@keyframes aivm-ripple { 0% { opacity: .5; transform: scale(1); } 100% { opacity: 0; transform: scale(2.6); } }
.aivm-ripple { position: absolute; inset: 0; border-radius: 9999px; border: 1.5px solid var(--rc); opacity: 0; animation: aivm-ripple 1.8s .3s cubic-bezier(.16,1,.3,1) forwards; }

/* Chữ */
@keyframes aivm-rise { from { opacity: 0; transform: translateY(10px); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
.aivm-rise { animation: aivm-rise .8s var(--delay, 0s) cubic-bezier(.16,1,.3,1) both; }
.aivm-shine-text {
  background: linear-gradient(90deg, #059669, #0ea5e9);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .aivm, .aivm *, .aivm-backdrop {
    animation-duration: .01ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Giữ trạng thái "đang gửi" tối thiểu ~0.9s để animation không bị nháy khi server trả về quá nhanh. */
const waitMinSending = (since: number, min = 900) => {
  if (prefersReducedMotion()) return Promise.resolve();
  const left = min - (performance.now() - since);
  return left > 0 ? new Promise<void>((r) => window.setTimeout(r, left)) : Promise.resolve();
};

let uidSeq = 0;
const nextUid = () => `v${++uidSeq}`;

// Stable key cho từng File → thumbnail không bị remount khi xoá ảnh khác
const fileIds = new WeakMap<File, string>();
let fileSeq = 0;
const fileKey = (f: File) => {
  let id = fileIds.get(f);
  if (!id) {
    id = `f${++fileSeq}`;
    fileIds.set(f, id);
  }
  return id;
};

// Violations that only apply to individual students
const PERSONAL_VIOLATION_CODES = [
  "Đi học muộn có phép",
  "Đi học muộn không phép",
  "Nghỉ học có phép",
  "Nghỉ học không phép",
  "Học sinh nói tục, chửi thề",
  "Học sinh hút thuốc lá/thuốc lá điện tử/thuốc lào",
  "Vi phạm ATGT (không đội mũ, không cài quai, xe phân khối lớn, pô chế, không biển số, dàn hàng, xe ngoài cổng)",
  "Đăng/chia sẻ thông tin sai sự thật, kích động, xúc phạm người khác trên MXH",
];

interface ParsedViolation {
  studentName: string | null;
  violatingClass: string;
  violationType: string;
  details: string | null;
  targetType: "student" | "class";
  originalText: string;
  evidenceFiles?: File[];
  // UI-only (không gửi lên API): key ổn định + delay stagger
  _uid?: string;
  _delay?: number;
}

type InputMode = "attendance" | "violations";
type ViewName = "input" | "results";

/* ───────────────────────────── Small UI primitives ───────────────────────── */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="aivm-draw" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Chevron({ open, className = "h-4 w-4" }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-300 ${EASE} ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const PlusIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

/** Mở/đóng mượt theo chiều cao thật (grid-rows 0fr → 1fr), không cần đo JS. */
function Collapse({ open, children, className = "" }: { open: boolean; children: React.ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // `inert` chặn focus/tab vào nội dung đang đóng (an toàn với cả React 18 & 19)
    if (innerRef.current) (innerRef.current as any).inert = !open;
  }, [open]);
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ${EASE} ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${className}`}
    >
      <div ref={innerRef} className="min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** Segmented control có "viên thuốc" trượt. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  dark,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  dark?: boolean;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`relative inline-grid grid-cols-2 rounded-lg border p-0.5 ${dark ? "border-slate-600 bg-slate-900/60" : "border-gray-200 bg-gray-50"}`}>
      <span
        aria-hidden="true"
        className={`absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-2px)] rounded-md shadow-sm transition-transform duration-300 ${EASE} ${idx === 1 ? "translate-x-full" : "translate-x-0"} ${dark ? "bg-slate-600" : "bg-white"}`}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`relative z-10 px-3 py-1 text-xs font-semibold transition-colors duration-200 active:scale-95 ${o.value === value
            ? dark ? "text-slate-100" : "text-gray-800"
            : dark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700"
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thumbnail ảnh bằng chứng: tạo + thu hồi object URL đúng cách (không rò bộ nhớ, không nháy). */
function EvidenceThumb({ file, dark, onRemove }: { file: File; dark?: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="aivm-pop group/img relative h-12 w-12 flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt="Ảnh bằng chứng"
          className={`h-full w-full rounded-lg border object-cover ${dark ? "border-slate-600" : "border-gray-200"}`}
        />
      ) : (
        <div className={`h-full w-full animate-pulse rounded-lg ${dark ? "bg-slate-700" : "bg-gray-200"}`} />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Xoá ảnh"
        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-100 shadow-sm transition-[opacity,transform] duration-200 hover:scale-110 active:scale-90 sm:opacity-0 sm:group-hover/img:opacity-100"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ───────────── Tìm tên học sinh: không dấu, ưu tiên "tên gọi" ───────────── */

type StudentOpt = { value: string; label: string; id: string; className: string; key: string };

/** Bỏ dấu tiếng Việt, hạ chữ thường, gọn khoảng trắng. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Như fold nhưng giữ nguyên độ dài (để tô đậm đúng vị trí). */
const foldKeep = (s: string) =>
  Array.from(s.normalize("NFC"))
    .map((c) => (c === "đ" || c === "Đ" ? "d" : c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()))
    .join("");

const givenOf = (key: string) => key.split(" ").pop() || "";

/**
 * Xếp hạng: trùng tên gọi > bắt đầu bằng > tên gọi bắt đầu bằng > mọi từ khớp đầu từ > chứa.
 * Không có kết quả thì thử fuzzy. Query rỗng → cả danh sách sắp theo tên gọi (kiểu sổ lớp VN).
 */
function searchStudents(query: string, pool: StudentOpt[]): StudentOpt[] {
  const q = fold(query);
  const byGiven = (a: StudentOpt, b: StudentOpt) =>
    givenOf(a.key).localeCompare(givenOf(b.key), "vi") || a.value.localeCompare(b.value, "vi");
  if (!q) return [...pool].sort(byGiven);

  const qt = q.split(" ");
  const scored: { o: StudentOpt; s: number }[] = [];
  for (const o of pool) {
    const toks = o.key.split(" ");
    const given = toks[toks.length - 1];
    let s = -1;
    if (o.key === q) s = 100;
    else if (qt.length === 1 && given === q) s = 95;
    else if (o.key.startsWith(q)) s = 90;
    else if (qt.length === 1 && given.startsWith(q)) s = 85;
    else if (qt.every((t) => toks.some((k) => k.startsWith(t)))) s = 70;
    else if (o.key.includes(q)) s = 50;
    else if (qt.every((t) => o.key.includes(t))) s = 40;
    if (s >= 0) scored.push({ o, s });
  }
  if (scored.length === 0 && q.length >= 3) {
    for (const o of pool) {
      const sim = stringSimilarity(q, o.key);
      if (sim > 0.4) scored.push({ o, s: sim * 30 });
    }
  }
  return scored.sort((a, b) => b.s - a.s || byGiven(a.o, b.o)).map((x) => x.o);
}

/** Tự khớp tên AI trả về với danh sách lớp (dùng khi parse). Trả null nếu mơ hồ. */
function matchStudentName(raw: string, pool: { fullName: string }[]): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;
  const exact = pool.find((s) => s.fullName.toLowerCase() === lower);
  if (exact) return exact.fullName;

  const q = fold(raw);
  const keyed = pool.map((s) => ({ name: s.fullName, key: fold(s.fullName) }));
  const exactFolded = keyed.filter((s) => s.key === q);
  if (exactFolded.length === 1) return exactFolded[0].name;
  if (!q.includes(" ")) {
    const byGivenName = keyed.filter((s) => givenOf(s.key) === q);
    if (byGivenName.length === 1) return byGivenName[0].name;
  }
  const contains = keyed.filter((s) => s.key.includes(q));
  if (contains.length === 1) return contains[0].name;

  let best: { name: string; score: number } | null = null;
  for (const s of keyed) {
    const score = stringSimilarity(q, s.key);
    if (!best || score > best.score) best = { name: s.name, score };
  }
  return best && best.score > 0.5 ? best.name : null;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const nfc = text.normalize("NFC");
  const keep = foldKeep(nfc);
  const tokens = fold(query).split(" ").filter(Boolean);
  if (!tokens.length || keep.length !== nfc.length) return <>{nfc}</>;

  const ranges: [number, number][] = [];
  for (const t of tokens) {
    let first = -1;
    let wordStart = -1;
    let from = 0;
    for (; ;) {
      const f = keep.indexOf(t, from);
      if (f < 0) break;
      if (first < 0) first = f;
      if (f === 0 || keep[f - 1] === " ") {
        wordStart = f;
        break;
      }
      from = f + 1;
    }
    const at = wordStart >= 0 ? wordStart : first;
    if (at >= 0) ranges.push([at, at + t.length]);
  }
  if (!ranges.length) return <>{nfc}</>;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([a, b], i) => {
    if (a > cursor) out.push(nfc.slice(cursor, a));
    out.push(<mark key={i} className="bg-transparent font-bold text-blue-500">{nfc.slice(a, b)}</mark>);
    cursor = b;
  });
  if (cursor < nfc.length) out.push(nfc.slice(cursor));
  return <>{out}</>;
}

/** Combobox chọn học sinh: gõ không dấu, ↑↓ Enter Esc, ưu tiên trong lớp, có "tìm toàn trường". */
function StudentCombobox({
  id, value, scoped, all, dark, matched, placeholder, inputClassName, barClassName, onText, onPick, onOpenChange,
}: {
  id: string;
  value: string;
  scoped: StudentOpt[];
  all: StudentOpt[];
  dark?: boolean;
  matched: boolean;
  placeholder?: string;
  inputClassName: string;
  barClassName: string;
  onText: (t: string) => void;
  onPick: (o: StudentOpt) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [wide, setWide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const hasScope = scoped !== all;
  const pool = wide || !hasScope ? all : scoped;
  const results = useMemo(() => searchStudents(value, pool), [value, pool]);
  const shown = results.slice(0, 40);

  useEffect(() => { onOpenChange?.(open); }, [open]);
  useEffect(() => () => onOpenChange?.(false), []);
  useEffect(() => { setActive(0); }, [value, wide]);

  // Mở ra thì cuộn vừa đủ để thấy hết popup
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      popupRef.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // Giữ mục đang chọn trong vùng nhìn thấy của list
  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[active] as HTMLElement | undefined;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [active, open]);

  const pick = (o: StudentOpt) => {
    onPick(o);
    setOpen(false);
  };

  const muted = dark ? "text-slate-400" : "text-gray-500";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open && shown.length ? `${id}-list` : undefined}
        aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className={`${inputClassName} pr-7`}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActive((a) => Math.min(a + 1, Math.max(0, shown.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      <span className={barClassName} />

      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        {matched ? (
          <span className="aivm-pop block text-emerald-500" title="Đã khớp học sinh">
            <CheckIcon />
          </span>
        ) : value ? (
          <button
            type="button"
            aria-label="Xoá tên"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onText("");
              inputRef.current?.focus();
            }}
            className={`rounded-full p-0.5 transition-colors ${dark ? "text-slate-500 hover:text-slate-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        ) : null}
      </div>

      {open && (
        <div
          ref={popupRef}
          onMouseDown={(e) => e.preventDefault()} // giữ focus ở input khi bấm vào popup
          className={`absolute left-0 right-0 top-full z-30 mt-1.5 origin-top overflow-hidden rounded-xl border shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150 ${dark ? "border-slate-600 bg-slate-800" : "border-gray-200 bg-white"}`}
        >
          {shown.length > 0 ? (
            <ul ref={listRef} id={`${id}-list`} role="listbox" className="relative max-h-56 overflow-y-auto overscroll-contain py-1">
              {shown.map((o, i) => (
                <li
                  key={o.id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm transition-colors duration-100 ${dark ? "text-slate-100" : "text-gray-900"} ${i === active ? (dark ? "bg-blue-500/20" : "bg-blue-50") : ""}`}
                >
                  <span className="min-w-0 truncate"><Highlighted text={o.value} query={value} /></span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${dark ? "bg-slate-700 text-slate-300" : "bg-gray-100 text-gray-600"}`}>{o.className}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`px-3 py-3 text-xs ${muted}`}>
              Không thấy “{value}” {hasScope && !wide ? "trong lớp này." : "trong danh sách."}
            </div>
          )}
          {hasScope && (
            <div className={`flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] ${dark ? "border-slate-700" : "border-gray-100"} ${muted}`}>
              <span>{wide ? "Đang tìm toàn trường" : "Đang tìm trong lớp"} · {results.length} kết quả</span>
              <button
                type="button"
                onClick={() => setWide((w) => !w)}
                className="font-semibold text-blue-500 hover:text-blue-400"
              >
                {wide ? "Chỉ trong lớp" : "Tìm toàn trường"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Submit overlay (sending / success / error) ───────────────────────── */

function CountUp({ to, delay = 0, duration = 1000 }: { to: number; delay?: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const t = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / duration);
        setN(Math.round(to * (1 - Math.pow(1 - p, 4)))); // easeOutQuart
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [to, delay, duration]);
  return <span className="tabular-nums">{n}</span>;
}

type SubmitOverlayState =
  | { phase: "sending" }
  | { phase: "success"; count: number; points: number; duplicates: number }
  | { phase: "error"; message: string; retryable?: boolean };

/**
 * Overlay phủ lên modal, đi theo vòng đời lúc gửi: đang gửi (spinner) → thành công (tick xanh)
 * hoặc thất bại (dấu X + thông báo lỗi + Thử lại). Luôn light mode.
 */
function SubmitOverlay({
  state, onSkip, onDismiss, onRetry,
}: { state: SubmitOverlayState; onSkip: () => void; onDismiss: () => void; onRetry: () => void }) {
  const phase = state.phase;
  const rise = (delay: string) => ({ "--delay": delay } as React.CSSProperties);
  return (
    <div
      role={phase === "error" ? "alert" : "status"}
      aria-live={phase === "error" ? "assertive" : "polite"}
      data-phase={phase}
      onClick={phase === "success" ? onSkip : undefined}
      className={`aivm-cel absolute inset-0 z-[60] flex select-none flex-col items-center justify-center overflow-hidden rounded-[inherit] ${phase === "success" ? "cursor-pointer" : ""}`}
    >
      <div aria-hidden="true" className="aivm-aurora aivm-aurora-1" />
      <div aria-hidden="true" className="aivm-aurora aivm-aurora-2" />
      {phase !== "sending" && (
        <React.Fragment key={phase}>
          <div aria-hidden="true" className="aivm-ring-glow"><div className="aivm-ring-spin" /></div>
          <div aria-hidden="true" className="aivm-ring"><div className="aivm-ring-spin" /></div>
        </React.Fragment>
      )}

      <div className="aivm-stage" aria-hidden="true">
        {phase !== "sending" && <span key={phase} className="aivm-ripple" />}

        {/* Đang gửi */}
        <div className="aivm-layer aivm-spin">
          <div className="aivm-breathe absolute inset-[24px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c7d2fe)] shadow-[0_0_30px_rgba(129,140,248,0.45)]" />
          <svg viewBox="0 0 88 88" className="absolute inset-0 h-full w-full" fill="none">
            <defs>
              <linearGradient id="aivm-spin-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <circle cx="44" cy="44" r="40" stroke="#e0e7ff" strokeWidth="3" />
            <circle cx="44" cy="44" r="40" stroke="url(#aivm-spin-grad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="62 190" />
          </svg>
        </div>

        {/* Thành công */}
        <div className="aivm-layer aivm-orb-ok" />
        <div className="aivm-mark aivm-mark-ok">
          <svg className="h-12 w-12 drop-shadow-[0_2px_6px_rgba(5,150,105,0.35)]" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
            <path pathLength={1} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Thất bại */}
        <div className="aivm-layer aivm-orb-err" />
        <div className="aivm-mark aivm-mark-err">
          <svg className="h-11 w-11 drop-shadow-[0_2px_6px_rgba(225,29,72,0.35)]" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
            <path pathLength={1} d="M6.5 6.5l11 11" />
            <path pathLength={1} d="M17.5 6.5l-11 11" />
          </svg>
        </div>
      </div>

      <div key={phase} className="mt-7 max-w-sm px-6 text-center">
        {state.phase === "sending" && (
          <>
            <p className="aivm-rise text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl" style={rise("0.05s")}>
              Đang gửi báo cáo
            </p>
            <p className="aivm-rise mt-2 text-sm text-slate-500" style={rise("0.18s")}>
              Vui lòng đợi trong giây lát…
            </p>
          </>
        )}

        {state.phase === "success" && (
          <>
            <p className="aivm-rise text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl" style={rise("0.3s")}>
              Đã gửi {state.count} báo cáo
            </p>
            <p className="aivm-rise mt-2 text-base font-medium" style={rise("0.42s")}>
              <span className="aivm-shine-text">+<CountUp to={state.points} delay={420} /> điểm báo cáo</span>
            </p>
            {state.duplicates > 0 && (
              <p className="aivm-rise mt-1 text-xs text-slate-500" style={rise("0.54s")}>
                {state.duplicates} báo cáo trùng đã được bỏ qua
              </p>
            )}
            <p className="aivm-rise mt-6 text-[11px] text-slate-400" style={rise("0.8s")}>
              Chạm để đóng
            </p>
          </>
        )}

        {state.phase === "error" && (
          <>
            <p className="aivm-rise text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl" style={rise("0.3s")}>
              Gửi không thành công
            </p>
            <p className="aivm-rise mt-2 line-clamp-3 break-words text-sm text-slate-500" style={rise("0.42s")}>
              {state.message}
            </p>
            <div className="aivm-rise mt-6 flex justify-center gap-2" style={rise("0.6s")}>
              {state.retryable === false ? (
                // Lỗi trùng báo cáo: thử lại vô nghĩa → chỉ có nút quay lại chỉnh sửa
                <button
                  type="button"
                  autoFocus
                  onClick={onDismiss}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-200 transition-[transform,box-shadow] duration-150 hover:shadow-lg active:scale-95"
                >
                  Đã hiểu
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-[transform,background-color] duration-150 hover:bg-slate-50 active:scale-95"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={onRetry}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-200 transition-[transform,box-shadow] duration-150 hover:shadow-lg active:scale-95"
                  >
                    Thử lại
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Khoá nhận diện "cùng một lỗi cho cùng một người/lớp" (mỗi ngày chỉ được báo 1 lần). null = chưa đủ dữ liệu. */
const violationKey = (v: ParsedViolation): string | null => {
  const cls = normalizeClassName(v.violatingClass || "");
  if (!cls || !v.violationType) return null;
  if (v.targetType === "class") return `c|${cls}|${v.violationType}`;
  const name = fold(v.studentName || "");
  return name ? `s|${cls}|${name}|${v.violationType}` : null;
};

/* ─────────────────────────────────── Component ───────────────────────────── */

export function AIViolationInputModal({
  onBulkSubmitSuccess,
  isDarkMode,
}: {
  onBulkSubmitSuccess: () => void;
  isDarkMode?: boolean;
}) {
  // Live violation categories from DB (admin-configurable), fallback to hardcoded
  const liveCategories = useQuery(api.violations.getViolationCategories);
  const activeCategories = liveCategories ?? VIOLATION_CATEGORIES;
  const ALL_VIOLATIONS = activeCategories.flatMap((c) => c.violations);

  const [rawText, setRawText] = useState("");
  const [parsedViolations, setParsedViolations] = useState<ParsedViolation[]>([]);
  const [checkedClasses, setCheckedClasses] = useState<string[]>([]);
  const [attendanceByClass, setAttendanceByClass] = useState<Record<string, { absentStudents: string[]; lateStudents: string[] }>>({});
  const [customDate, setCustomDate] = useState<number | null>(null);
  const [customReporterId, setCustomReporterId] = useState<Id<"users"> | null>(null);
  const [customReporterName, setCustomReporterName] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewName>("input");
  const [inputMode, setInputMode] = useState<InputMode>("violations");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Model selection is now controlled server-side (Admin setting)
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [showAiDebugDetails, setShowAiDebugDetails] = useState(false);
  const [aiDebugInfo, setAiDebugInfo] = useState<{
    firstPassTrace: string[];
    verificationChanged: boolean;
    verificationMode: string;
    correctionsMade: string[];
  } | null>(null);

  // ── UI/motion state (không ảnh hưởng API) ──
  const [isLeaving, setIsLeaving] = useState(false);
  const [navDir, setNavDir] = useState<"none" | "forward" | "back">("none");
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [flashUid, setFlashUid] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitOverlay, setSubmitOverlay] = useState<SubmitOverlayState | null>(null);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    confirmLabel: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const viewLockRef = useRef(false);
  const comboOpenRef = useRef(false);
  const celebrateSkipRef = useRef<(() => void) | null>(null);
  const resetPendingRef = useRef(false); // true = form cần reset sau khi modal đóng xong
  const dupFocusRef = useRef<string | null>(null); // thẻ trùng để cuộn tới khi tắt thông báo lỗi

  const T = (dark: string, light: string) => (isDarkMode ? dark : light);

  // Lock zoom when modal opens
  useEffect(() => {
    if (isOpen) {
      const viewport = document.querySelector('meta[name="viewport"]');
      const originalContent = viewport?.getAttribute("content");
      viewport?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");

      return () => {
        if (originalContent) {
          viewport?.setAttribute("content", originalContent);
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && currentView === "input") {
      const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 180);
      return () => window.clearTimeout(focusTimer);
    }
  }, [isOpen, currentView]);

  // Cuộn tới + focus thẻ vừa thêm
  useEffect(() => {
    if (!flashUid) return;
    const raf = requestAnimationFrame(() => {
      const el = cardRefs.current.get(flashUid);
      if (!el) return;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      (el.querySelector("[data-first-field]") as HTMLInputElement | null)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [flashUid]);

  const parseViolationsWithAI = useAction(api.ai.parseViolationsWithAI);
  const parseAttendanceWithAI = useAction(api.ai.parseAttendanceWithAI);
  const bulkReportViolations = useMutation(api.violations.bulkReportViolations);
  const generateR2UploadUrl = useMutation(api.r2.generateR2UploadUrl);
  const addReportingPoints = useMutation(api.reportingPoints.addReportingPoints);
  const allStudents = useQuery(api.users.getAllStudents);
  const allUserProfiles = useQuery(api.users.getAllUserProfiles);
  const myProfile = useQuery(api.users.getMyProfile);
  const savedGeminiModels = useQuery(api.users.getSetting, { key: "geminiModels" });
  const savedOpenRouterModels = useQuery(api.users.getSetting, { key: "openrouterModels" });
  const savedAiModels = useQuery(api.users.getSetting, { key: "aiModels" });
  const savedAiModel = useQuery(api.users.getSetting, { key: "aiModel" });
  const aiStatus = useQuery(api.users.getAiRequestStatus);

  const { classRosterCounts } = useMemo(() => {
    if (!allStudents)
      return { classRosterCounts: {} as { [key: string]: number }, normalizedToOriginalClassMap: {} };
    const counts: { [key: string]: number } = {};
    const nameMap: { [key: string]: string } = {};
    for (const student of allStudents) {
      const normalizedName = normalizeClassName(student.className);
      if (!counts[normalizedName]) {
        counts[normalizedName] = 0;
        nameMap[normalizedName] = student.className;
      }
      counts[normalizedName]++;
    }
    return { classRosterCounts: counts, normalizedToOriginalClassMap: nameMap };
  }, [allStudents]);

  const studentOptions = useMemo<StudentOpt[]>(() => {
    if (!allStudents) return [];
    return allStudents.map((s) => ({
      value: s.fullName,
      label: `${s.fullName} - ${s.className}`,
      id: s._id,
      className: s.className,
      key: fold(s.fullName),
    }));
  }, [allStudents]);

  const studentsByClass = useMemo(() => {
    const map = new Map<string, StudentOpt[]>();
    if (!allStudents) return map;
    for (const student of allStudents) {
      const normalizedClass = normalizeClassName(student.className);
      if (!map.has(normalizedClass)) {
        map.set(normalizedClass, []);
      }
      map.get(normalizedClass)!.push({
        value: student.fullName,
        label: `${student.fullName} - ${student.className}`,
        id: student._id,
        className: student.className,
        key: fold(student.fullName),
      });
    }
    return map;
  }, [allStudents]);

  /** uid thẻ trùng → index (0-based) của thẻ đầu tiên có cùng lỗi + cùng người/lớp. */
  const dupInfo = useMemo(() => {
    const firstSeen = new Map<string, number>();
    const dups = new Map<string, number>();
    parsedViolations.forEach((v, i) => {
      const uid = v._uid ?? `idx-${i}`;
      if (removingIds.includes(uid)) return;
      const key = violationKey(v);
      if (!key) return;
      if (firstSeen.has(key)) dups.set(uid, firstSeen.get(key)!);
      else firstSeen.set(key, i);
    });
    return dups;
  }, [parsedViolations, removingIds]);

  /* ── Navigation giữa 2 view: exit 150ms → swap → enter (có hướng) ── */
  const changeView = (next: ViewName) => {
    if (next === currentView || viewLockRef.current) return;
    viewLockRef.current = true;
    setNavDir(next === "results" ? "forward" : "back");
    setIsLeaving(true);
    window.setTimeout(() => {
      setCurrentView(next);
      setIsLeaving(false);
      bodyRef.current?.scrollTo({ top: 0 });
      viewLockRef.current = false;
    }, prefersReducedMotion() ? 0 : 150);
  };

  /* ── Confirm trong modal (thay window.confirm - không chặn UI, có animation) ── */
  const askConfirm = (message: string, confirmLabel = "Tiếp tục") =>
    new Promise<boolean>((resolve) => setConfirmState({ message, confirmLabel, resolve }));

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  /** Tắt thông báo lỗi gửi; nếu lỗi do trùng thì cuộn tới thẻ trùng đầu tiên. */
  const dismissOverlay = () => {
    setSubmitOverlay(null);
    const uid = dupFocusRef.current;
    dupFocusRef.current = null;
    if (uid) {
      requestAnimationFrame(() =>
        cardRefs.current.get(uid)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" })
      );
    }
  };

  /** Xoá sạch form (chỉ gọi khi modal đã khuất hẳn → người dùng không thấy view nhảy về "input"). */
  const resetForm = () => {
    resetPendingRef.current = false;
    setRawText("");
    setParsedViolations([]);
    setRemovingIds([]);
    setCheckedClasses([]);
    setAttendanceByClass({});
    setAiDebugInfo(null);
    setUsedModel(null);
    setCustomDate(null);
    setCustomReporterId(null);
    setCustomReporterName("");
    setSubmitDone(false);
    setSubmitOverlay(null);
    setNavDir("none");
    setCurrentView("input");
  };

  useEffect(() => {
    if (isOpen) {
      if (resetPendingRef.current) resetForm(); // mở lại quá nhanh: dọn ngay trước khi hiện
      return;
    }
    if (!resetPendingRef.current) return;
    const t = window.setTimeout(resetForm, DIALOG_CLOSE_MS + 120);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  /* Mở/đóng chỉ đổi `isOpen`. Animation do CSS theo data-state của Radix đảm nhiệm
   * (không còn state/timeout tự chế → hết nháy khi đóng, đóng sau khi gửi cũng có animation). */
  const handleOpenChange = (open: boolean) => {
    if (!open && confirmState) closeConfirm(false); // tránh promise treo khi đóng modal
    if (!open && submitOverlay?.phase === "sending") return; // đang gửi: không cho đóng giữa chừng
    if (!open && submitOverlay?.phase === "error") {
      dismissOverlay(); // Esc khi lỗi → quay lại form, giữ nguyên dữ liệu
      return;
    }
    if (!open) celebrateSkipRef.current?.();
    setIsOpen(open);
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập danh sách.");
      return;
    }
    if (!allStudents) {
      toast.error("Chưa tải được danh sách học sinh, vui lòng thử lại.");
      return;
    }
    if (aiStatus !== undefined && !aiStatus.isSuperUser && aiStatus.remaining <= 0) {
      toast.error("Bạn đã hết lượt dùng AI hôm nay.");
      return;
    }

    setIsParsing(true);
    setAiDebugInfo(null);
    const startedAt = performance.now();
    const configuredModelList =
      (typeof savedGeminiModels === "string" && savedGeminiModels.trim()
        ? savedGeminiModels.trim().split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
        : []) as string[];
    const primaryModel = configuredModelList[0] || "gemini-fallback";
    const toastId = toast.loading("Đang chuẩn bị yêu cầu AI...");
    try {
      toast.message(
        `Đang gửi yêu cầu đến Gemini model ưu tiên: ${primaryModel}${configuredModelList.length > 1 ? " (có fallback)" : ""}`,
        { id: toastId }
      );
      const debugEnabled = Boolean(isSuperUser && showAiDebugDetails);
      const result = inputMode === "attendance"
        ? await parseAttendanceWithAI({ rawText, debug: debugEnabled })
        : await parseViolationsWithAI({ rawText, debug: debugEnabled });

      const backendDebug = ((result as any).aiDebug || null) as
        | {
          firstPassTrace?: string[];
          verificationChanged?: boolean;
          verificationMode?: string;
        }
        | null;
      const corrections = (result as any).correctionsMade as string[] | undefined;
      setAiDebugInfo({
        firstPassTrace: Array.isArray(backendDebug?.firstPassTrace) ? backendDebug!.firstPassTrace! : [],
        verificationChanged: Boolean(backendDebug?.verificationChanged),
        verificationMode: backendDebug?.verificationMode || "unknown",
        correctionsMade: Array.isArray(corrections) ? corrections : [],
      });
      const serverUsedModel = (result as any).usedModel as string | undefined;
      toast.message(
        `Model phản hồi: ${serverUsedModel || primaryModel}. Đang ghép tên học sinh...`,
        { id: toastId }
      );
      const matchedResults = result.violations.map((v: any, idx: number) => {
        let matchedViolation: ParsedViolation = {
          ...v,
          studentName: v.studentName || null,
          details: v.details || null,
          targetType: v.studentName ? "student" : "class",
          _uid: nextUid(),
          _delay: Math.min(idx, 8) * 45,
        };

        if (matchedViolation.studentName) {
          const studentsInClass = allStudents.filter(
            (s) =>
              normalizeClassName(s.className) ===
              normalizeClassName(matchedViolation.violatingClass)
          );
          const targetStudents = studentsInClass.length > 0 ? studentsInClass : allStudents;
          const matched = matchStudentName(matchedViolation.studentName, targetStudents);
          if (matched) matchedViolation.studentName = matched;
        }
        return matchedViolation;
      });

      setRemovingIds([]);
      setParsedViolations(matchedResults);
      setCheckedClasses(result.checkedClasses);
      setUsedModel("usedModel" in result ? (result as any).usedModel : null);

      if (inputMode === "attendance" && "attendanceByClass" in result) {
        setAttendanceByClass(result.attendanceByClass as Record<string, { absentStudents: string[]; lateStudents: string[] }>);
      }

      changeView("results");
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
      const modelLabel =
        ("usedModel" in result ? (result as any).usedModel : null) ||
        configuredModelText ||
        "fallback";
      toast.success(`Xong: ${matchedResults.length} mục • model: ${modelLabel} • ${elapsedMs}ms`, { id: toastId });
    } catch (error) {
      toast.error("Lỗi khi phân tích bằng AI: " + (error as Error).message, { id: toastId });
      console.error(error);
    } finally {
      setIsParsing(false);
    }
  };

  // Ctrl/Cmd + Enter - dùng ref để luôn gọi bản handleParse mới nhất (tránh stale closure)
  const handleParseRef = useRef(handleParse);
  handleParseRef.current = handleParse;
  useEffect(() => {
    if (!isOpen || currentView !== "input") return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && rawText.trim()) {
        event.preventDefault();
        if (!isParsing && !isSubmitting && !confirmState) void handleParseRef.current();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isOpen, currentView, rawText, isParsing, isSubmitting, confirmState]);

  const configuredModelText =
    (typeof savedGeminiModels === "string" && savedGeminiModels.trim()
      ? savedGeminiModels.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
      : null) ||
    (typeof savedAiModel === "string" && savedAiModel.trim() ? savedAiModel.trim() : null);

  const configuredOpenRouterText =
    (typeof savedOpenRouterModels === "string" && savedOpenRouterModels.trim()
      ? savedOpenRouterModels.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
      : null) ||
    (typeof savedAiModels === "string" && savedAiModels.trim()
      ? savedAiModels.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
      : null);
  const isSuperUser = Boolean(myProfile?.isSuperUser);
  const canShowDebugDetails = isSuperUser && showAiDebugDetails;

  const updateAt = (index: number, patch: Partial<ParsedViolation>) =>
    setParsedViolations((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const handleFieldChange = (index: number, field: keyof ParsedViolation, value: string) => {
    if (field === "studentName") {
      updateAt(index, { studentName: value || null, targetType: value ? "student" : "class" });
    } else if (field === "violatingClass") {
      updateAt(index, { violatingClass: value });
    } else if (field === "violationType") {
      updateAt(index, { violationType: value });
    } else if (field === "details") {
      updateAt(index, { details: value });
    }
  };

  const handleTargetTypeChange = (index: number, type: "student" | "class") => {
    setParsedViolations((prev) =>
      prev.map((v, i) =>
        i === index
          ? { ...v, targetType: type, studentName: type === "student" ? (v.studentName || "") : null }
          : v
      )
    );
  };

  // Chọn từ gợi ý: set tên + (nếu học sinh thuộc lớp khác) tự đồng bộ lớp
  const handleStudentPick = (index: number, opt: StudentOpt) => {
    setParsedViolations((prev) =>
      prev.map((v, i) =>
        i !== index
          ? v
          : {
            ...v,
            studentName: opt.value,
            targetType: "student",
            violatingClass:
              normalizeClassName(v.violatingClass) === normalizeClassName(opt.className)
                ? v.violatingClass
                : opt.className,
          }
      )
    );
  };

  // Immutable (bản gốc mutate mảng evidenceFiles tại chỗ)
  const handleFileChange = (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setParsedViolations((prev) =>
      prev.map((v, i) => (i === index ? { ...v, evidenceFiles: [...(v.evidenceFiles ?? []), ...newFiles] } : v))
    );
  };

  const handleRemoveFile = (violationIndex: number, fileIndex: number) => {
    setParsedViolations((prev) =>
      prev.map((v, i) =>
        i === violationIndex ? { ...v, evidenceFiles: (v.evidenceFiles ?? []).filter((_, k) => k !== fileIndex) } : v
      )
    );
  };

  // Thu gọn mượt 280ms rồi mới gỡ khỏi state
  const handleDeleteViolation = (index: number) => {
    const uid = parsedViolations[index]?._uid;
    if (!uid) {
      setParsedViolations((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setRemovingIds((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    window.setTimeout(() => {
      setParsedViolations((prev) => prev.filter((v) => v._uid !== uid));
      setRemovingIds((prev) => prev.filter((id) => id !== uid));
    }, prefersReducedMotion() ? 0 : 280);
  };

  const handleAddViolationWithType = (t: "student" | "class") => {
    const uid = nextUid();
    const newViolation: ParsedViolation = {
      studentName: t === "student" ? "" : null,
      violatingClass: "",
      violationType: ALL_VIOLATIONS[0] || "",
      details: null,
      targetType: t,
      originalText: "Thêm mới",
      evidenceFiles: [],
      _uid: uid,
    };
    setParsedViolations((prev) => [...prev, newViolation]);
    setFlashUid(uid);
  };

  const handleAddViolation = () => handleAddViolationWithType("student");

  const handleCopyReport = async (andSubmit = false) => {
    const formattedDate = customDate
      ? new Date(customDate).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");

    if (!myProfile) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    if (inputMode === "attendance") {
      const sortedClasses = [...checkedClasses].sort();
      const otherStudentViolations: ParsedViolation[] = [];
      const absenceKeywords = ["vắng", "nghỉ"];
      const lateKeywords = ["muộn"];

      for (const v of parsedViolations) {
        if (v.targetType === "student" && v.studentName) {
          const violationText = (v.violationType + (v.details || "")).toLowerCase();
          const isLate = lateKeywords.some((k) => violationText.includes(k));
          const isAbsence = absenceKeywords.some((k) => violationText.includes(k));

          if (!isLate && !isAbsence) {
            otherStudentViolations.push(v);
          }
        }
      }

      const attendanceReportLines = sortedClasses.map((className) => {
        const normalizedClass = normalizeClassName(className);
        const attendanceData = attendanceByClass[normalizedClass];
        const totalStudents = classRosterCounts[normalizedClass] || 0;

        const absentCount = attendanceData?.absentStudents.length || 0;
        const lateCount = attendanceData?.lateStudents.length || 0;
        const presentCount = totalStudents - absentCount;

        let line = `${className}: ${presentCount}/${totalStudents}`;
        if (absentCount > 0) line += ` (Vắng: ${attendanceData!.absentStudents.join(", ")})`;
        if (lateCount > 0) line += ` (Muộn có phép: ${attendanceData!.lateStudents.join(", ")})`;
        return line;
      });

      const attendanceReportString = "\nSĩ số các lớp:\n" + attendanceReportLines.join("\n");

      const studentViolations = otherStudentViolations
        .map((v) => {
          const violationText = (v.violationType + (v.details || "")).toLowerCase();
          const isLate = lateKeywords.some((k) => violationText.includes(k));
          let detail = v.details || v.violationType;
          if (isLate) detail = "Đi muộn không phép";
          return `- ${v.studentName} (${v.violatingClass}): ${detail}`;
        })
        .join("\n");

      const classViolations = parsedViolations
        .filter((v) => v.targetType === "class")
        .map((v) => `- ${v.violatingClass}: ${v.details || v.violationType}`)
        .join("\n");

      const reportString = `Ngày trực: ${formattedDate}\nNgười trực: ${myProfile.fullName} (${myProfile.className})\nCác lớp đã kiểm tra: ${sortedClasses.join(", ")}${attendanceReportString}\nNội dung vi phạm nền nếp:${studentViolations ? "\n" + studentViolations : " Không có"}\nNội dung tự quản:${classViolations ? "\n" + classViolations : " Không có"}`;

      try {
        await navigator.clipboard.writeText(reportString);
        toast.success("Đã sao chép mẫu báo cáo!");
        if (andSubmit) await handleSubmit(true);
      } catch (err) {
        toast.error("Không thể sao chép.");
      }
    } else {
      // Violations mode logic (same as original)
      const sortedViolations = [...parsedViolations].sort((a, b) => {
        if (a.violatingClass !== b.violatingClass) {
          return a.violatingClass.localeCompare(b.violatingClass);
        }
        return (a.studentName || "").localeCompare(b.studentName || "");
      });

      const studentViolations = sortedViolations
        .filter((v) => v.targetType === "student" && v.studentName)
        .map((v) => `- ${v.studentName} (${v.violatingClass}): ${v.details || v.violationType}`)
        .join("\n");

      const classViolations = sortedViolations
        .filter((v) => v.targetType === "class")
        .map((v) => `- ${v.violatingClass}: ${v.details || v.violationType}`)
        .join("\n");

      const reportString = `Ngày trực: ${formattedDate}\nNgười trực: ${myProfile.fullName} (${myProfile.className})\nNội dung vi phạm nền nếp:${studentViolations ? "\n" + studentViolations : " Không có"}\nNội dung tự quản:${classViolations ? "\n" + classViolations : " Không có"}`;

      try {
        await navigator.clipboard.writeText(reportString);
        toast.success("Đã sao chép mẫu báo cáo!");
        if (andSubmit) await handleSubmit(true);
      } catch (err) {
        toast.error("Không thể sao chép.");
      }
    }
  };

  const handleBackToInput = () => changeView("input");

  const quickInputExamples = inputMode === "attendance"
    ? [
      { label: "Mẫu sĩ số", value: "10A1: vắng An, Bình; muộn Cường\n10A2 đủ" },
      { label: "Mẫu nhanh", value: "10A1: vắng An" },
    ]
    : [
      { label: "Mẫu cá nhân", value: "An 10A1 đi học muộn không phép" },
      { label: "Mẫu nhiều dòng", value: "An 10A1 sai đồng phục\nBình 10A2 nói tục" },
    ];

  const handleSubmit = async (fromCopy = false) => {
    const violationsToSubmit = [...parsedViolations];
    if (violationsToSubmit.length === 0) {
      toast.info("Không có báo cáo nào để gửi.");
      return;
    }

    // Chặn gửi khi trong danh sách có cùng 1 lỗi cho cùng 1 người/lớp (mỗi ngày chỉ báo 1 lần)
    if (dupInfo.size > 0) {
      const list = parsedViolations
        .map((v, i) => ({ i, uid: v._uid ?? `idx-${i}`, first: dupInfo.get(v._uid ?? `idx-${i}`) }))
        .filter((d): d is { i: number; uid: string; first: number } => d.first !== undefined);
      const shown = list.slice(0, 3).map((d) => `mục ${d.i + 1} trùng mục ${d.first + 1}`).join("; ");
      const more = list.length > 3 ? ` (+${list.length - 3} mục khác)` : "";
      dupFocusRef.current = list[0].uid;
      setSubmitOverlay({
        phase: "error",
        retryable: false,
        message: `Báo cáo bị trùng: ${shown}${more}. Mỗi lỗi chỉ được báo một lần cho cùng một học sinh/lớp trong ngày, hãy xoá các mục trùng rồi gửi lại.`,
      });
      return;
    }

    const hasViolationWithoutEvidence = violationsToSubmit.some(
      (v) => !v.evidenceFiles || v.evidenceFiles.length === 0
    );

    if (hasViolationWithoutEvidence) {
      const confirmed = await askConfirm("Một hoặc nhiều báo cáo không có bằng chứng. Tiếp tục?", "Vẫn gửi");
      if (!confirmed) return;
    }

    if (!fromCopy) setIsSubmitting(true);
    setSubmitOverlay({ phase: "sending" });
    const sendStart = performance.now();
    try {
      const violationsWithFileIds = await Promise.all(
        violationsToSubmit.map(async (v) => {
          let evidenceR2Keys: string[] = [];
          if (v.evidenceFiles && v.evidenceFiles.length > 0) {
            const compressionOptions = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1280,
              useWebWorker: true,
              initialQuality: 0.8,
            };

            const uploadPromises = v.evidenceFiles.map(async (file) => {
              try {
                let fileToUpload = file;
                if (file.type.startsWith("image/")) {
                  fileToUpload = await imageCompression(file, compressionOptions);
                }

                const { uploadUrl, key } = await generateR2UploadUrl({
                  fileName: fileToUpload.name,
                  contentType: fileToUpload.type,
                });

                const result = await fetch(uploadUrl, {
                  method: "PUT",
                  headers: { "Content-Type": fileToUpload.type },
                  body: fileToUpload,
                });

                return result.ok ? key : null;
              } catch (error) {
                console.error(error);
                return null;
              }
            });
            evidenceR2Keys = (await Promise.all(uploadPromises)).filter((k): k is string => k !== null);
          }
          // Chỉ gửi đúng các field API cần (không lọt _uid/_delay)
          return {
            studentName: v.studentName || undefined,
            violatingClass: v.violatingClass,
            violationType: v.violationType,
            details: v.details || undefined,
            targetType: v.targetType,
            evidenceR2Keys,
          };
        })
      );

      const result = await bulkReportViolations({
        violations: violationsWithFileIds,
        customDate: customDate ?? undefined,
        customReporterId: customReporterId ?? undefined,
        customReporterName: customReporterName ? customReporterName.trim() : undefined,
      });

      if (result.successCount > 0) {
        // Add reporting points for successful reports (10 points each)
        await addReportingPoints({
          points: result.successCount * 10,
        });

        // Spinner chạy đủ lâu rồi mới chuyển sang thành công (nút xanh + tick), giữ ~3s rồi đóng
        await waitMinSending(sendStart);
        setSubmitDone(true);
        setSubmitOverlay({ phase: "success", count: result.successCount, points: result.successCount * 10, duplicates: result.duplicateCount });
        await new Promise<void>((resolve) => {
          celebrateSkipRef.current = resolve;
          window.setTimeout(resolve, prefersReducedMotion() ? 1200 : 3000);
        });
        celebrateSkipRef.current = null;
      } else {
        // Toàn bộ là báo cáo trùng (đã gửi trong ngày) → BÁO LỖI, giữ nguyên form, không đóng modal
        await waitMinSending(sendStart);
        setSubmitOverlay({
          phase: "error",
          retryable: result.duplicateCount === 0,
          message:
            result.duplicateCount > 0
              ? `${result.duplicateCount} báo cáo đã được gửi trước đó trong ngày (cùng lỗi, cùng học sinh/lớp) nên không được ghi nhận thêm. Hãy xoá hoặc chỉnh lại các mục này.`
              : "Không có báo cáo nào được ghi nhận. Vui lòng thử lại.",
        });
        return;
      }
      if (result.duplicateCount > 0) toast.warning(`${result.duplicateCount} báo cáo trùng lặp đã bỏ qua.`);

      // Đóng modal: Radix chạy animation đóng rồi mới unmount; form được reset sau khi đã khuất (effect theo isOpen)
      resetPendingRef.current = true;
      setIsOpen(false);
      onBulkSubmitSuccess();
    } catch (error) {
      // Thất bại: giữ nguyên form, overlay chuyển sang trạng thái lỗi (Đóng / Thử lại)
      await waitMinSending(sendStart);
      setSubmitOverlay({ phase: "error", message: (error as Error).message || "Đã có lỗi xảy ra. Vui lòng thử lại." });
    } finally {
      if (!fromCopy) setIsSubmitting(false);
    }
  };

  const handleSubmitAndCopy = async () => {
    setIsSubmitting(true);
    await handleCopyReport(true);
    setIsSubmitting(false);
  };

  /* ── Derived ── */
  const liveCount = parsedViolations.length - removingIds.length;
  const isBusy = isParsing || isSubmitting;
  const outOfAi = aiStatus !== undefined && !aiStatus.isSuperUser && aiStatus.remaining <= 0;

  /* ── Shared class tokens ── */
  const labelCls = `text-[10px] font-bold uppercase tracking-wide ${T("text-slate-400", "text-gray-500")}`;
  const underlineInputCls = `peer w-full bg-transparent py-1.5 text-sm font-medium outline-none border-b transition-colors duration-200 placeholder:font-normal ${T(
    "border-slate-600 text-slate-100 placeholder:text-slate-500",
    "border-gray-200 text-gray-900 placeholder:text-gray-400"
  )}`;
  const underlineBarCls = `pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-blue-500 transition-transform duration-300 ${EASE} peer-focus:scale-x-100`;
  const boxInputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:ring-2 ${T(
    "border-slate-600 bg-slate-900/50 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/20",
    "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
  )}`;

  const modeButtons: { mode: InputMode; title: string; sub: string; icon: React.ReactNode }[] = [
    {
      mode: "attendance",
      title: "Cờ đỏ",
      sub: "Sĩ số + Vi phạm",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
      ),
    },
    {
      mode: "violations",
      title: "Trực tuần",
      sub: "Chỉ vi phạm",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      ),
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="w-full py-6 text-lg font-semibold relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-cyan-500 to-primary/80 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.9)] transition-all duration-500 active:scale-[0.98] group"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 opacity-60 blur-xl animate-pulse" />
          <span className="relative flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Nhập liệu hàng loạt
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent
        customMotion
        overlayClassName="aivm-backdrop bg-black/60"
        onEscapeKeyDown={(e) => {
          if (confirmState) {
            e.preventDefault();
            closeConfirm(false);
          } else if (comboOpenRef.current) {
            e.preventDefault(); // Esc chỉ đóng danh sách gợi ý, không đóng cả modal
          }
        }}
        className={`aivm [&>button]:hidden max-w-3xl w-[100vw] h-[100dvh] sm:h-[min(85vh,720px)] p-0 flex flex-col gap-0 border-none sm:border sm:rounded-2xl sm:shadow-2xl overflow-hidden ${T(
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
          "bg-gradient-to-br from-white via-cyan-50 to-blue-50"
        )}`}
      >
        <style>{MODAL_CSS}</style>

        {/* Header */}
        <DialogHeader className={`flex-shrink-0 px-4 py-3.5 sm:px-6 border-b backdrop-blur-md flex flex-row items-center justify-between gap-3 space-y-0 ${T("border-slate-700 bg-slate-800/50", "border-gray-100 bg-white/50")}`}>
          <DialogTitle className={`flex min-w-0 items-center gap-3 text-base font-semibold leading-tight tracking-tight sm:text-lg ${T("text-slate-100", "text-gray-800")}`}>
            <span
              key={`icon-${currentView}`}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base shadow-sm animate-in fade-in zoom-in-50 duration-300 ${T("bg-blue-500/20 text-blue-300", "bg-blue-100 text-blue-600")}`}
            >
              {currentView === "input" ? "✦" : "✓"}
            </span>
            <span key={`title-${currentView}`} className="flex min-w-0 flex-col gap-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <span className="block">{currentView === "input" ? "Nhập liệu AI" : "Kiểm tra kết quả"}</span>
              <span className={`block text-xs font-normal leading-snug tracking-normal ${T("text-slate-400", "text-gray-500")}`}>
                {currentView === "input" ? (
                  "Mô tả tự nhiên, AI sẽ chuẩn hóa giúp bạn"
                ) : (
                  <>
                    <span key={liveCount} className="inline-block tabular-nums animate-in fade-in slide-in-from-bottom-1 duration-200">{liveCount}</span>{" "}
                    mục đang chờ kiểm tra
                  </>
                )}
              </span>
            </span>
          </DialogTitle>
          <DialogClose
            aria-label="Đóng"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-200 hover:rotate-90 active:scale-90 ${T("bg-slate-700 hover:bg-slate-600", "bg-gray-100 hover:bg-gray-200")}`}
          >
            <svg className={`h-4 w-4 ${T("text-slate-400", "text-gray-500")}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </DialogClose>
        </DialogHeader>

        {/* Thanh tiến trình bất định khi đang gọi AI / gửi */}
        <div aria-hidden="true" className={`relative h-[2px] flex-shrink-0 overflow-hidden transition-opacity duration-300 ${isBusy ? "opacity-100" : "opacity-0"}`}>
          <div className="aivm-bar absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-4 sm:px-6">
          <div
            className={`min-h-full transition-[opacity,transform] duration-150 ease-in ${isLeaving
              ? `opacity-0 ${navDir === "forward" ? "-translate-x-3" : "translate-x-3"}`
              : "opacity-100 translate-x-0"
              }`}
          >
            {currentView === "input" ? (
              <div className={`flex min-h-full flex-col gap-5 pb-4 animate-in fade-in duration-300 ${navDir === "back" ? "slide-in-from-left-4" : "slide-in-from-bottom-2"}`}>
                {/* Mode Selection - viên thuốc trượt */}
                <div className={`relative grid grid-cols-2 rounded-2xl p-1 ${T("bg-slate-800/80", "bg-slate-100/80")}`} role="tablist" aria-label="Chế độ nhập">
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-xl shadow-sm transition-transform duration-300 ${EASE} ${inputMode === "violations" ? "translate-x-full" : "translate-x-0"} ${T("bg-blue-500/20 ring-1 ring-blue-400/20", "bg-white")}`}
                  />
                  {modeButtons.map(({ mode, title, sub, icon }) => {
                    const active = inputMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setInputMode(mode)}
                        className={`relative z-10 flex items-center justify-center gap-2 rounded-xl p-3 transition-[color,transform] duration-300 active:scale-[0.97] ${active
                          ? T("text-blue-300", "text-blue-700")
                          : T("text-slate-400 hover:text-slate-200", "text-gray-500 hover:text-gray-700")
                          }`}
                      >
                        <div className={`rounded-lg p-1.5 transition-colors duration-300 ${active ? T("bg-blue-500/30", "bg-blue-100") : T("bg-slate-700", "bg-gray-200")}`}>
                          {icon}
                        </div>
                        <div className="text-center">
                          <span className="block text-sm font-bold">{title}</span>
                          <span className="mt-0.5 block text-[10px] opacity-80">{sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Text Input */}
                <div className="flex flex-1 flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="aivm-raw-text" className={`text-sm font-semibold ${T("text-slate-300", "text-gray-700")}`}>Nội dung báo cáo</label>
                    <div className="flex gap-2">
                      {aiStatus !== undefined && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] tabular-nums transition-colors duration-300 ${outOfAi ? T("bg-red-500/20 text-red-400 border-red-500/30", "bg-red-50 text-red-500 border-red-100") : T("bg-blue-500/20 text-blue-400 border-blue-500/30", "bg-blue-50 text-blue-500 border-blue-100")}`}>
                          AI: {aiStatus.isSuperUser ? "vô hạn" : `${aiStatus.remaining} lượt`}
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] tabular-nums ${T("text-slate-400 bg-slate-800 border-slate-700", "text-gray-400 bg-white border-gray-200")}`}>{rawText.length} ký tự</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    <span className={`shrink-0 text-[11px] ${T("text-slate-500", "text-gray-400")}`}>Gợi ý:</span>
                    {quickInputExamples.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        onClick={() => {
                          setRawText(example.value);
                          textareaRef.current?.focus();
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 active:scale-95 ${T("border-slate-700 bg-slate-800/70 text-slate-300 hover:border-blue-500/50 hover:text-blue-300", "border-gray-200 bg-white/80 text-gray-600 hover:border-blue-300 hover:text-blue-600")}`}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex min-h-[200px] flex-1 sm:min-h-[250px]">
                    <Textarea
                      id="aivm-raw-text"
                      ref={textareaRef}
                      placeholder={inputMode === "attendance"
                        ? `10A1: vắng An, Bình; muộn Cường...\n10A2 đủ...`
                        : `An 10A1 sai dp\nBình 10A2 tóc...`}
                      className={`h-full w-full resize-none rounded-xl p-4 text-sm leading-relaxed shadow-inner transition-[border-color,box-shadow,background-color] duration-300 focus:ring-2 md:text-base ${T(
                        "border-slate-700 bg-slate-800/80 text-slate-200 focus:border-blue-500/70 focus:ring-blue-500/20 placeholder:text-slate-500",
                        "border-gray-200 bg-white/80 text-gray-900 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-gray-400"
                      )}`}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      disabled={isParsing || isSubmitting}
                    />
                    {/* Shimmer quét qua khi AI đang đọc */}
                    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden rounded-xl transition-opacity duration-500 ${isParsing ? "opacity-100" : "opacity-0"}`}>
                      <div className="aivm-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/15 to-transparent" />
                    </div>
                  </div>
                </div>

                {/* Advanced Options */}
                {(myProfile?.role === "gradeManager" || myProfile?.isSuperUser) && (
                  <div className={`overflow-hidden rounded-xl border ${T("border-slate-700 bg-slate-800", "border-gray-200 bg-white")}`}>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((s) => !s)}
                      aria-expanded={showAdvanced}
                      className={`flex w-full items-center justify-between p-3 text-xs font-semibold transition-colors duration-200 ${T("text-slate-400 hover:bg-slate-700", "text-gray-600 hover:bg-gray-50")}`}
                    >
                      <span>Cài đặt nâng cao (Ngày/Người báo cáo)</span>
                      <Chevron open={showAdvanced} />
                    </button>

                    <Collapse open={showAdvanced}>
                      <div className={`space-y-3 border-t p-3 ${T("bg-slate-900/50 border-slate-700", "bg-gray-50 border-gray-100")}`}>
                        <div className="space-y-1">
                          <label className={`text-xs ${T("text-slate-400", "text-gray-500")}`}>Override ngày</label>
                          <Input
                            type="datetime-local"
                            className={`h-9 text-sm ${T("bg-slate-800 border-slate-700 text-slate-200", "bg-white")}`}
                            onChange={(e) => setCustomDate(e.target.value ? new Date(e.target.value).getTime() : null)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={`text-xs ${T("text-slate-400", "text-gray-500")}`}>AI model</label>
                          <div className={`rounded-md border px-3 py-2 text-xs ${T("text-slate-400 bg-slate-800 border-slate-700", "text-gray-600 bg-white border-gray-200")}`}>
                            Đang cấu hình:{" "}
                            <span className={`font-mono ${T("text-slate-300", "text-gray-800")}`}>
                              {configuredModelText || "Chưa đặt (sẽ dùng fallback)"}
                            </span>
                            <div className={`mt-1 text-[11px] ${T("text-slate-500", "text-gray-500")}`}>
                              (Ưu tiên Gemini, fallback OpenRouter. Cấu hình ở Admin Dashboard → Cài đặt → AI)
                            </div>
                            <div className={`mt-1 text-[11px] ${T("text-slate-500", "text-gray-500")}`}>
                              OpenRouter fallback:{" "}
                              <span className={`font-mono ${T("text-slate-400", "text-gray-700")}`}>
                                {configuredOpenRouterText || "Chưa đặt"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {myProfile?.isSuperUser && (
                          <div className="space-y-1">
                            <label className={`text-xs ${T("text-slate-400", "text-gray-500")}`}>Override người báo cáo</label>
                            <input
                              list="reporter-list"
                              className={`flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${T("border-slate-700 bg-slate-800 text-slate-200", "border-input bg-white")}`}
                              placeholder="Nhập hoặc chọn người..."
                              onChange={(e) => {
                                const value = e.target.value;
                                const p = allUserProfiles?.find((p) => p.fullName === value);
                                if (p) {
                                  setCustomReporterId(p.userId);
                                  setCustomReporterName("");
                                } else {
                                  setCustomReporterId(null);
                                  setCustomReporterName(value);
                                }
                              }}
                            />
                            <datalist id="reporter-list">
                              {allUserProfiles?.map((p) => (
                                <option key={p.userId} value={p.fullName}>{p.fullName} - {p.className}</option>
                              ))}
                            </datalist>
                            <div className={`text-[10px] leading-tight ${T("text-slate-500", "text-gray-400")}`}>
                              * Có thể chọn tài khoản có sẵn hoặc tự nhập tên người báo (nếu không có tk).
                            </div>
                          </div>
                        )}
                        {myProfile?.isSuperUser && (
                          <div className="space-y-1">
                            <label className={`text-xs ${T("text-slate-400", "text-gray-500")}`}>Debug AI chi tiết</label>
                            <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs ${T("text-slate-400 bg-slate-800 border-slate-700", "text-gray-700 bg-white border-gray-200")}`}>
                              <input
                                type="checkbox"
                                className="accent-blue-500"
                                checked={showAiDebugDetails}
                                onChange={(e) => setShowAiDebugDetails(e.target.checked)}
                              />
                              Bật hiển thị trace provider/model + verify details
                            </label>
                          </div>
                        )}
                      </div>
                    </Collapse>
                  </div>
                )}
              </div>
            ) : (
              // RESULTS VIEW
              <div className={`flex flex-col gap-4 pb-20 animate-in fade-in duration-300 ${navDir === "forward" ? "slide-in-from-right-4" : "slide-in-from-bottom-2"}`}>
                {(usedModel || configuredModelText) && (
                  <div className={`rounded-xl border p-3 text-xs shadow-sm ${T("bg-slate-800/70 border-slate-700 text-slate-400", "bg-white/70 border-gray-200 text-gray-600")}`}>
                    AI model đang dùng:{" "}
                    <span className={`font-mono ${T("text-slate-300", "text-gray-800")}`}>{usedModel || configuredModelText}</span>
                  </div>
                )}
                {aiDebugInfo && (
                  <div className={`space-y-2 rounded-xl border p-3 text-xs shadow-sm ${T("bg-slate-800/70 border-slate-700 text-slate-400", "bg-slate-50/70 border-slate-200 text-slate-700")}`}>
                    <div>
                      Verify:{" "}
                      {aiDebugInfo.verificationChanged ? "có chỉnh sửa" : "không chỉnh sửa"}
                    </div>
                    {canShowDebugDetails && (
                      <div>
                        Verify mode: <span className={`font-mono ${T("text-slate-300", "text-slate-800")}`}>{aiDebugInfo.verificationMode}</span>
                      </div>
                    )}
                    {canShowDebugDetails && aiDebugInfo.correctionsMade.length > 0 && (
                      <div className={`text-[11px] ${T("text-slate-500", "text-slate-600")}`}>
                        Sửa bởi verifier: {aiDebugInfo.correctionsMade.join(" | ")}
                      </div>
                    )}
                    {canShowDebugDetails && aiDebugInfo.firstPassTrace.length > 0 && (
                      <details>
                        <summary className={`cursor-pointer text-[11px] ${T("text-slate-500", "text-slate-600")}`}>Trace provider/model</summary>
                        <div className={`mt-2 whitespace-pre-wrap break-all font-mono text-[10px] ${T("text-slate-400", "text-slate-700")}`}>
                          {aiDebugInfo.firstPassTrace.join("\n")}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Attendance Summary */}
                {inputMode === "attendance" && Object.keys(attendanceByClass).length > 0 && (
                  <div className={`rounded-xl border p-3 shadow-sm ${T("bg-blue-500/10 border-blue-500/30", "bg-blue-50/50 border-blue-100")}`}>
                    <h4 className={`mb-2 text-xs font-bold uppercase tracking-wide ${T("text-blue-400", "text-blue-800")}`}>Tổng hợp sĩ số</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {Object.entries(attendanceByClass).map(([className, data], tileIdx) => {
                        const total = allStudents?.filter((s) => normalizeClassName(s.className) === normalizeClassName(className)).length || 0;
                        const present = total - data.absentStudents.length;
                        return (
                          <div
                            key={className}
                            style={{ animationDelay: `${Math.min(tileIdx, 8) * 35}ms`, animationFillMode: "backwards" }}
                            className={`flex flex-col rounded border px-2.5 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-300 ${T("bg-slate-800 border-blue-500/30", "bg-white border-blue-100")}`}
                          >
                            <div className={`flex justify-between font-medium tabular-nums ${T("text-slate-300", "text-gray-700")}`}>
                              <span>{className}</span>
                              <span>{present}/{total}</span>
                            </div>
                            {(data.absentStudents.length > 0 || data.lateStudents.length > 0) && (
                              <div className={`mt-1 border-t pt-1 text-[10px] leading-tight ${T("border-slate-700 text-slate-400", "border-gray-50 text-gray-500")}`}>
                                {data.absentStudents.length > 0 && <div className={T("text-red-400", "text-red-500")}>V: {data.absentStudents.join(", ")}</div>}
                                {data.lateStudents.length > 0 && <div className={T("text-orange-400", "text-orange-500")}>M: {data.lateStudents.join(", ")}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Violations List */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className={`text-sm font-bold ${T("text-slate-200", "text-gray-800")}`}>
                      Danh sách vi phạm (<span key={liveCount} className="inline-block tabular-nums animate-in fade-in slide-in-from-bottom-1 duration-200">{liveCount}</span>)
                    </h3>
                    <div className="flex gap-1.5">
                      {(["student", "class"] as const).map((t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant="outline"
                          className={`h-7 gap-1 text-xs transition-transform duration-200 active:scale-95 ${T("text-green-400 bg-green-500/20 border-green-500/30 hover:bg-green-500/30", "text-green-700 bg-green-50 border-green-200 hover:bg-green-100")}`}
                          onClick={() => handleAddViolationWithType(t)}
                        >
                          {PlusIcon}
                          {t === "student" ? "Cá nhân" : "Cấp lớp"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {parsedViolations.length === 0 ? (
                    <div className={`flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 animate-in fade-in zoom-in-95 duration-300 ${T("bg-slate-800/50 border-slate-700", "bg-gray-50/50 border-gray-200")}`}>
                      <p className={`text-sm ${T("text-slate-500", "text-gray-400")}`}>Chưa có vi phạm nào</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs active:scale-95" onClick={() => handleAddViolationWithType("student")}>
                          {PlusIcon} Cá nhân
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs active:scale-95" onClick={() => handleAddViolationWithType("class")}>
                          {PlusIcon} Cấp lớp
                        </Button>
                      </div>
                    </div>
                  ) : (
                    parsedViolations.map((v, i) => {
                      const uid = v._uid ?? `idx-${i}`;
                      const removing = removingIds.includes(uid);
                      const studentOptionsForClass = studentsByClass.get(normalizeClassName(v.violatingClass)) || studentOptions;
                      const unmatched =
                        !!v.studentName &&
                        v.targetType === "student" &&
                        !allStudents?.some(
                          (s) =>
                            s.fullName.toLowerCase() === v.studentName?.toLowerCase() &&
                            normalizeClassName(s.className) === normalizeClassName(v.violatingClass)
                        );

                      const suggestions = unmatched ? searchStudents(v.studentName || "", studentOptionsForClass).slice(0, 4) : [];

                      return (
                        // Lớp ngoài: thu gọn chiều cao khi xoá (kèm padding-bottom làm khoảng cách → không bị giật)
                        <div
                          key={uid}
                          className={`grid transition-[grid-template-rows,opacity] duration-[280ms] ${EASE} ${removing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
                        >
                          <div className={`min-h-0 ${removing ? "overflow-hidden" : ""}`}>
                            <div className="pb-3">
                              <div
                                ref={(el) => {
                                  if (el) cardRefs.current.set(uid, el);
                                  else cardRefs.current.delete(uid);
                                }}
                                style={{ animationDelay: v._delay ? `${v._delay}ms` : undefined, animationFillMode: "backwards" }}
                                className={`relative focus-within:z-20 rounded-xl border p-3 shadow-sm transition-colors duration-200 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:p-4 ${flashUid === uid ? "aivm-flash" : ""} ${T("bg-slate-800 border-slate-700 hover:border-blue-500/50", "bg-white border-gray-200 hover:border-blue-300")}`}
                              >
                                {/* Index Badge */}
                                <div className={`absolute -left-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] tabular-nums shadow-md ${T("bg-slate-700 text-slate-200", "bg-gray-800 text-white")}`}>
                                  {i + 1}
                                </div>

                                {/* Original Text Display */}
                                {v.originalText && (
                                  <div className={`mb-3 rounded border px-2 py-1.5 text-[10px] ${T("bg-blue-500/10 text-blue-400 border-blue-500/30", "bg-blue-50 text-blue-700 border-blue-200")}`}>
                                    <span className="font-semibold">Dữ liệu gốc:</span> {v.originalText}
                                  </div>
                                )}

                                {/* Chưa khớp tên → gợi ý bấm một chạm */}
                                <Collapse open={unmatched}>
                                  <div className={`mb-3 rounded-lg border px-2.5 py-2 text-xs ${T("bg-yellow-500/10 text-yellow-300 border-yellow-500/30", "bg-yellow-50 text-yellow-800 border-yellow-200")}`}>
                                    <div className="flex items-start gap-1.5">
                                      <TriangleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                                      <span>{suggestions.length ? "Chưa khớp tên - có phải một trong các bạn này?" : "Chưa khớp tên trong danh sách. Hãy gõ lại ở ô Học sinh."}</span>
                                    </div>
                                    {suggestions.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {suggestions.map((o) => (
                                          <button
                                            key={o.id}
                                            type="button"
                                            onClick={() => handleStudentPick(i, o)}
                                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[transform,background-color] duration-150 active:scale-95 ${T("border-yellow-500/40 bg-slate-800 text-slate-100 hover:bg-slate-700", "border-yellow-300 bg-white text-gray-800 hover:bg-yellow-100")}`}
                                          >
                                            {o.value}
                                            {studentOptionsForClass === studentOptions && <span className="ml-1 opacity-60">{o.className}</span>}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </Collapse>

                                {/* Trùng lỗi trong danh sách → không cho gửi */}
                                <Collapse open={dupInfo.has(uid)}>
                                  <div className={`mb-3 rounded-lg border px-2.5 py-2 text-xs ${T("bg-red-500/10 text-red-300 border-red-500/30", "bg-red-50 text-red-700 border-red-200")}`}>
                                    <div className="flex items-start gap-1.5">
                                      <TriangleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                                      <span>Trùng lỗi: đã có mục khác báo cùng lỗi cho cùng {v.targetType === "class" ? "lớp" : "học sinh"} này. Mỗi ngày chỉ báo một lần, hãy xoá mục trùng.</span>
                                    </div>
                                  </div>
                                </Collapse>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="col-span-1 flex items-center justify-between gap-2 sm:col-span-2">
                                    <div className={labelCls}>Đối tượng</div>
                                    <div className="flex items-center gap-1.5">
                                      <Segmented
                                        dark={isDarkMode}
                                        value={v.targetType}
                                        onChange={(t) => handleTargetTypeChange(i, t)}
                                        options={[
                                          { value: "student", label: "Cá nhân" },
                                          { value: "class", label: "Cấp lớp" },
                                        ]}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteViolation(i)}
                                        aria-label={`Xoá mục ${i + 1}`}
                                        className={`rounded-md p-1.5 transition-[color,background-color,transform] duration-200 active:scale-90 ${T("text-slate-500 hover:text-red-400 hover:bg-red-500/10", "text-gray-400 hover:text-red-500 hover:bg-red-50")}`}
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Class FIRST */}
                                  <div className={`space-y-1 ${v.targetType === "class" ? "col-span-1 sm:col-span-2" : ""}`}>
                                    <label className={labelCls}>Lớp</label>
                                    <div className="relative">
                                      <input
                                        data-first-field
                                        value={v.violatingClass}
                                        onChange={(e) => handleFieldChange(i, "violatingClass", e.target.value)}
                                        className={underlineInputCls}
                                        placeholder="Ví dụ: 10A5"
                                      />
                                      <span className={underlineBarCls} />
                                    </div>
                                  </div>

                                  {/* Student SECOND (only if student) */}
                                  {v.targetType === "student" && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                      <label className={labelCls}>Học sinh</label>
                                      <StudentCombobox
                                        id={`stu-${uid}`}
                                        value={v.studentName || ""}
                                        scoped={studentOptionsForClass}
                                        all={studentOptions}
                                        dark={isDarkMode}
                                        matched={!!v.studentName && !unmatched}
                                        placeholder="Gõ tên, không cần dấu..."
                                        inputClassName={underlineInputCls}
                                        barClassName={underlineBarCls}
                                        onText={(t) => updateAt(i, { studentName: t })}
                                        onPick={(o) => handleStudentPick(i, o)}
                                        onOpenChange={(o) => { comboOpenRef.current = o; }}
                                      />
                                    </div>
                                  )}

                                  {/* Violation Type */}
                                  <div className="col-span-1 space-y-1 sm:col-span-2">
                                    <label className={labelCls}>Loại vi phạm</label>
                                    <ViolationTypePicker
                                      categories={activeCategories.map((category) => ({
                                        ...category,
                                        violations: category.violations.filter((violation) => v.targetType === "student" || !PERSONAL_VIOLATION_CODES.includes(violation)),
                                      })).filter((cat) => cat.violations.length > 0)}
                                      value={v.violationType}
                                      onChange={(val) => handleFieldChange(i, "violationType", val)}
                                      isDarkMode={isDarkMode}
                                      excludeViolations={(() => {
                                        // Tính tập lỗi đã dùng bởi các card khác cùng target trong ngày
                                        const excluded = new Set<string>();
                                        for (let j = 0; j < parsedViolations.length; j++) {
                                          if (j === i) continue;
                                          const other = parsedViolations[j];
                                          const sameClass = normalizeClassName(other.violatingClass) === normalizeClassName(v.violatingClass);
                                          if (!sameClass) continue;
                                          if (v.targetType === "class" && other.targetType === "class") {
                                            excluded.add(other.violationType);
                                          } else if (
                                            v.targetType === "student" &&
                                            other.targetType === "student" &&
                                            other.studentName &&
                                            v.studentName &&
                                            other.studentName.toLowerCase() === v.studentName.toLowerCase()
                                          ) {
                                            excluded.add(other.violationType);
                                          }
                                        }
                                        return excluded.size > 0 ? excluded : undefined;
                                      })()}
                                    />
                                  </div>

                                  {/* Violation Details */}
                                  <div className="col-span-1 space-y-1 sm:col-span-2">
                                    <label className={labelCls}>Chi tiết</label>
                                    <input
                                      value={v.details || ""}
                                      onChange={(e) => handleFieldChange(i, "details", e.target.value)}
                                      className={boxInputCls}
                                      placeholder="Ví dụ: quần bò, không sơ vin..."
                                    />
                                  </div>

                                  {/* Evidence Upload */}
                                  <div className="col-span-1 space-y-2 pt-1 sm:col-span-2">
                                    <div className="flex items-center gap-2 overflow-x-auto p-1.5 -m-1.5">
                                      <label className={`flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-[border-color,background-color,transform] duration-200 hover:scale-105 active:scale-95 ${T("border-slate-600 hover:border-blue-400 hover:bg-blue-500/10", "border-gray-300 hover:border-blue-500 hover:bg-blue-50")}`}>
                                        <input
                                          type="file"
                                          multiple
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            handleFileChange(i, e.target.files);
                                            e.target.value = ""; // cho phép chọn lại cùng 1 file
                                          }}
                                        />
                                        <svg className={`h-5 w-5 ${T("text-slate-400", "text-gray-400")}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      </label>

                                      {v.evidenceFiles?.map((file, idx) => (
                                        <EvidenceThumb
                                          key={fileKey(file)}
                                          file={file}
                                          dark={isDarkMode}
                                          onRemove={() => handleRemoveFile(i, idx)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>


                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          key={`footer-${currentView}`}
          className={`z-20 flex flex-shrink-0 flex-col gap-3 border-t p-4 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] animate-in fade-in duration-300 sm:flex-row ${T("border-slate-700 bg-slate-800", "border-gray-100 bg-white")}`}
        >
          {currentView === "input" ? (
            <>
              <Button
                variant="ghost"
                className={`w-full active:scale-[0.97] sm:w-auto ${T("text-slate-400 hover:text-slate-200 hover:bg-slate-700", "text-gray-600")}`}
                onClick={() => handleOpenChange(false)}
              >
                Hủy
              </Button>
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                <Button
                  onClick={async () => {
                    if (rawText.trim()) {
                      const ok = await askConfirm("Bỏ qua dữ liệu đã nhập?", "Bỏ qua");
                      if (!ok) return;
                    }
                    changeView("results");
                  }}
                  variant="outline"
                  className={`flex-1 transition-transform active:scale-[0.97] sm:flex-none ${T("border-slate-600 text-slate-300 hover:bg-slate-700", "border-gray-300 text-gray-700")}`}
                  disabled={isSubmitting || isParsing}
                >
                  Nhập thủ công
                </Button>
                <Button
                  onClick={handleParse}
                  disabled={isParsing || isSubmitting || !allStudents || outOfAi}
                  className={`flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-[box-shadow,transform,opacity] duration-300 active:scale-[0.97] sm:flex-none ${T("shadow-blue-500/20 hover:shadow-blue-500/30", "shadow-blue-200 hover:shadow-blue-300")}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isParsing ? (
                      <>
                        <Spinner />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        Phân tích AI
                        <span className="hidden text-[10px] opacity-70 sm:inline">Ctrl ↵</span>
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleBackToInput}
                disabled={isSubmitting}
                className={`w-full active:scale-[0.97] sm:w-auto ${T("border-slate-600 text-slate-300 hover:bg-slate-700", "border-gray-200")}`}
              >
                ← Quay lại
              </Button>
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                {inputMode === "attendance" && (
                  <Button
                    onClick={handleSubmitAndCopy}
                    disabled={isSubmitting || parsedViolations.length === 0 || removingIds.length > 0}
                    className={`flex-1 border active:scale-[0.97] ${T("bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/30", "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200")}`}
                  >
                    Gửi & Copy
                  </Button>
                )}
                <Button
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || parsedViolations.length === 0 || removingIds.length > 0}
                  className={`flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg transition-[box-shadow,transform,opacity] duration-300 active:scale-[0.97] sm:flex-none ${submitDone ? "disabled:!opacity-100" : ""} ${T("shadow-green-500/20 hover:shadow-green-500/30", "shadow-green-200 hover:shadow-green-300")}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {submitDone ? (
                      <>
                        <CheckIcon />
                        Đã gửi
                      </>
                    ) : isSubmitting ? (
                      <>
                        <Spinner />
                        Đang gửi...
                      </>
                    ) : (
                      <span className="tabular-nums">Gửi báo cáo ({liveCount})</span>
                    )}
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Overlay vòng đời gửi: đang gửi → thành công / thất bại */}
        {submitOverlay && (
          <SubmitOverlay
            state={submitOverlay}
            onSkip={() => celebrateSkipRef.current?.()}
            onDismiss={dismissOverlay}
            onRetry={() => {
              setSubmitOverlay(null);
              void handleSubmit();
            }}
          />
        )}

        {/* Confirm sheet - thay cho window.confirm */}
        {confirmState && (
          <div
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] animate-in fade-in duration-200 sm:items-center"
            onClick={() => closeConfirm(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={confirmState.message}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:zoom-in-95 ${T("bg-slate-800 border-slate-700 text-slate-100", "bg-white border-gray-200 text-gray-900")}`}
            >
              <p className="text-sm font-medium leading-relaxed">{confirmState.message}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" className="active:scale-95" onClick={() => closeConfirm(false)}>
                  Quay lại
                </Button>
                <Button autoFocus className="active:scale-95" onClick={() => closeConfirm(true)}>
                  {confirmState.confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}