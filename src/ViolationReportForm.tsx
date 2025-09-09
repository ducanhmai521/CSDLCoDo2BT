import { FormEvent, useState, useRef } from "react";
import { normalizeClassName, isValidClassName } from "./lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { AIViolationInputModal } from "./AIViolationInputModal"; // Import the new modal

const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(category => category.violations);

export default function ViolationReportForm() {
  const [targetType, setTargetType] = useState<"student" | "class">("class");
  const [studentName, setStudentName] = useState("");
  const [violatingClass, setViolatingClass] = useState("");
  const [violationType, setViolationType] = useState(ALL_VIOLATIONS[0]);
  const [details, setDetails] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedClass = normalizeClassName(violatingClass);
  const classFilter = isValidClassName(normalizedClass) ? normalizedClass : undefined;
  const studentSuggestions = useQuery(api.users.searchStudents, studentName ? { className: classFilter, q: studentName } : "skip");

  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const reportViolation = useMutation(api.violations.reportViolation);

  const resetForm = () => {
    setTargetType("class");
    setStudentName("");
    setViolatingClass("");
    setViolationType(ALL_VIOLATIONS[0]);
    setDetails("");
    setSelectedFiles([]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const evidenceFileIds: Id<"_storage">[] = [];
    if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
            if (file.size > 15 * 1024 * 1024) {
                toast.error(`Kích thước tệp ${file.name} không được vượt quá 15MB.`);
                return;
            }
        }

        const uploadPromises = selectedFiles.map(async (file) => {
            const postUrl = await generateUploadUrl();
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();
            return storageId;
        });
        
        evidenceFileIds.push(...await Promise.all(uploadPromises));
    }

    try {
      const normalizedClass = normalizeClassName(violatingClass);
      if (!isValidClassName(normalizedClass)) {
        toast.error("Tên lớp vi phạm không hợp lệ. Ví dụ: 10A1, 11A2, 12B3.");
        return;
      }

      await reportViolation({
        targetType,
        studentName: targetType === "student" ? studentName : undefined,
        violatingClass: normalizedClass || "",
        violationDate: Date.now(),
        violationType,
        details: details || "",
        evidenceFileIds,
      });
      toast.success("Báo cáo vi phạm thành công!");
      resetForm();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white/70 backdrop-blur-md rounded-xl shadow-md border border-white/50">
      <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Báo cáo vi phạm</h2>
          <AIViolationInputModal onBulkSubmitSuccess={resetForm} />
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="font-semibold block mb-3 text-slate-700">Đối tượng vi phạm</label>
        <div className="flex space-x-6">
          <label className="flex items-center cursor-pointer hover:text-primary transition-colors">
            <input
              type="radio"
              name="targetType"
              value="class"
              checked={targetType === "class"}
              onChange={() => setTargetType("class")}
              className="mr-2 h-4 w-4 text-primary focus:ring-primary-light"
            />
            Lớp
          </label>
          <label className="flex items-center cursor-pointer hover:text-primary transition-colors">
            <input
              type="radio"
              name="targetType"
              value="student"
              checked={targetType === "student"}
              onChange={() => setTargetType("student")}
              className="mr-2 h-4 w-4 text-primary focus:ring-primary-light"
            />
            Học sinh
          </label>
        </div>
      </div>

      {targetType === "student" && (
        <input
          className="auth-input-field bg-slate-50 border-slate-200 shadow-sm"
          placeholder="Tên học sinh"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          required
        />
      )}
      <input
        className="auth-input-field bg-slate-50 border-slate-200 shadow-sm"
        placeholder="Lớp vi phạm (ví dụ: 10A1)"
        value={violatingClass}
        onChange={(e) => setViolatingClass(e.target.value)}
        required
      />
      {targetType === "student" && studentName && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-800">Gợi ý tên học sinh</p>
            <span className="text-xs text-blue-600">{classFilter ? `Đang lọc theo lớp ${classFilter}` : 'Không lọc theo lớp'}</span>
          </div>
          {studentSuggestions === undefined ? (
            <p className="text-xs text-blue-500">Đang tải...</p>
          ) : (studentSuggestions as any[]).length === 0 ? (
            <p className="text-xs text-blue-500">Không có gợi ý.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(studentSuggestions as any[]).map((s, idx) => (
                <button key={idx} type="button" className="text-xs bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50 transition-all" onClick={() => setStudentName(s.fullName)}>
                  {s.fullName} ({s.className})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <select
        className="auth-input-field bg-slate-50 border-slate-200 shadow-sm"
        value={violationType}
        onChange={(e) => setViolationType(e.target.value)}
      >
        {VIOLATION_CATEGORIES.map((category) => (
          <optgroup key={category.name} label={`${category.name} (-${category.points} điểm)`}>
            {category.violations.map((violation) => (
              <option key={violation} value={violation}>
                {violation}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div>
        <textarea
          className="auth-input-field min-h-[120px] bg-slate-50 border-slate-200 shadow-inner"
          placeholder="Chi tiết vi phạm"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />
        <p className="text-xs text-slate-500 mt-1">Có thể bỏ trống với các lỗi "Đi muộn" hoặc "Vệ sinh muộn".</p>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="font-semibold block mb-2 text-slate-700">Bằng chứng (tùy chọn, tối đa 15MB mỗi tệp)</label>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
        />
      </div>

      <button type="submit" className="auth-button">
        Gửi Báo cáo
      </button>
    </form>
  );
}
