import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";

const PublicViolationReport = () => {
  const baseDateStr = useQuery(api.users.getSetting, { key: 'weekBaseDate' });
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState('1');
  const [weekError, setWeekError] = useState<string | null>(null);
  const [showReporterInput, setShowReporterInput] = useState(false);
  const [reporterPassword, setReporterPassword] = useState("");
  const [isReporterAuthenticated, setIsReporterAuthenticated] = useState(false);
  const checkPassword = useMutation(api.reporters.checkReporterPassword);


  useEffect(() => {
    if (baseDateStr) {
      const base = new Date(baseDateStr);
      const now = new Date();
      const weeks = differenceInCalendarWeeks(now, base, { weekStartsOn: 1 }) + 1;
      setWeekNumber(weeks);
      setWeekInput(weeks.toString());
    }
  }, [baseDateStr]);

  useEffect(() => {
    if (weekNumber === 172) {
      setShowReporterInput(true);
    } else {
      setShowReporterInput(false);
    }
  }, [weekNumber]);

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

  const violations = useQuery(
    api.violations.getPublicViolations,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
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

  const [showEvidences, setShowEvidences] = useState<{ [key: string]: boolean[] }>({});

  const handlePasswordSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const isValid = await checkPassword({ password: reporterPassword });
      if (isValid) {
        setIsReporterAuthenticated(true);
        setShowReporterInput(false);
      } else {
        alert("Sai mật khẩu!");
      }
    }
  };

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
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-center mb-2">CSDL CỜ ĐỎ THPTS2BT | BÁO CÁO VI PHẠM</h1>
              <h2 className="text-xl font-bold text-center mb-2">Đây chỉ là bảng tổng hợp các báo cáo được gửi tới hệ thống, có thể có sai sót, không phải danh sách lỗi cuối</h2>
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
        {showReporterInput && (
          <div className="flex justify-center items-center mb-4 gap-2">
            <label>Mật khẩu:</label>
            <input
              type="password"
              value={reporterPassword}
              onChange={(e) => setReporterPassword(e.target.value)}
              onKeyDown={handlePasswordSubmit}
              className="border p-1 w-40 text-center"
            />
          </div>
        )}
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
                  {isReporterAuthenticated && <th className="border border-black p-2">Người báo cáo</th>}
                  <th className="border border-black p-2">Bằng chứng</th>
                </tr>
              </thead>
              <tbody>
                {dayViolations.map((v: any, index: number) => (
                  <tr key={v._id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-black p-2 text-center">{v.violatingClass}</td>
                    <td className="border border-black p-2">{v.studentName || "-"}</td>
                    <td className="border border-black p-2">{v.details ? `${v.violationType}: ${v.details}`: v.violationType}</td>
                    <td className="border border-black p-2 text-center font-bold text-red-800 bg-red-100">{v.points}</td>
                    {isReporterAuthenticated && <td className="border border-black p-2">{v.reporterName}</td>}
                    <td className="border border-black p-2">
                      {v.evidenceUrls && v.evidenceUrls.length > 0 ? (
                        <div className="space-y-1">
                          {v.evidenceUrls.map((url: string | null, i: number) => {
                            if (!url) return null;
                            
                            const extension = url.split('.').pop()?.toLowerCase() || '';
                            const isShown = showEvidences[v._id]?.[i] || false;
                            
                            return (
                              <div key={i}>
                                <button 
                                  onClick={() => {
                                    const newShows = { ...showEvidences };
                                    if (!newShows[v._id]) {
                                      newShows[v._id] = Array(v.evidenceUrls.length).fill(false);
                                    }
                                    newShows[v._id][i] = !newShows[v._id][i];
                                    setShowEvidences(newShows);
                                  }} 
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {isShown ? 'Ẩn' : 'Xem'} bằng chứng {i + 1}
                                </button>
                                {isShown && (
                                  <>
                                    {(() => {
                                      // Video extensions
                                      const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
                                      if (videoExtensions.includes(extension)) {
                                        return (
                                          <div className="border rounded-lg overflow-hidden mt-1">
                                            <video 
                                              src={url} 
                                              controls 
                                              className="w-full max-h-64 object-contain"
                                              preload="metadata"
                                            >
                                              Trình duyệt của bạn không hỗ trợ video.
                                            </video>
                                            <a 
                                              href={url} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="text-blue-600 hover:underline text-sm block text-center py-1"
                                            >
                                              Tải video về nếu không xem được
                                            </a>
                                          </div>
                                        );
                                      }
                                      
                                      // Image extensions
                                      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                                      if (imageExtensions.includes(extension)) {
                                        return (
                                          <div className="border rounded-lg overflow-hidden mt-1">
                                            <img 
                                              src={url} 
                                              alt={`Bằng chứng ${i + 1}`} 
                                              className="w-full max-h-64 object-contain"
                                              loading="lazy"
                                            />
                                            <a 
                                              href={url} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="text-blue-600 hover:underline text-sm block text-center py-1"
                                            >
                                              Xem kích thước gốc (toàn màn hình)
                                            </a>
                                          </div>
                                        );
                                      }
                                      
                                      // Fallback for other files
                                      return (
                                        <a 
                                          href={url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-blue-600 hover:underline block mt-1 text-sm"
                                        >
                                          Xem bằng chứng {i + 1} ({extension.toUpperCase()})
                                        </a>
                                      );
                                    })()}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
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