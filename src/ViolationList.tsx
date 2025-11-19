import { useState } from "react";
import { ViolationWithDetails } from "../convex/violations";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { Loader2, X, Trash2, AlertTriangle } from "lucide-react";

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
    const deleteViolation = useAction(api.violations.deleteViolation);
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
    const [showEvidences, setShowEvidences] = useState<boolean[]>(violation.evidenceUrls ? Array(violation.evidenceUrls.length).fill(false) : []);
    
    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteProgress, setDeleteProgress] = useState<string[]>([]);

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
        setIsDeleting(true);
        setDeleteProgress([]);
        
        try {
            // Show evidence files being deleted
            const evidenceCount = (violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0);
            if (evidenceCount > 0) {
                setDeleteProgress(prev => [...prev, `Đang xóa ${evidenceCount} file bằng chứng...`]);
                
                // Show individual file names if available
                if (violation.evidenceR2Keys && violation.evidenceR2Keys.length > 0) {
                    violation.evidenceR2Keys.forEach(key => {
                        const fileName = key.split('/').pop() || key;
                        setDeleteProgress(prev => [...prev, `Xóa: ${fileName}`]);
                    });
                }
            }
            
            setDeleteProgress(prev => [...prev, "Đang xóa báo cáo vi phạm..."]);
            await deleteViolation({ violationId: violation._id });
            
            setDeleteProgress(prev => [...prev, "✓ Hoàn tất!"]);
            setTimeout(() => {
                toast.success("Đã xóa báo cáo vi phạm.");
                setShowDeleteModal(false);
            }, 500);
        } catch (error) {
            toast.error((error as Error).message);
            setIsDeleting(false);
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
                        {new Date(violation.violationDate).toLocaleString('vi-VN')} bởi {(violation as any).requesterName || violation.reporterName}
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
                    <div className="space-y-2">
                        {violation.evidenceUrls.map((url, index) => {
                            if (!url) return null;
                            
                            const extension = url.split('.').pop()?.toLowerCase() || '';
                            
                            return (
                                <div key={index}>
                                    <button 
                                        onClick={() => {
                                            const newShows = [...showEvidences];
                                            newShows[index] = !newShows[index];
                                            setShowEvidences(newShows);
                                        }} 
                                        className="text-primary hover:underline text-sm"
                                    >
                                        {showEvidences[index] ? 'Ẩn' : 'Xem'} bằng chứng {index + 1}
                                    </button>
                                    {showEvidences[index] && (
                                        <>
                                            {(() => {
                                                // Video extensions
                                                const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
                                                if (videoExtensions.includes(extension)) {
                                                    return (
                                                        <div className="border rounded-lg overflow-hidden mt-1">
                                                            <video 
                                                                src={url} 
                                                                controls 
                                                                className="w-full max-h-64 object-contain"
                                                                preload="metadata"
                                                            >
                                                                Trình duyệt của bạn không hỗ trợ video.
                                                            </video>
                                                            <a 
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-primary hover:underline text-sm block text-center py-1"
                                                            >
                                                                Tải video về nếu không xem được
                                                            </a>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Image extensions
                                                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                                                if (imageExtensions.includes(extension)) {
                                                    return (
                                                        <div className="border rounded-lg overflow-hidden mt-1">
                                                            <img 
                                                                src={url} 
                                                                alt={`Bằng chứng ${index + 1}`} 
                                                                className="w-full max-h-64 object-contain"
                                                                loading="lazy"
                                                            />
                                                            <a 
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-primary hover:underline text-sm block text-center py-1"
                                                            >
                                                                Xem full size
                                                            </a>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Fallback for other files
                                                return (
                                                    <a 
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-primary hover:underline block mt-1"
                                                    >
                                                        Xem bằng chứng {index + 1} ({extension.toUpperCase()})
                                                    </a>
                                                );
                                            })()}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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
                     <button onClick={() => setShowDeleteModal(true)} className="text-sm font-semibold text-red-600 hover:text-red-700">
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
            
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100 opacity-100">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Xác nhận xóa</h3>
                            </div>
                            {!isDeleting && (
                                <button 
                                    onClick={() => setShowDeleteModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        
                        {/* Content */}
                        <div className="p-6">
                            {!isDeleting ? (
                                <>
                                    <p className="text-slate-700 mb-4">
                                        Bạn có chắc chắn muốn xóa báo cáo vi phạm này không?
                                    </p>
                                    <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                                        <div><span className="font-medium">Lớp:</span> {violation.violatingClass}</div>
                                        {violation.studentName && (
                                            <div><span className="font-medium">Học sinh:</span> {violation.studentName}</div>
                                        )}
                                        <div><span className="font-medium">Vi phạm:</span> {violation.violationType}</div>
                                        {((violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)) > 0 && (
                                            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded mt-2">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                <span>
                                                    Sẽ xóa {(violation.evidenceR2Keys?.length || 0) + (violation.evidenceFileIds?.length || 0)} file bằng chứng
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-red-600 font-medium">
                                        Hành động này không thể hoàn tác!
                                    </p>
                                </>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                        <span className="font-medium text-slate-900">Đang xóa...</span>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                                        {deleteProgress.map((msg, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`text-sm py-1 ${msg.startsWith('✓') ? 'text-green-600 font-medium' : 'text-slate-600'}`}
                                            >
                                                {msg}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer */}
                        {!isDeleting && (
                            <div className="flex gap-3 p-6 border-t border-slate-200">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Xóa
                                </button>
                            </div>
                        )}
                    </div>
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
