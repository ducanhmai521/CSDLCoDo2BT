import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ViolationWithDetails } from "../convex/violations";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { ViolationTypePicker } from "./components/ViolationTypePicker";
import {
  Loader2, X, Trash2, AlertTriangle, ChevronDown, Pencil, CheckCircle2,
  MessageSquareWarning, Eye, History, Save, Ban, Download, ZoomIn,
  User, Users, FileWarning
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

const PERSONAL_VIOLATIONS = [
  "Đi học muộn có phép",
  "Đi học muộn không phép",
  "Học sinh nói tục, chửi thề",
  "Học sinh hút thuốc lá/thuốc lá điện tử/thuốc lào",
  "Vi phạm ATGT (không đội mũ, không cài quai, xe phân khối lớn, pô chế, không biển số, dàn hàng, xe ngoài cổng)",
  "Đăng/chia sẻ thông tin sai sự thật, kích động, xúc phạm người khác trên MXH",
  "Lớp có học sinh đánh nhau/bạo lực học đường",
];

const violationPointsMap = new Map<string, number>();
VIOLATION_CATEGORIES.forEach(cat => cat.violations.forEach(name => violationPointsMap.set(name, cat.points)));

// ── Portal — renders children into document.body so fixed positioning works ──
function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

// ── Media Viewer (y hệt public page) ────────────────────────────────────────
type MediaModalData = {
  url: string;
  type: "image" | "video";
  info: { student: string; cls: string; details: string };
};

function MediaViewer({ data, onClose }: { data: MediaModalData; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const [startInteraction, setStartInteraction] = useState({ x: 0, y: 0 });
  const pinchRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const reset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(s - e.deltaY * 0.005, 0.5), 10));
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setInteracting(true);
    setStartInteraction({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interacting) return;
    e.preventDefault();
    setPosition({ x: e.clientX - startInteraction.x, y: e.clientY - startInteraction.y });
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setInteracting(true);
      setStartInteraction({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    } else if (e.touches.length === 2) {
      pinchRef.current = dist(e.touches);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && interacting) {
      setPosition({ x: e.touches[0].clientX - startInteraction.x, y: e.touches[0].clientY - startInteraction.y });
    } else if (e.touches.length === 2 && pinchRef.current > 0) {
      const nd = dist(e.touches);
      setScale(s => Math.min(Math.max(s * (nd / pinchRef.current), 0.5), 10));
      pinchRef.current = nd;
    }
  };
  const handleInteractionEnd = () => { setInteracting(false); pinchRef.current = 0; };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <Portal>
    <div
      className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onMouseMove={data.type === "image" ? handleMouseMove : undefined}
      onMouseUp={data.type === "image" ? handleInteractionEnd : undefined}
      onMouseLeave={data.type === "image" ? handleInteractionEnd : undefined}
    >
      {/* Close */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Info bar at bottom */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[95%] md:max-w-xl bg-black/60 backdrop-blur-sm text-white rounded-xl text-sm z-50 overflow-hidden transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}>
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-200">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium">{data.info.student}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm">{data.info.cls}</span>
            </div>
          </div>
          <div className="flex items-start gap-1.5 pt-1.5 border-t border-white/15 text-xs text-slate-300">
            <FileWarning className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{data.info.details}</span>
          </div>
        </div>
        <a
          href={data.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border-t border-white/15 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Tải xuống
        </a>
      </div>

      {/* Media container */}
      <div className={`transform-gpu w-full h-full flex items-center justify-center transition-all duration-300 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        {loading && (
          <div className="absolute flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          </div>
        )}
        <div className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}>
          {data.type === "image" ? (
            <div
              className="w-full h-full"
              style={{ touchAction: "none", cursor: interacting ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onDoubleClick={reset}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleInteractionEnd}
            >
              <div className="w-full h-full" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
                <img
                  src={data.url}
                  alt="Bằng chứng"
                  className="w-full h-full object-contain"
                  onLoad={() => setLoading(false)}
                />
              </div>
            </div>
          ) : (
            <video
              src={data.url}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain"
              onLoadedData={() => setLoading(false)}
            >
              Trình duyệt không hỗ trợ video.
            </video>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Appeal Modal ─────────────────────────────────────────────────────────────
function AppealModal({
  violation, onClose
}: {
  violation: ViolationWithDetails;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const appealViolation = useMutation(api.violations.appealViolation);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error("Vui lòng nhập lý do kháng cáo."); return; }
    setSubmitting(true);
    try {
      await appealViolation({ violationId: violation._id, reason });
      toast.success("Đã gửi kháng cáo thành công.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const points = violationPointsMap.get(violation.violationType) ?? 0;
  const dateStr = (() => {
    try { return format(new Date(violation.violationDate), "EEEE, dd/MM/yyyy", { locale: vi }); }
    catch { return ""; }
  })();

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <MessageSquareWarning className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Gửi kháng cáo</h3>
            <p className="text-xs text-slate-500">Phản ánh nếu vi phạm này không chính xác</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Violation info */}
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Thông tin vi phạm</p>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{violation.violatingClass}</span>
                  {violation.studentName && (
                    <span className="text-slate-600">— {violation.studentName}</span>
                  )}
                </div>
                <p className="text-slate-700">{violation.violationType}</p>
                {violation.details && <p className="text-slate-500 text-xs">{violation.details}</p>}
                <p className="text-xs text-slate-400">{dateStr}</p>
              </div>
              {points > 0 && (
                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm">
                  -{points}đ
                </span>
              )}
            </div>
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
              <span className="font-medium">Báo cáo bởi:</span> {(violation as any).requesterName || violation.reporterName || "—"}
            </div>
          </div>

          {/* Reason input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Lý do kháng cáo <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none transition-all"
              placeholder="Mô tả tại sao vi phạm này cần được xem xét lại..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareWarning className="w-4 h-4" />}
            Gửi kháng cáo
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({
  violation, onClose
}: {
  violation: ViolationWithDetails;
  onClose: () => void;
}) {
  const [editDetails, setEditDetails] = useState(violation.details || "");
  const [editType, setEditType] = useState(violation.violationType);
  const [editClass, setEditClass] = useState(violation.violatingClass);
  const [editStudentName, setEditStudentName] = useState(violation.studentName || "");
  const [editTargetType, setEditTargetType] = useState<"student" | "class">(violation.targetType);
  const [studentSearch, setStudentSearch] = useState(violation.studentName || "");
  const [selectedStudent, setSelectedStudent] = useState<{ name: string; className: string } | null>(
    violation.studentName ? { name: violation.studentName, className: violation.violatingClass } : null
  );
  const [saving, setSaving] = useState(false);

  const studentSuggestions = useQuery(
    api.users.searchStudents,
    editTargetType === "student" && studentSearch && !selectedStudent ? { q: studentSearch } : "skip"
  );
  const editViolation = useMutation(api.violations.editViolation);

  const handleSelectStudent = (s: { fullName: string; className: string }) => {
    setSelectedStudent({ name: s.fullName, className: s.className });
    setStudentSearch(`${s.fullName} (${s.className})`);
    setEditStudentName(s.fullName);
    setEditClass(s.className);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await editViolation({
        violationId: violation._id,
        details: editDetails || undefined,
        violationType: editType,
        violatingClass: editClass,
        studentName: editTargetType === "student" ? editStudentName : null,
        targetType: editTargetType,
      });
      toast.success("Đã cập nhật vi phạm.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Pencil className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Chỉnh sửa vi phạm</h3>
            <p className="text-xs text-slate-500">{violation.violatingClass}{violation.studentName ? ` — ${violation.studentName}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Target type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Đối tượng</label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
              {(["class", "student"] as const).map((t, i) => (
                <button
                  key={t}
                  onClick={() => { setEditTargetType(t); setSelectedStudent(null); setStudentSearch(""); }}
                  className={`flex-1 py-2 transition-colors ${i > 0 ? "border-l border-slate-200" : ""} ${editTargetType === t ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {t === "class" ? "Lớp" : "Học sinh"}
                </button>
              ))}
            </div>
          </div>

          {/* Student search (if student target) */}
          {editTargetType === "student" ? (
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Học sinh</label>
              <input
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                placeholder="Tìm học sinh (vd: Quốc Việt 12A1)"
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); setEditStudentName(e.target.value); }}
              />
              {/* Suggestions dropdown */}
              {studentSearch && !selectedStudent && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {studentSuggestions === undefined ? (
                    <div className="px-3 py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tìm...
                    </div>
                  ) : studentSuggestions.length > 0 ? (
                    <ul>
                      {(studentSuggestions as any[]).map((s, i) => (
                        <li
                          key={i}
                          className="px-3 py-2.5 cursor-pointer hover:bg-indigo-50 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors"
                          onClick={() => handleSelectStudent(s)}
                        >
                          <span className="font-medium">{s.fullName}</span>
                          <span className="text-slate-400 ml-1.5">({s.className})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-3 py-3 text-center text-xs text-slate-400">Không tìm thấy học sinh</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Lớp vi phạm</label>
              <input
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={editClass}
                onChange={e => setEditClass(e.target.value)}
                placeholder="vd: 11A2"
              />
            </div>
          )}

          {/* Violation type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Loại vi phạm</label>
            <ViolationTypePicker
              categories={VIOLATION_CATEGORIES.map(cat => ({
                ...cat,
                violations: cat.violations.filter(v => editTargetType === "student" || !PERSONAL_VIOLATIONS.includes(v)),
              })).filter(cat => cat.violations.length > 0)}
              value={editType}
              onChange={setEditType}
            />
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Chi tiết (tùy chọn)</label>
            <textarea
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              value={editDetails}
              onChange={e => setEditDetails(e.target.value)}
              rows={2}
              placeholder="Mô tả thêm nếu cần..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ violation, onClose }: { violation: ViolationWithDetails; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const deleteViolation = useAction(api.violations.deleteViolation);

  const handleDelete = async () => {
    setDeleting(true);
    setProgress([]);
    try {
      const ev = (violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0);
      if (ev > 0) setProgress(p => [...p, `Đang xóa ${ev} file bằng chứng...`]);
      setProgress(p => [...p, "Đang xóa báo cáo..."]);
      await deleteViolation({ violationId: violation._id });
      setProgress(p => [...p, "✓ Hoàn tất!"]);
      setTimeout(() => { toast.success("Đã xóa vi phạm."); onClose(); }, 400);
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <h3 className="font-bold text-slate-900 flex-1">Xác nhận xóa</h3>
          {!deleting && <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
        </div>
        <div className="px-5 py-4 space-y-3">
          {!deleting ? (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                <div><span className="font-medium">Lớp:</span> {violation.violatingClass}</div>
                {violation.studentName && <div><span className="font-medium">Học sinh:</span> {violation.studentName}</div>}
                <div><span className="font-medium">Vi phạm:</span> {violation.violationType}</div>
                {((violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)) > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {(violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)} file bằng chứng sẽ bị xóa
                  </div>
                )}
              </div>
              <p className="text-xs text-rose-600 font-medium">Không thể hoàn tác sau khi xóa.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">Hủy</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /><span className="text-sm font-medium">Đang xóa...</span></div>
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                {progress.map((m, i) => <div key={i} className={m.startsWith("✓") ? "text-emerald-600 font-medium" : "text-slate-600"}>{m}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── ViolationList ─────────────────────────────────────────────────────────────
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
        <span className="text-sm font-medium">Đang tải...</span>
      </div>
    );
  }

  if (!violations || violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
        <Ban className="w-10 h-10 opacity-25" />
        <p className="text-sm font-medium">Chưa có vi phạm nào trong khoảng này</p>
      </div>
    );
  }

  const role = (currentUser as any)?.role ?? (currentUser as any)?.profile?.role;
  const isAdmin = role === "admin";
  const myUserId = currentUser?._id;

  return (
    <div className="space-y-2">
      {violations.map(v => (
        <ViolationCard key={v._id} violation={v} isAdminView={isAdminView} isAdmin={!!isAdmin} myUserId={myUserId} isDarkMode={isDarkMode} />
      ))}
    </div>
  );
}

// ── ViolationCard ─────────────────────────────────────────────────────────────
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
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [mediaModal, setMediaModal] = useState<MediaModalData | null>(null);

  const resolveViolation = useMutation(api.violations.resolveViolation);
  const logs = useQuery(api.violations.getViolationLogs, (isAdminView && showLogs) ? { violationId: violation._id } : "skip");

  const canEdit = isAdmin || (myUserId && violation.reporterId === myUserId);
  const points = violationPointsMap.get(violation.violationType) ?? 0;
  const hasEvidence = (violation.evidenceUrls?.filter(Boolean).length ?? 0) > 0;

  const dateStr = (() => {
    try { return format(new Date(violation.violationDate), "EEE dd/MM", { locale: vi }); }
    catch { return ""; }
  })();

  const reporterDisplay = (violation as any).requesterName || violation.reporterName || "—";

  const handleResolve = async () => {
    try {
      await resolveViolation({ violationId: violation._id });
      toast.success("Đã đánh dấu đã xử lý.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openMedia = useCallback((url: string) => {
    const ext = url.split(".").pop()?.toLowerCase() || "";
    const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);
    const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
    if (!isVideo && !isImage) { window.open(url, "_blank"); return; }
    setMediaModal({
      url, type: isVideo ? "video" : "image",
      info: {
        student: violation.studentName || (violation.targetType === "class" ? "Vi phạm lớp" : "—"),
        cls: violation.violatingClass,
        details: violation.details ? `${violation.violationType}: ${violation.details}` : violation.violationType,
      },
    });
  }, [violation]);

  const sc = {
    reported: { label: "Đã báo cáo", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    appealed: { label: "Kháng cáo", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    resolved: { label: "Đã xử lý", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending: { label: "Chờ xử lý", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  }[violation.status as "reported" | "appealed" | "resolved" | "pending"] ?? { label: violation.status, cls: "bg-slate-100 text-slate-500 border-slate-200" };

  return (
    <>
      <div className={`rounded-xl border transition-shadow ${expanded ? "border-indigo-200 shadow-md bg-white" : "border-slate-200/80 shadow-sm bg-white/90 hover:shadow-md"}`}>
        {/* Collapsed header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          {/* Points badge */}
          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
            points === 0 ? "bg-slate-100 text-slate-500" :
            points <= 3 ? "bg-amber-50 text-amber-700 border border-amber-200" :
            points <= 5 ? "bg-orange-50 text-orange-700 border border-orange-200" :
            "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            -{points}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm">{violation.violatingClass}</span>
              {violation.targetType === "student" && violation.studentName && (
                <span className="text-slate-700 text-sm truncate max-w-[140px] sm:max-w-[200px]">{violation.studentName}</span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.cls}`}>
                {sc.label}
              </span>
              {hasEvidence && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-indigo-600 font-medium">
                  <Eye className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {violation.violationType}
              {dateStr && <span className="ml-2 text-slate-400">{dateStr}</span>}
            </p>
          </div>

          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>

        {/* Expanded body */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
            {/* Detail grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Lớp</span>
                <p className="font-semibold text-slate-800">{violation.violatingClass}</p>
              </div>
              {violation.targetType === "student" && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Học sinh</span>
                  <p className="font-semibold text-slate-800">{violation.studentName || "—"}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ngày</span>
                <p className="text-slate-700">{dateStr}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vi phạm</span>
                <p className="font-semibold text-slate-800">{violation.violationType}</p>
              </div>
              {violation.details && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Chi tiết</span>
                  <p className="text-slate-700">{violation.details}</p>
                </div>
              )}
              <div className="col-span-2 sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Báo cáo bởi</span>
                <p className="text-slate-700">{reporterDisplay}</p>
              </div>
            </div>

            {/* Appeal reason */}
            {violation.status === "appealed" && violation.appealReason && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm">
                <span className="font-semibold text-amber-800">Lý do kháng cáo: </span>
                <span className="text-amber-900">{violation.appealReason}</span>
              </div>
            )}

            {/* Evidence */}
            {hasEvidence && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Bằng chứng</p>
                <div className="flex flex-wrap gap-2">
                  {(violation.evidenceUrls ?? []).filter(Boolean).map((url, i) => (
                    <button
                      key={i}
                      onClick={() => openMedia(url!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      Xem bằng chứng {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Edit logs */}
            {isAdminView && (
              <div>
                <button
                  onClick={() => setShowLogs(l => !l)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  <History className="w-3.5 h-3.5" />
                  {showLogs ? "Ẩn lịch sử" : "Lịch sử chỉnh sửa"}
                </button>
                {showLogs && (
                  <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
                    {logs === undefined ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</div>
                    ) : logs.length === 0 ? (
                      <p className="text-xs text-slate-400">Chưa có chỉnh sửa nào.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {logs.map((log: any) => (
                          <li key={log._id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                            <div className="text-slate-400 mb-0.5">{new Date(log.timestamp).toLocaleString("vi-VN")}</div>
                            {log.changes.map((c: any, idx: number) => (
                              <div key={idx} className="text-slate-700">
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

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              {isAdminView && violation.status === "appealed" && (
                <button
                  onClick={handleResolve}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đánh dấu đã xử lý
                </button>
              )}
              {!isAdminView && violation.status === "reported" && (
                <button
                  onClick={() => setShowAppealModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold transition-colors"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5" /> Kháng cáo
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                </button>
              )}
              {isAdminView && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {mediaModal && <MediaViewer data={mediaModal} onClose={() => setMediaModal(null)} />}
      {showAppealModal && <AppealModal violation={violation} onClose={() => setShowAppealModal(false)} />}
      {showEditModal && <EditModal violation={violation} onClose={() => setShowEditModal(false)} />}
      {showDeleteModal && <DeleteModal violation={violation} onClose={() => setShowDeleteModal(false)} />}
    </>
  );
}
