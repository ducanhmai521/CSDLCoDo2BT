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
  const [customDate, setCustomDate] = useState<number | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"input" | "results">("input");

  const parseWithAI = useAction(api.ai.parseViolationsWithAI);
  const bulkReportViolations = useMutation(api.violations.bulkReportViolations);
  const generateUploadUrl = useMutation(api.violations.generateUploadUrl);
  const allStudents = useQuery(api.users.getAllStudents);
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
      toast.error("Vui lòng nhập danh sách vi phạm.");
      return;
    }
    if (!allStudents) {
      toast.error("Chưa tải được danh sách học sinh, vui lòng thử lại.");
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseWithAI({ rawText });

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
      const attendanceViolationTypes = [
        "Nghỉ học có phép",
        "Đi học muộn có phép",
        "Đi học muộn không phép",
        "Nghỉ học không phép",
      ];

      const seenStudents = new Set<string>();
      const violationsToSubmit: ParsedViolation[] = [];
      const conflictingViolations: ParsedViolation[] = [];

      const allViolations = [...parsedViolations];

      const getSeverity = (violation: ParsedViolation) => {
        const type = violation.violationType;
        if (type === "Nghỉ học không phép") return 4;
        if (type === "Đi học muộn không phép") return 3;
        if (type === "Nghỉ học có phép") return 2;
        if (type === "Đi học muộn có phép") return 1;
        return 0;
      };

      allViolations.sort((a, b) => getSeverity(b) - getSeverity(a));

      for (const violation of allViolations) {
        if (
          violation.studentName &&
          attendanceViolationTypes.includes(violation.violationType)
        ) {
          if (seenStudents.has(violation.studentName)) {
            conflictingViolations.push(violation);
          } else {
            violationsToSubmit.push(violation);
            seenStudents.add(violation.studentName);
          }
        } else {
          violationsToSubmit.push(violation);
        }
      }

      if (conflictingViolations.length > 0) {
        const duplicateList = conflictingViolations
          .map((v) => `${v.studentName}: ${v.violationType}`)
          .join("\n");
        toast.warning(
          `${conflictingViolations.length} báo cáo đi muộn/nghỉ bị trùng lặp đã được tự động loại bỏ.`,
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

      if (violationsToSubmit.length === 0) {
        if (parsedViolations.length > 0) {
           toast.info(
            "Không có báo cáo nào được gửi vì tất cả đều bị trùng lặp."
          );
        } else {
          toast.info("Không có báo cáo nào để gửi.");
        }
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
          let evidenceFileIds: Id<"_storage">[] = []; // Khai báo với kiểu đúng
          if (v.evidenceFiles && v.evidenceFiles.length > 0) {
            const uploadPromises = v.evidenceFiles.map(async (file) => {
              try {
                const postUrl = await generateUploadUrl();
                const result = await fetch(postUrl, {
                  method: "POST",
                  headers: { "Content-Type": file.type },
                  body: file,
                });
                const { storageId } = await result.json();
                return storageId;
              } catch (error) {
                toast.error(`Lỗi khi tải lên file: ${file.name}`);
                console.error(error);
                return null;
              }
            });
            const successfulIds = (await Promise.all(uploadPromises)).filter(
              (id): id is string => id !== null
            );
            // *** SỬA LỖI NẰM Ở ĐÂY ***
            // Ép kiểu mảng string thành mảng Id<"_storage">
            evidenceFileIds = successfulIds as Id<"_storage">[];
          }
          return {
            studentName: v.studentName || undefined,
            violatingClass: v.violatingClass,
            violationType: v.violationType,
            details: v.details || undefined,
            targetType: v.targetType,
            evidenceFileIds, // Bây giờ biến này đã có kiểu đúng
          };
        })
      );

      const result = await bulkReportViolations({
        violations: violationsWithFileIds,
        customDate: customDate ?? undefined,
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

      setRawText("");
      setParsedViolations([]);
      setCustomDate(null);
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
        <Button variant="default" className="w-full py-6 text-lg font-semibold shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary/80">
          <svg
            className="h-5 w-5 mr-2"
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
          Nhập bằng AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nhập liệu vi phạm hàng loạt bằng AI</DialogTitle>
        </DialogHeader>
        {currentView === "input" ? (
          <div className="flex flex-col space-y-2 flex-grow">
            <h3 className="font-semibold">1. Dán danh sách vi phạm</h3>
            <Textarea
              placeholder="Ví dụ:
Ngô Xuân lộc 11a8 (sai dp, dép lê)
10a8 vệ sinh muộn"
              className="h-full resize-none"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isParsing || isSubmitting}
            />
            {myProfile?.role === "gradeManager" && (
              <div className="mt-2">
                <label className="font-semibold">
                  Override ngày (không động vô nếu không cần)
                </label>
                <Input
                  type="date"
                  onChange={(e) => {
                    const selectedDate = e.target.value
                      ? new Date(e.target.value).getTime()
                      : null;
                    setCustomDate(selectedDate);
                  }}
                />
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Hủy</Button>
              </DialogClose>
              <Button
                onClick={handleParse}
                disabled={isParsing || isSubmitting || !allStudents}
              >
                {isParsing ? "Đang phân tích..." : "Phân tích"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col space-y-2 overflow-hidden">
            <h3 className="font-semibold">2. Kiểm tra và chỉnh sửa</h3>
            <div className="border rounded-md flex-grow overflow-y-auto p-4 space-y-4">
              {parsedViolations.map((v, i) => {
                const studentOptionsForClass =
                  studentsByClass.get(normalizeClassName(v.violatingClass)) ||
                  studentOptions;
                return (
                  <div key={i} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg mb-2 break-words w-full">
                        {v.studentName
                          ? `${v.studentName} (${v.violatingClass})`
                          : v.violatingClass}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Học sinh</label>
                        <input
                          list={`students-list-${i}`}
                          type="text"
                          value={v.studentName || ""}
                          onChange={(e) =>
                            handleFieldChange(i, "studentName", e.target.value)
                          }
                          className="w-full p-1 border rounded mt-1"
                        />
                        <datalist id={`students-list-${i}`}>
                          {studentOptionsForClass.map((opt: { id: Key | null | undefined; value: string | number | readonly string[] | undefined; label: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }) => (
                            <option key={opt.id} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Lớp</label>
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
                          className="w-full p-1 border rounded mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">Vi phạm</label>
                        <select
                          value={v.violationType}
                          onChange={(e) =>
                            handleFieldChange(
                              i,
                              "violationType",
                              e.target.value
                            )
                          }
                          className="w-full p-1 border rounded mt-1"
                        >
                          {ALL_VIOLATIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">Chi tiết</label>
                        <input
                          type="text"
                          value={v.details || ""}
                          onChange={(e) =>
                            handleFieldChange(i, "details", e.target.value)
                          }
                          className="w-full p-1 border rounded mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">Bằng chứng (ảnh)</label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileChange(i, e.target.files)}
                          className="w-full p-1 border rounded mt-1"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {v.evidenceFiles?.map((file, fileIndex) => (
                            <div key={fileIndex} className="relative">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`preview ${fileIndex}`}
                                className="h-20 w-20 object-cover rounded"
                              />
                              <button
                                onClick={() => handleRemoveFile(i, fileIndex)}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Dữ liệu gốc: {v.originalText}
                    </p>
                  </div>
                );
              })}
              {parsedViolations.length === 0 && (
                <p className="p-4 text-center text-slate-500">
                  Chưa có dữ liệu
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 md:gap-4">
              <Button variant="outline" onClick={handleBackToInput} className="py-6 px-4 text-base">
                Quay lại
              </Button>
               <Button
                onClick={handleSubmitAndCopy}
                className="py-6 px-4 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  isSubmitting || isParsing || parsedViolations.length === 0
                }
              >
                {isSubmitting ? "Đang xử lý..." : "Gửi và Copy"}
              </Button>
              <Button
                onClick={() => handleSubmit()}
                className="py-6 px-4 text-base font-bold"
                disabled={
                  isSubmitting || isParsing || parsedViolations.length === 0
                }
              >
                {isSubmitting
                  ? "Đang gửi..."
                  : `Gửi ${parsedViolations.length} mục`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}