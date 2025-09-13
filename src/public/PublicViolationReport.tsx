import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";

const PublicViolationReport = () => {
  const baseDateStr = useQuery(api.users.getSetting, { key: 'weekBaseDate' });

  const [weekNumber, setWeekNumber] = useState(1);

  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const now = new Date();
      const weeks = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      setWeekNumber(weeks);
    }
  }, [baseDateStr]);

  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);

  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const monday = startOfWeek(base, { weekStartsOn: 1 });
      const start = new Date(monday.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      setDateRange({ start: start.getTime(), end: end.getTime() });
    }
  }, [weekNumber, baseDateStr]);

  const violations = useQuery(
    api.violations.getPublicViolations,
    dateRange ? { start: dateRange.start, end: dateRange.end } : {}
  );

  // Nhóm các vi phạm theo ngày bằng useMemo để tối ưu hiệu năng
  const violationsByDay = useMemo(() => {
    if (!violations) return new Map();

    const grouped = new Map<number, typeof violations>();
    violations.forEach(v => {
      const dayStart = startOfDay(new Date(v.violationDate)).getTime();
      if (!grouped.has(dayStart)) {
        grouped.set(dayStart, []);
      }
      grouped.get(dayStart)!.push(v);
    });
    return grouped;
  }, [violations]);

  // Sắp xếp các ngày theo thứ tự thời gian
  const sortedDays = Array.from(violationsByDay.keys()).sort((a, b) => a - b);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-center mb-2">CSDL CỜ ĐỎ THPTS2BT | BÁO CÁO VI PHẠM</h1>
        <div className="flex justify-center items-center mb-4 gap-4">
          <label>Tuần học:</label>
          <input 
            type="number" 
            value={weekNumber} 
            onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)} 
            className="border p-1 w-20 text-center"
            min={1}
          />
        </div>
        {dateRange ? (
          <p className="text-center text-gray-600">
            (Tuần từ {format(new Date(dateRange.start), "dd/MM/yyyy")} đến {format(new Date(dateRange.end), "dd/MM/yyyy")})
          </p>
        ) : (
          <p className="text-center text-gray-600">Đang tải...</p>
        )}
      </div>

      {violations === undefined && <p className="text-center">Đang tải dữ liệu...</p>}
      
      {violations && violations.length === 0 && (
        <p className="text-center text-gray-500">Không có vi phạm nào trong tuần này.</p>
      )}

      {sortedDays.map(dayTimestamp => {
        const dayViolations = violationsByDay.get(dayTimestamp)!;
        const dayDate = new Date(dayTimestamp);
        return (
          <div key={dayTimestamp}>
            <h2 className="text-xl font-semibold mb-2 text-center bg-purple-100 text-purple-800 p-2 rounded">
              {format(dayDate, "iiii, 'ngày' dd/MM/yyyy", { locale: vi })}
            </h2>
            <table className="w-full border-collapse border border-black">
              <thead>
                <tr className="bg-green-100 text-green-800">
                  <th className="border border-black p-2">Lớp</th>
                  <th className="border border-black p-2">Học sinh</th>
                  <th className="border border-black p-2">Chi tiết vi phạm</th>
                  <th className="border border-black p-2">Điểm trừ</th>
                  <th className="border border-black p-2">Người báo cáo</th>
                </tr>
              </thead>
              <tbody>
                {dayViolations.map((v: { _id: Key | null | undefined; violatingClass: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; studentName: any; details: any; violationType: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; points: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; reporterName: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }, index: number) => (
                  <tr key={v._id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-black p-2 text-center">{v.violatingClass}</td>
                    <td className="border border-black p-2">{v.studentName || "-"}</td>
                    <td className="border border-black p-2">{v.details ? `${v.violationType}: ${v.details}`: v.violationType}</td>
                    <td className="border border-black p-2 text-center font-bold text-red-800 bg-red-100">{v.points}</td>
                    <td className="border border-black p-2">{v.reporterName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default PublicViolationReport;