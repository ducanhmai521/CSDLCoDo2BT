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
  const [loadedDays, setLoadedDays] = useState<{ [key: number]: boolean }>({});
  const [expandedDetails, setExpandedDetails] = useState<{ [key: string]: boolean }>({});
  const [dateRange, setDateRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [hideExcusedAbsence, setHideExcusedAbsence] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    return localStorage.getItem('violationReportUnderstood') === 'true';
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [modalState, setModalState] = useState<'welcome' | 'mustAgree'>('welcome');
  
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
    (dateRange && hasAcknowledged) ? { start: dateRange.start, end: dateRange.end } : "skip"
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

  const toggleDay = (day: number) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
    if (!loadedDays[day]) {
      setLoadedDays(prev => ({ ...prev, [day]: true }));
    }
  };
  
  const handleUnderstood = () => {
    if (dontShowAgain) {
      localStorage.setItem('violationReportUnderstood', 'true');
    }
    setHasAcknowledged(true);
    setShowWelcomeModal(false);
  };
  
  const handleClose = () => {
    setModalState('mustAgree');
  };
  
  useEffect(() => {
    if (hasAcknowledged) {
      setShowWelcomeModal(false);
    }
  }, [hasAcknowledged]);
  
  const toggleDetails = (violationId: string) => setExpandedDetails(prev => ({ ...prev, [violationId]: !prev[violationId] }));

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
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-300">
            {modalState === 'welcome' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Bạn ơiiii!</h2>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p className="font-medium">Để tiết kiệm băng thông và tăng tốc độ tải, chúng mình đã thay đổi cách hiển thị:</p>
                  <ul className="space-y-2 list-disc list-inside pl-2">
                    <li><strong>Click vào ngày</strong> để xem vi phạm của ngày đó</li>
                    <li>Web chỉ tải dữ liệu những ngày bạn bấm vào</li>
                  </ul>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                    <p className="text-xs text-blue-800"><strong>Mẹo:</strong> Bạn có thể hiện/ẩn "Nghỉ học có phép" bằng nút toggle ở góc trên (mặc định đang ẩn)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 pb-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    id="dontShowAgain"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dontShowAgain" className="text-sm text-slate-600 cursor-pointer select-none">
                    Không hiện lại thông báo này
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUnderstood}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Toi dong tinh
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                  >
                    Từ chối
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Ê ủa?</h2>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p className="font-medium">Bạn phải dong tinh thì mới xem được nội dung web này.</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800">
                      Các thay đổi này giúp trang tải nhanh hơn và tiết kiệm băng thông. Thay đổi nhỏ thôi nhưng giúp chúng mình tiết kiệm 1 ổ bánh mì mỗi tháng luôn á.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 pb-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    id="dontShowAgain2"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dontShowAgain2" className="text-sm text-slate-600 cursor-pointer select-none">
                    Không hiện lại thông báo này
                  </label>
                </div>
                <button
                  onClick={handleUnderstood}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
                >
                  Toi that su dong tinh
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
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
        <div className="max-w-7xl mx-auto px-2 sm:px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 flex-shrink-0" />
              <h1 className="text-sm sm:text-lg font-bold text-slate-800 leading-tight">BÁO CÁO VI PHẠM THPTS2BT</h1>
              <span className="text-[10px] sm:text-xs text-slate-500">•</span>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Có thể có sai sót</p>
              <Link to="/bang-diem-thi-dua-tho" className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 transition-colors text-[10px] sm:text-xs font-medium">
                <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>Bảng điểm thô</span>
              </Link>
              <button
                onClick={() => setHideExcusedAbsence(!hideExcusedAbsence)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded transition-colors text-[10px] sm:text-xs font-medium ${
                  hideExcusedAbsence 
                    ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={hideExcusedAbsence ? 'Đang ẩn nghỉ có phép' : 'Đang hiện nghỉ có phép'}
              >
                <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">{hideExcusedAbsence ? 'Ẩn nghỉ CP' : 'Hiện tất cả'}</span>
                <span className="sm:hidden">{hideExcusedAbsence ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 flex-shrink-0" />
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700">Tuần:</label>
                <input type="text" value={weekInput} onChange={handleWeekChange} className={`border px-1.5 sm:px-2 py-0.5 sm:py-1 w-12 sm:w-16 text-center text-xs sm:text-sm rounded ${weekError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
              </div>
              {dateRange && (<span className="text-[10px] sm:text-xs text-slate-600 hidden md:inline whitespace-nowrap">({format(new Date(dateRange.start), "dd/MM")} - {format(new Date(dateRange.end), "dd/MM")})</span>)}
            </div>
          </div>
          {weekError && (
            <div className="mt-1 sm:mt-2 flex items-center justify-center gap-1 text-red-600 text-[10px] sm:text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{weekError}</span>
            </div>
          )}
          {showReporterInput && (
            <div className="mt-1 sm:mt-2 flex justify-center items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Mật khẩu:</label>
              <input type="password" value={reporterPassword} onChange={(e) => setReporterPassword(e.target.value)} onKeyDown={handlePasswordSubmit} className="border border-slate-300 px-2 py-1 w-32 sm:w-40 text-center text-xs sm:text-sm rounded" />
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
          const allDayViolations = violationsByDay.get(dayTimestamp)!;
          const dayViolations = hideExcusedAbsence 
            ? allDayViolations.filter((v: { violationType: string; }) => v.violationType !== "Nghỉ học có phép")
            : allDayViolations;
          const isExpanded = expandedDays[dayTimestamp] !== false;
          const isLoaded = loadedDays[dayTimestamp];
          
          return (
            <div key={dayTimestamp} className="mb-3">
              <button onClick={() => toggleDay(dayTimestamp)} className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-3 py-2 rounded-t-lg flex items-center justify-between hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm">
                <span className="font-semibold text-sm">{format(new Date(dayTimestamp), "iiii, 'ngày' dd/MM/yyyy", { locale: vi })}</span>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{dayViolations.length} vi phạm</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {isExpanded && !isLoaded && (
                <div className="bg-white rounded-b-lg shadow-sm border border-slate-200 border-t-0 p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full mb-3">
                    <Eye className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Click để tải vi phạm</p>
                  <p className="text-xs text-slate-500">Dữ liệu sẽ được tải khi bạn click vào ngày</p>
                </div>
              )}
              {isExpanded && isLoaded && (
                <div className="bg-white rounded-b-lg shadow-sm overflow-hidden border border-slate-200 border-t-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-1.5 py-2 text-left font-semibold text-slate-700 w-12 sm:w-14">Lớp</th>
                          <th className="px-1.5 py-2 text-left font-semibold text-slate-700">Học sinh</th>
                          <th className="px-1.5 py-2 text-left font-semibold text-slate-700">Chi tiết vi phạm</th>
                          <th className="px-1.5 py-2 text-center font-semibold text-slate-700 w-14 sm:w-16">Điểm trừ</th>
                          {isReporterAuthenticated && (<th className="px-1.5 py-2 text-left font-semibold text-slate-700">Báo cáo</th>)}
                          <th className="px-1.5 py-2 text-center font-semibold text-slate-700 w-16 sm:w-20">BC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dayViolations.map((v: any) => {
                          const isDetailExpanded = expandedDetails[v._id];
                          const hasDetails = v.details && v.details.trim() !== '';
                          
                          return (
                            <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-1.5 py-2 text-center font-medium text-slate-900 text-xs sm:text-sm">{v.violatingClass}</td>
                              <td className="px-1.5 py-2 text-slate-800 text-xs sm:text-sm">{v.studentName || "-"}</td>
                              <td className="px-1.5 py-2 text-slate-700">
                                <div className="font-medium text-slate-900 text-xs sm:text-sm">
                                  {v.violationType}
                                  {hasDetails && (
                                    <>
                                      <button 
                                        onClick={() => toggleDetails(v._id)}
                                        className="ml-1 text-blue-600 hover:text-blue-700 inline-flex items-center"
                                      >
                                        {isDetailExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                      {isDetailExpanded && (
                                        <div className="mt-1 text-xs text-slate-600 border-l-2 border-slate-300 pl-2">
                                          {v.details}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-1.5 py-2 text-center">
                                <span className="inline-flex items-center justify-center min-w-[2rem] sm:min-w-[2.5rem] h-5 sm:h-6 bg-red-100 text-red-700 font-bold rounded text-xs sm:text-sm px-1.5 sm:px-2">{v.points}</span>
                              </td>
                              {isReporterAuthenticated && (<td className="px-1.5 py-2 text-slate-700 text-xs sm:text-sm">{(v as any).requesterName || v.reporterName}</td>)}
                              <td className="px-1.5 py-2">
                                {v.evidenceUrls && v.evidenceUrls.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {v.evidenceUrls.map((url: string | null, i: number) => {
                                      if (!url) return null;
                                      return (
                                        <div key={i}>
                                          <button onClick={() => handleOpenModal(v, url)} className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-xs">
                                            <Eye className="w-3 h-3" />
                                            <span className="hidden sm:inline">Xem {i + 1}</span>
                                            <span className="sm:hidden">{i + 1}</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
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
          );
        })}
      </div>
    </div>
  );
};

export default PublicViolationReport;