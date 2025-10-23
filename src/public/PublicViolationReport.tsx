import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo, useRef } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";
import { 
  ChevronDown, ChevronUp, Eye, Calendar, AlertCircle, 
  FileText, Loader2, Trophy, X, User, Users, FileWarning, Download
} from "lucide-react";
import { Link } from "react-router-dom";

// Define a richer type for our modal state
type ModalMedia = {
  url: string;
  type: 'image' | 'video';
  violationInfo: {
    student: string;
    class: string;
    details: string;
  }
}

const PublicViolationReport = () => {
  // Component State
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState('1');
  const [weekError, setWeekError] = useState<string | null>(null);
  const [showReporterInput, setShowReporterInput] = useState(false);
  const [reporterPassword, setReporterPassword] = useState("");
  const [isReporterAuthenticated, setIsReporterAuthenticated] = useState(false);
  const [expandedDays, setExpandedDays] = useState<{ [key: number]: boolean }>({});
  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);
  
  // Modal State
  const [modalMedia, setModalMedia] = useState<ModalMedia | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [startInteraction, setStartInteraction] = useState({ x: 0, y: 0 });
  const initialPinchDistance = useRef(0);

  // Convex Hooks
  const baseDateStr = useQuery(api.users.getSetting, { key: 'weekBaseDate' });
  const checkPassword = useMutation(api.reporters.checkReporterPassword);
  const violations = useQuery(
    api.violations.getPublicViolations,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );

  // Memoized Calculations
  const violationsByDay = useMemo(() => {
    if (!violations) return new Map();
    const grouped = new Map<number, typeof violations>();
    violations.forEach(v => {
      const dayStart = startOfDay(new Date(v.violationDate)).getTime();
      if (!grouped.has(dayStart)) grouped.set(dayStart, []);
      grouped.get(dayStart)!.push(v);
    });
    return grouped;
  }, [violations]);

  const sortedDays = Array.from(violationsByDay.keys()).sort((a, b) => a - b);

  // Side Effects
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
    if (modalMedia) {
      const timer = setTimeout(() => setIsModalVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [modalMedia]);
  
  useEffect(() => {
    if (weekNumber === 172) setShowReporterInput(true);
    else setShowReporterInput(false);
  }, [weekNumber]);

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

  // Helper Functions
  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  };

  // Event Handlers
  const handleOpenModal = (violation: any, url: string) => {
    resetTransform();
    setIsMediaLoading(true);
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const extension = url.split('.').pop()?.toLowerCase() || '';
    
    let type: 'image' | 'video' | null = null;
    if (videoExtensions.includes(extension)) type = 'video';
    else if (imageExtensions.includes(extension)) type = 'image';
    else { window.open(url, '_blank'); return; }

    setModalMedia({
      url, type,
      violationInfo: {
        student: violation.studentName || "Không có tên",
        class: violation.violatingClass,
        details: violation.details ? `${violation.violationType}: ${violation.details}` : violation.violationType
      }
    });
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setTimeout(() => setModalMedia(null), 300);
  };

  const handlePasswordSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const isValid = await checkPassword({ password: reporterPassword });
      if (isValid) {
        setIsReporterAuthenticated(true);
        setShowReporterInput(false);
      } else alert("Sai mật khẩu!");
    }
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWeekInput(val);
    if (val.trim() === '') { setWeekError('Tuần không được để trống'); return; }
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) { setWeekError('Tuần phải là một số dương hợp lệ'); } 
    else { setWeekError(null); setWeekNumber(num); }
  };

  const toggleDay = (day: number) => setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));

  // --- Zoom & Pan Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = scale - e.deltaY * 0.005;
    setScale(Math.min(Math.max(newScale, 0.5), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsInteracting(true);
    setStartInteraction({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting) return;
    e.preventDefault();
    setPosition({ x: e.clientX - startInteraction.x, y: e.clientY - startInteraction.y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        setIsInteracting(true);
        setStartInteraction({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    } else if (e.touches.length === 2) {
        initialPinchDistance.current = getDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isInteracting) {
        setPosition({ x: e.touches[0].clientX - startInteraction.x, y: e.touches[0].clientY - startInteraction.y });
    } else if (e.touches.length === 2 && initialPinchDistance.current > 0) {
        const newDistance = getDistance(e.touches);
        const newScale = scale * (newDistance / initialPinchDistance.current);
        setScale(Math.min(Math.max(newScale, 0.5), 10));
        initialPinchDistance.current = newDistance;
    }
  };
  
  const handleInteractionEnd = () => {
    setIsInteracting(false);
    initialPinchDistance.current = 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {modalMedia && (
        <div 
          className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-0 transition-opacity duration-300 ease-in-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={modalMedia.type === 'image' ? handleMouseMove : undefined}
          onMouseUp={modalMedia.type === 'image' ? handleInteractionEnd : undefined}
          onMouseLeave={modalMedia.type === 'image' ? handleInteractionEnd : undefined}
        >
          {/* Static UI Overlay */}
          <button onClick={handleCloseModal} className="absolute top-2 right-2 z-50 text-white flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-white/20 transition-colors" aria-label="Đóng"><X className="w-6 h-6" /></button>
          
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[95%] md:max-w-xl bg-black/60 backdrop-blur-sm text-white rounded-lg text-sm transition-all duration-300 ease-in-out z-50 overflow-hidden ${!isMediaLoading ? 'opacity-100' : 'opacity-0'}`}>
            <div className="p-3">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-300" /><span>{modalMedia.violationInfo.student}</span></div>
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-300" /><span>{modalMedia.violationInfo.class}</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/20 text-xs text-slate-200 flex items-center justify-center gap-2">
                <FileWarning className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-left">{modalMedia.violationInfo.details}</span>
              </div>
            </div>
            <a 
              href={modalMedia.url} 
              download 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full bg-white/10 hover:bg-white/20 transition-colors py-2 text-xs font-semibold flex items-center justify-center gap-2 border-t border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              Tải xuống
            </a>
          </div>
          
          {/* Media Container */}
          <div className={`transform-gpu transition-all duration-300 ease-in-out max-w-full max-h-full w-full h-full flex items-center justify-center relative ${isModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {isMediaLoading && ( 
              <div className="absolute">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-200/50 rounded-full animate-pulse"></div>
              </div> 
            )}
            
            <div className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ease-in-out ${isMediaLoading ? 'opacity-0' : 'opacity-100'}`}>
              {modalMedia.type === 'image' ? (
                <div
                  className="w-full h-full"
                  style={{ touchAction: 'none', cursor: isInteracting ? 'grabbing' : 'grab' }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={resetTransform}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleInteractionEnd}
                >
                  <div 
                    className="w-full h-full"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                  >
                    <img 
                      src={modalMedia.url} 
                      alt="Bằng chứng" 
                      className="w-full h-full object-contain"
                      onLoad={() => setIsMediaLoading(false)}
                    />
                  </div>
                </div>
              ) : (
                <video 
                  src={modalMedia.url} 
                  controls 
                  autoPlay 
                  className="max-w-full max-h-full object-contain" 
                  onLoadedData={() => setIsMediaLoading(false)}
                >
                  Trình duyệt của bạn không hỗ trợ video.
                </video>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Sticky Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">BÁO CÁO VI PHẠM THPTS2BT</h1>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <p className="text-xs text-slate-500">Có thể có sai sót, không phải danh sách lỗi cuối để xét thi đua.</p>
                <Link to="/bang-diem-thi-dua-tho" className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors text-xs font-medium">
                  <Trophy className="w-3 h-3" />
                  <span>Xem bảng điểm thi đua thô</span>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Tuần:</label>
                <input type="text" value={weekInput} onChange={handleWeekChange} className={`border px-2 py-1 w-16 text-center text-sm rounded ${weekError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
              </div>
              {dateRange && (<span className="text-xs text-slate-600 hidden sm:inline">({format(new Date(dateRange.start), "dd/MM/yyyy")} - {format(new Date(dateRange.end), "dd/MM/yyyy")})</span>)}
            </div>
          </div>
          {weekError && (
            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{weekError}</span>
            </div>
          )}
          {showReporterInput && (
            <div className="mt-2 flex justify-center items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Mật khẩu:</label>
              <input type="password" value={reporterPassword} onChange={(e) => setReporterPassword(e.target.value)} onKeyDown={handlePasswordSubmit} className="border border-slate-300 px-2 py-1 w-40 text-center text-sm rounded" />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        {violations === undefined && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-200 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-slate-700">Đang tải dữ liệu...</p>
              <p className="text-sm text-slate-500">Vui lòng chờ trong giây lát</p>
            </div>
          </div>
        )}
        {violations && violations.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700 mb-1">Không có vi phạm</p>
            <p className="text-sm text-slate-500">Không có vi phạm nào trong tuần này</p>
          </div>
        )}
        {sortedDays.map(dayTimestamp => {
          const dayViolations = violationsByDay.get(dayTimestamp)!;
          const isExpanded = expandedDays[dayTimestamp] !== false;
          return (
            <div key={dayTimestamp} className="mb-3">
              <button onClick={() => toggleDay(dayTimestamp)} className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-3 py-2 rounded-t-lg flex items-center justify-between hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm">
                <span className="font-semibold text-sm">{format(new Date(dayTimestamp), "iiii, 'ngày' dd/MM/yyyy", { locale: vi })}</span>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{dayViolations.length} vi phạm</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {isExpanded && (
                <div className="bg-white rounded-b-lg shadow-sm overflow-hidden border border-slate-200 border-t-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-2 py-2 text-left font-semibold text-slate-700 w-16">Lớp</th>
                          <th className="px-2 py-2 text-left font-semibold text-slate-700">Học sinh</th>
                          <th className="px-2 py-2 text-left font-semibold text-slate-700">Chi tiết vi phạm</th>
                          <th className="px-2 py-2 text-center font-semibold text-slate-700 w-16">Điểm trừ</th>
                          {isReporterAuthenticated && (<th className="px-2 py-2 text-left font-semibold text-slate-700">Báo cáo</th>)}
                          <th className="px-2 py-2 text-center font-semibold text-slate-700 w-20">BC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dayViolations.map((v: any) => (
                          <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-2 text-center font-medium text-slate-900">{v.violatingClass}</td>
                            <td className="px-2 py-2 text-slate-800">{v.studentName || "-"}</td>
                            <td className="px-2 py-2 text-slate-700">
                              <div className="font-medium text-slate-900">{v.details ? `${v.violationType}: ${v.details}`: v.violationType}</div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 bg-red-100 text-red-700 font-bold rounded text-sm px-2">{v.points}</span>
                            </td>
                            {isReporterAuthenticated && (<td className="px-2 py-2 text-slate-700">{v.reporterName}</td>)}
                            <td className="px-2 py-2">
                              {v.evidenceUrls && v.evidenceUrls.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {v.evidenceUrls.map((url: string | null, i: number) => {
                                    if (!url) return null;
                                    return (
                                      <div key={i}>
                                        <button onClick={() => handleOpenModal(v, url)} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-xs">
                                          <Eye className="w-3 h-3" />
                                          <span>Xem {i + 1}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PublicViolationReport;