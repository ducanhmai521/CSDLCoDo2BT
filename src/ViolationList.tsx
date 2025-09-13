import { useState } from "react";
import { ViolationWithDetails } from "../convex/violations";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";

export default function ViolationList({ violations, isLoading, isAdminView = false }: { violations: ViolationWithDetails[] | undefined, isLoading: boolean, isAdminView?: boolean }) {
    const currentUser = useQuery(api.users.getLoggedInUser);
    if (isLoading) {
        return <div className="text-center p-4">Đang tải danh sách...</div>;
    }

    if (!violations || violations.length === 0) {
        return <div className="text-center p-4 text-slate-500">Chưa có vi phạm nào được báo cáo.</div>;
    }

    const role = (currentUser as any)?.role ?? (currentUser as any)?.profile?.role;
    const isAdmin = role === 'admin';
    const myUserId = currentUser?._id;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
            {violations.map(v => <ViolationCard key={v._id} violation={v} isAdminView={isAdminView} isAdmin={!!isAdmin} myUserId={myUserId} />)}
        </div>
    );
}

function ViolationCard({ violation, isAdminView, isAdmin, myUserId }: { violation: ViolationWithDetails, isAdminView: boolean, isAdmin: boolean, myUserId: string | undefined }) {
    const [showAppealForm, setShowAppealForm] = useState(false);
    const [appealReason, setAppealReason] = useState("");
    const appealViolation = useMutation(api.violations.appealViolation);
    const resolveViolation = useMutation(api.violations.resolveViolation);
    const deleteViolation = useMutation(api.violations.deleteViolation);
    const editViolation = useMutation(api.violations.editViolation);
    const [isEditing, setIsEditing] = useState(false);
    const [editDetails, setEditDetails] = useState(violation.details || "");
    const [editType, setEditType] = useState(violation.violationType);
    const [editClass, setEditClass] = useState(violation.violatingClass);
    const [editStudentName, setEditStudentName] = useState(violation.studentName || "");
    const [editTargetType, setEditTargetType] = useState<"student" | "class">(violation.targetType);
    const [saving, setSaving] = useState(false);
    const canEdit = isAdmin || (myUserId && violation.reporterId === myUserId);
    const [showLogs, setShowLogs] = useState(false);
    const logs = useQuery(api.violations.getViolationLogs, isAdminView ? { violationId: violation._id } : "skip");

    const handleAppeal = async () => {
        if (!appealReason.trim()) {
            toast.error("Vui lòng nhập lý do kháng cáo.");
            return;
        }
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
    }

    const handleDelete = async () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa báo cáo này không? Hành động này không thể hoàn tác.")) {
            try {
                await deleteViolation({ violationId: violation._id });
                toast.success("Đã xóa báo cáo vi phạm.");
            } catch (error) {
                toast.error((error as Error).message);
            }
        }
    }

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
            toast.success("Đã cập nhật chi tiết vi phạm.");
            setIsEditing(false);
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white/80 p-4 rounded-lg shadow-sm border border-slate-200/80">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{violation.violatingClass} - <span className="font-normal">{violation.violationType}</span></p>
                    <p className="text-sm text-slate-600">
                        {new Date(violation.violationDate).toLocaleString('vi-VN')} bởi {violation.reporterName}
                    </p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColor(violation.status)}`}>
                    {translateStatus(violation.status)}
                </span>
            </div>
            {violation.targetType === 'student' && <p className="mt-2"><strong>Học sinh:</strong> {violation.studentName}</p>}
            {!isEditing ? (
                <p className="mt-2"><strong>Chi tiết:</strong> {violation.details}</p>
            ) : (
                <div className="mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Đối tượng</label>
                            <select className="auth-input-field w-full" value={editTargetType} onChange={(e) => setEditTargetType(e.target.value as any)}>
                                <option value="class">Lớp</option>
                                <option value="student">Học sinh</option>
                            </select>
                        </div>
                        {editTargetType === 'student' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tên học sinh</label>
                                <input className="auth-input-field w-full" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Lớp vi phạm</label>
                            <input className="auth-input-field w-full" value={editClass} onChange={(e) => setEditClass(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Loại vi phạm</label>
                            <select className="auth-input-field w-full" value={editType} onChange={(e) => setEditType(e.target.value)}>
                                {VIOLATION_CATEGORIES.map(category => (
                                    <optgroup label={`${category.name} (-${category.points}đ)`} key={category.name}>
                                        {category.violations.map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 mt-3">Chi tiết</label>
                    <textarea
                        className="auth-input-field w-full"
                        value={editDetails}
                        onChange={(e) => setEditDetails(e.target.value)}
                        rows={3}
                    />
                    <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveEdit} disabled={saving} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-slate-400">Lưu</button>
                        <button onClick={() => { setIsEditing(false); setEditDetails(violation.details || ""); setEditType(violation.violationType); setEditClass(violation.violatingClass); setEditStudentName(violation.studentName || ""); setEditTargetType(violation.targetType); }} className="bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm hover:bg-slate-300">Hủy</button>
                    </div>
                </div>
            )}
            {violation.evidenceUrls && violation.evidenceUrls.length > 0 && (
                <div className="mt-2">
                    <p className="font-semibold">Bằng chứng:</p>
                    <ul className="list-disc list-inside">
                        {violation.evidenceUrls.map((url, index) => (
                            url && <li key={index}>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    Xem bằng chứng {index + 1}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {violation.status === 'appealed' && <p className="mt-2 text-amber-700"><strong>Lý do kháng cáo:</strong> {violation.appealReason}</p>}

            <div className="mt-3 flex gap-4 items-center flex-wrap">
                {!isAdminView && violation.status === 'reported' && (
                    <div>
                        {!showAppealForm ? (
                            <button onClick={() => setShowAppealForm(true)} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
                                Kháng cáo
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <textarea
                                    className="auth-input-field w-full"
                                    placeholder="Nhập lý do kháng cáo..."
                                    value={appealReason}
                                    onChange={(e) => setAppealReason(e.target.value)}
                                    rows={2}
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleAppeal} className="bg-amber-500 text-white px-3 py-1 rounded text-sm hover:bg-amber-600">
                                        Gửi
                                    </button>
                                    <button onClick={() => setShowAppealForm(false)} className="bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm hover:bg-slate-300">
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {isAdminView && violation.status === 'appealed' && (
                    <button onClick={handleResolve} className="text-sm font-semibold text-green-600 hover:text-green-700">
                        Đánh dấu đã giải quyết
                    </button>
                )}
                {isAdminView && (
                     <button onClick={handleDelete} className="text-sm font-semibold text-red-600 hover:text-red-700">
                        Xóa
                    </button>
                )}
                {canEdit && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                        Chỉnh sửa chi tiết
                    </button>
                )}
                {isAdminView && (
                    <button onClick={() => setShowLogs((v) => !v)} className="text-sm font-semibold text-slate-600 hover:text-slate-700">
                        {showLogs ? 'Ẩn lịch sử' : 'Xem lịch sử chỉnh sửa'}
                    </button>
                )}
            </div>
            {isAdminView && showLogs && (
                <div className="mt-3 bg-slate-50/80 rounded p-3 border border-slate-200/80">
                    <p className="font-semibold mb-2">Lịch sử chỉnh sửa</p>
                    {logs === undefined ? (
                        <p className="text-sm text-slate-500">Đang tải...</p>
                    ) : logs.length === 0 ? (
                        <p className="text-sm text-slate-500">Chưa có chỉnh sửa nào.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {logs.map((log: any) => (
                                <li key={log._id} className="border-b border-slate-200/80 pb-2">
                                    <div className="text-slate-700">{new Date(log.timestamp).toLocaleString('vi-VN')}</div>
                                    <div className="mt-1">
                                        {log.changes.map((c: any, idx: number) => (
                                            <div key={idx}>
                                                <span className="font-medium">{c.field}</span>: "{c.oldValue}" → "{c.newValue}"
                                            </div>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

function translateStatus(status: string) {
    switch (status) {
        case 'reported': return 'Đã báo cáo';
        case 'appealed': return 'Đã kháng cáo';
        case 'resolved': return 'Đã xử lý';
        default: return 'Không xác định';
    }
}

function statusColor(status: string) {
    switch (status) {
        case 'reported': return 'bg-red-100 text-red-800';
        case 'appealed': return 'bg-amber-100 text-amber-800';
        case 'resolved': return 'bg-green-100 text-green-800';
        default: return 'bg-slate-100 text-slate-800';
    }
}
