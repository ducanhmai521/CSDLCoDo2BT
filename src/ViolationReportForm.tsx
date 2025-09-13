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
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{name: string, className: string} | null>(null);
  const [violatingClass, setViolatingClass] = useState("");
  const [violationType, setViolationType] = useState(ALL_VIOLATIONS[0]);
  const [details, setDetails] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentSuggestions = useQuery(api.users.searchStudents, studentSearch ? { q: studentSearch } : "skip");

  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const reportViolation = useMutation(api.violations.reportViolation);

  const resetForm = () => {
    setTargetType("class");
    setStudentSearch("");
    setSelectedStudent(null);
    setViolatingClass("");
    setViolationType(ALL_VIOLATIONS[0]);
    setDetails("");
    setSelectedFiles([]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleSelectStudent = (student: {fullName: string, className: string}) => {
    setSelectedStudent({name: student.fullName, className: student.className});
    setStudentSearch(`${student.fullName} (${student.className})`);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      const confirmed = window.confirm(
        "Báo cáo không có bằng chứng. Bạn sẽ phải tự chịu trách nhiệm nếu có tranh cãi. Tiếp tục?"
      );
      if (!confirmed) {
        return;
      }
    }
    
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
      const finalViolatingClass = targetType === 'student' ? selectedStudent?.className : violatingClass;
      const normalizedClass = normalizeClassName(finalViolatingClass || "");

      if (!isValidClassName(normalizedClass)) {
        toast.error("Tên lớp vi phạm không hợp lệ. Ví dụ: 10A1, 11A2, 12B3.");
        return;
      }

      if (targetType === 'student' && !selectedStudent) {
        toast.error("Vui lòng chọn một học sinh từ danh sách gợi ý.");
        return;
      }

      await reportViolation({
        targetType,
        studentName: targetType === "student" ? selectedStudent?.name : undefined,
        violatingClass: normalizedClass,
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
    <div className="space-y-6">
      <AIViolationInputModal onBulkSubmitSuccess={resetForm} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Báo cáo vi phạm</h2>
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
  
        {targetType === "student" ? (
          <div className="relative">
            <input
              className="auth-input-field bg-slate-50 border-slate-200 shadow-sm"
              placeholder="Tìm kiếm học sinh (ví dụ: Quốc Việt 12A1)"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setSelectedStudent(null);
              }}
              required
            />
            {studentSuggestions && studentSuggestions.length > 0 && !selectedStudent && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                <ul className="py-1">
                  {(studentSuggestions as any[]).map((s, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSelectStudent(s)}
                    >
                      {s.fullName} ({s.className})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <input
            className="auth-input-field bg-slate-50 border-slate-200 shadow-sm"
            placeholder="Lớp vi phạm (ví dụ: 10A1)"
            value={violatingClass}
            onChange={(e) => setViolatingClass(e.target.value)}
            required
          />
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
    </div>
  );
}
