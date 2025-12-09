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
  DialogClose,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { normalizeClassName } from "./lib/utils";
import { stringSimilarity } from "string-similarity-js";
import imageCompression from 'browser-image-compression';
import React from "react";

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
  const [showAdvanced, setShowAdvanced] = useState(false); // New state for collapsible options
  const [selectedAIModel, setSelectedAIModel] = useState<string>("moonshotai/kimi-k2-instruct-0905"); // AI model selection state

  // Lock zoom when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const viewport = document.querySelector('meta[name="viewport"]');
      const originalContent = viewport?.getAttribute('content');
      viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      
      return () => {
        if (originalContent) {
          viewport?.setAttribute('content', originalContent);
        }
      };
    }
  }, [isOpen]);

  const parseViolationsWithAI = useAction(api.ai.parseViolationsWithAI);
  const parseAttendanceWithAI = useAction(api.ai.parseAttendanceWithAI);
  const bulkReportViolations = useMutation(api.violations.bulkReportViolations);
  const generateR2UploadUrl = useMutation(api.r2.generateR2UploadUrl);
  const allStudents = useQuery(api.users.getAllStudents);
  const allUserProfiles = useQuery(api.users.getAllUserProfiles);
  const myProfile = useQuery(api.users.getMyProfile);

  const { classRosterCounts } = useMemo(() => {
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
      id: s._id,
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
        ? await parseAttendanceWithAI({ rawText, model: selectedAIModel })
        : await parseViolationsWithAI({ rawText, model: selectedAIModel });

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

          const exactMatch = targetStudents.find(
            (s) => s.fullName.toLowerCase() === parsedName
          );
          
          if (exactMatch) {
            matchedViolation.studentName = exactMatch.fullName;
          } else {
            const containsMatches = targetStudents.filter((s) =>
              s.fullName.toLowerCase().includes(parsedName)
            );
            
            if (containsMatches.length === 1) {
              matchedViolation.studentName = containsMatches[0].fullName;
            } else {
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

    if (inputMode === "attendance") {
      const sortedClasses = [...checkedClasses].sort();
      const otherStudentViolations: ParsedViolation[] = [];
      const absenceKeywords = ["vắng", "nghỉ"];
      const lateKeywords = ["muộn"];

      for (const v of parsedViolations) {
        if (v.targetType === "student" && v.studentName) {
          const violationText = (v.violationType + (v.details || "")).toLowerCase();
          const isLate = lateKeywords.some((k) => violationText.includes(k));
          const isAbsence = absenceKeywords.some((k) => violationText.includes(k));

          if (!isLate && !isAbsence) {
            otherStudentViolations.push(v);
          }
        }
      }

      const attendanceReportLines = sortedClasses.map((className) => {
        const normalizedClass = normalizeClassName(className);
        const attendanceData = attendanceByClass[normalizedClass];
        const totalStudents = classRosterCounts[normalizedClass] || 0;
        
        const absentCount = attendanceData?.absentStudents.length || 0;
        const lateCount = attendanceData?.lateStudents.length || 0;
        const presentCount = totalStudents - absentCount;
        
        let line = `${className}: ${presentCount}/${totalStudents}`;
        if (absentCount > 0) line += ` (Vắng: ${attendanceData!.absentStudents.join(", ")})`;
        if (lateCount > 0) line += ` (Muộn có phép: ${attendanceData!.lateStudents.join(", ")})`;
        return line;
      });

      const attendanceReportString = "\nSĩ số các lớp:\n" + attendanceReportLines.join("\n");

      const studentViolations = otherStudentViolations
        .map((v) => {
          const violationText = (v.violationType + (v.details || "")).toLowerCase();
          const isLate = lateKeywords.some((k) => violationText.includes(k));
          let detail = v.details || v.violationType;
          if (isLate) detail = "Đi muộn không phép";
          return `- ${v.studentName} (${v.violatingClass}): ${detail}`;
        })
        .join("\n");

      const classViolations = parsedViolations
        .filter((v) => v.targetType === "class")
        .map((v) => `- ${v.violatingClass}: ${v.details || v.violationType}`)
        .join("\n");

      const reportString = `Ngày trực: ${formattedDate}\nNgười trực: ${myProfile.fullName} (${myProfile.className})\nCác lớp đã kiểm tra: ${sortedClasses.join(", ")}${attendanceReportString}\nNội dung vi phạm nền nếp:${studentViolations ? "\n" + studentViolations : " Không có"}\nNội dung tự quản:${classViolations ? "\n" + classViolations : " Không có"}`;

      try {
        await navigator.clipboard.writeText(reportString);
        toast.success("Đã sao chép mẫu báo cáo!");
        if (andSubmit) await handleSubmit(true);
      } catch (err) {
        toast.error("Không thể sao chép.");
      }
    } else {
      // Violations mode logic (same as original)
      const sortedViolations = [...parsedViolations].sort((a, b) => {
        if (a.violatingClass !== b.violatingClass) {
          return a.violatingClass.localeCompare(b.violatingClass);
        }
        return (a.studentName || "").localeCompare(b.studentName || "");
      });

      const studentViolations = sortedViolations
        .filter((v) => v.targetType === "student" && v.studentName)
        .map((v) => `- ${v.studentName} (${v.violatingClass}): ${v.details || v.violationType}`)
        .join("\n");

      const classViolations = sortedViolations
        .filter((v) => v.targetType === "class")
        .map((v) => `- ${v.violatingClass}: ${v.details || v.violationType}`)
        .join("\n");

      const reportString = `Ngày trực: ${formattedDate}\nNgười trực: ${myProfile.fullName} (${myProfile.className})\nNội dung vi phạm nền nếp:${studentViolations ? "\n" + studentViolations : " Không có"}\nNội dung tự quản:${classViolations ? "\n" + classViolations : " Không có"}`;

      try {
        await navigator.clipboard.writeText(reportString);
        toast.success("Đã sao chép mẫu báo cáo!");
        if (andSubmit) await handleSubmit(true);
      } catch (err) {
        toast.error("Không thể sao chép.");
      }
    }
  };

  const handleBackToInput = () => {
    setCurrentView("input");
  };

  const handleSubmit = async (fromCopy = false) => {
    if (!fromCopy) setIsSubmitting(true);
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
        const confirmed = window.confirm("Một hoặc nhiều báo cáo không có bằng chứng. Tiếp tục?");
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
                
                return result.ok ? key : null;
              } catch (error) {
                console.error(error);
                return null;
              }
            });
            evidenceR2Keys = (await Promise.all(uploadPromises)).filter((k): k is string => k !== null);
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

      if (result.successCount > 0) toast.success(`Gửi thành công ${result.successCount} báo cáo.`);
      if (result.duplicateCount > 0) toast.warning(`${result.duplicateCount} báo cáo trùng lặp đã bỏ qua.`);

      setRawText("");
      setParsedViolations([]);
      setCustomDate(null);
      setCustomReporterId(null);
      setIsOpen(false);
      setCurrentView("input");
      onBulkSubmitSuccess();
    } catch (error) {
      toast.error("Lỗi khi gửi: " + (error as Error).message);
    } finally {
      if (!fromCopy) setIsSubmitting(false);
    }
  };

  const handleSubmitAndCopy = async () => {
    setIsSubmitting(true);
    await handleCopyReport(true);
    setIsSubmitting(false);
  }

  // Common SVG Icons for reuse
  const Icons = {
    Flag: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    Clipboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    Magic: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    Plus: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    Trash: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    ChevronDown: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
    ChevronUp: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
    Upload: <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* ... Button trigger giữ nguyên */}
        <Button
          variant="default"
          className="w-full py-6 text-lg font-semibold relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-cyan-500 to-primary/80 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.9)] transition-all duration-500 group"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 opacity-60 blur-xl animate-pulse" />
          <span className="relative flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
             {/* Icon Magic */}
             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             Nhập liệu hàng loạt
          </span>
        </Button>
      </DialogTrigger>
      
      {/* SỬA ĐỔI 1: Thêm [&>button]:hidden để ẩn nút X mặc định bị trùng */}
      <DialogContent className="[&>button]:hidden max-w-3xl w-[100vw] h-[100dvh] sm:h-auto sm:max-h-[85vh] p-0 flex flex-col gap-0 bg-gradient-to-br from-white via-cyan-50 to-blue-50 border-none sm:border sm:rounded-2xl sm:shadow-2xl overflow-hidden">
        
        {/* Header giữ nguyên */}
        <DialogHeader className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-white/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            {currentView === "input" ? "Nhập liệu AI" : "Kiểm tra kết quả"}
          </DialogTitle>
          <DialogClose className="rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </DialogClose>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {currentView === "input" ? (
             // ... Phần input mode giữ nguyên như cũ
             <div className="flex flex-col gap-5 pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInputMode("attendance")}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                    inputMode === "attendance"
                      ? "border-blue-500 bg-blue-50/80 text-blue-700 shadow-md transform scale-[1.02]"
                      : "border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className={`p-2 rounded-full ${inputMode === 'attendance' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-sm">Cờ đỏ</span>
                    <span className="block text-[10px] opacity-80 mt-0.5">Sĩ số + Vi phạm</span>
                  </div>
                </button>

                <button
                  onClick={() => setInputMode("violations")}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                    inputMode === "violations"
                      ? "border-blue-500 bg-blue-50/80 text-blue-700 shadow-md transform scale-[1.02]"
                      : "border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className={`p-2 rounded-full ${inputMode === 'violations' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-sm">Trực tuần</span>
                    <span className="block text-[10px] opacity-80 mt-0.5">Chỉ vi phạm</span>
                  </div>
                </button>
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700">Nội dung báo cáo</label>
                  <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full border">{rawText.length} ký tự</span>
                </div>
                <Textarea
                  placeholder={inputMode === "attendance" 
                    ? `10A1: vắng An, Bình; muộn Cường...\n10A2 đủ...`
                    : `An 10A1 sai dp\nBình 10A2 tóc...`}
                  className="min-h-[200px] sm:min-h-[250px] resize-none w-full p-4 border-gray-200 bg-white/80 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm md:text-base leading-relaxed shadow-inner"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  disabled={isParsing || isSubmitting}
                />
              </div>

               {/* Advanced Options Collapsible */}
               {(myProfile?.role === "gradeManager" || myProfile?.isSuperUser) && (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span>Cài đặt nâng cao (Ngày/Người báo cáo)</span>
                    {showAdvanced ? (
                         <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    ) : (
                         <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                  </button>
                  
                  {showAdvanced && (
                    <div className="p-3 bg-gray-50 space-y-3 border-t border-gray-100 animate-in slide-in-from-top-2">
                      <div className="space-y-1">
                         <label className="text-xs text-gray-500">Override ngày</label>
                         <Input
                          type="datetime-local"
                          className="bg-white text-sm h-9"
                          onChange={(e) => setCustomDate(e.target.value ? new Date(e.target.value).getTime() : null)}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">AI Model</label>
                        <select
                          value={selectedAIModel}
                          onChange={(e) => setSelectedAIModel(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="moonshotai/kimi-k2-instruct-0905">moonshotai/kimi-k2-instruct-0905</option>
                          <option value="groq/compound-mini">groq/compound-mini</option>
                          <option value="groq/compound">groq/compound</option>
                          <option value="meta-llama/llama-4-maverick-17b-128e-instruct">meta-llama/llama-4-maverick-17b-128e-instruct</option>
                          <option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>
                        </select>
                      </div>
                      
                      {myProfile?.isSuperUser && (
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Override người báo cáo</label>
                          <input
                            list="reporter-list"
                            className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Chọn người..."
                            onChange={(e) => {
                              const p = allUserProfiles?.find(p => p.fullName === e.target.value);
                              setCustomReporterId(p?.userId || null);
                            }}
                          />
                          <datalist id="reporter-list">
                            {allUserProfiles?.map((p) => (
                              <option key={p.userId} value={p.fullName}>{p.fullName} - {p.className}</option>
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // RESULTS VIEW
            <div className="flex flex-col gap-4 pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
               {/* Attendance Summary */}
               {inputMode === "attendance" && Object.keys(attendanceByClass).length > 0 && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 shadow-sm">
                  <h4 className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">Tổng hợp sĩ số</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(attendanceByClass).map(([className, data]) => {
                      const total = allStudents?.filter(s => normalizeClassName(s.className) === normalizeClassName(className)).length || 0;
                      const present = total - data.absentStudents.length;
                      return (
                        <div key={className} className="bg-white rounded px-2.5 py-1.5 border border-blue-100 text-xs flex flex-col">
                          <div className="flex justify-between font-medium text-gray-700">
                            <span>{className}</span>
                            <span>{present}/{total}</span>
                          </div>
                          {(data.absentStudents.length > 0 || data.lateStudents.length > 0) && (
                             <div className="mt-1 pt-1 border-t border-gray-50 text-[10px] text-gray-500 leading-tight">
                                {data.absentStudents.length > 0 && <div className="text-red-500">V: {data.absentStudents.join(", ")}</div>}
                                {data.lateStudents.length > 0 && <div className="text-orange-500">M: {data.lateStudents.join(", ")}</div>}
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Violations List */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Danh sách vi phạm ({parsedViolations.length})</h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 bg-green-50 border-green-200 hover:bg-green-100" onClick={handleAddViolation}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                       Thêm
                    </Button>
                 </div>
                 
                 {parsedViolations.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                       <p className="text-gray-400 text-sm">Chưa có vi phạm nào</p>
                    </div>
                 ) : (
                   parsedViolations.map((v, i) => {
                     const studentOptionsForClass = studentsByClass.get(normalizeClassName(v.violatingClass)) || studentOptions;
                     return (
                        <div key={i} className="group bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200 hover:border-blue-300 transition-all relative">
                           {/* Index Badge */}
                           <div className="absolute -left-2 -top-2 bg-gray-800 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md z-10">
                             {i + 1}
                           </div>

                           {/* Warning Alert */}
                           {v.studentName && v.targetType === 'student' && (() => {
                              const match = allStudents?.some(s => s.fullName.toLowerCase() === v.studentName?.toLowerCase() && normalizeClassName(s.className) === normalizeClassName(v.violatingClass));
                              return !match ? (
                                <div className="mb-3 px-2 py-1.5 bg-yellow-50 text-yellow-800 text-[10px] sm:text-xs rounded border border-yellow-200 flex items-center gap-1.5">
                                  ⚠️ Chưa khớp tên trong danh sách. Vui lòng chọn lại.
                                </div>
                              ) : null;
                           })()}

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Student & Class */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Học sinh</label>
                                <input
                                  list={`students-list-${i}`}
                                  value={v.studentName || ""}
                                  onChange={(e) => handleFieldChange(i, "studentName", e.target.value)}
                                  className="w-full text-sm font-medium border-b border-gray-200 focus:border-blue-500 outline-none py-1.5 bg-transparent placeholder:font-normal"
                                  placeholder="Nhập tên..."
                                />
                                <datalist id={`students-list-${i}`}>
                                  {studentOptionsForClass.map((opt: any) => (
                                    <option key={opt.id} value={opt.value}>{opt.label}</option>
                                  ))}
                                </datalist>
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Lớp</label>
                                <input
                                  value={v.violatingClass}
                                  onChange={(e) => handleFieldChange(i, "violatingClass", e.target.value)}
                                  className="w-full text-sm font-medium border-b border-gray-200 focus:border-blue-500 outline-none py-1.5 bg-transparent"
                                />
                              </div>
                              
                              {/* Violation Type */}
                              <div className="col-span-1 sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Loại vi phạm</label>
                                <select
                                  value={v.violationType}
                                  onChange={(e) => handleFieldChange(i, "violationType", e.target.value)}
                                  className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:bg-white transition-colors focus:ring-1 focus:ring-blue-500 outline-none"
                                >
                                  {VIOLATION_CATEGORIES.map((category) => (
                                    <optgroup key={category.name} label={`${category.name} (${category.points} điểm)`}>
                                      {category.violations.map((violation) => (
                                        <option key={violation} value={violation}>
                                          {violation}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>

                              {/* Violation Details */}
                              <div className="col-span-1 sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Chi tiết</label>
                                <input
                                    value={v.details || ""}
                                    onChange={(e) => handleFieldChange(i, "details", e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Ví dụ: quần bò, không sơ vin..."
                                />
                              </div>

                              {/* Evidence Upload */}
                              <div className="col-span-1 sm:col-span-2 space-y-2 pt-1">
                                 <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                    <label className="flex-shrink-0 cursor-pointer w-12 h-12 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                                       <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(i, e.target.files)} />
                                       <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </label>
                                    
                                    {v.evidenceFiles?.map((file, idx) => (
                                       <div key={idx} className="relative flex-shrink-0 w-12 h-12 group/img">
                                          <img src={URL.createObjectURL(file)} className="w-full h-full object-cover rounded-lg border border-gray-200" alt="evidence" />
                                          <button 
                                            onClick={() => handleRemoveFile(i, idx)}
                                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity"
                                          >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>

                           {/* Delete Button */}
                           <button onClick={() => handleDeleteViolation(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                        </div>
                     );
                   })
                 )}
              </div>
            </div>
          )}
        </div>

        {/* Footer giữ nguyên */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-20">
          {currentView === "input" ? (
             <>
               <Button variant="ghost" className="w-full sm:w-auto text-gray-600" onClick={() => setIsOpen(false)}>Hủy</Button>
               <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                 <Button
                    onClick={() => {
                       if (rawText.trim() && !window.confirm("Bỏ qua dữ liệu đã nhập?")) return;
                       handleAddViolation();
                       setCurrentView("results");
                    }}
                    variant="outline"
                    className="flex-1 sm:flex-none border-gray-300 text-gray-700"
                    disabled={isSubmitting}
                  >
                    Thủ công
                  </Button>
                  <Button
                    onClick={handleParse}
                    disabled={isParsing || isSubmitting || !allStudents}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all"
                  >
                    {isParsing ? "Đang xử lý..." : "Phân tích AI"}
                  </Button>
               </div>
             </>
          ) : (
             <>
               <Button variant="outline" onClick={handleBackToInput} className="w-full sm:w-auto border-gray-200">
                  ← Quay lại
               </Button>
               <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                  {inputMode === "attendance" && (
                     <Button
                        onClick={handleSubmitAndCopy}
                        disabled={isSubmitting || parsedViolations.length === 0}
                        className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                     >
                        Gửi & Copy
                     </Button>
                  )}
                  <Button
                     onClick={() => handleSubmit()}
                     disabled={isSubmitting || parsedViolations.length === 0}
                     className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-200 hover:shadow-green-300"
                  >
                     {isSubmitting ? "Đang gửi..." : `Gửi báo cáo (${parsedViolations.length})`}
                  </Button>
               </div>
             </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}