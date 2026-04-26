import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Doc } from "../convex/_generated/dataModel";
import ViolationList from "./ViolationList";
import EmulationScoreTable from "./EmulationScoreTable";
import { useEffect, useMemo, useState } from "react";
import { startOfWeek, startOfDay, endOfDay, toDate, differenceInCalendarWeeks, parseISO, format, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { normalizeClassName, isValidClassName, triggerFileDownload } from "./lib/utils";
import { BarChart, AlertTriangle, Trophy, Users, CheckCircle, Settings, Clock, School, GraduationCap, UserCheck, Clipboard, Download, Trash2, Upload, X } from 'lucide-react';
import { AIViolationInputModal } from "./AIViolationInputModal";
import ViolationReportForm from "./ViolationReportForm";

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getWeekStartAndEnd() {
    const now = new Date();
    const zonedNow = toZonedTime(now, TIME_ZONE);
    const start = startOfWeek(zonedNow, { weekStartsOn: 1 }); // Monday
    const end = endOfDay(zonedNow);
    return { start: start.getTime(), end: end.getTime() };
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

export default function AdminDashboard() {
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: number, end: number }>(getWeekStartAndEnd());
  const [customDateRange, setCustomDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
  const [filterMode, setFilterMode] = useState<'month' | 'week' | 'custom'>('week');
  const [monthInput, setMonthInput] = useState<string>('');
  const [weekBaseDate, setWeekBaseDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [holidayBreakStartDate, setHolidayBreakStartDate] = useState<string>("");
  const [holidayBreakEndDate, setHolidayBreakEndDate] = useState<string>("");
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [weekInput, setWeekInput] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<'actions' | 'overview' | 'violations' | 'emulation' | 'roster' | 'systemUsers' | 'settings' >('actions');
  // Better Auth users state for systemUsers tab
  const [betterAuthUsers, setBetterAuthUsers] = useState<Array<any> | null>(null);
  const [betterAuthUsersLoading, setBetterAuthUsersLoading] = useState(false);
  // Password reset state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  // Bulk create state
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{ username: string; password: string }>>([
    { username: "", password: "" },
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    created: number;
    failed: number;
    results: Array<{ username: string; status: "created" | "duplicate" | "failed"; reason?: string }>;
  } | null>(null);
  const [showAutoMigrateModal, setShowAutoMigrateModal] = useState(false);
  const [autoMigrateStep, setAutoMigrateStep] = useState<'preview' | 'processing' | 'result'>('preview');
  const [autoMigrateData, setAutoMigrateData] = useState<any | null>(null);
  const savedWeekBase = useQuery(api.users.getSetting, { key: 'weekBaseDate' });
  const savedBreakStart = useQuery(api.users.getSetting, { key: 'holidayBreakStartDate' });
  const savedBreakEnd = useQuery(api.users.getSetting, { key: 'holidayBreakEndDate' });
  const savedAiModel = useQuery(api.users.getSetting, { key: 'aiModel' });
  const savedAiModels = useQuery(api.users.getSetting, { key: 'aiModels' });
  const savedGeminiModels = useQuery(api.users.getSetting, { key: 'geminiModels' });
  const savedOpenRouterModels = useQuery(api.users.getSetting, { key: 'openrouterModels' });
  const saveSetting = useMutation(api.users.setSetting);
  const exportRosterTemplate = useAction(api.adminTools.exportRosterTemplate);
  const importRoster = useAction(api.adminTools.importRoster);
  const setupPublicAbsenceSystemUser = useAction(api.adminTools.setupPublicAbsenceSystemUser);
  const getBetterAuthUsersAction = useAction(api.adminTools.getBetterAuthUsers);
  const setUserPasswordAction = useAction(api.adminTools.setUserPassword);
  const bulkCreateUsersAction = useAction(api.adminTools.bulkCreateUsers);
  const migrateProfilesToBetterAuthAction = useAction(api.adminTools.migrateProfilesToBetterAuth);

  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const deleteUserProfile = useMutation(api.users.deleteUserProfile);
  const migrateUserDataAndDeleteProfile = useMutation(api.users.migrateUserDataAndDeleteProfile);
  const reassignAuthAccountMutation = useMutation(api.users.reassignAuthAccount);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const roster = useQuery(api.users.listRoster);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedRosterClass, setSelectedRosterClass] = useState<string>("");
  const [showSingleReportForm, setShowSingleReportForm] = useState(false);
  const [overviewDate, setOverviewDate] = useState(() => format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy'));
  const [aiModelsDraft, setAiModelsDraft] = useState<string>("");
  const [geminiModelsDraft, setGeminiModelsDraft] = useState<string>("");
  const [openRouterModelsDraft, setOpenRouterModelsDraft] = useState<string>("");
  const [aiModelsSaving, setAiModelsSaving] = useState<boolean>(false);
  const [aiModelsSavedAt, setAiModelsSavedAt] = useState<number | null>(null);
  const [migrateFromProfileId, setMigrateFromProfileId] = useState<string>("");
  const [migrateToProfileId, setMigrateToProfileId] = useState<string>("");
  // Reassign auth account state
  const [reassignSourceBaId, setReassignSourceBaId] = useState<string>("");
  const [reassignTargetProfileId, setReassignTargetProfileId] = useState<string>("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignConflict, setReassignConflict] = useState<{
    existingProfileName: string;
    existingProfileId: string;
  } | null>(null);
  const navButtonClass = (active: boolean) =>
    `shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
      active
        ? "bg-indigo-900/80 text-white shadow-md"
        : "text-slate-700 hover:bg-white/40 hover:text-slate-900"
    }`;
  const sideNavButtonClass = (active: boolean) =>
    `w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
      active
        ? "bg-indigo-900/80 text-white shadow-md"
        : "text-slate-700 hover:bg-white/40 hover:text-slate-900"
    }`;
  const panelClass = "rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-4 md:p-5";
  const primaryButtonClass =
    "inline-flex items-center justify-center rounded-lg bg-indigo-900/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClass =
    "inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white";

  const formatDateDDMMYYYY = (iso: string) => {
    try {
      const d = toZonedTime(new Date(iso), TIME_ZONE);
      return format(d, 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const filters = {
      grade: gradeFilter ? parseInt(gradeFilter) : undefined,
      className: classFilter || undefined,
      targetType: (targetTypeFilter || undefined) as "student" | "class" | undefined,
      dateRange: dateRange,
  };

  const pendingUsers = useQuery(api.users.getPendingUsers);
  const allUserProfiles = useQuery(api.users.getAllUserProfiles);
  // Fetch Convex users bridging Better Auth IDs to Convex user IDs
  // betterAuthUsers is the raw array of BA user objects (already extracted from result.users)
  const betterAuthUserIds = betterAuthUsers
    ? (betterAuthUsers as Array<any>).map((u: any) => u.id ?? u._id).filter(Boolean) as string[]
    : [];
  const convexUsersByBetterAuthId = useQuery(
    api.users.getUsersByBetterAuthIds,
    betterAuthUsers !== null && betterAuthUserIds.length > 0 ? { betterAuthIds: betterAuthUserIds } : "skip"
  );
  const allViolations = useQuery(api.violations.getAllViolationsForAdmin, filters);
  const appealedViolations = useQuery(api.violations.getAppealedViolations, {}) ?? [];
  // Overview: selected date range
  const _parsedOverview = parseDDMMYYYY(overviewDate);
  const _overviewStart = _parsedOverview ? startOfDay(toZonedTime(_parsedOverview, TIME_ZONE)).getTime() : startOfDay(toZonedTime(new Date(), TIME_ZONE)).getTime();
  const _overviewEnd = _parsedOverview ? endOfDay(toZonedTime(_parsedOverview, TIME_ZONE)).getTime() : endOfDay(toZonedTime(new Date(), TIME_ZONE)).getTime();
  const overviewViolations = useQuery(api.violations.getAdminOverviewViolations, { dateRange: { start: _overviewStart, end: _overviewEnd } });
  // TODO: if needed, implement pagination UI here while keeping export using full filtered set on server
  const exportViolations = useAction(api.excelExport.exportViolations);

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const startStr = format(toZonedTime(new Date(dateRange.start), TIME_ZONE), 'dd/MM/yyyy');
        const endStr = format(toZonedTime(new Date(dateRange.end), TIME_ZONE), 'dd/MM/yyyy');
        let headerLabel = '';
        let filename = 'vi-pham';
        if (filterMode === 'week') {
          headerLabel = `Tuần ${weekInput} (${startStr} - ${endStr})`;
          filename = `vi-pham-tuan-${weekInput}-${format(new Date(), 'yyyy-MM-dd')}`;
        } else if (filterMode === 'month') {
          const monthStr = format(toZonedTime(new Date(dateRange.start), TIME_ZONE), 'MM/yyyy');
          headerLabel = `Tháng ${monthStr} (${startStr} - ${endStr})`;
          filename = `vi-pham-thang-${format(toZonedTime(new Date(dateRange.start), TIME_ZONE), 'yyyy-MM')}`;
        } else {
          headerLabel = `Khoảng ngày (${startStr} - ${endStr})`;
          filename = `vi-pham-${format(toZonedTime(new Date(dateRange.start), TIME_ZONE), 'yyyy-MM-dd')}-den-${format(toZonedTime(new Date(dateRange.end), TIME_ZONE), 'yyyy-MM-dd')}`;
        }
        const url = await exportViolations({ ...filters, weekLabel: headerLabel } as any);
        if (url) {
            await triggerFileDownload(url, `${filename}.xlsx`);
            toast.success("Đã xuất tệp Excel thành công!");
        } else {
            throw new Error("Không thể tạo URL cho tệp Excel.");
        }
    } catch (error) {
        toast.error((error as Error).message);
    } finally {
        setIsExporting(false);
    }
  };

  function parseDDMMYYYY(value: string) {
    const [dd, mm, yyyy] = value.split('/').map((s) => parseInt(s, 10));
    if (!dd || !mm || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  }

  const handleCustomDateChange = () => {
    if (customDateRange.start && customDateRange.end) {
        const startDate = parseDDMMYYYY(customDateRange.start);
        const endDate = parseDDMMYYYY(customDateRange.end);
        if (!startDate || !endDate) return;
        const start = toZonedTime(startDate, TIME_ZONE).getTime();
        const end = endOfDay(toZonedTime(endDate, TIME_ZONE)).getTime();
        setDateRange({ start, end });
    }
  };

  useEffect(() => {
    handleCustomDateChange();
  }, [customDateRange]);

  useEffect(() => {
    const now = toZonedTime(new Date(), TIME_ZONE);
    const breakWindow = getBreakWindow(weekBaseDate, holidayBreakStartDate || null, holidayBreakEndDate || null);
    if (filterMode === 'week') {
      const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
      const calendarWeekInput = toCalendarWeek(weekInput, breakWindow);
      const mondayMs = startOfWeek(base, { weekStartsOn: 1 }).getTime() + (calendarWeekInput - 1) * 7 * 24 * 60 * 60 * 1000;
      const start = mondayMs;
      const end = endOfDay(new Date(mondayMs + 6 * 24 * 60 * 60 * 1000)).getTime();
      setDateRange({ start, end });
    } else if (filterMode === 'month') {
      const base = monthInput ? toZonedTime(new Date(monthInput + '-01'), TIME_ZONE) : now;
      const start = startOfMonth(base).getTime();
      const end = endOfDay(endOfMonth(base)).getTime();
      setDateRange({ start, end });
    } else if (filterMode === 'custom') {
      handleCustomDateChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, monthInput, weekBaseDate, weekInput, holidayBreakStartDate, holidayBreakEndDate]);

  useEffect(() => {
    try {
      const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
      const current = toZonedTime(new Date(), TIME_ZONE);
      const breakWindow = getBreakWindow(weekBaseDate, holidayBreakStartDate || null, holidayBreakEndDate || null);
      const weeks = differenceInCalendarWeeks(current, base, { weekStartsOn: 1 }) + 1;
      const academicWeek = toAcademicWeek(weeks, breakWindow);
      setWeekNumber(academicWeek);
      if (filterMode === 'week') setWeekInput(academicWeek);
    } catch {}
  }, [weekBaseDate, holidayBreakStartDate, holidayBreakEndDate, filterMode]);

  useEffect(() => {
    if (savedWeekBase && typeof savedWeekBase === 'string') {
      setWeekBaseDate(savedWeekBase);
    }
  }, [savedWeekBase]);

  useEffect(() => {
    if (typeof savedBreakStart === 'string' && savedBreakStart) setHolidayBreakStartDate(savedBreakStart);
    else setHolidayBreakStartDate("");
  }, [savedBreakStart]);

  useEffect(() => {
    if (typeof savedBreakEnd === 'string' && savedBreakEnd) setHolidayBreakEndDate(savedBreakEnd);
    else setHolidayBreakEndDate("");
  }, [savedBreakEnd]);

  useEffect(() => {
    // Prefer multi-model config, fallback to single model
    if (typeof savedAiModels === 'string' && savedAiModels.trim()) {
      setAiModelsDraft(savedAiModels);
      return;
    }
    if (typeof savedAiModel === 'string' && savedAiModel.trim()) {
      setAiModelsDraft(savedAiModel);
      return;
    }
    setAiModelsDraft('');
  }, [savedAiModels, savedAiModel]);

  useEffect(() => {
    if (typeof savedGeminiModels === 'string') {
      setGeminiModelsDraft(savedGeminiModels);
      return;
    }
    setGeminiModelsDraft('');
  }, [savedGeminiModels]);

  useEffect(() => {
    if (typeof savedOpenRouterModels === 'string' && savedOpenRouterModels.trim()) {
      setOpenRouterModelsDraft(savedOpenRouterModels);
      return;
    }
    if (typeof savedAiModels === 'string' && savedAiModels.trim()) {
      setOpenRouterModelsDraft(savedAiModels);
      return;
    }
    if (typeof savedAiModel === 'string' && savedAiModel.trim()) {
      setOpenRouterModelsDraft(savedAiModel);
      return;
    }
    setOpenRouterModelsDraft('');
  }, [savedOpenRouterModels, savedAiModels, savedAiModel]);

  // Fetch Better Auth users when systemUsers tab is activated
  useEffect(() => {
    if (activeSection !== 'systemUsers') return;
    if (betterAuthUsers !== null || betterAuthUsersLoading) return;
    setBetterAuthUsersLoading(true);
    getBetterAuthUsersAction({})
      .then((result: any) => {
        // Better Auth admin listUsers returns { users: [...], total, ... }
        const users = Array.isArray(result) ? result : (result?.users ?? result?.data ?? []);
        setBetterAuthUsers(users);
      })
      .catch(() => {
        toast.error("Không thể tải danh sách tài khoản. Hiển thị dữ liệu hồ sơ.");
        setBetterAuthUsers([]);
      })
      .finally(() => {
        setBetterAuthUsersLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1400px] md:flex gap-6">
        <div className="md:hidden mb-4 sticky top-24 z-10">
          <div
            className="flex overflow-x-auto gap-2 px-1 py-1 rounded-2xl border border-white/30 bg-white/20 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ boxShadow: '0 4px 16px rgba(31,38,135,0.15)' }}
          >
            <button className={navButtonClass(activeSection==='actions')} onClick={() => setActiveSection('actions')}>Hành động</button>
            <button className={navButtonClass(activeSection==='overview')} onClick={() => setActiveSection('overview')}>Tổng hợp</button>
            <button className={navButtonClass(activeSection==='violations')} onClick={() => setActiveSection('violations')}>Vi phạm</button>
            <button className={navButtonClass(activeSection==='emulation')} onClick={() => setActiveSection('emulation')}>Thi đua</button>
            <button className={navButtonClass(activeSection==='roster')} onClick={() => setActiveSection('roster')}>Học sinh</button>
            <button className={navButtonClass(activeSection==='systemUsers')} onClick={() => setActiveSection('systemUsers')}>Tài khoản HT</button>
            <button className={navButtonClass(activeSection==='settings')} onClick={() => setActiveSection('settings')}>Cài đặt</button>
          </div>
        </div>
        <aside className="hidden md:block w-60 shrink-0">
          <nav
            className="sticky top-24 space-y-1 rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-3"
            style={{ boxShadow: '0 8px 32px rgba(31,38,135,0.2)' }}
          >
            <button className={sideNavButtonClass(activeSection==='actions')} onClick={() => setActiveSection('actions')}><Clipboard className="w-4 h-4 inline-block mr-2" /> Hành động</button>
            <button className={sideNavButtonClass(activeSection==='overview')} onClick={() => setActiveSection('overview')}><BarChart className="w-4 h-4 inline-block mr-2" /> Tổng hợp</button>
            <button className={sideNavButtonClass(activeSection==='violations')} onClick={() => setActiveSection('violations')}><AlertTriangle className="w-4 h-4 inline-block mr-2" /> Quản lý Vi phạm</button>
            <button className={sideNavButtonClass(activeSection==='emulation')} onClick={() => setActiveSection('emulation')}><Trophy className="w-4 h-4 inline-block mr-2" /> Điểm thi đua</button>
            <button className={sideNavButtonClass(activeSection==='roster')} onClick={() => setActiveSection('roster')}><Users className="w-4 h-4 inline-block mr-2" /> Danh sách học sinh</button>
            <button className={sideNavButtonClass(activeSection==='systemUsers')} onClick={() => setActiveSection('systemUsers')}><UserCheck className="w-4 h-4 inline-block mr-2" /> User hệ thống</button>
            <button className={sideNavButtonClass(activeSection==='settings')} onClick={() => setActiveSection('settings')}><Settings className="w-4 h-4 inline-block mr-2" /> Cài đặt</button>
          </nav>
        </aside>
        <div className="flex-1 min-w-0 space-y-8">
      {activeSection === 'emulation' && (
        <EmulationScoreTable />
      )}
      {activeSection === 'actions' && (
      <div className="w-full space-y-6">
        <div className={panelClass}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Nhập liệu nhanh (AI)</h3>
          </div>
          <AIViolationInputModal onBulkSubmitSuccess={() => {}} />
        </div>
        <div className={panelClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Nhập vi phạm đơn lẻ</h3>
            <button
              onClick={() => setShowSingleReportForm(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showSingleReportForm
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-indigo-900/90 text-white hover:bg-indigo-900'
              }`}
            >
              {showSingleReportForm ? 'Ẩn form' : '+ Mở form nhập'}
            </button>
          </div>
          {showSingleReportForm && (
            <div className="mt-4 border-t border-slate-200/60 pt-4">
              <ViolationReportForm showAIModal={false} />
            </div>
          )}
        </div>
        {pendingUsers && pendingUsers.length > 0 && (
          <div className={panelClass}>
            <h3 className="text-lg font-semibold mb-3 text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-amber-500" />
              Người dùng chờ duyệt ({pendingUsers.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200/80">
                    <th className="py-2 px-4">Họ tên</th>
                    <th className="py-2 px-4">Email</th>
                    <th className="py-2 px-4">Lớp</th>
                    <th className="py-2 px-4">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((u: any) => (
                    <PendingUserRow key={u._id} user={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {appealedViolations && appealedViolations.length > 0 && (
          <div className={panelClass}>
            <h3 className="text-lg font-semibold mb-3 text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Báo cáo đang kháng cáo ({appealedViolations.length})
            </h3>
            <div>
              <p className="text-xs text-slate-600 mb-3">
                Có thể xử lý trực tiếp tại đây: xem chi tiết, bằng chứng, chỉnh sửa, xóa, xử lý kháng cáo.
              </p>
              <ViolationList
                violations={appealedViolations}
                isLoading={false}
                isAdminView={true}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {activeSection === 'systemUsers' && (
      <div className="w-full space-y-6">
        {/* Unified Better Auth + Convex user table */}
        <div className={panelClass}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Tài khoản hệ thống</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setBulkRows([{ username: "", password: "" }]);
                  setBulkSummary(null);
                  setShowBulkCreateModal(true);
                }}
                className={primaryButtonClass}
              >
                Tạo nhiều tài khoản
              </button>
              <button
                onClick={async () => {
                  setShowAutoMigrateModal(true);
                  setAutoMigrateStep('preview');
                  setAutoMigrateData(null);
                  try {
                    const result = await migrateProfilesToBetterAuthAction({ dryRun: true });
                    setAutoMigrateData(result);
                  } catch (e) {
                    toast.error(`Lỗi tải dữ liệu: ${(e as Error).message}`);
                    setShowAutoMigrateModal(false);
                  }
                }}
                className={secondaryButtonClass}
              >
                Tự động tạo Better Auth
              </button>
              <button
                onClick={() => {
                  setBetterAuthUsers(null);
                  setBetterAuthUsersLoading(false);
                }}
                className={secondaryButtonClass}
                title="Tải lại danh sách"
              >
                Tải lại
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Danh sách tài khoản Better Auth kết hợp với hồ sơ Convex. Sắp xếp theo ngày tạo mới nhất.
          </p>
          {(() => {
            // Build merged list
            const baUsers: Array<any> = betterAuthUsers ?? [];
            const profiles: Array<any> = allUserProfiles ?? [];
            const convexUsers: Array<any> = convexUsersByBetterAuthId ?? [];

            // Map betterAuthId -> convex user record
            const baIdToConvexUser = new Map<string, any>();
            for (const cu of convexUsers) {
              baIdToConvexUser.set(cu.betterAuthId, cu);
            }

            // Map convex userId -> profile
            const userIdToProfile = new Map<string, any>();
            for (const p of profiles) {
              userIdToProfile.set(p.userId, p);
            }

            // Track which profiles have been matched to a BA user
            const matchedProfileUserIds = new Set<string>();

            // Build rows from Better Auth users
            const rows: Array<{
              key: string;
              baUser: any | null;
              convexUser: any | null;
              profile: any | null;
            }> = baUsers.map((baUser: any) => {
              const baId = baUser.id ?? baUser._id ?? "";
              const convexUser = baIdToConvexUser.get(baId) ?? null;
              const profile = convexUser ? (userIdToProfile.get(convexUser._id) ?? null) : null;
              if (convexUser) matchedProfileUserIds.add(convexUser._id);
              return { key: baId || String(Math.random()), baUser, convexUser, profile };
            });

            // Add profiles with no linked BA account
            for (const p of profiles) {
              if (!matchedProfileUserIds.has(p.userId)) {
                rows.push({ key: `profile-${p.profileId}`, baUser: null, convexUser: null, profile: p });
              }
            }

            // Sort by BA account creation date descending; profiles-only rows go to the end
            rows.sort((a, b) => {
              const aTime = a.baUser ? new Date(a.baUser.createdAt).getTime() : 0;
              const bTime = b.baUser ? new Date(b.baUser.createdAt).getTime() : 0;
              return bTime - aTime;
            });

            const isLoading = betterAuthUsersLoading || allUserProfiles === undefined;

            if (isLoading) {
              return <p className="text-sm text-slate-500">Đang tải...</p>;
            }

            if (rows.length === 0) {
              return <p className="text-sm text-slate-500">Không có tài khoản nào.</p>;
            }

            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200/80">
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Tên đăng nhập</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Email</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Ngày tạo</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Đăng nhập cuối</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Họ tên</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Lớp</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Vai trò</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">SuperUser</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Báo cáo</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Hoạt động cuối</th>
                      <th className="py-2 px-3 text-slate-700 whitespace-nowrap">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ key, baUser, profile }) => (
                      <tr key={key} className="border-b border-slate-200/60 hover:bg-white/60">
                        <td className="py-2 px-3 text-slate-700 font-mono text-xs">
                          {baUser
                            ? (baUser.username ?? baUser.name ?? baUser.email?.split("@")[0] ?? "—")
                            : (profile?.fullName ? (
                                <span className="text-slate-500 italic">—</span>
                              ) : "—")}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-xs">
                          {baUser ? baUser.email : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-xs">
                          {baUser
                            ? format(toZonedTime(new Date(baUser.createdAt), TIME_ZONE), "dd/MM/yyyy HH:mm")
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-xs">
                          {baUser?.updatedAt
                            ? format(toZonedTime(new Date(baUser.updatedAt), TIME_ZONE), "dd/MM/yyyy HH:mm")
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {profile ? profile.fullName : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {profile ? profile.className : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {profile ? profile.role : (
                            !baUser ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                                Không có tài khoản auth
                              </span>
                            ) : "—"
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {profile ? (profile.isSuperUser ? "Có" : "Không") : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-semibold">
                          {profile ? profile.reportCount : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-xs">
                          {profile?.lastActiveAt
                            ? format(toZonedTime(new Date(profile.lastActiveAt), TIME_ZONE), "dd/MM/yyyy HH:mm")
                            : "—"}
                        </td>
                        <td className="py-2 px-3">
                          {baUser && (
                            <button
                              onClick={() => {
                                setResetPasswordUserId(baUser.id ?? baUser._id);
                                setResetPasswordValue("");
                              }}
                              className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
                            >
                              Đặt lại mật khẩu
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Password reset modal */}
        {resetPasswordUserId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/95 shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-800">Đặt lại mật khẩu</h3>
              <p className="text-sm text-slate-600">
                Nhập mật khẩu mới cho tài khoản này. Mật khẩu phải có ít nhất 8 ký tự.
              </p>
              <input
                type="password"
                placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="auth-input-field w-full"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setResetPasswordUserId(null);
                    setResetPasswordValue("");
                  }}
                  disabled={resetPasswordLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    if (!resetPasswordUserId) return;
                    setResetPasswordLoading(true);
                    try {
                      await setUserPasswordAction({
                        betterAuthUserId: resetPasswordUserId,
                        newPassword: resetPasswordValue,
                      });
                      toast.success("Đặt lại mật khẩu thành công.");
                      setResetPasswordUserId(null);
                      setResetPasswordValue("");
                    } catch (err) {
                      toast.error(`Đặt lại mật khẩu thất bại: ${(err as Error).message}`);
                    } finally {
                      setResetPasswordLoading(false);
                    }
                  }}
                  disabled={resetPasswordValue.length < 8 || resetPasswordLoading}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-900/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetPasswordLoading ? "Đang xử lý..." : "Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk create users modal */}
        {showBulkCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/70 bg-white/95 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Tạo nhiều tài khoản</h3>
                <button
                  onClick={() => {
                    setShowBulkCreateModal(false);
                    setBulkSummary(null);
                  }}
                  disabled={bulkSubmitting}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
                >
                  ×
                </button>
              </div>

              {/* CSV upload */}
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white cursor-pointer">
                  Tải lên CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                        if (lines.length === 0) return;
                        // Detect header row
                        const firstLine = lines[0].toLowerCase();
                        const hasHeader =
                          firstLine.includes("username") || firstLine.includes("password");
                        const dataLines = hasHeader ? lines.slice(1) : lines;
                        const parsed = dataLines.map((line) => {
                          const parts = line.split(",").map((p) => p.trim());
                          return { username: parts[0] ?? "", password: parts[1] ?? "" };
                        });
                        setBulkRows(parsed.length > 0 ? parsed : [{ username: "", password: "" }]);
                        setBulkSummary(null);
                      };
                      reader.readAsText(file);
                      // Reset input so same file can be re-uploaded
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">
                  Định dạng CSV: cột 1 = username, cột 2 = password
                </span>
              </div>

              {/* Multi-row form */}
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-semibold text-slate-600 px-1">
                  <span>Tên đăng nhập</span>
                  <span>Mật khẩu</span>
                  <span />
                </div>
                {bulkRows.map((row, idx) => {
                  const usernameError = row.username.trim() === "";
                  const passwordError = row.password.trim() === "";
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                      <div>
                        <input
                          type="text"
                          placeholder="username"
                          value={row.username}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], username: e.target.value };
                            setBulkRows(next);
                            setBulkSummary(null);
                          }}
                          className={`auth-input-field w-full ${usernameError && row.username !== "" ? "" : ""} ${
                            bulkSummary ? "" : ""
                          }`}
                          style={
                            usernameError && (bulkSummary !== null || row.username !== "")
                              ? { borderColor: "#f87171" }
                              : {}
                          }
                        />
                        {usernameError && row.username === "" && bulkSummary !== null && (
                          <p className="text-xs text-red-500 mt-0.5">Bắt buộc</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="password"
                          value={row.password}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], password: e.target.value };
                            setBulkRows(next);
                            setBulkSummary(null);
                          }}
                          className="auth-input-field w-full"
                          style={
                            passwordError && (bulkSummary !== null || row.password !== "")
                              ? { borderColor: "#f87171" }
                              : {}
                          }
                        />
                        {passwordError && row.password === "" && bulkSummary !== null && (
                          <p className="text-xs text-red-500 mt-0.5">Bắt buộc</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setBulkRows(bulkRows.filter((_, i) => i !== idx));
                          setBulkSummary(null);
                        }}
                        disabled={bulkRows.length === 1}
                        className="mt-1 px-2 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Xóa
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setBulkRows([...bulkRows, { username: "", password: "" }]);
                    setBulkSummary(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  + Thêm dòng
                </button>
              </div>

              {/* Summary after submission */}
              {bulkSummary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Tạo thành công {bulkSummary.created} tài khoản, thất bại {bulkSummary.failed} tài khoản.
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {bulkSummary.results.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-xs rounded-lg px-2 py-1 ${
                          r.status === "created"
                            ? "bg-emerald-50 text-emerald-800"
                            : r.status === "duplicate"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        <span className="font-semibold shrink-0">
                          {r.status === "created"
                            ? "✓"
                            : r.status === "duplicate"
                            ? "⚠ Trùng"
                            : "✗"}
                        </span>
                        <span className="font-mono">{r.username}</span>
                        {r.reason && (
                          <span className="text-xs opacity-75 ml-1">— {r.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setShowBulkCreateModal(false);
                    setBulkSummary(null);
                    // Refresh the Better Auth user list
                    setBetterAuthUsers(null);
                    setBetterAuthUsersLoading(false);
                  }}
                  disabled={bulkSubmitting}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-60"
                >
                  {bulkSummary ? "Đóng" : "Hủy"}
                </button>
                {!bulkSummary && (
                  <button
                    onClick={async () => {
                      // Validate: all rows must have username and password
                      const hasEmpty = bulkRows.some(
                        (r) => r.username.trim() === "" || r.password.trim() === ""
                      );
                      if (hasEmpty) {
                        setBulkSummary({
                          created: 0,
                          failed: 0,
                          results: [],
                        });
                        toast.error("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu cho tất cả các dòng.");
                        return;
                      }
                      setBulkSubmitting(true);
                      try {
                        const summary = await bulkCreateUsersAction({
                          users: bulkRows.map((r) => ({
                            username: r.username.trim(),
                            password: r.password.trim(),
                          })),
                        });
                        setBulkSummary(summary);
                        if (summary.created > 0) {
                          toast.success(
                            `Tạo thành công ${summary.created} tài khoản${summary.failed > 0 ? `, thất bại ${summary.failed}` : ""}.`
                          );
                        } else {
                          toast.error(`Tất cả ${summary.failed} tài khoản đều thất bại.`);
                        }
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setBulkSubmitting(false);
                      }
                    }}
                    disabled={
                      bulkSubmitting ||
                      bulkRows.length === 0 ||
                      bulkRows.every((r) => r.username.trim() === "" && r.password.trim() === "")
                    }
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-900/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bulkSubmitting ? (
                      <>
                        <div className="form-loading-spinner mr-2" />
                        Đang tạo...
                      </>
                    ) : (
                      `Tạo ${bulkRows.filter((r) => r.username.trim() !== "").length} tài khoản`
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Auth account reassignment tool */}
        <div className={panelClass}>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Gán lại tài khoản auth</h3>
          <p className="text-sm text-slate-600 mb-3">
            Liên kết một tài khoản Better Auth với một hồ sơ Convex khác. Dùng khi tài khoản auth bị lệch với hồ sơ.
          </p>
          {betterAuthUsers === null || allUserProfiles === undefined ? (
            <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Source: Better Auth user */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Tài khoản Better Auth (nguồn)
                  </label>
                  <select
                    value={reassignSourceBaId}
                    onChange={(e) => {
                      setReassignSourceBaId(e.target.value);
                      setReassignConflict(null);
                    }}
                    className="auth-input-field w-full"
                  >
                    <option value="">Chọn tài khoản auth...</option>
                    {(betterAuthUsers as Array<any>).map((u: any) => {
                      const uid = u.id ?? u._id ?? "";
                      const label = u.username ?? u.name ?? u.email?.split("@")[0] ?? uid.slice(-8);
                      return (
                        <option key={uid} value={uid}>
                          {label} — {uid.slice(-8)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Target: Convex userProfile */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Hồ sơ Convex (đích)
                  </label>
                  <select
                    value={reassignTargetProfileId}
                    onChange={(e) => {
                      setReassignTargetProfileId(e.target.value);
                      setReassignConflict(null);
                    }}
                    className="auth-input-field w-full"
                  >
                    <option value="">Chọn hồ sơ...</option>
                    {(allUserProfiles as Array<any>).map((p: any) => (
                      <option key={p.profileId} value={p.profileId}>
                        {p.fullName} — {p.className} ({p.role}) · #{p.profileId.slice(-6)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview of selected items */}
              {(reassignSourceBaId || reassignTargetProfileId) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                  {reassignSourceBaId && (() => {
                    const u = (betterAuthUsers as Array<any>).find((x: any) => x.id === reassignSourceBaId);
                    if (!u) return null;
                    // Check if this BA user is already linked to a profile
                    const convexUser = (convexUsersByBetterAuthId ?? []).find((cu: any) => cu.betterAuthId === reassignSourceBaId);
                    const linkedProfile = convexUser
                      ? (allUserProfiles as Array<any>).find((p: any) => p.userId === convexUser._id)
                      : null;
                    return (
                      <div>
                        <span className="font-semibold">Auth:</span>{" "}
                        {u.username ?? u.name ?? u.email?.split("@")[0]} ({u.email})
                        {linkedProfile && (
                          <span className="ml-2 text-amber-700 font-medium">
                            → hiện liên kết với: {linkedProfile.fullName} ({linkedProfile.className})
                          </span>
                        )}
                        {!linkedProfile && (
                          <span className="ml-2 text-slate-500">→ chưa liên kết hồ sơ nào</span>
                        )}
                      </div>
                    );
                  })()}
                  {reassignTargetProfileId && (() => {
                    const p = (allUserProfiles as Array<any>).find((x: any) => x.profileId === reassignTargetProfileId);
                    if (!p) return null;
                    return (
                      <div>
                        <span className="font-semibold">Hồ sơ đích:</span>{" "}
                        {p.fullName} — {p.className} ({p.role})
                        {p.isSuperUser && <span className="ml-1 text-indigo-700 font-medium">[SuperUser]</span>}
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={async () => {
                  if (!reassignSourceBaId || !reassignTargetProfileId) {
                    toast.error("Vui lòng chọn đủ tài khoản auth và hồ sơ đích.");
                    return;
                  }

                  // Check if the selected BA user is already linked to a different profile
                  const convexUser = (convexUsersByBetterAuthId ?? []).find(
                    (cu: any) => cu.betterAuthId === reassignSourceBaId
                  );
                  const linkedProfile = convexUser
                    ? (allUserProfiles as Array<any>).find(
                        (p: any) => p.userId === convexUser._id && p.profileId !== reassignTargetProfileId
                      )
                    : null;

                  if (linkedProfile) {
                    // Show conflict warning — require confirmation
                    setReassignConflict({
                      existingProfileName: `${linkedProfile.fullName} (${linkedProfile.className})`,
                      existingProfileId: linkedProfile.profileId,
                    });
                    return;
                  }

                  // No conflict — proceed directly
                  setReassignLoading(true);
                  try {
                    await reassignAuthAccountMutation({
                      targetProfileId: reassignTargetProfileId as any,
                      newBetterAuthId: reassignSourceBaId,
                    });
                    toast.success("Gán lại tài khoản thành công.");
                    setReassignSourceBaId("");
                    setReassignTargetProfileId("");
                    setReassignConflict(null);
                    // Refresh the Better Auth user list
                    setBetterAuthUsers(null);
                    setBetterAuthUsersLoading(false);
                  } catch (err) {
                    toast.error(`Gán lại tài khoản thất bại: ${(err as Error).message}`);
                  } finally {
                    setReassignLoading(false);
                  }
                }}
                disabled={reassignLoading || !reassignSourceBaId || !reassignTargetProfileId}
                className={`${primaryButtonClass}`}
              >
                {reassignLoading ? "Đang xử lý..." : "Gán lại tài khoản"}
              </button>
            </div>
          )}
        </div>

        {/* Conflict confirmation dialog for reassignment */}
        {reassignConflict !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/95 shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="text-amber-500">⚠</span> Xác nhận gán lại
              </h3>
              <p className="text-sm text-slate-700">
                Tài khoản auth này hiện đang liên kết với hồ sơ:{" "}
                <span className="font-semibold text-amber-700">{reassignConflict.existingProfileName}</span>.
              </p>
              <p className="text-sm text-slate-600">
                Nếu tiếp tục, hồ sơ đó sẽ mất liên kết với tài khoản auth này. Bạn có chắc chắn muốn tiếp tục?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setReassignConflict(null)}
                  disabled={reassignLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    setReassignLoading(true);
                    try {
                      await reassignAuthAccountMutation({
                        targetProfileId: reassignTargetProfileId as any,
                        newBetterAuthId: reassignSourceBaId,
                      });
                      toast.success("Gán lại tài khoản thành công.");
                      setReassignSourceBaId("");
                      setReassignTargetProfileId("");
                      setReassignConflict(null);
                      // Refresh the Better Auth user list
                      setBetterAuthUsers(null);
                      setBetterAuthUsersLoading(false);
                    } catch (err) {
                      toast.error(`Gán lại tài khoản thất bại: ${(err as Error).message}`);
                      setReassignConflict(null);
                    } finally {
                      setReassignLoading(false);
                    }
                  }}
                  disabled={reassignLoading}
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reassignLoading ? "Đang xử lý..." : "Xác nhận gán lại"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile merge tool — unchanged */}
        <div className={panelClass}>
          <p className="text-sm text-slate-600 mb-3">
            Danh sách hồ sơ user trong hệ thống. Có thể xóa hồ sơ nếu user chưa có dữ liệu báo cáo.
          </p>
          {allUserProfiles && allUserProfiles.length > 1 && (
            <div className="mb-4 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-3 space-y-2">
              <div className="text-sm font-semibold text-indigo-800">
                Gộp tài khoản trùng (migrate dữ liệu acc A {"->"} acc B, rồi xóa acc A)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  value={migrateFromProfileId}
                  onChange={(e) => setMigrateFromProfileId(e.target.value)}
                  className="auth-input-field"
                >
                  <option value="">Chọn tài khoản nguồn (sẽ bị xóa)</option>
                  {allUserProfiles.map((u: any) => (
                    <option key={`from-${u.profileId}`} value={u.profileId}>
                      {u.fullName} - {u.className} ({u.role}) · {u.reportCount} BC · #{u.profileId.slice(-6)}
                    </option>
                  ))}
                </select>
                <select
                  value={migrateToProfileId}
                  onChange={(e) => setMigrateToProfileId(e.target.value)}
                  className="auth-input-field"
                >
                  <option value="">Chọn tài khoản đích (giữ lại)</option>
                  {allUserProfiles.map((u: any) => (
                    <option key={`to-${u.profileId}`} value={u.profileId}>
                      {u.fullName} - {u.className} ({u.role}) · {u.reportCount} BC · #{u.profileId.slice(-6)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!migrateFromProfileId || !migrateToProfileId) {
                    toast.error("Vui lòng chọn đủ tài khoản nguồn và đích.");
                    return;
                  }
                  if (migrateFromProfileId === migrateToProfileId) {
                    toast.error("Nguồn và đích không được trùng nhau.");
                    return;
                  }
                  const from = allUserProfiles.find((u: any) => u.profileId === migrateFromProfileId);
                  const to = allUserProfiles.find((u: any) => u.profileId === migrateToProfileId);
                  const ok = window.confirm(
                    `Gộp dữ liệu từ "${from?.fullName || "Nguồn"}" sang "${to?.fullName || "Đích"}" và xóa hồ sơ nguồn?`
                  );
                  if (!ok) return;
                  try {
                    await migrateUserDataAndDeleteProfile({
                      fromProfileId: migrateFromProfileId as any,
                      toProfileId: migrateToProfileId as any,
                    });
                    toast.success("Đã migrate dữ liệu và xóa hồ sơ nguồn.");
                    setMigrateFromProfileId("");
                    setMigrateToProfileId("");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
                className={primaryButtonClass}
              >
                Migrate & Xóa tài khoản nguồn
              </button>
              <p className="text-xs text-indigo-700">
                Dữ liệu được migrate: báo cáo vi phạm (reporter), điểm báo cáo, vật phẩm đã mua.
              </p>
            </div>
          )}
          {allUserProfiles === undefined ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : allUserProfiles.length === 0 ? (
            <p className="text-sm text-slate-500">Không có user nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200/80">
                    <th className="py-2 px-4">Họ tên</th>
                    <th className="py-2 px-4">Lớp</th>
                    <th className="py-2 px-4">Vai trò</th>
                    <th className="py-2 px-4">SuperUser</th>
                    <th className="py-2 px-4">Báo cáo</th>
                    <th className="py-2 px-4">Last active</th>
                    <th className="py-2 px-4">Vật phẩm đã mua</th>
                    <th className="py-2 px-4">ID</th>
                    <th className="py-2 px-4">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {allUserProfiles.map((u: any) => (
                    <tr key={u.userId} className="border-b border-slate-200/60 hover:bg-white/60">
                      <td className="py-2 px-4 text-slate-700">{u.fullName}</td>
                      <td className="py-2 px-4 text-slate-700">{u.className}</td>
                      <td className="py-2 px-4 text-slate-700">{u.role}</td>
                      <td className="py-2 px-4 text-slate-700">{u.isSuperUser ? "Có" : "Không"}</td>
                      <td className="py-2 px-4 text-slate-700 font-semibold">{u.reportCount}</td>
                      <td className="py-2 px-4 text-slate-700 whitespace-nowrap">
                        {u.lastActiveAt
                          ? format(toZonedTime(new Date(u.lastActiveAt), TIME_ZONE), "dd/MM/yyyy HH:mm")
                          : "Chưa có"}
                      </td>
                      <td className="py-2 px-4 text-slate-700">
                        {u.purchaseCount > 0 ? (
                          <span title={u.purchasedItems?.join(", ") || ""}>
                            {u.purchaseCount} món
                            {u.purchasedItems?.length ? `: ${u.purchasedItems.slice(0, 3).join(", ")}` : ""}
                            {u.purchasedItems?.length > 3 ? "..." : ""}
                          </span>
                        ) : (
                          "Chưa mua"
                        )}
                      </td>
                      <td className="py-2 px-4 text-slate-500 font-mono text-xs" title={u.profileId}>
                        {u.profileId.slice(-8)}
                      </td>
                      <td className="py-2 px-4">
                        <button
                          onClick={async () => {
                            const ok = window.confirm(`Xóa hồ sơ user "${u.fullName}"?`);
                            if (!ok) return;
                            try {
                              await deleteUserProfile({ profileId: u.profileId });
                              toast.success("Đã xóa hồ sơ user.");
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                          className="px-3 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          Xóa hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      {activeSection === 'overview' && (
      <div className="w-full">
        <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="text-sm text-slate-700">Chọn ngày:</label>
            <input
              type="text"
              placeholder="dd/mm/yyyy"
              value={overviewDate}
              onChange={(e) => setOverviewDate(e.target.value)}
              className="auth-input-field min-w-[160px]"
            />
            <span className="text-sm text-slate-600">Khoảng: {format(toZonedTime(new Date(_overviewStart), TIME_ZONE), 'dd/MM/yyyy')} - {format(toZonedTime(new Date(_overviewEnd), TIME_ZONE), 'dd/MM/yyyy')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="text-sm text-slate-600 mb-2">Tổng vi phạm</div>
              <div className="text-4xl font-bold text-slate-900">{overviewViolations ? overviewViolations.length : '...'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="text-sm text-slate-600 mb-2">Tuần hiện tại</div>
              <div className="text-4xl font-bold text-slate-900">{weekNumber}</div>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold mb-4 text-slate-800"><School className="w-5 h-5 inline-block mr-1" /> Theo lớp</h3>
            {overviewViolations === undefined ? (
              <p className="text-sm text-slate-600">Đang tải...</p>
            ) : overviewViolations.length === 0 ? (
              <p className="text-sm text-slate-600">Không có vi phạm.</p>
            ) : (
              <ul className="text-sm space-y-2 max-h-72 overflow-auto">
                {Object.entries((() => {
                  const m: Record<string, number> = {};
                  for (const v of overviewViolations as any) {
                    m[v.violatingClass] = (m[v.violatingClass] || 0) + 1;
                  }
                  return Object.fromEntries(Object.entries(m).sort((a,b) => b[1]-a[1]));
                })()).map(([cls, count]) => (
                  <li key={cls} className="flex justify-between items-center p-2 rounded-lg bg-white/10">
                    <span className="text-slate-700">{cls}</span>
                    <span className="font-semibold text-slate-800 bg-white/20 px-2 py-1 rounded-full text-xs">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold mb-4 text-slate-800"><GraduationCap className="w-5 h-5 inline-block mr-1" /> Theo học sinh</h3>
            {overviewViolations === undefined ? (
              <p className="text-sm text-slate-600">Đang tải...</p>
            ) : overviewViolations.length === 0 ? (
              <p className="text-sm text-slate-600">Không có vi phạm.</p>
            ) : (
              <ul className="text-sm space-y-2 max-h-72 overflow-auto">
                {Object.entries((() => {
                  const m: Record<string, number> = {};
                  for (const v of overviewViolations as any) {
                    if (v.targetType === 'student' && v.studentName) {
                      m[v.studentName] = (m[v.studentName] || 0) + 1;
                    }
                  }
                  return Object.fromEntries(Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0, 20));
                })()).map(([name, count]) => (
                  <li key={name} className="flex justify-between items-center p-2 rounded-lg bg-white/10">
                    <span className="text-slate-700">{name}</span>
                    <span className="font-semibold text-slate-800 bg-white/20 px-2 py-1 rounded-full text-xs">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold mb-4 text-slate-800"><UserCheck className="w-5 h-5 inline-block mr-1" /> Theo người báo cáo</h3>
            {overviewViolations === undefined ? (
              <p className="text-sm text-slate-600">Đang tải...</p>
            ) : overviewViolations.length === 0 ? (
              <p className="text-sm text-slate-600">Không có vi phạm.</p>
            ) : (
              <ul className="text-sm space-y-2 max-h-72 overflow-auto">
                {Object.entries((() => {
                  const m: Record<string, number> = {};
                  for (const v of overviewViolations as any) {
                    const reporter = (v as any).reporterName || v.reporterId;
                    m[reporter] = (m[reporter] || 0) + 1;
                  }
                  return Object.fromEntries(Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0, 20));
                })()).map(([name, count]) => (
                  <li key={name} className="flex justify-between items-center p-2 rounded-lg bg-white/10">
                    <span className="text-slate-700">{name}</span>
                    <span className="font-semibold text-slate-800 bg-white/20 px-2 py-1 rounded-full text-xs">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6">
          <h3 className="font-semibold mb-4 text-slate-800"><Clipboard className="w-5 h-5 inline-block mr-1" /> Chi tiết vi phạm</h3>
          {overviewViolations === undefined ? (
            <p className="text-sm text-slate-600">Đang tải...</p>
          ) : overviewViolations.length === 0 ? (
            <p className="text-sm text-slate-600">Không có thông tin vi phạm.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-glass">
                <thead>
                  <tr className="text-left">
                    <th className="py-3 pr-4 text-slate-800">Thời gian</th>
                    <th className="py-3 pr-4 text-slate-800">Lớp</th>
                    <th className="py-3 pr-4 text-slate-800">Đối tượng</th>
                    <th className="py-3 pr-4 text-slate-800">Loại</th>
                    <th className="py-3 pr-4 text-slate-800">Người báo cáo</th>
                  </tr>
                </thead>
                <tbody>
                  {(overviewViolations as any).slice(0, 50).map((v: any) => (
                    <tr key={v._id} className="hover:bg-white/10 transition-colors">
                      <td className="py-3 pr-4 text-slate-700">{format(toZonedTime(new Date(v.violationDate), TIME_ZONE), 'HH:mm')}</td>
                      <td className="py-3 pr-4 text-slate-700">{v.violatingClass}</td>
                      <td className="py-3 pr-4 text-slate-700">{v.targetType === 'student' ? (v.studentName || 'HS') : 'Lớp'}</td>
                      <td className="py-3 pr-4 text-slate-700">{v.violationType}</td>
                      <td className="py-3 pr-4 text-slate-700">{v.reporterName || 'Không rõ'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      {activeSection === 'settings' && (
      <div className="w-full space-y-6">
        <div className={panelClass}>
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm">Giờ hệ thống (GMT+7):</span>
            <span className="font-semibold text-slate-800 text-sm">{format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy HH:mm:ss')}</span>
          </div>
        </div>
        
        <div className={panelClass}>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">Tuần học</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm text-slate-700">Ngày bắt đầu học kỳ/tuần gốc:</label>
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={formatDateDDMMYYYY(weekBaseDate)}
                onChange={async (e) => {
                  const v = e.target.value;
                  const parsed = parseDDMMYYYY(v);
                  if (!parsed) return;
                  const iso = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0,10);
                  setWeekBaseDate(iso);
                  try { await saveSetting({ key: 'weekBaseDate', value: iso }); } catch (err) { toast.error((err as Error).message); }
                }}
                className="auth-input-field min-w-[160px]"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Tuần học hiện tại:</span>
                <span className="font-semibold text-slate-800">{weekNumber}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm text-slate-700">Tuần nghỉ (Tết/Lễ):</label>
              <input
                type="date"
                value={holidayBreakStartDate}
                onChange={async (e) => {
                  const v = e.target.value;
                  setHolidayBreakStartDate(v);
                  try { await saveSetting({ key: 'holidayBreakStartDate', value: v }); } catch (err) { toast.error((err as Error).message); }
                }}
                className="auth-input-field min-w-[160px]"
              />
              <span className="text-sm text-slate-500">đến</span>
              <input
                type="date"
                value={holidayBreakEndDate}
                onChange={async (e) => {
                  const v = e.target.value;
                  setHolidayBreakEndDate(v);
                  try { await saveSetting({ key: 'holidayBreakEndDate', value: v }); } catch (err) { toast.error((err as Error).message); }
                }}
                className="auth-input-field min-w-[160px]"
              />
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">AI Provider Fallback</h3>
          <p className="text-sm text-slate-600 mb-3">
            Luồng chạy: thử toàn bộ danh sách <span className="font-semibold">Gemini AI Studio</span> trước, nếu vẫn lỗi thì mới chuyển qua danh sách <span className="font-semibold">OpenRouter</span>.
          </p>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm text-slate-700">Danh sách model (ưu tiên từ trên xuống):</label>
              <div className="text-xs text-slate-600">
                {aiModelsSavedAt ? `Đã lưu lúc ${format(new Date(aiModelsSavedAt), 'HH:mm:ss')}` : ''}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-1">Gemini models (AI Studio)</div>
              <textarea
                value={geminiModelsDraft}
                onChange={(e) => setGeminiModelsDraft(e.target.value)}
                placeholder={"gemini-2.5-flash\ngemini-2.0-flash"}
                className="w-full min-h-[90px] rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-1">OpenRouter models (fallback cuối)</div>
              <textarea
                value={openRouterModelsDraft}
                onChange={(e) => setOpenRouterModelsDraft(e.target.value)}
                placeholder={"openai/gpt-4o-mini\nanthropic/claude-3.5-sonnet\ngoogle/gemini-2.0-flash"}
                className="w-full min-h-[90px] rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <textarea
              value={aiModelsDraft}
              onChange={(e) => setAiModelsDraft(e.target.value)}
              placeholder={"openai/gpt-4o-mini\nanthropic/claude-3.5-sonnet\ngoogle/gemini-2.0-flash"}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                onClick={async () => {
                  setAiModelsSaving(true);
                  try {
                    await saveSetting({ key: 'geminiModels', value: geminiModelsDraft });
                    await saveSetting({ key: 'openrouterModels', value: openRouterModelsDraft });
                    // Legacy keys kept for compatibility with older code paths.
                    await saveSetting({ key: 'aiModels', value: openRouterModelsDraft });
                    const first = openRouterModelsDraft.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0] || '';
                    await saveSetting({ key: 'aiModel', value: first });
                    setAiModelsSavedAt(Date.now());
                    toast.success('Đã lưu cấu hình Gemini + OpenRouter.');
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setAiModelsSaving(false);
                  }
                }}
                disabled={aiModelsSaving}
                className={`${primaryButtonClass} w-full sm:w-auto`}
              >
                {aiModelsSaving ? 'Đang lưu...' : 'Lưu AI model'}
              </button>
              <button
                onClick={() => {
                  if (typeof savedGeminiModels === 'string') setGeminiModelsDraft(savedGeminiModels);
                  else setGeminiModelsDraft('');

                  if (typeof savedOpenRouterModels === 'string' && savedOpenRouterModels.trim()) {
                    setOpenRouterModelsDraft(savedOpenRouterModels);
                  } else if (typeof savedAiModels === 'string' && savedAiModels.trim()) {
                    setOpenRouterModelsDraft(savedAiModels);
                  } else if (typeof savedAiModel === 'string' && savedAiModel.trim()) {
                    setOpenRouterModelsDraft(savedAiModel);
                  } else {
                    setOpenRouterModelsDraft('');
                  }
                }}
                disabled={aiModelsSaving}
                className={`${secondaryButtonClass} w-full sm:w-auto`}
              >
                Hoàn tác
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Khi model Gemini đầu tiên lỗi, hệ thống tự thử model Gemini tiếp theo; hết Gemini mới qua OpenRouter.
            </p>
          </div>
        </div>



        <div className={panelClass}>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">Form xin phép công khai</h3>
          <p className="text-sm text-slate-600 mb-3">
            Cấu hình system user để form xin phép công khai có thể hoạt động. Chỉ cần chạy một lần.
          </p>
          <button
            onClick={async () => {
              try {
                const result = await setupPublicAbsenceSystemUser({} as any);
                toast.success(result.message);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className={primaryButtonClass}
          >
            <Settings className="w-5 h-5 inline-block mr-1" /> Cấu hình System User
          </button>
        </div>
      </div>
      )}
      {activeSection === 'roster' && (
      <div className="w-full space-y-6">
        <div className={panelClass}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" /> Danh sách học sinh
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Quản lý và cập nhật danh sách học sinh theo lớp.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={async () => {
                            try {
                                const url = await exportRosterTemplate({} as any);
                                if (url) window.open(url, '_blank');
                            } catch (e) { toast.error((e as Error).message); }
                        }}
                        className={`${secondaryButtonClass} w-full sm:w-auto`}
                    >
                        <Download className="w-4 h-4 mr-2 text-slate-500" /> Tải file mẫu
                    </button>
                    <label className="w-full sm:w-auto cursor-pointer">
                        <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const postUrl = await generateUploadUrl();
                                    const res = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
                                    const { storageId } = await res.json();
                                    await importRoster({ storageId } as any);
                                    toast.success('Đã nhập danh sách học sinh.');
                                } catch (err) {
                                    toast.error((err as Error).message);
                                } finally {
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                        <div className={`${primaryButtonClass} w-full sm:w-auto`}>
                            <Upload className="w-4 h-4 mr-2" /> Tải lên & Nhập
                        </div>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 flex flex-col h-[60vh] md:h-[500px]">
                    <div className="font-semibold text-sm text-slate-700 mb-3 px-1 uppercase tracking-wider">Danh sách lớp</div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                        {roster === undefined ? (
                            <p className="text-sm text-slate-500 italic p-2">Đang tải...</p>
                        ) : roster.length === 0 ? (
                            <p className="text-sm text-slate-500 italic p-2">Chưa có dữ liệu.</p>
                        ) : (
                            roster.map((c: any) => (
                                <button
                                    key={c.className}
                                    onClick={() => setSelectedRosterClass(c.className)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${selectedRosterClass === c.className ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-700'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">{c.className}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedRosterClass === c.className ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>{c.students.length} HS</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
                <div className="md:col-span-3 flex flex-col h-[60vh] md:h-[500px]">
                    <div className="font-semibold text-sm text-slate-700 mb-3 px-1 uppercase tracking-wider">
                        Học sinh {selectedRosterClass ? `lớp ${selectedRosterClass}` : ''}
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/60 bg-white shadow-sm p-4 custom-scrollbar">
                        {selectedRosterClass && roster ? (
                            (() => {
                                const cls = roster.find((c: any) => c.className === selectedRosterClass);
                                if (!cls) return <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">Chưa chọn lớp.</div>;
                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                                        {cls.students.map((s: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                                                <div className="w-6 h-6 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-medium">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-sm text-slate-700 font-medium">{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">
                                Chọn một lớp ở danh sách bên trái để xem học sinh.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
      )}
      {activeSection === 'violations' && (
      <div className="w-full">

        <div className="my-4 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4">
                <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="auth-input-field">
                    <option value="">Tất cả các khối</option>
                    <option value="10">Khối 10</option>
                    <option value="11">Khối 11</option>
                    <option value="12">Khối 12</option>
                </select>
                <input
                    type="text"
                    placeholder="Lọc theo lớp (vd: 11A2)"
                    value={classFilter}
                    onChange={e => setClassFilter(e.target.value)}
                    className="auth-input-field"
                />
                <select value={targetTypeFilter} onChange={e => setTargetTypeFilter(e.target.value)} className="auth-input-field">
                    <option value="">Tất cả đối tượng</option>
                    <option value="student">Học sinh</option>
                    <option value="class">Lớp</option>
                </select>
                <div className="col-span-1 md:col-span-4 xl:col-span-8">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <select value={filterMode} onChange={e => setFilterMode(e.target.value as any)} className="auth-input-field">
                      <option value="month">Tháng</option>
                      <option value="week">Tuần học</option>
                      <option value="custom">Tùy chỉnh</option>
                    </select>
                    {filterMode === 'week' && (
                      <input type="number" min={1} value={weekInput} onChange={e => setWeekInput(parseInt(e.target.value || '1', 10))} className="auth-input-field w-28" placeholder="Tuần #" />
                    )}
                    {filterMode === 'month' && (
                      <input type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)} className="auth-input-field min-w-[180px]" />
                    )}
                    {filterMode === 'custom' && (
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="dd/mm/yyyy" value={customDateRange.start} onChange={e => setCustomDateRange(prev => ({...prev, start: e.target.value}))} className="auth-input-field min-w-[160px]"/>
                        <span>-</span>
                        <input type="text" placeholder="dd/mm/yyyy" value={customDateRange.end} onChange={e => setCustomDateRange(prev => ({...prev, end: e.target.value}))} className="auth-input-field min-w-[160px]"/>
                      </div>
                    )}
                  </div>
                </div>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className={`${primaryButtonClass} w-full sm:w-auto`}
                >
                    {isExporting ? (
                        <>
                            <div className="form-loading-spinner mr-2"></div>
                            Đang xuất...
                        </>
                    ) : (
                        <><Download className="w-5 h-5 inline-block mr-1" /> Xuất Excel</>
                    )}
                </button>
            </div>
        </div>
        {/* Roster modal removed; content moved to its own section */}
        <ViolationList
            violations={allViolations}
            isLoading={allViolations === undefined}
            isAdminView={true}
        />
      </div>
      )}
        </div>
      </div>

      {/* Auto Migrate Better Auth Modal */}
      {showAutoMigrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-800">
                {autoMigrateStep === 'preview' ? 'Xác nhận tạo tài khoản tự động' : autoMigrateStep === 'processing' ? 'Đang xử lý...' : 'Kết quả tạo tài khoản'}
              </h3>
              {autoMigrateStep !== 'processing' && (
                <button onClick={() => setShowAutoMigrateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {autoMigrateStep === 'preview' && !autoMigrateData && (
                <div className="flex flex-col justify-center items-center py-12 space-y-4">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-slate-600 font-medium">Đang phân tích danh sách hồ sơ...</span>
                </div>
              )}
              
              {autoMigrateStep === 'preview' && autoMigrateData && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 text-indigo-800 p-4 rounded-xl text-sm border border-indigo-100">
                    Hệ thống tìm thấy <strong>{autoMigrateData.total}</strong> hồ sơ. Trong đó có <strong>{autoMigrateData.results.filter((r:any) => r.status==='dry_run').length}</strong> hồ sơ chưa có tài khoản Better Auth và sẽ được tạo mới tự động.
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <tr>
                          <th className="px-4 py-3">Học sinh</th>
                          <th className="px-4 py-3">Username dự kiến</th>
                          <th className="px-4 py-3">Password dự kiến</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {autoMigrateData.results.filter((r:any) => r.status === 'dry_run').length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Tất cả hồ sơ đều đã có tài khoản.</td></tr>
                        ) : (
                          autoMigrateData.results.filter((r:any) => r.status === 'dry_run').map((r:any, i:number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-medium text-slate-800">{r.fullName}</td>
                              <td className="px-4 py-3 text-slate-600 font-mono">{r.username}</td>
                              <td className="px-4 py-3 text-slate-600 font-mono">{r.tempPassword}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {autoMigrateStep === 'processing' && (
                <div className="flex flex-col justify-center items-center py-16 space-y-4">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                  <span className="text-slate-600 font-medium">Hệ thống đang tạo tài khoản, vui lòng không đóng cửa sổ này...</span>
                </div>
              )}
              
              {autoMigrateStep === 'result' && autoMigrateData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                      <div className="text-2xl font-bold text-emerald-600">{autoMigrateData.created}</div>
                      <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider mt-1">Tạo mới</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                      <div className="text-2xl font-bold text-slate-600">{autoMigrateData.skipped}</div>
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wider mt-1">Bỏ qua</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center">
                      <div className="text-2xl font-bold text-rose-600">{autoMigrateData.failed}</div>
                      <div className="text-xs font-medium text-rose-800 uppercase tracking-wider mt-1">Thất bại</div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <tr>
                          <th className="px-4 py-3">Học sinh</th>
                          <th className="px-4 py-3">Username</th>
                          <th className="px-4 py-3">Password</th>
                          <th className="px-4 py-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {autoMigrateData.results.filter((r:any) => r.status === 'created' || r.status === 'failed').map((r:any, i:number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-800">{r.fullName}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{r.username || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{r.tempPassword || '-'}</td>
                            <td className="px-4 py-3">
                              {r.status === 'created' ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Thành công</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800" title={r.reason}>Thất bại</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {autoMigrateData.results.filter((r:any) => r.status === 'created' || r.status === 'failed').length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Không có tài khoản nào được tạo.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              {autoMigrateStep === 'preview' && (
                <>
                  <button onClick={() => setShowAutoMigrateModal(false)} className={secondaryButtonClass}>
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      setAutoMigrateStep('processing');
                      try {
                        const result = await migrateProfilesToBetterAuthAction({ dryRun: false });
                        setAutoMigrateData(result);
                        setAutoMigrateStep('result');
                        setBetterAuthUsers(null);
                        setBetterAuthUsersLoading(false);
                      } catch (e) {
                        toast.error(`Lỗi: ${(e as Error).message}`);
                        setShowAutoMigrateModal(false);
                      }
                    }}
                    className={primaryButtonClass}
                    disabled={!autoMigrateData || autoMigrateData.results.filter((r:any) => r.status==='dry_run').length === 0}
                  >
                    Tiến hành tạo tài khoản
                  </button>
                </>
              )}
              {autoMigrateStep === 'result' && (
                <button onClick={() => setShowAutoMigrateModal(false)} className={primaryButtonClass}>
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function PendingUserRow({ user }: { user: Doc<"userProfiles"> & { email?: string } }) {
  const verifyUser = useMutation(api.users.verifyUser);

  const handleVerify = async () => {
    try {
      await verifyUser({ profileId: user._id });
      toast.success(`Đã duyệt người dùng ${user.fullName}.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <tr className="border-b border-slate-200/80 hover:bg-slate-50/80">
      <td className="py-3 px-4">{user.fullName}</td>
      <td className="py-3 px-4">{user.email}</td>
      <td className="py-3 px-4">{user.className}</td>
      <td className="py-3 px-4">
        <button
          onClick={handleVerify}
          className="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-semibold hover:bg-green-600 transition-colors"
        >
          Duyệt
        </button>
      </td>
    </tr>
  );
}
