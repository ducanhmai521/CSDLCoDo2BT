import { useState, useMemo } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
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
import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { normalizeClassName } from "./lib/utils";
import { stringSimilarity } from "string-similarity-js";

const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(
  (category) => category.violations
);

type ParsedViolation = {
  studentName: string | undefined;
  violatingClass: string;
  violationType: string;
  targetType: "student" | "class";
};

export function AIViolationInputModal({
  onBulkSubmitSuccess,
}: {
  onBulkSubmitSuccess: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [parsedViolations, setParsedViolations] = useState<ParsedViolation[]>(
    []
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const parseWithAI = useAction(api.ai.parseViolationsWithAI);
  const bulkReportViolations = useMutation(api.violations.bulkReportViolations);
  const allStudents = useQuery(api.users.getAllStudents);

  const studentOptions = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.map((s) => ({
      value: s.fullName,
      label: `${s.fullName} - ${s.className}`,
    }));
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

      const matchedResults = result.map((v: { studentName: string | null, violatingClass: string, violationType: string }) => {
        let matchedViolation: ParsedViolation = {
          ...v,
          studentName: v.studentName || undefined,
          targetType: v.studentName ? "student" : "class",
        };

        if (matchedViolation.studentName) {
          const studentsInClass = allStudents.filter(
            (s) => normalizeClassName(s.className) === normalizeClassName(matchedViolation.violatingClass)
          );
          
          const targetStudents = studentsInClass.length > 0 ? studentsInClass : allStudents;

          const studentNames = targetStudents.map((s) => s.fullName);
          
          if (studentNames.length > 0) {
            const ratings = studentNames.map(name => ({ name, score: stringSimilarity(matchedViolation.studentName!, name) }));
            const bestMatch = ratings.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr);

            if (bestMatch.score > 0.5) { 
              matchedViolation.studentName = bestMatch.name;
            }
          }
        }
        return matchedViolation;
      });

      setParsedViolations(matchedResults);
      toast.success(`Đã phân tích xong ${matchedResults.length} mục.`);
    } catch (error) {
      toast.error(
        "Lỗi khi phân tích bằng AI: " + (error as Error).message
      );
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

    if (field === 'studentName') {
      violationToUpdate.studentName = value || undefined;
      violationToUpdate.targetType = value ? 'student' : 'class';
    } else if (field === 'violatingClass') {
      violationToUpdate.violatingClass = value;
    } else if (field === 'violationType') {
      violationToUpdate.violationType = value;
    }

    updatedViolations[index] = violationToUpdate;
    setParsedViolations(updatedViolations);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await bulkReportViolations({ violations: parsedViolations });
      toast.success(`Đã gửi thành công ${parsedViolations.length} báo cáo.`);
      setRawText("");
      setParsedViolations([]);
      setIsOpen(false);
      onBulkSubmitSuccess();
    } catch (error) {
      toast.error("Lỗi khi gửi hàng loạt: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <svg
            className="h-4 w-4 mr-2"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-hidden">
          <div className="flex flex-col space-y-2">
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
            <Button onClick={handleParse} disabled={isParsing || isSubmitting || !allStudents}>
              {isParsing ? "Đang phân tích..." : "Phân tích"}
            </Button>
          </div>
          <div className="flex flex-col space-y-2 overflow-hidden">
            <h3 className="font-semibold">2. Kiểm tra và chỉnh sửa</h3>
            <div className="border rounded-md flex-grow overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="p-2 text-left w-2/5">Học sinh</th>
                    <th className="p-2 text-left w-1/5">Lớp</th>
                    <th className="p-2 text-left w-2/5">Vi phạm</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedViolations.map((v, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 w-2/5">
                        <input
                          list={`students-list-${i}`}
                          type="text"
                          value={v.studentName || ""}
                          onChange={(e) =>
                            handleFieldChange(i, "studentName", e.target.value)
                          }
                          className="w-full p-1 border rounded"
                        />
                        <datalist id={`students-list-${i}`}>
                          {studentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </datalist>
                      </td>
                      <td className="p-2 w-1/5">
                        <input
                          type="text"
                          value={v.violatingClass}
                          onChange={(e) =>
                            handleFieldChange(i, "violatingClass", e.target.value)
                          }
                          className="w-full p-1 border rounded"
                        />
                      </td>
                      <td className="p-2 w-2/5">
                        <select
                          value={v.violationType}
                          onChange={(e) =>
                            handleFieldChange(i, "violationType", e.target.value)
                          }
                          className="w-full p-1 border rounded"
                        >
                          {ALL_VIOLATIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedViolations.length === 0 && (
                <p className="p-4 text-center text-slate-500">
                  Chưa có dữ liệu
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Hủy</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || isParsing || parsedViolations.length === 0
            }
          >
            {isSubmitting ? "Đang gửi..." : `Gửi ${parsedViolations.length} mục`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}