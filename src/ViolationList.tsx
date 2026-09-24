import { useState } from "react";
import { ViolationWithDetails } from "../convex/violations";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import {
  Loader2, X, Trash2, AlertTriangle, ChevronDown, Pencil, CheckCircle2,
  MessageSquareWarning, Eye, History, Save, Ban
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

const PERSONAL_VIOLATIONS = [
  "Nghỉ học có phép",
  "Sai đồng phục/đầu tóc,...",
  "Đi học muộn có phép",
  "Sử dụng điện thoại sai mục đích",
  "Đi học muộn/nghỉ học không phép",
  "Nói tục, chửi thề.",
  "Hút thuốc lá.",
  "Vi phạm ATGT.",
  "Có học sinh đánh nhau."
];

// Map violation type -> points
const violationPointsMap = new Map<string, number>();
VIOLATION_CATEGORIES.forEach(cat => {
  cat.violations.forEach(name => violationPointsMap.set(name, cat.points));
});

export default function ViolationList({
  violations, isLoading, isAdminView = false, isDarkMode
}: {
  violations: ViolationWithDetails[] | undefined;
  isLoading: boolean;
  isAdminView?: boolean;
  isDarkMode?: boolean;
}) {
  const currentUser = useQuery(api.users.getLoggedInUser);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Đang tải danh sách...</span>
      </div>
    );
  }

  if (!violations || violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
        <Ban className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Chưa có vi phạm nào trong khoảng này</p>
      </div>
    );
  }

  const role = (currentUser as any)?.role ?? (currentUser as any)?.profile?.role;
  const isAdmin = role === 'admin';
  const myUserId = currentUser?._id;

  return (
    <div className="space-y-2">
      {violations.map(v => (
        <ViolationCard
          key={v._id}
          violation={v}
          isAdminView={isAdminView}
          isAdmin={!!isAdmin}
          myUserId={myUserId}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
}

function ViolationCard({
  violation, isAdminView, isAdmin, myUserId, isDarkMode
}: {
  violation: ViolationWithDetails;
  isAdminView: boolean;
  isAdmin: boolean;
  myUserId: string | undefined;
  isDarkMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<string[]>([]);

  // Edit state
  const [editDetails, setEditDetails] = useState(violation.details || "");
  const [editType, setEditType] = useState(violation.violationType);
  const [editClass, setEditClass] = useState(violation.violatingClass);
  const [editStudentName, setEditStudentName] = useState(violation.studentName || "");
  const [editTargetType, setEditTargetType] = useState<"student" | "class">(violation.targetType);
  const [saving, setSaving] = useState(false);

  // Appeal state
  const [appealReason, setAppealReason] = useState("");

  const appealViolation = useMutation(api.violations.appealViolation);
  const resolveViolation = useMutation(api.violations.resolveViolation);
  const deleteViolation = useAction(api.violations.deleteViolation);
  const editViolation = useMutation(api.violations.editViolation);

  const canEdit = isAdmin || (myUserId && violation.reporterId === myUserId);
  const logs = useQuery(api.violations.getViolationLogs, (isAdminView && showLogs) ? { violationId: violation._id } : "skip");
  const points = violationPointsMap.get(violation.violationType) ?? 0;

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDetails(violation.details || "");
    setEditType(violation.violationType);
    setEditClass(violation.violatingClass);
    setEditStudentName(violation.studentName || "");
    setEditTargetType(violation.targetType);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      await editViolation({
        violationId: violation._id,
        details: editDetails || undefined,
        violationType: editType,
        violatingClass: editClass,
        studentName: editTargetType === 'student' ? editStudentName : null,
        targetType: editTargetType,
      });
      toast.success("Đã cập nhật vi phạm.");
      setIsEditing(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAppeal = async () => {
    if (!appealReason.trim()) { toast.error("Vui lòng nhập lý do kháng cáo."); return; }
    try {
      await appealViolation({ violationId: violation._id, reason: appealReason });
      toast.success("Gửi kháng cáo thành công.");
      setShowAppealForm(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveViolation({ violationId: violation._id });
      toast.success("Đã giải quyết vi phạm.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteProgress([]);
    try {
      const evidenceCount = (violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0);
      if (evidenceCount > 0) {
        setDeleteProgress(prev => [...prev, `Đang xóa ${evidenceCount} file bằng chứng...`]);
      }
      setDeleteProgress(prev => [...prev, "Đang xóa báo cáo..."]);
      await deleteViolation({ violationId: violation._id });
      setDeleteProgress(prev => [...prev, "✓ Hoàn tất!"]);
      setTimeout(() => {
        toast.success("Đã xóa báo cáo vi phạm.");
        setShowDeleteModal(false);
      }, 400);
    } catch (error) {
      toast.error((error as Error).message);
      setIsDeleting(false);
    }
  };

  const statusCfg = {
    reported: { label: 'Đã báo cáo', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    appealed: { label: 'Kháng cáo', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    resolved: { label: 'Đã xử lý', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending: { label: 'Chờ xử lý', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  } as const;
  const sc = statusCfg[violation.status as keyof typeof statusCfg] ?? statusCfg.pending;

  const dateStr = (() => {
    try { return format(new Date(violation.violationDate), "EEE dd/MM", { locale: vi }); }
    catch { return ""; }
  })();

  const reporterDisplay = (violation as any).requesterName || violation.reporterName || "—";
  const hasEvidence = (violation.evidenceUrls?.filter(Boolean).length ?? 0) > 0;

  return (
    <div className={`rounded-xl border transition-shadow ${
      isEditing
        ? 'border-indigo-300 shadow-md bg-white'
        : 'border-slate-200/80 shadow-sm bg-white/90 hover:shadow-md'
    }`}>
      {/* ── Collapsed header (always visible) ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => { if (!isEditing) setExpanded(e => !e); }}
      >
        {/* Points badge */}
        <div className={`shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold leading-none ${
          points === 0 ? 'bg-slate-100 text-slate-500' :
          points <= 3 ? 'bg-amber-50 text-amber-700' :
          points <= 5 ? 'bg-orange-50 text-orange-700' :
          'bg-rose-50 text-rose-700'
        }`}>
          <span className="text-[10px] font-semibold opacity-70">-đ</span>
          <span className="text-sm">{points}</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{violation.violatingClass}</span>
            {violation.targetType === 'student' && violation.studentName && (
              <span className="text-slate-700 text-sm truncate max-w-[160px]">{violation.studentName}</span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.cls}`}>
              {sc.label}
            </span>
            {hasEvidence && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-indigo-600 font-medium">
                <Eye className="w-3 h-3" /> BC
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {violation.violationType}
            {dateStr && <span className="ml-2 text-slate-400">{dateStr}</span>}
          </p>
        </div>

        {/* Expand chevron */}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* ── Expanded body ── */}
      {(expanded || isEditing) && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">

          {/* View mode */}
          {!isEditing && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lớp</span>
                  <p className="font-medium text-slate-800">{violation.violatingClass}</p>
                </div>
                {violation.targetType === 'student' && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Học sinh</span>
                    <p className="font-medium text-slate-800">{violation.studentName || '—'}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ngày</span>
                  <p className="font-medium text-slate-800">{dateStr}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Loại vi phạm</span>
                  <p className="font-medium text-slate-800">{violation.violationType}</p>
                </div>
                {violation.details && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Chi tiết</span>
                    <p className="text-slate-700">{violation.details}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Người báo cáo</span>
                  <p className="text-slate-700">{reporterDisplay}</p>
                </div>
              </div>

              {/* Appeal reason */}
              {violation.status === 'appealed' && violation.appealReason && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                  <span className="font-semibold text-amber-800">Lý do kháng cáo: </span>
                  <span className="text-amber-900">{violation.appealReason}</span>
                </div>
              )}

              {/* Evidence */}
              {hasEvidence && (
                <EvidenceSection urls={violation.evidenceUrls!} />
              )}

              {/* Edit logs */}
              {isAdminView && (
                <div>
                  <button
                    onClick={() => setShowLogs(l => !l)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    <History className="w-3.5 h-3.5" />
                    {showLogs ? 'Ẩn lịch sử' : 'Lịch sử chỉnh sửa'}
                  </button>
                  {showLogs && (
                    <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                      {logs === undefined ? (
                        <p className="text-xs text-slate-500">Đang tải...</p>
                      ) : logs.length === 0 ? (
                        <p className="text-xs text-slate-500">Chưa có chỉnh sửa nào.</p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {logs.map((log: any) => (
                            <li key={log._id} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                              <div className="text-slate-500">{new Date(log.timestamp).toLocaleString('vi-VN')}</div>
                              {log.changes.map((c: any, idx: number) => (
                                <div key={idx} className="text-slate-700 mt-0.5">
                                  <span className="font-medium">{c.field}</span>: "{c.oldValue}" → "{c.newValue}"
                                </div>
                              ))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Appeal form (non-admin, reported status) */}
              {!isAdminView && violation.status === 'reported' && (
                <div>
                  {!showAppealForm ? (
                    <button
                      onClick={() => setShowAppealForm(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
                    >
                      <MessageSquareWarning className="w-4 h-4" /> Gửi kháng cáo
                    </button>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Lý do kháng cáo</p>
                      <textarea
                        className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                        placeholder="Nhập lý do..."
                        value={appealReason}
                        onChange={e => setAppealReason(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAppeal} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors">Gửi kháng cáo</button>
                        <button onClick={() => setShowAppealForm(false)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex flex-wrap gap-2 pt-1">
                {isAdminView && violation.status === 'appealed' && (
                  <button
                    onClick={handleResolve}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đánh dấu đã xử lý
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                  </button>
                )}
                {isAdminView && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                )}
              </div>
            </>
          )}

          {/* Edit mode — inline form */}
          {isEditing && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Chỉnh sửa vi phạm</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Đối tượng</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={editTargetType}
                    onChange={e => setEditTargetType(e.target.value as any)}
                  >
                    <option value="class">Lớp</option>
                    <option value="student">Học sinh</option>
                  </select>
                </div>
                {editTargetType === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tên học sinh</label>
                    <input
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      value={editStudentName}
                      onChange={e => setEditStudentName(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Lớp vi phạm</label>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={editClass}
                    onChange={e => setEditClass(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Loại vi phạm</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                  >
                    {VIOLATION_CATEGORIES.map(cat => {
                      const filtered = cat.violations.filter(v =>
                        editTargetType === "student" || !PERSONAL_VIOLATIONS.includes(v)
                      );
                      if (!filtered.length) return null;
                      return (
                        <optgroup key={cat.name} label={`${cat.name} (-${cat.points}đ)`}>
                          {filtered.map(v => <option key={v} value={v}>{v}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Chi tiết (tùy chọn)</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    value={editDetails}
                    onChange={e => setEditDetails(e.target.value)}
                    rows={2}
                    placeholder="Mô tả thêm nếu cần..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lưu thay đổi
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4" /> Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Xác nhận xóa</h3>
              {!isDeleting && (
                <button onClick={() => setShowDeleteModal(false)} className="ml-auto text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5 space-y-3">
              {!isDeleting ? (
                <>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                    <div><span className="font-medium">Lớp:</span> {violation.violatingClass}</div>
                    {violation.studentName && <div><span className="font-medium">Học sinh:</span> {violation.studentName}</div>}
                    <div><span className="font-medium">Vi phạm:</span> {violation.violationType}</div>
                    {((violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)) > 0 && (
                      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded p-2 mt-2 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Sẽ xóa {(violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)} file bằng chứng
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-rose-600 font-medium">Hành động này không thể hoàn tác!</p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50">Hủy</button>
                    <button onClick={handleDelete} className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span className="text-sm font-medium text-slate-800">Đang xóa...</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                    {deleteProgress.map((msg, i) => (
                      <div key={i} className={msg.startsWith('✓') ? 'text-emerald-600 font-medium' : 'text-slate-600'}>{msg}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Evidence section — lazy load media inline
function EvidenceSection({ urls }: { urls: (string | null)[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const validUrls = urls.filter(Boolean) as string[];
  if (!validUrls.length) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Bằng chứng ({validUrls.length})</p>
      <div className="flex flex-wrap gap-2">
        {validUrls.map((url, i) => {
          const ext = url.split('.').pop()?.toLowerCase() || '';
          const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
          return (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {openIdx === i ? 'Ẩn' : `Xem ${i + 1}`}
              </button>
              {openIdx === i && (
                <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden max-w-xs">
                  {isVideo ? (
                    <video src={url} controls className="w-full max-h-52 object-contain bg-black" preload="metadata" />
                  ) : isImage ? (
                    <img src={url} alt={`Bằng chứng ${i + 1}`} className="w-full max-h-52 object-contain" loading="lazy" />
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block p-3 text-sm text-indigo-600 hover:underline">
                      Tải file ({ext.toUpperCase()})
                    </a>
                  )}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-indigo-500 hover:underline py-1 border-t border-slate-100">
                    Mở tab mới
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
