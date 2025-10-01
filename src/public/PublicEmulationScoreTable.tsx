import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks } from "date-fns";

const PublicEmulationScoreTable = () => {
  const baseDateStr = useQuery(api.users.getSetting, { key: 'weekBaseDate' });

  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState('1');
  const [weekError, setWeekError] = useState<string | null>(null);

  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const now = new Date();
      const weeks = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      setWeekNumber(weeks);
      setWeekInput(weeks.toString());
    }
  }, [baseDateStr]);

  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);

  useEffect(() => {
    if (baseDateStr && !weekError) {
      const base = new Date(baseDateStr);
      const monday = startOfWeek(base, { weekStartsOn: 1 });
      const start = new Date(monday.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      setDateRange({ start: start.getTime(), end: end.getTime() });
    } else {
      setDateRange(undefined);
    }
  }, [weekNumber, baseDateStr, weekError]);

  const emulationScores = useQuery(
    api.violations.getPublicEmulationScores,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWeekInput(val);

    if (val.trim() === '') {
      setWeekError('Tuần không được để trống');
      return;
    }

    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setWeekError('Tuần phải là một số dương hợp lệ');
    } else {
      setWeekError(null);
      setWeekNumber(num);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center mb-2">CSDL CỜ ĐỎ THPTS2BT | BẢNG ĐIỂM THI ĐUA THÔ</h1>
      <h2 className="text-xl font-bold text-center mb-2">Đây chỉ là bảng điểm thi đua thô được tạo nên bởi các báo cáo được gửi tới hệ thống, không phải bảng điểm chuẩn cuối</h2>
      <div className="flex justify-center items-center mb-4 gap-4">
        <label>Tuần học:</label>
        <input 
          type="text" 
          value={weekInput} 
          onChange={handleWeekChange} 
          className={`border p-1 w-20 text-center ${weekError ? 'border-red-500' : 'border-gray-300'}`}
        />
      </div>
      {weekError && <p className="text-center text-red-500 text-sm -mt-2 mb-2">{weekError}</p>}
      {dateRange ? (
        <p className="text-center mb-4">
          (Tuần từ {format(new Date(dateRange.start), "dd/MM/yyyy")} đến {format(new Date(dateRange.end), "dd/MM/yyyy")})
        </p>
      ) : (
        <p className="text-center mb-4">Đang tải...</p>
      )}
      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-2 w-[5%]">STT</th>
            <th className="border border-black p-2 w-[10%]">Lớp</th>
            <th className="border border-black p-2 w-[10%]">Điểm trừ (chưa trừ điểm giờ học)</th>
            <th className="border border-black p-2 w-[15%]">Tổng điểm (chưa cộng điểm thưởng)</th>
            <th className="border border-black p-2 w-[60%]">Chi tiết vi phạm</th>
          </tr>
        </thead>
        <tbody>
          {emulationScores === undefined && (
            <tr>
              <td colSpan={5} className="p-4 text-center">Đang tải dữ liệu...</td>
            </tr>
          )}
          {emulationScores?.map((score, index) => (
            <tr key={score.className}>
              <td className={`border border-black p-2 text-center align-top ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{index + 1}</td>
              <td className={`border border-black p-2 text-center align-top ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{score.className}</td>
              <td className={`border border-black p-2 text-center align-top font-bold ${score.totalPoints > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{score.totalPoints > 0 ? `-${score.totalPoints}`: score.totalPoints}</td>
              <td className={`border border-black p-2 text-center align-top font-bold bg-green-100 text-green-800`}>{120 - score.totalPoints}</td>
              <td className={`border border-black p-2 align-top text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                {score.violations.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {score.violations.map(v => (
                      <li key={v._id}>
                        <strong>{v.violationType}</strong>
                        {v.studentName && ` (${v.studentName})`}
                        {v.details && `: ${v.details}`}
                        <span className="text-gray-500 text-xs ml-2">
                          ({format(new Date(v.violationDate), 'dd/MM')})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-500 italic">Không có vi phạm</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PublicEmulationScoreTable;