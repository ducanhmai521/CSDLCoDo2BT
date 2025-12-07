import { useState, useMemo, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { normalizeClassName } from "./lib/utils";
import { stringSimilarity } from "string-similarity-js";
import imageCompression from 'browser-image-compression';

const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(
  (category) => category.violations
);

interface ParsedViolation {
  studentName: string | null;
  violatingClass: string;
  violationType: string;
  details: string | null;
  targetType: "student" | "class";
  originalText: string;
  evidenceFiles?: File[];
}

type InputMode = "attendance" | "violations";

export function AIViolationInputModal({
  onBulkSubmitSuccess,
}: {
  onBulkSubmitSuccess: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [parsedViolations, setParsedViolations] = useState<ParsedViolation[]>(
    []
  );
  const [checkedClasses, setCheckedClasses] = useState<string[]>([]);
  const [attendanceByClass, setAttendanceByClass] = useState<Record<string, { absentStudents: string[]; lateStudents: string[] }>>({});
  const [customDate, setCustomDate] = useState<number | null>(null);
  const [customReporterId, setCustomReporterId] = useState<Id<"users"> | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"input" | "results">("input");
  const [inputMode, setInputMode] = useState<InputMode>("violations");

  const parseViolationsWithAI = useAction(api.ai.parseViolationsWithAI);
  const parseAttendanceWithAI = useAction(api.ai.parseAttendanceWithAI);
  const bulkReportViolations = useMutation(api.violations.bulkReportViolations);
  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const generateR2UploadUrl = useMutation(api.r2.generateR2UploadUrl);
  const allStudents = useQuery(api.users.getAllStudents);
  const allUserProfiles = useQuery(api.users.getAllUserProfiles);
  const myProfile = useQuery(api.users.getMyProfile);

  const { classRosterCounts, normalizedToOriginalClassMap } = useMemo(() => {
    if (!allStudents)
      return { classRosterCounts: {}, normalizedToOriginalClassMap: {} };
    const counts: { [key: string]: number } = {};
    const nameMap: { [key: string]: string } = {};
    for (const student of allStudents) {
      const normalizedName = normalizeClassName(student.className);
      if (!counts[normalizedName]) {
        counts[normalizedName] = 0;
        nameMap[normalizedName] = student.className;
      }
      counts[normalizedName]++;
    }
    return { classRosterCounts: counts, normalizedToOriginalClassMap: nameMap };
  }, [allStudents]);

  const studentOptions = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.map((s) => ({
      value: s.fullName,
      label: `${s.fullName} - ${s.className}`,
      id: s._id, // <<< SỬA ĐỔI 1: Thêm ID duy nhất
    }));
  }, [allStudents]);

  const studentsByClass = useMemo(() => {
    if (!allStudents) return new Map();
    const map = new Map<
      string,
      { value: string; label: string; id: string }[]
    >();
    for (const student of allStudents) {
      const normalizedClass = normalizeClassName(student.className);
      if (!map.has(normalizedClass)) {
        map.set(normalizedClass, []);
      }
      map.get(normalizedClass)!.push({
        value: student.fullName,
        label: `${student.fullName} - ${student.className}`,
        id: student._id,
      });
    }
    return map;
  }, [allStudents]);

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập danh sách.");
      return;
    }
    if (!allStudents) {
      toast.error("Chưa tải được danh sách học sinh, vui lòng thử lại.");
      return;
    }

    setIsParsing(true);
    try {
      const result = inputMode === "attendance" 
        ? await parseAttendanceWithAI({ rawText })
        : await parseViolationsWithAI({ rawText });

      const matchedResults = result.violations.map((v: any) => {
        let matchedViolation: ParsedViolation = {
          ...v,
          studentName: v.studentName || null,
          details: v.details || null,
          targetType: v.studentName ? "student" : "class",
        };

        if (matchedViolation.studentName) {
          const parsedName = matchedViolation.studentName.trim().toLowerCase();
          const studentsInClass = allStudents.filter(
            (s) =>
              normalizeClassName(s.className) ===
              normalizeClassName(matchedViolation.violatingClass)
          );

          const targetStudents =
            studentsInClass.length > 0 ? studentsInClass : allStudents;

          const studentNames = targetStudents.map((s) => s.fullName);

          if (studentNames.length > 0) {
            const ratings = studentNames.map((name) => ({
              name,
              score: stringSimilarity(parsedName, name.toLowerCase()),
            }));
            const bestMatch = ratings.reduce((prev, curr) =>
              prev.score > curr.score ? prev : curr
            );

            if (bestMatch.score > 0.5) {
              matchedViolation.studentName = bestMatch.name;
            }
          }
        }
        return matchedViolation;
      });

      setParsedViolations(matchedResults);
      setCheckedClasses(result.checkedClasses);
      
      if (inputMode === "attendance" && 'attendanceByClass' in result) {
        setAttendanceByClass(result.attendanceByClass as Record<string, { absentStudents: string[]; lateStudents: string[] }>);
      }
      
      setCurrentView("results");
      toast.success(`Đã phân tích xong ${matchedResults.length} mục.`);
    } catch (error) {
      toast.error("Lỗi khi phân tích bằng AI: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFieldChange = (
    index: number,
    field: keyof ParsedViolation,
    value: string
  ) => {
    const updatedViolations = [...parsedViolations];
    const violationToUpdate = { ...updatedViolations[index] };

    if (field === "studentName") {
      violationToUpdate.studentName = value || null;
      violationToUpdate.targetType = value ? "student" : "class";
    } else if (field === "violatingClass") {
      violationToUpdate.violatingClass = value;
    } else if (field === "violationType") {
      violationToUpdate.violationType = value;
    } else if (field === "details") {
      violationToUpdate.details = value;
    }

    updatedViolations[index] = violationToUpdate;
    setParsedViolations(updatedViolations);
  };

  const handleFileChange = (index: number, files: FileList | null) => {
    if (!files) return;
    const updatedViolations = [...parsedViolations];
    const newFiles = Array.from(files);
    if (updatedViolations[index].evidenceFiles) {
      updatedViolations[index].evidenceFiles?.push(...newFiles);
    } else {
      updatedViolations[index].evidenceFiles = newFiles;
    }
    setParsedViolations(updatedViolations);
  };

  const handleRemoveFile = (violationIndex: number, fileIndex: number) => {
    const updatedViolations = [...parsedViolations];
    updatedViolations[violationIndex].evidenceFiles?.splice(fileIndex, 1);
    setParsedViolations(updatedViolations);
  };

  const handleDeleteViolation = (index: number) => {
    const updatedViolations = parsedViolations.filter((_, i) => i !== index);
    setParsedViolations(updatedViolations);
  };

  const handleAddViolation = () => {
    const newViolation: ParsedViolation = {
      studentName: null,
      violatingClass: "",
      violationType: ALL_VIOLATIONS[0] || "",
      details: null,
      targetType: "class",
      originalText: "Thêm mới",
      evidenceFiles: [],
    };
    setParsedViolations([...parsedViolations, newViolation]);
  };

  const handleCopyReport = async (andSubmit = false) => {
    const formattedDate = customDate
      ? new Date(customDate).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");

    if (!myProfile) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    const checkedClasses = Array.from(
      new Set(parsedViolations.map((v) => v.violatingClass))
    ).sort();

    const absenceKeywords = ["vắng", "nghỉ"];
    const lateKeywords = ["muộn"];
    const permittedKeywords = ["có phép", "cp"];

    const lateWithPermission = new Map<string, string[]>();
    const unexcusedAbsences = new Map<string, string[]>();
    const otherStudentViolations: ParsedViolation[] = [];

    for (const v of parsedViolations) {
      if (v.targetType === "student" && v.studentName) {
        const violationText = (
          v.violationType + (v.details || "")
        ).toLowerCase();
        const isLate = lateKeywords.some((k) => violationText.includes(k));
        const isAbsence = absenceKeywords.some((k) =>
          violationText.includes(k)
        );
        const isPermitted = permittedKeywords.some((k) =>
          violationText.includes(k)
        );

        if (isLate && isPermitted) {
          if (!lateWithPermission.has(v.violatingClass)) {
            lateWithPermission.set(v.violatingClass, []);
          }
          lateWithPermission.get(v.violatingClass)!.push(v.studentName);
        } else if (isAbsence && !isPermitted) {
          if (!unexcusedAbsences.has(v.violatingClass)) {
            unexcusedAbsences.set(v.violatingClass, []);
          }
          unexcusedAbsences.get(v.violatingClass)!.push(v.studentName);
        } else {
          otherStudentViolations.push(v);
        }
      }
    }

    const attendanceReportLines = checkedClasses.map((className) => {
      const absentees = unexcusedAbsences.get(className) || [];
      const latecomers = lateWithPermission.get(className) || [];

      const attendanceStatus =
        absentees.length > 0
          ? `Vắng ${absentees.length} (${absentees.join(", ")})`
          : "Đủ";

      const lateNote =
        latecomers.length > 0
          ? ` (${latecomers.join(", ")} đi muộn có phép)`
          : "";

      return `${className}: ${attendanceStatus}${lateNote}`;
    });

    const attendanceReportString =
      "\nSĩ số các lớp:\n" + attendanceReportLines.join("\n");

    const studentViolations = otherStudentViolations
      .map((v) => {
        const violationText = (
          v.violationType + (v.details || "")
        ).toLowerCase();
        const isLate = lateKeywords.some((k) => violationText.includes(k));
        let detail = v.details || v.violationType;
        if (isLate) {
          detail = "Đi muộn không phép";
        }
        return `- ${v.studentName} (${v.violatingClass}): ${detail}`;
      })
      .join("\n");

    const classViolations = parsedViolations
      .filter((v) => v.targetType === "class")
      .map(
        (v) => `- ${v.violatingClass}: ${v.details || v.violationType}`
      )
      .join("\n");

    const reportString = `Ngày trực: ${formattedDate}\nNgười trực: ${myProfile.fullName} (${myProfile.className})\nCác lớp đã kiểm tra: ${checkedClasses.join(", ")}${attendanceReportString}\nNội dung vi phạm nền nếp:${
      studentViolations ? "\n" + studentViolations : " Không có"
    }\nNội dung tự quản:${
      classViolations ? "\n" + classViolations : " Không có"
    }`;

    try {
      await navigator.clipboard.writeText(reportString);
      toast.success("Đã sao chép mẫu báo cáo vào clipboard!");
      if (andSubmit) {
        await handleSubmit(true); // Pass a flag to avoid recursion
      }
    } catch (err) {
      toast.error("Không thể sao chép. Vui lòng thử lại.");
      console.error("Failed to copy: ", err);
    }
  };

  const handleBackToInput = () => {
    setCurrentView("input");
  };

  const handleSubmit = async (fromCopy = false) => {
    if (!fromCopy) {
      setIsSubmitting(true);
    }
    try {
      const violationsToSubmit = [...parsedViolations];

      if (violationsToSubmit.length === 0) {
        toast.info("Không có báo cáo nào để gửi.");
        setIsSubmitting(false);
        return;
      }

      const hasViolationWithoutEvidence = violationsToSubmit.some(
        (v) => !v.evidenceFiles || v.evidenceFiles.length === 0
      );

      if (hasViolationWithoutEvidence) {
        const confirmed = window.confirm(
          "Một hoặc nhiều báo cáo không có bằng chứng. Bạn sẽ phải tự chịu trách nhiệm nếu có tranh cãi. Tiếp tục?"
        );
        if (!confirmed) {
          setIsSubmitting(false);
          return;
        }
      }

      const violationsWithFileIds = await Promise.all(
        violationsToSubmit.map(async (v) => {
          let evidenceR2Keys: string[] = [];
          if (v.evidenceFiles && v.evidenceFiles.length > 0) {
            const compressionOptions = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1280,
              useWebWorker: true,
              initialQuality: 0.8,
            };

            const uploadPromises = v.evidenceFiles.map(async (file) => {
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
                toast.error(`Lỗi khi xử lý tệp ${file.name}: ${(error as Error).message}`);
                console.error(error);
                return null;
              }
            });
            const successfulKeys = (await Promise.all(uploadPromises)).filter(
              (key): key is string => key !== null
            );
            evidenceR2Keys = successfulKeys;
          }
          return {
            studentName: v.studentName || undefined,
            violatingClass: v.violatingClass,
            violationType: v.violationType,
            details: v.details || undefined,
            targetType: v.targetType,
            evidenceR2Keys,
          };
        })
      );

      const result = await bulkReportViolations({
        violations: violationsWithFileIds,
        customDate: customDate ?? undefined,
        customReporterId: customReporterId ?? undefined,
      });

      if (result.successCount > 0) {
        toast.success(`Đã gửi thành công ${result.successCount} báo cáo.`);
      }

      if (result.duplicateCount > 0) {
        const duplicateList = result.duplicates.join("\n");
        toast.warning(
          `${result.duplicateCount} báo cáo bị trùng lặp đã được bỏ qua.`,
          {
            description: (
              <pre className="whitespace-pre-wrap text-xs">
                {duplicateList}
              </pre>
            ),
            duration: 10000,
          }
        );
      }

      if (result.successCount === 0 && result.duplicateCount > 0) {
        toast.info("Không có báo cáo nào được gửi vì tất cả đều bị trùng lặp.");
      }


      setRawText("");
      setParsedViolations([]);
      setCustomDate(null);
      setCustomReporterId(null);
      setIsOpen(false);
      setCurrentView("input");
      onBulkSubmitSuccess();
    } catch (error) {
      toast.error("Lỗi khi gửi hàng loạt: " + (error as Error).message);
      console.error(error);
    } finally {
      if (!fromCopy) {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitAndCopy = async () => {
    setIsSubmitting(true);
    await handleCopyReport(true);
    setIsSubmitting(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
<Button
  variant="default"
  className="w-full py-6 text-lg font-semibold 
             relative overflow-hidden rounded-2xl 
             bg-gradient-to-r from-primary via-purple-500 to-primary/80 
             text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] 
             hover:shadow-[0_0_35px_rgba(139,92,246,0.9)] 
             transition-all duration-500"
>
  <span className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-60 blur-xl animate-pulse" />
  <span className="relative flex items-center justify-center">
    <svg
      className="h-5 w-5 mr-2 drop-shadow-md"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
    Nhập liệu hàng loạt
  </span>
</Button>
      </DialogTrigger>
<DialogContent className="max-w-lg w-[95vw] max-h-[90vh] flex flex-col 
  bg-gradient-to-br from-white/80 via-purple-100/70 to-blue-100/70
  backdrop-blur-lg 
  border border-white/30 
  shadow-2xl rounded-2xl">
        <DialogHeader className="pb-3 border-b border-gray-200">
          <DialogTitle className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
            Nhập liệu vi phạm hàng loạt
          </DialogTitle>
        </DialogHeader>
        {currentView === "input" ? (
          <div className="flex flex-col space-y-3 flex-grow overflow-auto p-1">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Chế độ nhập liệu</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setInputMode("attendance")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMode === "attendance"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs font-semibold">Cờ đỏ</span>
                    <span className="text-[10px] text-center">Sĩ số + Vi phạm</span>
                  </div>
                </button>
                <button
                  onClick={() => setInputMode("violations")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMode === "violations"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-semibold">Trực tuần</span>
                    <span className="text-[10px] text-center">Chỉ vi phạm</span>
                  </div>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {inputMode === "attendance" ? "Dán báo cáo sĩ số" : "Dán danh sách vi phạm"}
                </h3>
              </div>
              <div className="relative">
                <Textarea
                  placeholder={inputMode === "attendance" 
                    ? `Ví dụ (Cờ đỏ):
10A1: vắng An, Bình; muộn Cường
10A2 đủ
10A3: Dũng sai dp, vs muộn`
                    : `Ví dụ (Trực tuần):
An 10A1 sai dp
Bình 10A2 tóc
10A3 vs muộn`}
                  className="min-h-[150px] md:min-h-[180px] resize-none w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm text-gray-900 placeholder-gray-500"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  disabled={isParsing || isSubmitting}
                />
                {rawText.length > 0 && (
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/90 px-2 py-0.5 rounded border">
                    {rawText.length} ký tự
                  </div>
                )}
              </div>
            </div>
            
            {(myProfile?.role === "gradeManager" || myProfile?.isSuperUser) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Override ngày
                </label>
                <Input
                  type="datetime-local"
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                  onChange={(e) => {
                    const selectedDate = e.target.value
                      ? new Date(e.target.value).getTime()
                      : null;
                    setCustomDate(selectedDate);
                  }}
                />
              </div>
            )}
            
            {myProfile?.isSuperUser && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Override người báo cáo
                </label>
                {!allUserProfiles ? (
                  <div className="text-xs text-gray-500 italic p-2">Đang tải...</div>
                ) : allUserProfiles.length === 0 ? (
                  <div className="text-xs text-gray-500 italic p-2">Không có người dùng</div>
                ) : (
                  <input
                    list="reporter-list"
                    type="text"
                    placeholder="Chọn người báo cáo"
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                    onChange={(e) => {
                      const selectedProfile = allUserProfiles.find(p => p.fullName === e.target.value);
                      setCustomReporterId(selectedProfile?.userId || null);
                    }}
                  />
                )}
                <datalist id="reporter-list">
                  {allUserProfiles?.map((profile) => (
                    <option key={profile.userId} value={profile.fullName}>
                      {profile.fullName} - {profile.className} ({profile.role})
                    </option>
                  ))}
                </datalist>
              </div>
            )}
            
            <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200 mt-auto">
              <DialogClose asChild>
                <Button variant="ghost" className="w-full sm:w-auto text-sm py-2 text-gray-600 hover:text-gray-800">Hủy</Button>
              </DialogClose>
              <Button
                onClick={handleParse}
                disabled={isParsing || isSubmitting || !allStudents}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
              >
                {isParsing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang phân tích...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Phân tích bằng AI
                  </>
                )}
              </Button>
              <Button
                onClick={() => { 
                  if (rawText.trim()) {
                    const confirmed = window.confirm("Dữ liệu bạn đã paste sẽ KHÔNG được xử lý. Bạn sẽ nhập thủ công từ đầu. Tiếp tục?");
                    if (!confirmed) return;
                  }
                  handleAddViolation(); 
                  setCurrentView("results"); 
                }}
                disabled={isSubmitting || !allStudents}
                className="w-full sm:w-auto bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Nhập thủ công
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col space-y-2 flex-grow overflow-auto">
            {inputMode === "attendance" && Object.keys(attendanceByClass).length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                <h4 className="text-xs font-semibold text-blue-900 mb-1.5">Tổng hợp sĩ số</h4>
                <div className="space-y-1 text-[10px]">
                  {Object.entries(attendanceByClass).map(([className, data]) => {
                    const classStudents = allStudents?.filter(s => 
                      normalizeClassName(s.className) === normalizeClassName(className)
                    ) || [];
                    const totalStudents = classStudents.length;
                    const absentCount = data.absentStudents.length;
                    const presentCount = totalStudents - absentCount;
                    
                    return (
                      <div key={className} className="bg-white rounded px-2 py-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">{className}:</span>
                          <span className="text-gray-600 font-medium">{presentCount}/{totalStudents}</span>
                        </div>
                        {(absentCount > 0 || data.lateStudents.length > 0) && (
                          <div className="mt-0.5 text-[9px] leading-tight">
                            {absentCount > 0 && (
                              <span className="text-red-600">(Vắng: {data.absentStudents.join(", ")})</span>
                            )}
                            {data.lateStudents.length > 0 && (
                              <span className="text-orange-600 ml-1">(Muộn: {data.lateStudents.join(", ")})</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 text-xs pb-1.5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 whitespace-nowrap text-[11px]">
                 Kiểm tra & sửa
              </h3>
            <div className="ml-auto bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">
             {parsedViolations.length}
           </div>
<Button
  onClick={handleAddViolation}
  className="bg-green-600 hover:bg-green-700 text-white 
             px-1.5 py-0.5 rounded text-[10px] font-medium 
             flex items-center gap-0.5 transition-colors whitespace-nowrap h-5"
  >
  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
  Thêm
</Button>
          </div>
            
            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
              {parsedViolations.map((v, i) => {
                const studentOptionsForClass =
                  studentsByClass.get(normalizeClassName(v.violatingClass)) ||
                  studentOptions;
                return (
                  <div key={i} className="bg-white/40 backdrop-blur-sm border border-gray-200 rounded-lg p-2 space-y-1.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-gray-800 break-words leading-tight">
                          {v.studentName
                            ? `${v.studentName} (${v.violatingClass})`
                            : v.violatingClass}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={v.originalText}>
                          {v.originalText}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          #{i + 1}
                        </div>
                        <button
                          onClick={() => handleDeleteViolation(i)}
                          className="bg-red-500 hover:bg-red-600 text-white p-0.5 rounded transition-colors"
                          title="Xóa"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Warning if student name not found in class (only if not a full match) */}
                    {v.studentName && (() => {
                      const studentsInClass = allStudents?.filter(s => 
                        normalizeClassName(s.className) === normalizeClassName(v.violatingClass)
                      ) || [];
                      
                      // Check if it's an exact full name match
                      const isExactMatch = studentsInClass.some(s => 
                        s.fullName.toLowerCase() === v.studentName?.toLowerCase()
                      );
                      
                      // Only show warning if not an exact match and class has students
                      if (!isExactMatch && studentsInClass.length > 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-300 rounded px-2 py-1 flex items-start gap-1">
                            <svg className="w-3 h-3 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-[10px] text-yellow-800 leading-tight">
                              Vui lòng chọn họ tên đầy đủ từ danh sách
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-medium text-gray-700">Học sinh</label>
                        <input
                          list={`students-list-${i}`}
                          type="text"
                          value={v.studentName || ""}
                          onChange={(e) =>
                            handleFieldChange(i, "studentName", e.target.value)
                          }
                          className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                          placeholder="Tên"
                        />
                        <datalist id={`students-list-${i}`}>
                          {studentOptionsForClass.map((opt: { id: Key | null | undefined; value: string | number | readonly string[] | undefined; label: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }) => (
                            <option key={opt.id} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </datalist>
                      </div>
                      
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-medium text-gray-700">Lớp</label>
                        <input
                          type="text"
                          value={v.violatingClass}
                          onChange={(e) =>
                            handleFieldChange(
                              i,
                              "violatingClass",
                              e.target.value
                            )
                          }
                          className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                        />
                      </div>
                      
                      <div className="col-span-2 space-y-0.5">
                        <label className="text-[10px] font-medium text-gray-700">Loại vi phạm</label>
                        <select
                          value={v.violationType}
                          onChange={(e) =>
                            handleFieldChange(
                              i,
                              "violationType",
                              e.target.value
                            )
                          }
                          className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                        >
                          {ALL_VIOLATIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="col-span-2 space-y-0.5">
                        <label className="text-[10px] font-medium text-gray-700">Chi tiết</label>
                        <input
                          type="text"
                          value={v.details || ""}
                          onChange={(e) =>
                            handleFieldChange(i, "details", e.target.value)
                          }
                          className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                          placeholder="Mô tả"
                        />
                      </div>
                      
                      <div className="col-span-2 space-y-0.5">
                        <label className="text-[10px] font-medium text-gray-700">Bằng chứng</label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileChange(i, e.target.files)}
                          className="w-full p-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                        />
                        {v.evidenceFiles && v.evidenceFiles.length > 0 && (
                          <div className="grid grid-cols-4 gap-1 mt-1">
                            {v.evidenceFiles.map((file, fileIndex) => (
                              <div key={fileIndex} className="relative group">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`${fileIndex}`}
                                  className="h-12 w-full object-cover rounded shadow-sm"
                                />
                                <button
                                  onClick={() => handleRemoveFile(i, fileIndex)}
                                  className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                >
                                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {parsedViolations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 font-medium text-xs">Chưa có dữ liệu</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Nhấn "Thêm" để bắt đầu</p>
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-row gap-1.5 pt-2 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={handleBackToInput} 
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 text-[10px] text-gray-600 hover:text-gray-800 border-gray-300 h-9"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Quay lại
              </Button>
              
              <Button
                onClick={handleSubmitAndCopy}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg text-[10px] h-9"
                disabled={
                  isSubmitting || isParsing || parsedViolations.length === 0
                }
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Xử lý...
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Gửi & Copy
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleSubmit()}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg text-[10px] h-9"
                disabled={
                  isSubmitting || isParsing || parsedViolations.length === 0
                }
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Gửi...
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Gửi ({parsedViolations.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )}