import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format, startOfWeek, endOfWeek, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, FileDown } from "lucide-react";
import { triggerFileDownload } from "@/lib/utils";
import { Doc } from "../convex/_generated/dataModel";

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Định nghĩa kiểu dữ liệu cho kết quả trả về từ query
interface EmulationScoreData {
  className: string;
  totalPoints: number;
  violations: (Doc<"violations"> & { 
    studentName?: string | null; 
    details?: string | null; 
    violationDate: number 
  })[];
}

function cn(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function getCurrentWeekRange(): DateRange {
    const now = new Date();
    const zonedNow = toZonedTime(now, TIME_ZONE);
    const from = startOfWeek(zonedNow, { weekStartsOn: 1 });
    const to = endOfWeek(zonedNow, { weekStartsOn: 1 });
    return { from, to };
}

export default function EmulationScoreTable() {
  const [date, setDate] = useState<DateRange | undefined>(getCurrentWeekRange());
  const [isExporting, setIsExporting] = useState(false);

  const emulationScores = useQuery(
    api.violations.getPublicEmulationScores,
    date?.from ? {
        // Sửa lỗi: Truyền trực tiếp start và end, không lồng trong dateRange
        start: date.from.getTime(),
        end: endOfDay(date.to ?? date.from).getTime()
    } : "skip"
  );

  const exportEmulationScores = useAction(api.excelExport.exportEmulationScores);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = await exportEmulationScores({
        dateRange: date?.from ? {
          start: date.from.getTime(),
          end: endOfDay(date.to ?? date.from).getTime()
        } : undefined
      });
      if (url) {
        const fromDate = date?.from ? format(date.from, "yyyy-MM-dd") : 'all';
        const toDateStr = date?.to ? format(date.to, "yyyy-MM-dd") : fromDate;
        await triggerFileDownload(url, `diem-thi-dua-${fromDate}-den-${toDateStr}.xlsx`);
      } else {
        console.error("Export failed: URL is null.");
      }
    } catch (error) {
      console.error('Lỗi khi xuất file Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-md border border-white/50 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Bảng Điểm Thi Đua</h2>
            {date?.from && (
              <p className="text-sm text-slate-500 mt-1">
                {date.to
                  ? `Dữ liệu từ ${format(date.from, "dd/MM/yyyy")} đến ${format(date.to, "dd/MM/yyyy")}`
                  : `Dữ liệu cho ngày ${format(date.from, "dd/MM/yyyy")}`
                }
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={cn("grid gap-2")}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    className={cn(
                      "w-[300px] justify-start text-left font-normal border",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd/MM/yyyy", { locale: vi })} -{" "}
                          {format(date.to, "dd/MM/yyyy", { locale: vi })}
                        </>
                      ) : (
                        format(date.from, "dd/MM/yyyy", { locale: vi })
                      )
                    ) : (
                      <span>Chọn khoảng ngày</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              className="border"
              onClick={handleExport}
              disabled={isExporting || !emulationScores || emulationScores.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          </div>
        </div>

        {emulationScores === undefined && <p>Đang tải...</p>}
        {emulationScores && emulationScores.length === 0 && <p>Không có dữ liệu để hiển thị.</p>}

        {emulationScores && emulationScores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng Điểm Trừ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi Tiết Vi Phạm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Sửa lỗi: Sử dụng interface EmulationScoreData thay cho Doc<"emulationScores"> */}
                {emulationScores.map((score: EmulationScoreData) => (
                  <tr key={score.className}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{score.className}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600 font-bold">-{score.totalPoints}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {score.violations.map((v) => (
                          <div key={v._id} className="text-sm text-gray-700">
                            <span className="font-semibold">{v.violationType}</span>
                            {v.studentName && <span className="font-normal text-blue-600"> ({v.studentName})</span>}
                            {v.details && <span>: {v.details}</span>}
                            <span className="text-gray-500"> ({new Date(v.violationDate).toLocaleDateString('vi-VN')})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}