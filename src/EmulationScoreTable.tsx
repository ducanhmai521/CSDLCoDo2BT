import { VIOLATION_CATEGORIES } from "../convex/violationPoints";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, FileDown } from "lucide-react";

function cn(...classes: (string | boolean | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function EmulationScoreTable() {
  const [date, setDate] = useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  const emulationScores = useQuery(
    api.violations.getEmulationScores,
    date ? { dateRange: { start: date.from?.getTime() ?? 0, end: date.to?.getTime() ?? Date.now() } } : {}
  );

  const exportEmulationScores = useAction(api.excelExport.exportEmulationScores);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = await exportEmulationScores({
        dateRange: date ? {
          start: date.from?.getTime() ?? 0,
          end: date.to?.getTime() ?? Date.now()
        } : undefined
      });
      if (url) {
        window.open(url, '_blank');
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
          <h2 className="text-2xl font-semibold text-slate-800">Bảng Điểm Thi Đua</h2>
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
                {emulationScores.map((score) => (
                  <tr key={score.className}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{score.className}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600 font-bold">-{score.totalPoints}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {score.violations.map((v) => (
                          <div key={v._id} className="text-sm text-gray-700">
                            <span className="font-semibold">{v.violationType}</span>
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

{VIOLATION_CATEGORIES.map((category) => (
  <div key={category.name} className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800">
        {category.name} <span className="text-red-600">(-{category.points} điểm/lượt/1 HS)</span>
      </h3>
    </div>
    <div className="p-4">
      <ul className="list-disc list-inside space-y-2">
        {category.violations.map((violation, index) => (
          <li key={index} className="text-slate-700">
            {violation}
          </li>
        ))}
      </ul>
    </div>
  </div>
))}