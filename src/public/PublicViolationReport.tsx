import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo, useRef } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";
import {
  ChevronDown, ChevronUp, Eye, Calendar, AlertCircle,
  FileText, Loader2, Trophy, X, User, Users, FileWarning, Download, ShieldCheck, Sparkles, Award, Moon, Sun
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// --- TYPES ---
type ModalMedia = {
  url: string;
  type: 'image' | 'video';
  violationInfo: {
    student: string;
    class: string;
    details: string;
  }
}
const premiumStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-150%); }
    100% { transform: translateX(150%); }
  }
  @keyframes gradient-xy {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  .animate-gradient-text {
    background-size: 200% auto;
    animation: gradient-xy 3s linear infinite;
  }

  /* ===== ANIMATED BACKGROUND SYSTEM ===== */
  @keyframes blob-drift-1 {
    0%   { transform: translate(0px, 0px) scale(1); }
    25%  { transform: translate(40px, -60px) scale(1.08); }
    50%  { transform: translate(-30px, 40px) scale(0.94); }
    75%  { transform: translate(60px, 20px) scale(1.05); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  @keyframes blob-drift-2 {
    0%   { transform: translate(0px, 0px) scale(1); }
    33%  { transform: translate(-50px, 30px) scale(1.1); }
    66%  { transform: translate(30px, -50px) scale(0.92); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  @keyframes blob-drift-3 {
    0%   { transform: translate(0px, 0px) scale(1.02); }
    40%  { transform: translate(35px, 55px) scale(0.96); }
    70%  { transform: translate(-45px, -20px) scale(1.07); }
    100% { transform: translate(0px, 0px) scale(1.02); }
  }
  @keyframes bg-hue-shift {
    0%, 100% { filter: hue-rotate(0deg) brightness(1); }
    33%  { filter: hue-rotate(20deg) brightness(1.05); }
    66%  { filter: hue-rotate(-15deg) brightness(0.97); }
  }

  .aurora-blob-1 {
    animation: blob-drift-1 22s ease-in-out infinite;
    will-change: transform;
  }
  .aurora-blob-2 {
    animation: blob-drift-2 28s ease-in-out infinite;
    will-change: transform;
  }
  .aurora-blob-3 {
    animation: blob-drift-3 18s ease-in-out infinite;
    will-change: transform;
  }
  .aurora-blob-4 {
    animation: blob-drift-1 34s ease-in-out infinite reverse;
    will-change: transform;
  }
  .aurora-blob-5 {
    animation: blob-drift-2 24s ease-in-out infinite 6s;
    will-change: transform;
  }
  .aurora-bg-layer {
    animation: bg-hue-shift 20s ease-in-out infinite;
  }
  .public-report-shell.theme-dark {
    background: radial-gradient(1200px circle at 15% 0%, rgba(59, 130, 246, 0.2), transparent 45%),
      radial-gradient(900px circle at 85% 20%, rgba(6, 182, 212, 0.18), transparent 45%),
      #0f172a;
    color: #f8fafc;
  }
  
  /* Tăng hiệu ứng blob trong darkmode */
  .public-report-shell.theme-dark .aurora-blob-1 { background-color: rgba(59, 130, 246, 0.35); }
  .public-report-shell.theme-dark .aurora-blob-2 { background-color: rgba(99, 102, 241, 0.3); }
  .public-report-shell.theme-dark .aurora-blob-3 { background-color: rgba(6, 182, 212, 0.3); }
  .public-report-shell.theme-dark .aurora-blob-4 { background-color: rgba(139, 92, 246, 0.25); }
  .public-report-shell.theme-dark .aurora-blob-5 { background-color: rgba(20, 184, 166, 0.3); }

  /* GLASSMORPHISM - Performant approach */
  .glass-header {
    background-color: rgba(255, 255, 255, 0.75) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .public-report-shell.theme-dark .glass-header {
    background-color: rgba(15, 23, 42, 0.65) !important;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom-color: rgba(255, 255, 255, 0.08) !important;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3) !important;
  }

  .glass-card {
    background-color: rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-color: rgba(255, 255, 255, 0.4) !important;
  }
  .public-report-shell.theme-dark .glass-card {
    background-color: rgba(30, 41, 59, 0.45) !important;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-color: rgba(255, 255, 255, 0.12) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.08) !important;
  }

  .glass-day-expanded {
    background: linear-gradient(to right, rgba(79, 70, 229, 0.85), rgba(99, 102, 241, 0.85)) !important;
  }
  
  .glass-row {
    background-color: transparent !important;
  }
  .glass-row:hover {
    background-color: rgba(255, 255, 255, 0.4) !important;
  }
  .public-report-shell.theme-dark .glass-row:hover {
    background-color: rgba(51, 65, 85, 0.4) !important;
  }

  .glass-details {
    background-color: rgba(248, 250, 252, 0.4) !important;
  }
  .public-report-shell.theme-dark .glass-details {
    background-color: rgba(15, 23, 42, 0.3) !important;
  }

  .public-report-shell.theme-dark .bg-white {
    background-color: rgba(15, 23, 42, 0.88) !important;
  }
  .public-report-shell.theme-dark .bg-slate-50,
  .public-report-shell.theme-dark .bg-slate-50\\/80,
  .public-report-shell.theme-dark .bg-slate-50\\/50,
  .public-report-shell.theme-dark .bg-slate-100,
  .public-report-shell.theme-dark .bg-slate-100\\/80 {
    background-color: rgba(30, 41, 59, 0.72) !important;
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
  .public-report-shell.theme-dark .border-slate-200\/60 {
    border-color: rgba(148, 163, 184, 0.26) !important;
  }
  .public-report-shell.theme-dark .reporter-badge {
    background-color: rgba(30, 41, 59, 0.72) !important;
    border-color: rgba(148, 163, 184, 0.35) !important;
    box-shadow: none !important;
  }
  .public-report-shell.theme-dark .reporter-badge-inner {
    background-color: rgba(15, 23, 42, 0.72) !important;
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
  /* Hide scrollbars but keep scrolling */
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .public-report-shell.theme-dark .points-badge {
    background-color: rgba(239, 68, 68, 0.18) !important;
    border-color: rgba(248, 113, 113, 0.38) !important;
    color: #fecaca !important;
  }
  .public-report-shell.theme-dark .reporter-label {
    color: #e2e8f0 !important;
    border-color: rgba(148, 163, 184, 0.45) !important;
  }
  .public-report-shell.theme-dark .admin-shield {
    color: #bfdbfe !important;
  }
`;

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

// --- SUB-COMPONENT: VIOLATION ROW (Clean & Intuitive) ---
const ViolationRow = ({
  violation,
  onOpenEvidence
}: {
  violation: any,
  onOpenEvidence: (v: any, url: string) => void
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const violationTimestamp = (() => {
    const t = violation?.violationDate ? new Date(violation.violationDate).getTime() : NaN;
    if (!Number.isFinite(t)) return typeof violation?._creationTime === "number" ? violation._creationTime : null;
    return t;
  })();

  // Kiểm tra dữ liệu
  const hasDetails = violation.details && violation.details.trim() !== '';
  const hasEvidence = violation.evidenceUrls && violation.evidenceUrls.length > 0;

  // Lấy thông tin người báo cáo (nếu có quyền xem hoặc data có trả về)
  const reporterName = (violation as any).requesterName || violation.reporterName;
  const isImportedFromAbsenceRequest = Boolean((violation as any).requesterName);
  const reporterIsSuperUser = (violation as any).reporterIsSuperUser || false;
  const reporterCustomization = (violation as any).reporterCustomization || null;
  const isCustomReporter = Boolean(violation.customReporterName);

  return (
    <div className="glass-row transition-colors w-full">
      {/* TẦNG 1: OVERVIEW - Click để mở/đóng */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 overflow-hidden">
          {/* Badge Lớp & Điểm */}
          <div className="flex flex-col items-center justify-center gap-1 min-w-[2.5rem]">
            <span className="font-bold text-slate-700 text-xs sm:text-sm">{violation.violatingClass}</span>
            <span className="points-badge inline-flex items-center justify-center min-w-[1.5rem] h-4 sm:h-5 bg-red-50 text-red-600 border border-red-100 font-bold rounded-md text-[10px] px-1">
              -{violation.points}
            </span>
          </div>

          {/* Thông tin chính */}
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
              {displayStudentHeading(violation)}
            </span>
            <span className="text-xs text-slate-500 truncate pr-2">
              {violation.violationType}
            </span>
          </div>

          {/* Hiện người báo cáo */}
          {reporterName && (
            // Dùng flex-shrink-0 để badge không bị bóp méo, nhưng ml-auto để đẩy nó sang phải
            <div className="flex items-center ml-auto pl-2">
              {isImportedFromAbsenceRequest ? (
                <div className="reporter-badge relative inline-flex overflow-hidden rounded-lg sm:rounded-full p-[0.5px] group shadow-sm flex-shrink-0 cursor-default border border-emerald-200">
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="reporter-badge-inner relative flex items-center bg-white rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5 h-full w-full backface-hidden">
                    <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-emerald-700 uppercase leading-tight sm:leading-none 
                           sm:border-r sm:border-emerald-100 sm:pr-1.5 sm:py-0.5
                           border-b border-emerald-50 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                        Nhập từ trang xin nghỉ
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isCustomReporter ? (
                <div className="reporter-badge relative inline-flex rounded-lg sm:rounded-full flex-shrink-0 cursor-default border border-amber-200/70 bg-amber-50/60 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="relative flex items-center rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-amber-600 uppercase leading-tight sm:leading-none 
                           sm:border-r sm:border-amber-200 sm:pr-1.5 sm:py-0.5
                           border-b border-amber-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                        Nguồn
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : reporterIsSuperUser ? (
                <div className="reporter-badge relative inline-flex rounded-lg sm:rounded-full flex-shrink-0 cursor-default border border-slate-200 bg-slate-50/80 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.05),0_0_0_1px_rgba(226,232,240,0.9)]">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 opacity-[0.07] saturate-150 animate-[gradient-xy_1s_linear_infinite] bg-[linear-gradient(90deg,rgba(99,102,241,0.90),rgba(236,72,153,0.80),rgba(245,158,11,0.75),rgba(34,197,94,0.72),rgba(14,165,233,0.80),rgba(99,102,241,0.90))] [background-size:320%_320%]"
                  />
                  <div className="relative flex items-center rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5">
                    <ShieldCheck
                      className="admin-shield w-3.5 h-3.5 text-indigo-700 shrink-0 [filter:drop-shadow(0_0_0.5px_rgba(236,72,153,0.35))_drop-shadow(0_0_0.5px_rgba(14,165,233,0.30))]"
                      strokeWidth={2.5}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-slate-700 uppercase leading-tight sm:leading-none 
                           sm:border-r sm:border-slate-200 sm:pr-1.5 sm:py-0.5
                           border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                        Admin nhập
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : reporterCustomization ? (
                <div className={`reporter-badge relative inline-flex rounded-lg sm:rounded-full flex-shrink-0 cursor-default overflow-hidden border border-${reporterCustomization.colorFrom} bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]`}>
                  <div className="relative flex items-center rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5">
                    {reporterCustomization.icon && (
                      <span className={`text-${reporterCustomization.colorFrom} text-sm leading-none shrink-0`}>
                        {reporterCustomization.icon}
                      </span>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className={`reporter-label text-[8px] sm:text-[9px] font-extrabold tracking-wider text-${reporterCustomization.colorFrom} uppercase leading-tight sm:leading-none 
                           sm:border-r sm:border-${reporterCustomization.colorFrom} sm:pr-1.5 sm:py-0.5
                           border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit`}>
                        {reporterCustomization.label || 'Nhập bởi'}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="reporter-badge relative inline-flex rounded-lg sm:rounded-full flex-shrink-0 cursor-default border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.05),0_0_0_1px_rgba(226,232,240,0.9)]">
                  <div className="relative flex items-center rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className="reporter-label text-[8px] sm:text-[9px] font-extrabold tracking-wider text-slate-500 uppercase leading-tight sm:leading-none 
                           sm:border-r sm:border-slate-200 sm:pr-1.5 sm:py-0.5
                           border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                        Nhập bởi
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                        {reporterName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nút Toggle Icon */}
        <div className="text-slate-400 pl-2 flex-shrink-0">
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* TẦNG 2: DETAILS - Expandable Area */}
      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
        <div className="glass-details p-3 sm:p-4 text-sm space-y-3 border-t border-slate-100/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
          {/* Ngày vi phạm */}
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

          {/* Chi tiết lỗi */}
          <div className="flex gap-3">
            <div className="mt-0.5 min-w-[20px]"><FileWarning className="w-4 h-4 text-slate-400" /></div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết vi phạm</span>
              <p className="text-slate-700 mt-0.5 leading-relaxed">
                {hasDetails ? violation.details : "Không có mô tả chi tiết."}
              </p>
            </div>
          </div>

          {/* Người báo cáo (Chỉ hiện ở details nếu chưa hiện ở overview) */}
          {reporterName && (
            <div className="flex gap-3">
              <div className="mt-0.5 min-w-[20px]"><User className="w-4 h-4 text-slate-400" /></div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người báo cáo</span>
                <p className="text-slate-700 mt-0.5 font-medium">
                  {reporterName}
                </p>
              </div>
            </div>
          )}

          {/* Khu vực Bằng chứng */}
          <div className="flex gap-3 pt-1">
            <div className="mt-1.5 min-w-[20px]"><Eye className="w-4 h-4 text-slate-400" /></div>
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Bằng chứng</span>
              {hasEvidence ? (
                <div className="flex flex-wrap gap-2">
                  {violation.evidenceUrls.map((url: string, i: number) => {
                    if (!url) return null;
                    return (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation(); // Ngăn click lan ra ngoài làm đóng accordion
                          onOpenEvidence(violation, url);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm transition-all text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem bằng chứng {i + 1}</span>
                      </button>
                    )
                  })}
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

// --- MAIN COMPONENT ---
const PublicViolationReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Tab state - check URL for initial tab
  const [activeTab, setActiveTab] = useState<'violations' | 'scores' | 'classSummary'>(() => {
    if (location.pathname === '/bang-diem-thi-dua-tho') {
      return 'scores';
    }
    return 'violations';
  });

  // Component State
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState('1');

  // Class Selection State (from localStorage)
  const [selectedClass, setSelectedClass] = useState<string | null>(() => {
    return localStorage.getItem('selectedClassSummary') || null;
  });
  const [isClassSelectorOpen, setIsClassSelectorOpen] = useState(false);

  const [weekError, setWeekError] = useState<string | null>(null);

  const [expandedDays, setExpandedDays] = useState<{ [key: number]: boolean }>({});
  // Đã xóa state expandedDetails vì ViolationRow tự xử lý
  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [hideExcusedAbsence, setHideExcusedAbsence] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    return localStorage.getItem('violationReportUnderstood_v2') === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [modalState, setModalState] = useState<'welcome' | 'mustAgree'>('welcome');

  // Modal State
  const [modalMedia, setModalMedia] = useState<ModalMedia | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [startInteraction, setStartInteraction] = useState({ x: 0, y: 0 });
  const initialPinchDistance = useRef(0);

  // Convex Hooks
  const baseDateStr = useQuery(api.users.getSetting, { key: 'weekBaseDate' });
  const breakStartDateStr = useQuery(api.users.getSetting, { key: 'holidayBreakStartDate' });
  const breakEndDateStr = useQuery(api.users.getSetting, { key: 'holidayBreakEndDate' });
  const violations = useQuery(
    api.violations.getPublicViolations,
    (dateRange && hasAcknowledged) ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const emulationScores = useQuery(
    api.violations.getPublicEmulationScores,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );

  const classViolations = useQuery(
    api.violations.getViolationsByClass,
    (activeTab === 'classSummary' && selectedClass) ? { className: selectedClass } : "skip"
  );

  // Memoized Calculations
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

  // Tuần hiện tại (độc lập với tuần đang chọn ở tab chính)
  const currentWeekNumber = useMemo(() => {
    if (!baseDateStr) return 1;
    const base = new Date(baseDateStr);
    const now = new Date();
    const rawWeek = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
    return toAcademicWeek(rawWeek, breakWindow);
  }, [baseDateStr, breakWindow]);

  // Group Class Violations by Week
  const classViolationsByWeek = useMemo(() => {
    if (!classViolations || !baseDateStr) return [];

    const base = new Date(baseDateStr);
    const grouped = new Map<number, any[]>();

    classViolations.forEach((v: any) => {
      // Filter excused absence if enabled
      if (hideExcusedAbsence && v.violationType === "Nghỉ học có phép") return;

      const vDate = new Date(v.violationDate);
      // Calculate week number relative to base date
      // Week 1 starts at base date
      const diffTime = vDate.getTime() - base.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Assuming base date is Monday of Week 1
      // If vDate is before base, it's week 0 or negative?
      // Let's assume valid weeks are >= 1
      const rawWeek = Math.floor(diffDays / 7) + 1;
      const w = toAcademicWeek(rawWeek, breakWindow);

      if (!grouped.has(w)) grouped.set(w, []);
      grouped.get(w)!.push(v);
    });
    // Sort theo ngày vi phạm trong từng tuần (tránh lệch do nhập bù)
    for (const [, rows] of grouped) {
      rows.sort((a: any, b: any) => {
        const at = a?.violationDate ? new Date(a.violationDate).getTime() : (typeof a?._creationTime === "number" ? a._creationTime : 0);
        const bt = b?.violationDate ? new Date(b.violationDate).getTime() : (typeof b?._creationTime === "number" ? b._creationTime : 0);
        return at - bt;
      });
    }

    // We want to show all weeks from Current Week down to 1
    const weeks: { week: number, violations: any[] }[] = [];
    for (let i = currentWeekNumber; i >= 1; i--) {
      weeks.push({
        week: i,
        violations: grouped.get(i) || []
      });
    }
    return weeks;
  }, [classViolations, baseDateStr, currentWeekNumber, hideExcusedAbsence, breakWindow]);

  // Side Effects
  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const now = new Date();
      const rawWeek = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      const academicWeek = toAcademicWeek(rawWeek, breakWindow);
      setWeekNumber(academicWeek);
      setWeekInput(academicWeek.toString());
    }
  }, [baseDateStr, breakWindow]);

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

  // Helper Functions
  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  };

  // Event Handlers
  const handleOpenModal = (violation: any, url: string) => {
    resetTransform();
    setIsMediaLoading(true);
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const extension = url.split('.').pop()?.toLowerCase() || '';

    let type: 'image' | 'video' | null = null;
    if (videoExtensions.includes(extension)) type = 'video';
    else if (imageExtensions.includes(extension)) type = 'image';
    else { window.open(url, '_blank'); return; }

    setModalMedia({
      url, type,
      violationInfo: {
        student: displayStudentHeading(violation),
        class: violation.violatingClass,
        details: violation.details ? `${violation.violationType}: ${violation.details}` : violation.violationType
      }
    });
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setTimeout(() => setModalMedia(null), 300);
  };



  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWeekInput(val);
    if (val.trim() === '') { setWeekError('Tuần không được để trống'); return; }
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) { setWeekError('Tuần phải là một số dương hợp lệ'); }
    else { setWeekError(null); setWeekNumber(num); }
  };

  const handleClassSelect = (cls: string) => {
    setSelectedClass(cls);
    localStorage.setItem('selectedClassSummary', cls);
    setIsClassSelectorOpen(false);
  };

  const toggleDay = (day: number) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  // Handle tab changes and URL updates
  const handleTabChange = (tab: 'violations' | 'scores' | 'classSummary') => {
    setActiveTab(tab);
    if (tab === 'scores') {
      navigate('/bang-diem-thi-dua-tho', { replace: true });
    } else if (tab === 'violations') {
      navigate('/bang-bao-cao-vi-pham', { replace: true });
    }
  };

  // Handle URL changes from external navigation
  useEffect(() => {
    if (location.pathname === '/bang-diem-thi-dua-tho') {
      setActiveTab('scores');
    } else if (location.pathname === '/bang-bao-cao-vi-pham' && activeTab === 'scores') {
      setActiveTab('violations');
    }
  }, [location.pathname]);

  const handleUnderstood = () => {
    if (dontShowAgain) {
      localStorage.setItem('violationReportUnderstood_v2', 'true');
    }
    setHasAcknowledged(true);
    setShowWelcomeModal(false);
  };

  const handleClose = () => {
    setModalState('mustAgree');
  };

  useEffect(() => {
    if (hasAcknowledged) {
      setShowWelcomeModal(false);
    }
  }, [hasAcknowledged]);

  // --- Zoom & Pan Handlers ---
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

  return (
    <div className={`public-report-shell ${isDarkMode ? "theme-dark" : "theme-light"} min-h-screen pb-10 relative`}>
      <style>{premiumStyles}</style>
      {/* Fixed animated background — does NOT scroll with content */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden aurora-bg-layer">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50" />
        {/* Blob 1 — top-left, blue */}
        <div className="aurora-blob-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-400/25 blur-[80px]" />
        {/* Blob 2 — top-right, indigo */}
        <div className="aurora-blob-2 absolute -top-20 right-0 h-[420px] w-[420px] rounded-full bg-indigo-400/20 blur-[70px]" />
        {/* Blob 3 — center-left, cyan */}
        <div className="aurora-blob-3 absolute top-1/3 -left-24 h-[380px] w-[380px] rounded-full bg-cyan-400/22 blur-[90px]" />
        {/* Blob 4 — bottom-right, violet */}
        <div className="aurora-blob-4 absolute bottom-0 right-0 h-[480px] w-[480px] rounded-full bg-violet-400/18 blur-[80px]" />
        {/* Blob 5 — bottom-center, teal */}
        <div className="aurora-blob-5 absolute bottom-1/4 left-1/3 h-[360px] w-[360px] rounded-full bg-teal-400/20 blur-[100px]" />
      </div>
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-slate-900 border border-slate-700/80" : "bg-white"} rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-300`}>
            {modalState === 'welcome' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-blue-500/20" : "bg-blue-100"}`}>
                    <AlertCircle className={`w-6 h-6 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Bạn ơiiii!</h2>
                </div>
                <div className={`space-y-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <p className={`font-medium ${isDarkMode ? "text-blue-300" : "text-blue-800"}`}>Web đã cập nhật thêm nhiều tính năng mới:</p>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
                        <FileText className={`w-4 h-4 ${isDarkMode ? "text-indigo-300" : "text-indigo-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Tab Vi phạm (Mặc định)</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Xem vi phạm theo từng ngày trong tuần. Bấm vào mỗi dòng để xem chi tiết & bằng chứng.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-emerald-500/20" : "bg-emerald-50"}`}>
                        <Users className={`w-4 h-4 ${isDarkMode ? "text-emerald-300" : "text-emerald-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Tab Tổng hợp theo lớp</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Chọn lớp của bạn để xem tất cả vi phạm từ đầu năm đến nay, được gom nhóm theo từng tuần.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-amber-500/20" : "bg-amber-50"}`}>
                        <Trophy className={`w-4 h-4 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Tab Bảng điểm</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Theo dõi điểm thi đua thô của tất cả các lớp trong tuần hiện tại.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-green-500/20" : "bg-green-50"}`}>
                        <Eye className={`w-4 h-4 ${isDarkMode ? "text-green-300" : "text-green-600"}`} />
                      </div>
                      <div>
                        <p className={`font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Ẩn/Hiện nghỉ có phép</p>
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Sử dụng nút ở góc dưới bên phải để lọc nhanh các vi phạm không cần thiết.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-lg p-3 mt-4 ${isDarkMode ? "bg-blue-500/10 border border-blue-400/30" : "bg-blue-50 border border-blue-200"}`}>
                    <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-blue-200" : "text-blue-800"}`}>
                      <strong>Lưu ý:</strong> Hệ thống sẽ tự động ghi nhớ lớp bạn đã chọn ở tab "Tổng hợp theo lớp" cho lần truy cập sau!
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
                    Toi dong tinh
                  </button>
                  <button
                    onClick={handleClose}
                    className={`px-4 py-2.5 font-medium transition-colors ${isDarkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-800"}`}
                  >
                    Từ chối
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-amber-500/20" : "bg-amber-100"}`}>
                    <AlertCircle className={`w-6 h-6 ${isDarkMode ? "text-amber-300" : "text-amber-600"}`} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Ê ủa?</h2>
                </div>
                <div className={`space-y-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <p className="font-medium">Bạn phải dong tinh thì mới xem được nội dung web này.</p>
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
                  Toi that su dong tinh
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {modalMedia && (
        <div
          className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-0 transition-opacity duration-300 ease-in-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={modalMedia.type === 'image' ? handleMouseMove : undefined}
          onMouseUp={modalMedia.type === 'image' ? handleInteractionEnd : undefined}
          onMouseLeave={modalMedia.type === 'image' ? handleInteractionEnd : undefined}
        >
          {/* Static UI Overlay */}
          <button onClick={handleCloseModal} className="absolute top-2 right-2 z-50 text-white flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-white/20 transition-colors" aria-label="Đóng"><X className="w-6 h-6" /></button>

          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[95%] md:max-w-xl bg-black/60 backdrop-blur-sm text-white rounded-lg text-sm transition-all duration-300 ease-in-out z-50 overflow-hidden ${!isMediaLoading ? 'opacity-100' : 'opacity-0'}`}>
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

          {/* Media Container */}
          <div className={`transform-gpu transition-all duration-300 ease-in-out max-w-full max-h-full w-full h-full flex items-center justify-center relative ${isModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {isMediaLoading && (
              <div className="absolute">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-200/50 rounded-full animate-pulse"></div>
              </div>
            )}

            <div className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ease-in-out ${isMediaLoading ? 'opacity-0' : 'opacity-100'}`}>
              {modalMedia.type === 'image' ? (
                <div
                  className="w-full h-full"
                  style={{ touchAction: 'none', cursor: isInteracting ? 'grabbing' : 'grab' }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={resetTransform}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleInteractionEnd}
                >
                  <div
                    className="w-full h-full"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                  >
                    <img
                      src={modalMedia.url}
                      alt="Bằng chứng"
                      className="w-full h-full object-contain"
                      onLoad={() => setIsMediaLoading(false)}
                    />
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
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Chọn lớp của bạn
              </h3>
              <button onClick={() => setIsClassSelectorOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {[10, 11, 12].map(grade => (
                <div key={grade} className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-full h-px bg-slate-200"></span>
                    <span className="whitespace-nowrap">Khối {grade}</span>
                    <span className="w-full h-px bg-slate-200"></span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {Array.from({ length: 8 }, (_, i) => `${grade}A${i + 1}`).map(cls => (
                      <button
                        key={cls}
                        onClick={() => handleClassSelect(cls)}
                        className={`px-2 py-2 text-sm font-medium rounded-lg transition-all ${selectedClass === cls
                          ? 'bg-emerald-600 text-white shadow-md scale-105'
                          : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm border border-slate-200'
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

      {/* Sticky Header (title row + tab row only) */}
      <div className={`glass-header border-b ${isDarkMode ? "border-slate-700/50" : "border-slate-200"} shadow-sm sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto">
          {/* Header Row: Title + Week/Class Selector */}
          <div className={`px-3 sm:px-4 py-2 border-b ${isDarkMode ? "border-slate-700/50" : "border-slate-100"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="flex items-center justify-center gap-2">
                <div
                  className={`rounded-full p-1.5 shadow-sm ${isDarkMode ? "bg-slate-100/65" : "bg-white"
                    }`}
                >
                  <img
                    src="https://www.dropbox.com/scl/fi/qhdckf1zj8svntuz93gcq/csdl512.png?rlkey=ms93xygjfp7mzk727hij811po&st=lt8k0y9x&raw=1"
                    alt="logo"
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-full"
                  />
                </div>
                <h1 className="text-sm sm:text-base font-bold text-slate-800 text-center">
                  CSDL Cờ đỏ THPTS2BT
                </h1>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border shadow-sm hover:shadow-md transition-all ${isDarkMode
                    ? "bg-slate-800 border-slate-600 text-amber-300"
                    : "bg-white border-slate-200 text-indigo-600"
                    }`}
                  title={isDarkMode ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>

                {activeTab === 'classSummary' ? (
                  <button
                    onClick={() => setIsClassSelectorOpen(true)}
                    className="flex items-center gap-1.5 sm:gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md hover:text-emerald-700 transition-all group"
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
                  <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border flex-shrink-0 ${isDarkMode ? "bg-slate-800/70 border-slate-600/80" : "bg-slate-50 border-slate-200"
                    }`}>
                    <Calendar className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`} />
                    <div className="flex items-center gap-1.5">
                      <label className={`text-xs sm:text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Tuần:</label>
                      <input
                        type="text"
                        value={weekInput}
                        onChange={handleWeekChange}
                        className={`border px-1.5 sm:px-2 py-0.5 sm:py-1 w-10 sm:w-16 text-center text-xs sm:text-sm rounded font-medium ${weekError
                          ? (isDarkMode ? "border-red-500/80 bg-red-500/15 text-red-200" : "border-red-400 bg-red-50")
                          : (isDarkMode ? "border-slate-500 bg-slate-900/70 text-slate-100" : "border-slate-300")
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

          {/* Tab Selector Row */}
          <div className="px-3 sm:px-4 py-0">
            {/* Tab buttons: centered on mobile, left-aligned on desktop */}
            <div className={`flex items-end justify-center sm:justify-start border-b-2 ${isDarkMode ? "border-slate-700/50" : "border-slate-200"}`}>
              <button
                onClick={() => handleTabChange('violations')}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === 'violations'
                  ? (isDarkMode ? 'text-indigo-300 border-indigo-300' : 'text-indigo-600 border-indigo-600')
                  : 'border-transparent ' + (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Vi phạm</span>
                </span>
              </button>
              <button
                onClick={() => handleTabChange('scores')}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === 'scores'
                  ? (isDarkMode ? 'text-amber-300 border-amber-300' : 'text-amber-600 border-amber-600')
                  : 'border-transparent ' + (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Bảng điểm</span>
                </span>
              </button>
              <button
                onClick={() => handleTabChange('classSummary')}
                className={`relative px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${activeTab === 'classSummary'
                  ? (isDarkMode ? 'text-emerald-300 border-emerald-300' : 'text-emerald-600 border-emerald-600')
                  : 'border-transparent ' + (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
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

      {/* Disclaimer & Actions — NOT sticky */}
      <div className={`glass-header border-b ${isDarkMode ? "border-slate-700/50" : "border-slate-100"}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed flex-1 min-w-[200px]">
            {activeTab === 'violations' ? (
              <>
                Dữ liệu vi phạm được cập nhật bởi các thành viên đội cờ đỏ. Nếu phát hiện sai sót, hãy báo lại thành viên đội hoặc Admin nhé!
              </>
            ) : activeTab === 'scores' ? (
              <>
                Bảng điểm thi đua thô được tính toán dựa trên dữ liệu vi phạm, chưa bao gồm điểm giờ học, điểm thưởng.
              </>
            ) : (
              <>
                Tổng hợp tất cả vi phạm của lớp {selectedClass} từ đầu năm học đến nay, sắp xếp theo tuần mới nhất.
              </>
            )}
          </p>

          {/* Show/Hide toggle for violation-related tabs */}
          {(activeTab === 'violations' || activeTab === 'classSummary') && (
            <button
              onClick={() => setHideExcusedAbsence(!hideExcusedAbsence)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-[10px] sm:text-xs font-medium whitespace-nowrap flex-shrink-0 ${hideExcusedAbsence
                ? (isDarkMode
                  ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/50'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200')
                : (isDarkMode
                  ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-600/70 border border-slate-500/70'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                }`}
              title={hideExcusedAbsence ? 'Đang ẩn nghỉ có phép' : 'Đang hiện nghỉ có phép'}
            >
              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{hideExcusedAbsence ? 'Ẩn nghỉ CP' : 'Hiện tất cả'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        {activeTab === 'violations' ? (
          // Violations Content
          <>
            {violations === undefined && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-200 rounded-full animate-pulse"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-slate-700">Đang tải dữ liệu...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            )}
            {violations && violations.length === 0 && (
              <div className="glass-card rounded-lg shadow-sm !p-8 text-center mt-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Không có vi phạm</p>
                <p className="text-sm text-slate-500">Không có vi phạm nào trong tuần này</p>
              </div>
            )}

            {/* Daily Lists */}
            <div className="space-y-4 mt-2">
              {sortedDays.map(dayTimestamp => {
                const allDayViolations = violationsByDay.get(dayTimestamp)!;
                const dayViolations = hideExcusedAbsence
                  ? allDayViolations.filter((v: { violationType: string; }) => v.violationType !== "Nghỉ học có phép")
                  : allDayViolations;
                const isExpanded = expandedDays[dayTimestamp] !== false;

                // Case: Ẩn nghỉ có phép và chỉ còn nghỉ có phép
                if (hideExcusedAbsence && dayViolations.length === 0) {
                  const excusedAbsenceCount = allDayViolations.filter((v: { violationType: string; }) => v.violationType === "Nghỉ học có phép").length;
                  if (excusedAbsenceCount === 0) return null;

                  return (
                    <div key={dayTimestamp} className="w-full glass-card text-slate-500 !px-4 !py-3 rounded-xl flex items-center justify-between border border-slate-200">
                      <span className="font-semibold text-sm">{format(new Date(dayTimestamp), "iiii, dd/MM", { locale: vi })}</span>
                      <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200">Chỉ có {excusedAbsenceCount} nghỉ CP</span>
                    </div>
                  );
                }

                // Nếu không có vi phạm nào sau khi filter thì skip
                if (dayViolations.length === 0) return null;

                return (
                  <div key={dayTimestamp} className="glass-card !p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
                    {/* Header Ngày */}
                    <button
                      onClick={() => toggleDay(dayTimestamp)}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${isExpanded
                        ? 'glass-day-expanded text-white'
                        : 'glass-row text-slate-800'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm sm:text-base capitalize">
                          {format(new Date(dayTimestamp), "iiii", { locale: vi })}
                        </span>
                        <span className={`text-xs sm:text-sm font-medium px-2 py-0.5 rounded-full ${isExpanded ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {format(new Date(dayTimestamp), "dd/MM")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${isExpanded ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                          {dayViolations.length} vi phạm
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Body Ngày */}
                    {isExpanded && (
                      <div className="border-t border-slate-200/50">
                        <div className="divide-y divide-slate-200/50">
                          {dayViolations.map((v: any) => (
                            <ViolationRow
                              key={v._id}
                              violation={v}
                              onOpenEvidence={handleOpenModal}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : activeTab === 'scores' ? (
          // Emulation Scores Content
          <>
            {emulationScores === undefined && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 border-4 border-amber-200 rounded-full animate-pulse"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-slate-700">Đang tải dữ liệu...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            )}

            {emulationScores && emulationScores.length === 0 && (
              <div className="glass-card rounded-lg shadow-sm !p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <Award className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Chưa có dữ liệu</p>
                <p className="text-sm text-slate-500">Chưa có điểm thi đua cho tuần này</p>
              </div>
            )}

            {emulationScores && emulationScores.length > 0 && (
              <div className="glass-card !p-0 rounded-lg shadow-sm overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className={`${isDarkMode ? "bg-slate-800/80 border-b border-slate-600/80" : "bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-200"}`}>
                        <th className={`px-2 py-3 text-center font-semibold w-20 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Lớp</th>
                        <th className={`px-2 py-3 text-center font-semibold w-24 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Điểm trừ</th>
                        <th className={`px-2 py-3 text-center font-semibold w-24 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Tổng điểm</th>
                        <th className={`px-2 py-3 text-left font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Chi tiết vi phạm</th>
                      </tr>
                    </thead>
                    <tbody className={`${isDarkMode ? "divide-y divide-slate-700/60" : "divide-y divide-slate-100"}`}>
                      {emulationScores.map((score, index) => {
                        return (
                          <tr key={score.className} className="glass-row transition-colors">
                            <td className="px-2 py-3 text-center align-top">
                              <span className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{score.className}</span>
                            </td>
                            <td className="px-2 py-3 text-center align-top">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded font-bold text-sm ${score.totalPoints > 0
                                ? (isDarkMode ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-700')
                                : (isDarkMode ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700')
                                }`}>
                                {score.totalPoints > 0 ? `-${score.totalPoints}` : score.totalPoints}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center align-top">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded font-bold text-sm ${isDarkMode ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                {120 - score.totalPoints}
                              </span>
                            </td>
                            <td className="px-2 py-3 align-top">
                              {score.violations.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {score.violations.map(v => (
                                    <li key={v._id} className="flex items-start gap-2">
                                      <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"} mt-0.5`}>•</span>
                                      <div className="flex-1">
                                        <span className={`font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{v.violationType}</span>
                                        {v.studentName && (
                                          <span className={`${isDarkMode ? "text-slate-300" : "text-slate-600"}`}> ({v.studentName})</span>
                                        )}
                                        {v.details && (
                                          <span className={`${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>: {v.details}</span>
                                        )}
                                        <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"} text-xs ml-2`}>
                                          ({format(new Date(v.violationDate), 'dd/MM')})
                                        </span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-slate-400 italic text-sm">Không có vi phạm</span>
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
          </>
        ) : (
          // Class Summary Content
          <>
            {!selectedClass ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce">
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-slate-800">Chưa chọn lớp</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Vui lòng chọn một lớp để xem tổng hợp vi phạm.
                  </p>
                  <button
                    onClick={() => setIsClassSelectorOpen(true)}
                    className="mt-4 px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 transition-colors"
                  >
                    Chọn lớp ngay
                  </button>
                </div>
              </div>
            ) : classViolations === undefined ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-200 rounded-full animate-pulse"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-slate-700">Đang tải dữ liệu lớp {selectedClass}...</p>
                  <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            ) : classViolations && classViolationsByWeek.length === 0 ? (
              <div className="glass-card rounded-lg shadow-sm !p-8 text-center mt-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Chưa có dữ liệu</p>
                <p className="text-sm text-slate-500">Không tìm thấy dữ liệu vi phạm cho lớp này</p>
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                {classViolationsByWeek.map(({ week, violations }) => (
                  <div key={week} className="glass-card !p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
                    <div className={`w-full px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? "border-slate-600/70" : "border-slate-200/50"
                      } glass-row`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm sm:text-base ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>Tuần {week}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${violations.length > 0
                        ? (isDarkMode ? 'bg-red-500/20 text-red-200 border border-red-400/40' : 'bg-red-50 text-red-600 border border-red-100')
                        : (isDarkMode ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                        }`}>
                        {violations.length > 0 ? `${violations.length} vi phạm` : 'Không có vi phạm'}
                      </span>
                    </div>

                    {violations.length > 0 ? (
                      <div className={`${isDarkMode ? "divide-y divide-slate-700/60" : "divide-y divide-slate-200/50"}`}>
                        {violations.map((v: any) => (
                          <ViolationRow
                            key={v._id}
                            violation={v}
                            onOpenEvidence={handleOpenModal}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className={`p-4 text-center text-sm italic ${isDarkMode ? "text-slate-300 glass-row" : "text-slate-500 glass-row"
                        }`}>
                        Tuần này lớp ngoan, không có vi phạm nào! 🎉
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