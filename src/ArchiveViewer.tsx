/**
 * ArchiveViewer – loads a local .zip archive file and renders the data
 * as a read-only view of violations, evidence, metadata, etc.
 *
 * The component receives the parsed ZIP contents and renders a simplified
 * dashboard. A sticky banner at the top lets the user exit archive mode.
 */
import { useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { normalizeClassName } from "./lib/utils";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

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

// ─── Types ──────────────────────────────────────────────────────────────────

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
  evidenceFiles: Map<string, string>; // basename → object URL
  evidenceErrors: Array<{ r2Key: string; error: string }>;
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface ArchiveViewerProps {
  onExit: () => void;
}

export default function ArchiveViewer({ onExit }: ArchiveViewerProps) {
  const [archiveData, setArchiveData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "violations" | "roster" | "users" | "evidence"
  >("overview");

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const data = await parseZip(zip);
        setArchiveData(data);
        setActiveTab("overview");
      } catch (err) {
        setError(`Không thể đọc file archive: ${(err as Error).message}`);
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* ── Sticky banner ── */}
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
        {/* ── File picker ── */}
        {!archiveData && (
          <div className="rounded-2xl border border-white/70 bg-white/80 backdrop-blur-sm shadow p-8 text-center space-y-4">
            <FileArchive className="w-12 h-12 text-slate-400 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-800">
              Chọn file Archive (.zip)
            </h2>
            <p className="text-sm text-slate-500">
              Chọn file ZIP đã tải về từ hệ thống để xem dữ liệu lưu trữ mà
              không cần kết nối database.
            </p>
            {loading && (
              <p className="text-sm text-indigo-600 animate-pulse">
                Đang đọc file...
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            )}
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-indigo-900/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors">
              <Upload className="w-4 h-4" />
              Chọn file ZIP
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}

        {/* ── Archive content ── */}
        {archiveData && (
          <>
            {/* Tab bar */}
            <div className="flex overflow-x-auto gap-2 p-1 rounded-2xl border border-white/30 bg-white/30 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: "overview", label: "Tổng quan" },
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
                    label: `Bằng chứng (${archiveData.evidenceFiles.size})`,
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
              {/* Replace file button */}
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
              <OverviewTab data={archiveData} />
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

// ─── Parse ZIP ───────────────────────────────────────────────────────────────

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

  // Build evidence object URLs
  const evidenceFiles = new Map<string, string>();
  const evidenceFolder = zip.folder("evidence");
  if (evidenceFolder) {
    const tasks: Promise<void>[] = [];
    evidenceFolder.forEach((relativePath, file) => {
      if (file.dir) return;
      tasks.push(
        file.async("blob").then((blob) => {
          const url = URL.createObjectURL(blob);
          evidenceFiles.set(relativePath, url);
        })
      );
    });
    await Promise.all(tasks);
  }

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
    evidenceFiles,
    evidenceErrors,
  };
}

// ─── Tab components ──────────────────────────────────────────────────────────

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

function OverviewTab({ data }: { data: ArchiveData }) {
  const { metadata, violations, studentRoster, users, evidenceFiles, evidenceErrors } = data;
  const { weekBaseDate } = resolveWeekSettings(data);
  const gradeCounts = [10, 11, 12].map((g) => ({
    grade: g,
    count: violations.filter((v) => getViolationGrade(v) === g).length,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-slate-800 mb-4 text-base">
          Thông tin Archive
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            value={evidenceFiles.size}
            color="emerald"
          />
          {evidenceErrors.length > 0 && (
            <StatBox
              icon={<X className="w-6 h-6" />}
              label="Lỗi bằng chứng"
              value={evidenceErrors.length}
              color="amber"
            />
          )}
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
  const { violations, evidenceFiles } = data;
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
                                        evidenceFiles={evidenceFiles}
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
  evidenceFiles,
}: {
  violation: any;
  evidenceFiles: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const evidenceBasenames: string[] = (violation.evidenceR2Keys ?? []).map(
    (key: string) =>
      key.includes("/") ? key.substring(key.lastIndexOf("/") + 1) : key
  );
  const availableEvidence = evidenceBasenames.filter((b) => evidenceFiles.has(b));
  const ts = getViolationTimestamp(violation);

  return (
    <div>
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
                {availableEvidence.map((basename) => {
                  const url = evidenceFiles.get(basename)!;
                  const isVideo = /\.(mp4|webm|mov|avi)$/i.test(basename);
                  return isVideo ? (
                    <video
                      key={basename}
                      src={url}
                      controls
                      className="max-h-48 rounded-lg border border-slate-200"
                    />
                  ) : (
                    <a
                      key={basename}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={url}
                        alt={basename}
                        className="max-h-32 rounded-lg border border-slate-200 hover:opacity-90 transition-opacity object-cover"
                      />
                    </a>
                  );
                })}
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

  // Map userId → profile
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
  const { evidenceFiles } = data;
  const entries = Array.from(evidenceFiles.entries());

  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-4">
          Không có file bằng chứng trong archive.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-semibold text-slate-800 mb-4">
        Bằng chứng ({entries.length} files)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto pr-1">
        {entries.map(([basename, url]) => {
          const isVideo = /\.(mp4|webm|mov|avi)$/i.test(basename);
          return (
            <div key={basename} className="space-y-1">
              {isVideo ? (
                <video
                  src={url}
                  controls
                  className="w-full rounded-xl border border-slate-200 bg-black aspect-video object-contain"
                />
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={basename}
                    className="w-full rounded-xl border border-slate-200 aspect-square object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              )}
              <p className="text-xs text-slate-500 truncate px-0.5" title={basename}>
                {basename}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
