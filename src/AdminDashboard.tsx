import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Doc } from "../convex/_generated/dataModel";
import ViolationList from "./ViolationList";
import EmulationScoreTable from "./EmulationScoreTable";
import { useEffect, useState } from "react";
import { startOfWeek, startOfDay, endOfDay, toDate, differenceInCalendarWeeks, parseISO, format, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { normalizeClassName, isValidClassName, triggerFileDownload } from "./lib/utils";

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getWeekStartAndEnd() {
    const now = new Date();
    const zonedNow = toZonedTime(now, TIME_ZONE);
    const start = startOfWeek(zonedNow, { weekStartsOn: 1 }); // Monday
    const end = endOfDay(zonedNow);
    return { start: start.getTime(), end: end.getTime() };
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
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [weekInput, setWeekInput] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<'overview' | 'violations' | 'emulation' | 'roster' | 'users' | 'settings' >('overview');
  const savedWeekBase = useQuery(api.users.getSetting, { key: 'weekBaseDate' });
  const saveSetting = useMutation(api.users.setSetting);
  const clearStoredFiles = useAction(api.adminTools.clearStoredFiles);
  const [isClearing, setIsClearing] = useState(false);
  const exportRosterTemplate = useAction(api.adminTools.exportRosterTemplate);
  const importRoster = useAction(api.adminTools.importRoster);
  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const roster = useQuery(api.users.listRoster);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedRosterClass, setSelectedRosterClass] = useState<string>("");
  const [overviewDate, setOverviewDate] = useState<string>(format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy'));

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
  const allViolations = useQuery(api.violations.getAllViolationsForAdmin, filters);
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

  const handleClearStorage = async () => {
    if (!window.confirm('Xóa tất cả tệp đã lưu trong hệ thống (evidence & excel)?')) return;
    setIsClearing(true);
    try {
      await clearStoredFiles({ kind: 'all' as any });
      toast.success('Đã xóa toàn bộ tệp đã lưu.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    handleCustomDateChange();
  }, [customDateRange]);

  useEffect(() => {
    const now = toZonedTime(new Date(), TIME_ZONE);
    if (filterMode === 'week') {
      const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
      const mondayMs = startOfWeek(base, { weekStartsOn: 1 }).getTime() + (weekInput - 1) * 7 * 24 * 60 * 60 * 1000;
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
  }, [filterMode, monthInput, weekBaseDate, weekInput]);

  useEffect(() => {
    try {
      const base = toZonedTime(new Date(weekBaseDate), TIME_ZONE);
      const current = toZonedTime(new Date(), TIME_ZONE);
      const weeks = differenceInCalendarWeeks(current, base, { weekStartsOn: 1 });
      setWeekNumber(weeks + 1);
      if (filterMode === 'week') setWeekInput(weeks + 1);
    } catch {}
  }, [weekBaseDate]);

  useEffect(() => {
    if (savedWeekBase && typeof savedWeekBase === 'string') {
      setWeekBaseDate(savedWeekBase);
    }
  }, [savedWeekBase]);

  return (
    <div className="w-full">
      <div className="md:flex gap-6">
        <div className="md:hidden -mx-4 mb-3 sticky top-16 z-10 nav-glass">
          <div className="flex overflow-x-auto gap-2 px-4 py-2">
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='overview' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('overview')}>Tổng hợp</button>
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='violations' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('violations')}>Vi phạm</button>
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='emulation' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('emulation')}>Điểm thi đua</button>
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='roster' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('roster')}>DS học sinh</button>
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='users' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('users')}>Xét duyệt thành viên</button>
            <button className={`shrink-0 px-3 py-2 rounded-xl transition-all ${activeSection==='settings' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('settings')}>Cài đặt</button>
          </div>
        </div>
        <aside className="hidden md:block w-60 shrink-0">
          <nav className="sticky top-20 space-y-2 glass-card-subtle p-4">
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='overview' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('overview')}>📊 Tổng hợp</button>
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='violations' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('violations')}>⚠️ Quản lý Vi phạm</button>
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='emulation' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('emulation')}>🏆 Điểm thi đua</button>
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='roster' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('roster')}>👥 Danh sách học sinh</button>
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='users' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('users')}>✅ Xét duyệt thành viên</button>
            <button className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeSection==='settings' ? 'bg-white/30 text-slate-800 font-semibold shadow-lg' : 'bg-white/10 text-slate-700 hover:bg-white/20 hover:text-slate-800'}`} onClick={() => setActiveSection('settings')}>⚙️ Cài đặt</button>
          </nav>
        </aside>
        <div className="flex-1 space-y-8">
          <div className="glass-card-subtle p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-slate-700">
              <div>🕐 Giờ hệ thống (GMT+7): <span className="font-semibold text-slate-800">{format(toZonedTime(new Date(), TIME_ZONE), 'dd/MM/yyyy HH:mm:ss')}</span></div>
            </div>
          </div>
      {activeSection === 'emulation' && (
        <EmulationScoreTable />
      )}
      {activeSection === 'users' && (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-4 border-b pb-2">Quản lý Người dùng</h2>
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
      {activeSection === 'overview' && (
      <div className="w-full">
        <div className="glass-card">
          <h2 className="text-2xl font-bold mb-6 text-slate-800">📊 Thông tin tổng hợp theo ngày</h2>
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
            <div className="glass-card-subtle p-6 text-center">
              <div className="text-sm text-slate-600 mb-2">Tổng vi phạm</div>
              <div className="text-4xl font-bold text-slate-900">{overviewViolations ? overviewViolations.length : '...'}</div>
            </div>
            <div className="glass-card-subtle p-6 text-center">
              <div className="text-sm text-slate-600 mb-2">Tuần hiện tại</div>
              <div className="text-4xl font-bold text-slate-900">{weekNumber}</div>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card-subtle p-6">
            <h3 className="font-semibold mb-4 text-slate-800">🏫 Theo lớp</h3>
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
          <div className="glass-card-subtle p-6">
            <h3 className="font-semibold mb-4 text-slate-800">👨‍🎓 Theo học sinh</h3>
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
          <div className="glass-card-subtle p-6">
            <h3 className="font-semibold mb-4 text-slate-800">👮 Theo người báo cáo</h3>
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
        <div className="mt-6 glass-card-subtle p-6">
          <h3 className="font-semibold mb-4 text-slate-800">📋 Chi tiết vi phạm</h3>
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
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-slate-800">Cài đặt</h2>
        <div className="glass-card-subtle p-4 flex flex-col sm:flex-row sm:items-center gap-3">
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
      </div>
      )}
      {activeSection === 'roster' && (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-slate-800">Danh sách học sinh</h2>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
                onClick={async () => {
                    try {
                        const url = await exportRosterTemplate({} as any);
                        if (url) window.open(url, '_blank');
                    } catch (e) { toast.error((e as Error).message); }
                }}
                className="btn-glass-primary w-full sm:w-auto"
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
                <span className="inline-block bg-gradient-to-r from-indigo-500/80 to-blue-600/80 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-semibold hover:from-indigo-600/90 hover:to-blue-700/90 cursor-pointer transition-all duration-300 shadow-xl hover:shadow-2xl border border-white/20">Tải lên & nhập danh sách HS</span>
            </label>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 glass-card-subtle mt-4">
            <div className="md:col-span-1 glass-card-subtle p-3">
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
                <div className="max-h-96 overflow-auto glass-card-subtle p-3">
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
        <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-slate-800">Quản lý Vi phạm</h2>

        <div className="my-4 glass-card-subtle p-4">
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
                    className="btn-glass-primary w-full sm:w-auto"
                >
                    {isExporting ? (
                        <>
                            <div className="form-loading-spinner mr-2"></div>
                            Đang xuất...
                        </>
                    ) : (
                        "📊 Xuất Excel"
                    )}
                </button>
                <button
                    onClick={handleClearStorage}
                    disabled={isClearing}
                    className="w-full sm:w-auto bg-gradient-to-r from-red-500/80 to-red-600/80 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-semibold hover:from-red-600/90 hover:to-red-700/90 transition-all duration-300 border border-white/20 shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isClearing ? (
                        <>
                            <div className="form-loading-spinner mr-2"></div>
                            Đang xóa...
                        </>
                    ) : (
                        '🗑️ Xóa toàn bộ tệp lưu'
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
