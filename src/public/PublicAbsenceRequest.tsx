import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { User, Users, FileText, Send, AlertCircle, CheckCircle, X } from "lucide-react";
import imageCompression from 'browser-image-compression';

interface SelectedStudent {
  name: string;
  className: string;
  absenceType: "Nghỉ học có phép" | "Đi học muộn có phép";
  reason: string;
  files: File[];
}

interface SubmitResult {
  successCount: number;
  skippedCount: number;
  successfulStudents: string[];
  skippedStudents: Array<{ name: string; className: string; reason: string }>;
}

const PublicAbsenceRequest = () => {
  // Form state
  const [requesterName, setRequesterName] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Error and success state
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // Time validation state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isInAfternoonWindow, setIsInAfternoonWindow] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");

  // Query server time with polling every 10 seconds
  const serverTime = useQuery(
    (api as any).absenceRequests?.getCurrentServerTime,
    {}
  );

  // Sync with server time and set initial time
  useEffect(() => {
    const timeData = serverTime;
    
    if (timeData !== undefined) {
      const now = new Date(timeData.timestamp);
      setCurrentTime(now);
      
      const isBeforeMorning = timeData.isBeforeMorningCutoff;
      const isAfternoon = timeData.isInAfternoonWindow;
      
      setCanSubmit(isBeforeMorning || isAfternoon);
      setIsInAfternoonWindow(isAfternoon);
    }
  }, [serverTime]);

  // Update displayed time and countdown every second
  useEffect(() => {
    if (!currentTime) return;

    const interval = setInterval(() => {
      // Increment current time by 1 second
      setCurrentTime((prevTime) => {
        if (!prevTime) return prevTime;
        return new Date(prevTime.getTime() + 1000);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime]);

  // Calculate time remaining whenever currentTime changes
  useEffect(() => {
    if (!currentTime) return;

    const now = currentTime;
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    const isBeforeMorning = hour < 7 || (hour === 7 && minute < 15);
    const isAfternoon = hour >= 12;

    // Calculate time remaining based on current window
    if (isBeforeMorning) {
      // Morning window - show countdown to 7:15 AM
      const cutoff = new Date(now);
      cutoff.setHours(7, 15, 0, 0);
      
      const diff = cutoff.getTime() - now.getTime();
      
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeRemaining(`${hours} giờ ${minutes} phút`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes} phút ${seconds} giây`);
        } else {
          setTimeRemaining(`${seconds} giây`);
        }
      } else {
        setTimeRemaining("");
      }
    } else if (!isAfternoon) {
      // Locked period (7:15 AM - 12:00 PM) - show countdown to noon
      const noonTime = new Date(now);
      noonTime.setHours(12, 0, 0, 0);
      
      const diff = noonTime.getTime() - now.getTime();
      
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        setTimeRemaining(`${hours} giờ ${minutes} phút`);
      } else {
        setTimeRemaining("");
      }
    } else {
      // Afternoon window - no countdown needed
      setTimeRemaining("");
    }
  }, [currentTime]);

  // Poll server time every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger re-query by updating a dummy state
      // The useQuery hook will automatically refetch
    }, 10000);

    return () => clearInterval(interval);
  }, []);



  // Query student suggestions
  const studentSuggestions = useQuery(
    api.users.searchStudents,
    studentSearch.trim() ? { q: studentSearch } : "skip"
  );

  // Mutations
  const submitAbsenceRequest = useMutation((api as any).absenceRequests?.submitPublicAbsenceRequest);
  const generateR2UploadUrl = useMutation((api as any).r2?.generateR2UploadUrl);

  // Handle student selection
  const handleSelectStudent = (student: { fullName: string; className: string }) => {
    // Check if student is already selected
    const alreadySelected = selectedStudents.some(
      (s) => s.name === student.fullName && s.className === student.className
    );

    if (alreadySelected) {
      setErrorMessage("Học sinh này đã được chọn");
      return;
    }

    // Add student to selected list with default absence type, empty reason and files
    setSelectedStudents([
      ...selectedStudents,
      { name: student.fullName, className: student.className, absenceType: "Nghỉ học có phép", reason: "", files: [] },
    ]);

    // Clear search
    setStudentSearch("");
  };

  // Handle removing a student from selection
  const handleRemoveStudent = (index: number) => {
    setSelectedStudents(selectedStudents.filter((_, i) => i !== index));
  };

  // Client-side validation
  const validateForm = (): boolean => {
    setErrorMessage(""); // Clear previous errors
    
    // Validate requester name
    const trimmedName = requesterName.trim();
    if (!trimmedName) {
      setErrorMessage("Vui lòng nhập tên người xin phép");
      return false;
    }
    if (trimmedName.length < 2) {
      setErrorMessage("Tên người xin phép quá ngắn");
      return false;
    }
    if (trimmedName.length > 100) {
      setErrorMessage("Tên người xin phép quá dài");
      return false;
    }

    // Validate at least one student selected
    if (selectedStudents.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một học sinh");
      return false;
    }

    // Validate each student has reason and evidence files
    const studentsWithoutReason = selectedStudents.filter(s => !s.reason.trim());
    if (studentsWithoutReason.length > 0) {
      setErrorMessage(`Vui lòng nhập lý do cho: ${studentsWithoutReason.map(s => s.name).join(", ")}`);
      return false;
    }
    
    const studentsWithoutEvidence = selectedStudents.filter(s => s.files.length === 0);
    if (studentsWithoutEvidence.length > 0) {
      setErrorMessage(`Vui lòng tải bằng chứng cho: ${studentsWithoutEvidence.map(s => s.name).join(", ")}`);
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        initialQuality: 0.8,
      };

      // Upload files for each student and prepare data
      const studentsWithEvidence = await Promise.all(
        selectedStudents.map(async (student) => {
          const evidenceR2Keys: string[] = [];
          
          // Upload this student's files
          const uploadPromises = student.files.map(async (file) => {
            try {
              let fileToUpload = file;
              // Only compress images, not videos
              if (file.type.startsWith('image/')) {
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
              
              if (result.ok) {
                return key;
              } else {
                throw new Error(`Upload failed with status: ${result.status}`);
              }
            } catch (error) {
              throw new Error(`Lỗi khi xử lý tệp ${file.name} cho ${student.name}: ${(error as Error).message}`);
            }
          });
          
          const uploadedKeys = await Promise.all(uploadPromises);
          
          return {
            name: student.name,
            className: student.className,
            absenceType: student.absenceType,
            reason: student.reason.trim(),
            evidenceR2Keys: uploadedKeys,
          };
        })
      );

      const result = await submitAbsenceRequest({
        requesterName: requesterName.trim(),
        students: studentsWithEvidence,
      });

      // Handle success - show modal
      setSubmitResult(result);
      setShowSuccessModal(true);
      
      // Reset form on success
      if (result.successCount > 0) {
        setRequesterName("");
        setSelectedStudents([]);
        setStudentSearch("");
      }
    } catch (error) {
      // Handle error - show inline error
      const errorMsg = error instanceof Error ? error.message : "Có lỗi xảy ra khi gửi đơn";
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen animated-gradient-bg">
      {/* Header - Floating Island */}
      <div className="sticky top-4 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="glass-card rounded-3xl px-4 py-3">
          {/* School Info, Title and Time */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm flex-shrink-0">
                <img 
                  src="https://www.dropbox.com/scl/fi/23fj64gvknqcw0fu6ibzw/icon.ico?rlkey=t0qmc0ffbkoh5z16g5xts105w&st=for1a0hd&raw=1" 
                  alt="Logo trường" 
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg" 
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 font-display truncate">
                  CSDL Cờ đỏ THPTS2BT
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-600 truncate">
                  {currentTime ? currentTime.toLocaleTimeString("vi-VN", { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    second: "2-digit",
                    hour12: false 
                  }) : "Đang tải..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <h1 className="text-xs sm:text-base font-bold text-slate-800 leading-tight">
                XIN PHÉP
              </h1>
            </div>
          </div>
          
          {/* Time Status */}
          {currentTime && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {canSubmit ? (
                <>
                  <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm text-green-800 px-4 py-2 rounded-xl border border-green-300/50 shadow-lg">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">
                      {isInAfternoonWindow 
                        ? "Đang mở - Xin phép cho NGÀY MAI" 
                        : timeRemaining 
                          ? `Còn ${timeRemaining} để gửi đơn cho HÔM NAY`
                          : "Đang mở - Xin phép cho HÔM NAY"}
                    </span>
                  </div>
                  {isInAfternoonWindow && (
                    <p className="text-xs text-amber-700 font-bold bg-amber-100/50 px-3 py-1 rounded-lg">
                      ⚠️ Lưu ý: Đơn xin phép sẽ có hiệu lực cho NGÀY MAI
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-sm text-red-800 px-4 py-2 rounded-xl border border-red-300/50 shadow-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-bold">
                    {timeRemaining 
                      ? `Đã khóa - Mở lại sau ${timeRemaining}`
                      : "Đã khóa - Vui lòng quay lại sau"}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <p className="text-xs text-slate-600 text-center mt-2 font-medium">
            Thời gian mở: 0h00 - 7h15 (xin cho hôm nay) | 12h00 - 24h00 (xin cho ngày mai)
          </p>
          
          {/* Debug Mode Indicator */}
          {serverTime?.isDebugMode && (
            <div className="mt-3 bg-yellow-100 border-2 border-yellow-500 rounded-xl p-3">
              <p className="text-xs font-bold text-yellow-900 text-center mb-1">
                ĐANG TRONG CHẾ ĐỘ DEBUG
              </p>
              <p className="text-xs text-yellow-800 text-center">
                Trạng thái thật: {serverTime.actualIsBeforeMorningCutoff 
                  ? "Trước 7h15 (mở)" 
                  : serverTime.actualIsInAfternoonWindow 
                    ? "Sau 12h (mở)" 
                    : "7h15-12h (khóa)"}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-card">
          {!canSubmit && (
            <div className="mb-6 bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-sm border border-red-300/50 rounded-2xl p-5 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-6 h-6 text-red-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 text-lg">Hiện không thể gửi đơn xin phép</p>
                <p className="text-sm text-red-800 mt-2 font-medium">
                  Hệ thống chỉ chấp nhận đơn xin phép trong 2 khung giờ:
                </p>
                <ul className="text-sm text-red-800 mt-2 ml-4 list-disc font-medium">
                  <li><strong>0h00 - 7h15:</strong> Xin phép cho hôm nay</li>
                  <li><strong>12h00 - 24h00:</strong> Xin phép cho ngày mai</li>
                </ul>
                <p className="text-sm text-red-800 mt-2 font-medium">
                  Vui lòng quay lại sau {timeRemaining}.
                </p>
              </div>
            </div>
          )}
          
          {isInAfternoonWindow && canSubmit && (
            <div className="mb-6 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 backdrop-blur-sm border border-amber-300/50 rounded-2xl p-5 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-lg">⚠️ Lưu ý quan trọng</p>
                <p className="text-sm text-amber-800 mt-2 font-medium">
                  Bạn đang xin phép trong khung giờ <strong>12h00 - 24h00</strong>. Đơn xin phép này sẽ có hiệu lực cho <span className="font-bold underline">NGÀY MAI</span>, không phải hôm nay.
                </p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Requester Name */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Tên người xin phép
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Nhập tên người xin phép"
                className="auth-input-field"
                disabled={isSubmitting || !canSubmit}
                required
              />
            </div>

            {/* Student Search */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Chọn học sinh
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm kiếm học sinh (ví dụ: Nguyễn Mạnh Trường 12A1)"
                  className="auth-input-field"
                  disabled={isSubmitting || !canSubmit}
                />
                
                {/* Dropdown results */}
                {studentSearch.trim() && (
                  <div className="mt-2 bg-white rounded-xl shadow-lg border border-slate-200 max-h-60 overflow-y-auto">
                    {studentSuggestions === undefined ? (
                      <div className="px-4 py-3 text-center text-slate-700">
                        <div className="form-loading-spinner mx-auto mb-2"></div>
                        <p className="text-xs font-medium">Đang tìm kiếm...</p>
                      </div>
                    ) : studentSuggestions.length > 0 ? (
                      studentSuggestions.map((student, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectStudent(student)}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-b-0"
                        >
                          <span className="font-bold text-slate-900 text-sm">{student.fullName}</span>
                          <span className="text-slate-600 ml-2 text-sm">({student.className})</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-slate-600 text-sm">
                        Không tìm thấy học sinh
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Students */}
              {selectedStudents.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Đã chọn {selectedStudents.length} học sinh
                  </p>
                  {selectedStudents.map((student, idx) => (
                    <div key={idx} className="bg-white border-2 border-indigo-300 rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-slate-900 block">{student.name}</span>
                          <span className="text-xs text-slate-600">({student.className})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(idx)}
                          disabled={isSubmitting || !canSubmit}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Loại xin phép
                        </label>
                        <div className="flex gap-2">
                          <label className="flex items-center cursor-pointer bg-white hover:bg-indigo-50 p-2 rounded-lg flex-1 border border-slate-300">
                            <input
                              type="radio"
                              name={`absenceType-${idx}`}
                              value="Nghỉ học có phép"
                              checked={student.absenceType === "Nghỉ học có phép"}
                              onChange={(e) => {
                                const updated = [...selectedStudents];
                                updated[idx].absenceType = e.target.value as "Nghỉ học có phép";
                                setSelectedStudents(updated);
                              }}
                              disabled={isSubmitting || !canSubmit}
                              className="mr-2 h-4 w-4"
                            />
                            <span className="text-slate-800 font-semibold text-xs">Nghỉ học</span>
                          </label>
                          <label className="flex items-center cursor-pointer bg-white hover:bg-indigo-50 p-2 rounded-lg flex-1 border border-slate-300">
                            <input
                              type="radio"
                              name={`absenceType-${idx}`}
                              value="Đi học muộn có phép"
                              checked={student.absenceType === "Đi học muộn có phép"}
                              onChange={(e) => {
                                const updated = [...selectedStudents];
                                updated[idx].absenceType = e.target.value as "Đi học muộn có phép";
                                setSelectedStudents(updated);
                              }}
                              disabled={isSubmitting || !canSubmit}
                              className="mr-2 h-4 w-4"
                            />
                            <span className="text-slate-800 font-semibold text-xs">Đi muộn</span>
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Lý do <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={student.reason}
                          onChange={(e) => {
                            const updated = [...selectedStudents];
                            updated[idx].reason = e.target.value;
                            setSelectedStudents(updated);
                          }}
                          placeholder="Nhập lý do (tối thiểu 5 ký tự)"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                          rows={2}
                          disabled={isSubmitting || !canSubmit}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Bằng chứng <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            const updated = [...selectedStudents];
                            updated[idx].files = files;
                            setSelectedStudents(updated);
                          }}
                          disabled={isSubmitting || !canSubmit}
                          className="block w-full text-xs text-slate-700 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
                        />
                        {student.files.length > 0 && (
                          <p className="text-xs text-green-700 mt-1 font-medium">
                            ✓ {student.files.length} tệp đã chọn
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900">Lỗi</p>
                  <p className="text-sm text-red-800 mt-1">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage("")}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="auth-button relative"
            >
              {isSubmitting ? (
                <>
                  <div className="form-loading-spinner mr-2"></div>
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 inline mr-2" />
                  Gửi đơn xin phép
                </>
              )}
            </button>
          </form>

          {/* Loading Overlay */}
          {isSubmitting && (
            <div className="form-loading-overlay">
              <div className="text-center">
                <div className="form-loading-spinner mx-auto mb-4"></div>
                <p className="text-slate-800 font-bold text-lg">Đang xử lý đơn xin phép...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && submitResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Gửi đơn thành công!</h2>
                  <p className="text-sm text-slate-700">Đơn xin phép đã được ghi nhận</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-slate-600 hover:text-slate-900 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Success Summary */}
            <div className="space-y-4">
              {submitResult.successCount > 0 && (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                  <p className="font-bold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Đã gửi thành công cho {submitResult.successCount} học sinh
                  </p>
                  <ul className="space-y-1 ml-7">
                    {submitResult.successfulStudents.map((student, idx) => (
                      <li key={idx} className="text-sm text-green-900">
                        • {student}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {submitResult.skippedCount > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                  <p className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {submitResult.skippedCount} học sinh bị bỏ qua
                  </p>
                  <ul className="space-y-2 ml-7">
                    {submitResult.skippedStudents.map((student, idx) => (
                      <li key={idx} className="text-sm text-amber-900">
                        • <span className="font-semibold">{student.name}</span> ({student.className}): {student.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Info about when the request is effective */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-bold">Lưu ý:</span> Đơn xin phép có hiệu lực cho{" "}
                  <span className="font-bold">
                    {isInAfternoonWindow ? "NGÀY MAI" : "HÔM NAY"}
                  </span>
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicAbsenceRequest;
