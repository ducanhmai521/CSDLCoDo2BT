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
import { BarChart, AlertTriangle, Trophy, Users, CheckCircle, Settings, Clock, School, GraduationCap, UserCheck, Clipboard, Download, Trash2 } from 'lucide-react';
import { AIViolationInputModal } from "./AIViolationInputModal";

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
  const [activeSection, setActiveSection] = useState<'actions' | 'overview' | 'violations' | 'emulation' | 'roster' | 'users' | 'systemUsers' | 'settings' >('actions');
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
  const migrateExistingViolations = useMutation(api.reportingPoints.migrateExistingViolations);
  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const deleteUserProfile = useMutation(api.users.deleteUserProfile);
  const migrateUserDataAndDeleteProfile = useMutation(api.users.migrateUserDataAndDeleteProfile);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const roster = useQuery(api.users.listRoster);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedRosterClass, setSelectedRosterClass] = useState<string>("");
  const [overviewDate, setOverviewDate] = useState<string>(format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy'));
  const [aiModelsDraft, setAiModelsDraft] = useState<string>("");
  const [geminiModelsDraft, setGeminiModelsDraft] = useState<string>("");
  const [openRouterModelsDraft, setOpenRouterModelsDraft] = useState<string>("");
  const [aiModelsSaving, setAiModelsSaving] = useState<boolean>(false);
  const [aiModelsSavedAt, setAiModelsSavedAt] = useState<number | null>(null);
  const [migrateFromProfileId, setMigrateFromProfileId] = useState<string>("");
  const [migrateToProfileId, setMigrateToProfileId] = useState<string>("");
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
  const allViolations = useQuery(api.violations.getAllViolationsForAdmin, filters);
  const allViolationsForActions = useQuery(api.violations.getAllViolationsForAdmin, {} as any);
  const appealedViolations = useMemo(
    () => (allViolationsForActions || []).filter((v: any) => v.status === "appealed"),
    [allViolationsForActions]
  );
  // Overview: selected date range
  const _parsedOverview = parseDDMMYYYY(overviewDate);
  const _overviewStart = _parsedOverview ? startOfDay(toZonedTime(_parsedOverview, TIME_ZONE)).getTime() : startOfDay(toZonedTime(new Date(), TIME_ZONE)).getTime();
  const _overviewEnd = _parsedOverview ? endOfDay(toZonedTime(_parsedOverview, TIME_ZONE)).getTime() : endOfDay(toZonedTime(new Date(), TIME_ZONE)).getTime();
  const overviewViolations = useQuery(api.violations.getAllViolationsForAdmin, { dateRange: { start: _overviewStart, end: _overviewEnd } } as any);
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
            <button className={navButtonClass(activeSection==='users')} onClick={() => setActiveSection('users')}>Xét duyệt</button>
            <button className={navButtonClass(activeSection==='systemUsers')} onClick={() => setActiveSection('systemUsers')}>Users</button>
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
            <button className={sideNavButtonClass(activeSection==='users')} onClick={() => setActiveSection('users')}><CheckCircle className="w-4 h-4 inline-block mr-2" /> Xét duyệt</button>
            <button className={sideNavButtonClass(activeSection==='systemUsers')} onClick={() => setActiveSection('systemUsers')}><UserCheck className="w-4 h-4 inline-block mr-2" /> User hệ thống</button>
            <button className={sideNavButtonClass(activeSection==='settings')} onClick={() => setActiveSection('settings')}><Settings className="w-4 h-4 inline-block mr-2" /> Cài đặt</button>
          </nav>
        </aside>
        <div className="flex-1 space-y-8">
      {activeSection === 'emulation' && (
        <EmulationScoreTable />
      )}
      {activeSection === 'actions' && (
      <div className="w-full space-y-6">
        <div className={panelClass}>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">Nhập liệu nhanh</h3>
          <AIViolationInputModal onBulkSubmitSuccess={() => {}} />
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
        <div className={panelClass}>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">
            Báo cáo đang kháng cáo ({appealedViolations.length})
          </h3>
          {allViolationsForActions === undefined ? (
            <p className="text-sm text-slate-600">Đang tải...</p>
          ) : appealedViolations.length === 0 ? (
            <p className="text-sm text-emerald-700">Ổn rồi, hiện không có báo cáo nào ở trạng thái kháng cáo.</p>
          ) : (
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
          )}
        </div>
      </div>
      )}
      {activeSection === 'users' && (
      <div className="w-full">
        <div className="bg-white/80 rounded-lg border border-slate-200/80 p-4">
          <h3 className="text-lg font-semibold mb-3">Người dùng chờ duyệt</h3>
          {pendingUsers === undefined ? (
            <p className="text-slate-500 text-sm">Đang tải...</p>
          ) : pendingUsers.length === 0 ? (
            <p className="text-slate-500 text-sm">Không có người dùng chờ duyệt.</p>
          ) : (
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
          )}
        </div>
      </div>
      )}
      {activeSection === 'systemUsers' && (
      <div className="w-full">
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
          <h3 className="text-lg font-semibold mb-3 text-slate-800">Điểm báo cáo</h3>
          <p className="text-sm text-slate-600 mb-3">
            Chạy migration để cộng điểm cho các vi phạm hiện có trong database (10 điểm/vi phạm).
          </p>
          <button
            onClick={async () => {
              try {
                const result = await migrateExistingViolations();
                toast.success(result.message);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className={primaryButtonClass}
          >
            <Settings className="w-5 h-5 inline-block mr-1" /> Migrate điểm báo cáo
          </button>
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
      <div className="w-full">
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
                onClick={async () => {
                    try {
                        const url = await exportRosterTemplate({} as any);
                        if (url) window.open(url, '_blank');
                    } catch (e) { toast.error((e as Error).message); }
                }}
                className={`${primaryButtonClass} w-full sm:w-auto`}
            >
                Tải mẫu danh sách HS
            </button>
            <label className="w-full sm:w-auto">
                <span className="sr-only">Upload và nhập danh sách HS</span>
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
                <span className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">Tải lên & nhập danh sách HS</span>
            </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-4 md:grid-cols-4">
            <div className="md:col-span-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium mb-2 text-slate-800">Chọn lớp</p>
                <div className="max-h-64 overflow-auto space-y-1">
                    {roster === undefined ? (
                        <p className="text-sm text-slate-600">Đang tải...</p>
                    ) : roster.length === 0 ? (
                        <p className="text-sm text-slate-600">Chưa có dữ liệu.</p>
                    ) : (
                        roster.map((c: any) => (
                            <button
                                key={c.className}
                                onClick={() => setSelectedRosterClass(c.className)}
                                className={`w-full text-left px-2 py-1 rounded-lg transition-all ${selectedRosterClass === c.className ? 'bg-white/30 text-slate-800' : 'hover:bg-white/10 text-slate-700 hover:text-slate-800'}`}
                            >
                                {c.className} <span className="text-xs text-slate-600">({c.students.length})</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
            <div className="md:col-span-3">
                <p className="text-sm font-medium mb-2 text-slate-800">Học sinh</p>
                <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {selectedRosterClass && roster && (
                        (() => {
                            const cls = roster.find((c: any) => c.className === selectedRosterClass);
                            if (!cls) return <p className="text-sm text-slate-600">Chưa chọn lớp.</p>;
                            return (
                                <ul className="list-disc list-inside text-sm space-y-1 text-slate-700">
                                    {cls.students.map((s: string, idx: number) => (
                                        <li key={idx}>{s}</li>
                                    ))}
                                </ul>
                            );
                        })()
                    )}
                    {!selectedRosterClass && <p className="text-sm text-slate-600">Chọn một lớp để xem danh sách học sinh.</p>}
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
