import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks } from "date-fns";
import { Calendar, AlertCircle, Trophy, Loader2, Award, FileText } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Compact Sticky Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">
                  BẢNG ĐIỂM THI ĐUA THÔ
                </h1>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <p className="text-xs text-slate-500">
                  Không phải bảng điểm chuẩn cuối được dùng để xét thi đua (còn thiếu điểm đánh giá giờ học, điểm thưởng).
                </p>
                <Link 
                  to="/bang-bao-cao-vi-pham" 
                  className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors text-xs font-medium"
                >
                  <FileText className="w-3 h-3" />
                  <span>Xem báo cáo vi phạm</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Tuần:</label>
                <input 
                  type="text" 
                  value={weekInput} 
                  onChange={handleWeekChange} 
                  className={`border px-2 py-1 w-16 text-center text-sm rounded ${weekError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
              </div>
              {dateRange && (
                <span className="text-xs text-slate-600 hidden sm:inline">
                  ({format(new Date(dateRange.start), "dd/MM/yyyy")} - {format(new Date(dateRange.end), "dd/MM/yyyy")})
                </span>
              )}
            </div>
          </div>
          
          {weekError && (
            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{weekError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        {emulationScores === undefined && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-amber-200 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-slate-700">Đang tải dữ liệu...</p>
              <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
            </div>
          </div>
        )}

        {emulationScores && emulationScores.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <Award className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700 mb-1">Chưa có dữ liệu</p>
            <p className="text-sm text-slate-500">Chưa có điểm thi đua cho tuần này</p>
          </div>
        )}

        {emulationScores && emulationScores.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-200">

                    <th className="px-2 py-3 text-center font-semibold text-slate-700 w-20">Lớp</th>
                    <th className="px-2 py-3 text-center font-semibold text-slate-700 w-24">Điểm trừ</th>
                    <th className="px-2 py-3 text-center font-semibold text-slate-700 w-24">Tổng điểm</th>
                    <th className="px-2 py-3 text-left font-semibold text-slate-700">Chi tiết vi phạm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emulationScores.map((score, index) => {

                    return (
                      <tr key={score.className} className={`hover:bg-slate-50 transition-colors`}>

                        <td className="px-2 py-3 text-center align-top">
                          <span className="font-semibold text-slate-900">{score.className}</span>
                        </td>
                        <td className="px-2 py-3 text-center align-top">
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded font-bold text-sm ${
                            score.totalPoints > 0 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {score.totalPoints > 0 ? `-${score.totalPoints}` : score.totalPoints}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center align-top">
                          <span className="inline-flex items-center justify-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-bold text-sm">
                            {120 - score.totalPoints}
                          </span>
                        </td>
                        <td className="px-2 py-3 align-top">
                          {score.violations.length > 0 ? (
                            <ul className="space-y-1.5">
                              {score.violations.map(v => (
                                <li key={v._id} className="flex items-start gap-2">
                                  <span className="text-slate-400 mt-0.5">•</span>
                                  <div className="flex-1">
                                    <span className="font-medium text-slate-900">{v.violationType}</span>
                                    {v.studentName && (
                                      <span className="text-slate-600"> ({v.studentName})</span>
                                    )}
                                    {v.details && (
                                      <span className="text-slate-700">: {v.details}</span>
                                    )}
                                    <span className="text-slate-400 text-xs ml-2">
                                      ({format(new Date(v.violationDate), 'dd/MM')})
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Không có vi phạm</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEmulationScoreTable;