import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect, useMemo, useRef } from "react";
import { startOfWeek, endOfWeek, differenceInCalendarWeeks, startOfDay } from "date-fns";
import { 
  ChevronDown, ChevronUp, Eye, Calendar, AlertCircle, 
  FileText, Loader2, Trophy, X, User, Users, FileWarning, Download, ShieldCheck, Sparkles, Award
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

// --- TYPES ---
type ModalMedia = {
  url: string;
  type: 'image' | 'video';
  violationInfo: {
    student: string;
    class: string;
    details: string;
  }
}
const premiumStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-150%); }
    100% { transform: translateX(150%); }
  }
  @keyframes gradient-xy {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  .animate-gradient-text {
    background-size: 200% auto;
    animation: gradient-xy 3s linear infinite;
  }
`;
// --- SUB-COMPONENT: VIOLATION ROW (Clean & Intuitive) ---
const ViolationRow = ({ 
  violation, 
  onOpenEvidence 
}: { 
  violation: any, 
  onOpenEvidence: (v: any, url: string) => void 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Kiểm tra dữ liệu
  const hasDetails = violation.details && violation.details.trim() !== '';
  const hasEvidence = violation.evidenceUrls && violation.evidenceUrls.length > 0;
  
  // Lấy thông tin người báo cáo (nếu có quyền xem hoặc data có trả về)
  const reporterName = (violation as any).requesterName || violation.reporterName;
  const reporterIsSuperUser = (violation as any).reporterIsSuperUser || false;
  const reporterCustomization = (violation as any).reporterCustomization || null;

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50 transition-colors">
      {/* TẦNG 1: OVERVIEW - Click để mở/đóng */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 overflow-hidden">
          {/* Badge Lớp & Điểm */}
          <div className="flex flex-col items-center justify-center gap-1 min-w-[2.5rem]">
            <span className="font-bold text-slate-700 text-xs sm:text-sm">{violation.violatingClass}</span>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-4 sm:h-5 bg-red-50 text-red-600 border border-red-100 font-bold rounded-md text-[10px] px-1">
              -{violation.points}
            </span>
          </div>
          
          {/* Thông tin chính */}
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
              {violation.studentName || "Không có tên"}
            </span>
            <span className="text-xs text-slate-500 truncate pr-2">
              {violation.violationType}
            </span>
          </div>
          
{/* Hiện người báo cáo */}
{reporterName && (
  // Dùng flex-shrink-0 để badge không bị bóp méo, nhưng ml-auto để đẩy nó sang phải
  <div className="flex items-center ml-auto pl-2"> 
    {reporterIsSuperUser ? (
      <div className="relative inline-flex overflow-hidden rounded-lg sm:rounded-full p-[1.5px] group shadow-sm flex-shrink-0 cursor-default">
        <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#ef4444_0%,#eab308_25%,#22c55e_50%,#3b82f6_75%,#a855f7_100%,#ef4444_100%)]" />
        <div className="relative flex items-center bg-white rounded-lg sm:rounded-full py-1 sm:py-0.5 px-2 sm:px-1.5 sm:pl-2 gap-1.5 h-full w-full backface-hidden">
          {/* Icon Shield */}
          <ShieldCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-700 shrink-0" strokeWidth={2.5} />
          {/* Text Container */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
              
              <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-blue-600 uppercase leading-tight sm:leading-none 
                             sm:border-r sm:border-blue-100 sm:pr-1.5 sm:py-0.5
                             border-b border-blue-50 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                  Nhập bởi Admin
              </span>
              
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                  {reporterName}
              </span>
          </div>
        </div>
      </div>
    ) : reporterCustomization ? (
      // --- CUSTOM BADGE ---
      <div className="group relative flex items-center">
        {/* Glow Background */}
        <div className={`absolute -inset-1 bg-${reporterCustomization.colorFrom}/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition duration-500`}></div>
        
        {/* Container chính */}
        <div className={`relative flex items-center bg-white border border-${reporterCustomization.colorFrom} shadow-[0_2px_8px_-3px_rgba(100,116,139,0.3)] rounded-lg sm:rounded-full py-1 px-2 sm:py-0.5 sm:px-1.5 sm:pl-2 gap-1.5 sm:gap-1.5`}>
          
          {/* Custom Icon */}
          {reporterCustomization.icon && (
            <span className={`text-${reporterCustomization.colorFrom} text-sm`}>
              {reporterCustomization.icon}
            </span>
          )}
          
          {/* Text Container */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
              
              {/* Label */}
              <span className={`text-[8px] sm:text-[9px] font-extrabold tracking-wider text-${reporterCustomization.colorFrom} uppercase leading-none 
                             sm:border-r sm:border-${reporterCustomization.colorFrom} sm:pr-1.5 sm:py-0.5
                             border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit`}>
                  {reporterCustomization.label || 'Nhập bởi'}
              </span>
              
              {/* Tên User */}
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                  {reporterName}
              </span>
          </div>
        </div>
      </div>
    ) : (
      // --- USER BADGE (Giống admin nhưng màu xám) ---
      <div className="group relative flex items-center">
        {/* Glow Background */}
        <div className="absolute -inset-1 bg-slate-400/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition duration-500"></div>
        
        {/* Container chính: Mobile padding nhỏ hơn chút */}
        <div className="relative flex items-center bg-white border border-slate-200 shadow-[0_2px_8px_-3px_rgba(100,116,139,0.3)] rounded-lg sm:rounded-full py-1 px-2 sm:py-0.5 sm:px-1.5 sm:pl-2 gap-1.5 sm:gap-1.5">
          
          {/* Text Container: Flex Col trên Mobile (dọc), Flex Row trên Desktop (ngang) */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
              
              {/* Label USER */}
              <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-slate-500 uppercase leading-none 
                             sm:border-r sm:border-slate-200 sm:pr-1.5 sm:py-0.5
                             border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 w-fit">
                  Nhập bởi
              </span>
              
              {/* Tên User */}
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate max-w-[80px] sm:max-w-[120px]">
                  {reporterName}
              </span>
          </div>
        </div>
      </div>
    )}
  </div>
)}
        </div>

        {/* Nút Toggle Icon */}
        <div className={`text-slate-400 pl-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
           <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {/* TẦNG 2: DETAILS - Expandable Area */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-slate-50/80 ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 sm:p-4 text-sm space-y-3 border-t border-slate-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
          
          {/* Chi tiết lỗi */}
          <div className="flex gap-3">
            <div className="mt-0.5 min-w-[20px]"><FileWarning className="w-4 h-4 text-slate-400" /></div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết vi phạm</span>
              <p className="text-slate-700 mt-0.5 leading-relaxed">
                {hasDetails ? violation.details : "Không có mô tả chi tiết."}
              </p>
            </div>
          </div>

          {/* Người báo cáo (Chỉ hiện ở details nếu chưa hiện ở overview) */}
          {reporterName && (
            <div className="flex gap-3">
              <div className="mt-0.5 min-w-[20px]"><User className="w-4 h-4 text-slate-400" /></div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người báo cáo</span>
                <p className="text-slate-700 mt-0.5 font-medium">
                  {reporterName}
                </p>
              </div>
            </div>
          )}

          {/* Khu vực Bằng chứng */}
          <div className="flex gap-3 pt-1">
            <div className="mt-1.5 min-w-[20px]"><Eye className="w-4 h-4 text-slate-400" /></div>
            <div className="flex-1">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Bằng chứng</span>
               {hasEvidence ? (
                 <div className="flex flex-wrap gap-2">
                    {violation.evidenceUrls.map((url: string, i: number) => {
                      if (!url) return null;
                      return (
                        <button 
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation(); // Ngăn click lan ra ngoài làm đóng accordion
                            onOpenEvidence(violation, url);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-sm transition-all text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem bằng chứng {i + 1}</span>
                        </button>
                      )
                    })}
                 </div>
               ) : (
                 <span className="text-xs text-slate-400 italic">Không có bằng chứng đính kèm</span>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const PublicViolationReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Tab state - check URL for initial tab
  const [activeTab, setActiveTab] = useState<'violations' | 'scores'>(() => {
    if (location.pathname === '/bang-diem-thi-dua-tho') {
      return 'scores';
    }
    return 'violations';
  });

  // Component State
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekInput, setWeekInput] = useState('1');
  const [weekError, setWeekError] = useState<string | null>(null);

  const [expandedDays, setExpandedDays] = useState<{ [key: number]: boolean }>({});
  // Đã xóa state expandedDetails vì ViolationRow tự xử lý
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
  const violations = useQuery(
    api.violations.getPublicViolations,
    (dateRange && hasAcknowledged) ? { start: dateRange.start, end: dateRange.end } : "skip"
  );
  const emulationScores = useQuery(
    api.violations.getPublicEmulationScores,
    dateRange ? { start: dateRange.start, end: dateRange.end } : "skip"
  );

  // Memoized Calculations
  const violationsByDay = useMemo(() => {
    if (!violations) return new Map();
    const grouped = new Map<number, typeof violations>();
    violations.forEach((v: any) => {
      const dayStart = startOfDay(new Date(v.violationDate)).getTime();
      if (!grouped.has(dayStart)) grouped.set(dayStart, []);
      grouped.get(dayStart)!.push(v);
    });
    return grouped;
  }, [violations, hideExcusedAbsence]);

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
  };

  // Handle tab changes and URL updates
  const handleTabChange = (tab: 'violations' | 'scores') => {
    setActiveTab(tab);
    if (tab === 'scores') {
      navigate('/bang-diem-thi-dua-tho', { replace: true });
    } else {
      navigate('/bang-bao-cao-vi-pham', { replace: true });
    }
  };

  // Handle URL changes from external navigation
  useEffect(() => {
    if (location.pathname === '/bang-diem-thi-dua-tho') {
      setActiveTab('scores');
    } else {
      setActiveTab('violations');
    }
  }, [location.pathname]);
  
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-10">
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
                  <p className="font-medium">Web đã cập nhật giao diện mới gọn gàng hơn:</p>
                  <ul className="space-y-2 list-disc list-inside pl-2">
                    <li><strong>Bấm vào từng dòng</strong> vi phạm để xem chi tiết & bằng chứng.</li>
                  </ul>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                    <p className="text-xs text-blue-800"><strong>Mẹo:</strong> Bạn có thể hiện/ẩn "Nghỉ học có phép" bằng nút toggle ở góc trên.</p>
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

      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header Row: Title + Week Selector */}
          <div className="px-3 sm:px-4 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-800">
                CSDL Cờ đỏ THPTS2BT
              </h1>
              
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 flex-shrink-0">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Tuần:</label>
                  <input 
                    type="text" 
                    value={weekInput} 
                    onChange={handleWeekChange} 
                    className={`border px-1.5 sm:px-2 py-0.5 sm:py-1 w-10 sm:w-16 text-center text-xs sm:text-sm rounded font-medium ${weekError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} 
                  />
                </div>
                {dateRange && (
                  <span className="text-[10px] sm:text-xs text-slate-600 whitespace-nowrap">
                    ({format(new Date(dateRange.start), "dd/MM")} - {format(new Date(dateRange.end), "dd/MM")})
                  </span>
                )}
              </div>
            </div>
            
            {weekError && (
              <div className="mt-1.5 flex items-center justify-center gap-1 text-red-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>{weekError}</span>
              </div>
            )}
          </div>

          {/* Tab Selector Row */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-3">
            {/* Tab Selector */}
            <div className="flex items-center gap-0.5 border-b-2 border-slate-200 flex-1">
              <button
                onClick={() => handleTabChange('violations')}
                className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'violations'
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Vi phạm</span>
                </span>
                {activeTab === 'violations' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 -mb-[2px]"></div>
                )}
              </button>
              <button
                onClick={() => handleTabChange('scores')}
                className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === 'scores'
                    ? 'text-amber-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Bảng điểm</span>
                </span>
                {activeTab === 'scores' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 -mb-[2px]"></div>
                )}
              </button>
            </div>
            
            {/* Show/Hide toggle only for violations tab */}
            {activeTab === 'violations' && (
              <button
                onClick={() => setHideExcusedAbsence(!hideExcusedAbsence)}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap ${
                  hideExcusedAbsence 
                    ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
                title={hideExcusedAbsence ? 'Đang ẩn nghỉ có phép' : 'Đang hiện nghỉ có phép'}
              >
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{hideExcusedAbsence ? 'Ẩn nghỉ CP' : 'Hiện tất cả'}</span>
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <div className="px-3 sm:px-4 py-1.5 border-t border-slate-100">
            <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed">
              {activeTab === 'violations' ? (
                <>
                  Dữ liệu vi phạm được cập nhật bởi các thành viên đội cờ đỏ. Nếu phát hiện sai sót, hãy báo lại thành viên đội hoặc Admin nhé!
                </>
              ) : (
                <>
                  Bảng điểm thi đua thô được tính toán dựa trên dữ liệu vi phạm, chưa bao gồm điểm giờ học, điểm thưởng.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        {activeTab === 'violations' ? (
          // Violations Content
          <>
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
              <div className="bg-white rounded-lg shadow-sm p-8 text-center mt-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700 mb-1">Không có vi phạm</p>
                <p className="text-sm text-slate-500">Không có vi phạm nào trong tuần này</p>
              </div>
            )}
            
            {/* Daily Lists */}
            <div className="space-y-4 mt-2">
              {sortedDays.map(dayTimestamp => {
                const allDayViolations = violationsByDay.get(dayTimestamp)!;
                const dayViolations = hideExcusedAbsence 
                  ? allDayViolations.filter((v: { violationType: string; }) => v.violationType !== "Nghỉ học có phép")
                  : allDayViolations;
                const isExpanded = expandedDays[dayTimestamp] !== false;
                
                // Case: Ẩn nghỉ có phép và chỉ còn nghỉ có phép
                if (hideExcusedAbsence && dayViolations.length === 0) {
                  const excusedAbsenceCount = allDayViolations.filter((v: { violationType: string; }) => v.violationType === "Nghỉ học có phép").length;
                  if (excusedAbsenceCount === 0) return null;
                  
                  return (
                    <div key={dayTimestamp} className="w-full bg-slate-100 text-slate-500 px-4 py-3 rounded-xl flex items-center justify-between border border-slate-200">
                      <span className="font-semibold text-sm">{format(new Date(dayTimestamp), "iiii, dd/MM", { locale: vi })}</span>
                      <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200">Chỉ có {excusedAbsenceCount} nghỉ CP</span>
                    </div>
                  );
                }
                
                // Nếu không có vi phạm nào sau khi filter thì skip
                if (dayViolations.length === 0) return null;
                
                return (
                  <div key={dayTimestamp} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header Ngày */}
                    <button 
                      onClick={() => toggleDay(dayTimestamp)} 
                      className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                        isExpanded 
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white' 
                          : 'bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm sm:text-base capitalize">
                          {format(new Date(dayTimestamp), "iiii", { locale: vi })}
                        </span>
                        <span className={`text-xs sm:text-sm font-medium px-2 py-0.5 rounded-full ${isExpanded ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {format(new Date(dayTimestamp), "dd/MM")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${isExpanded ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                          {dayViolations.length} vi phạm
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Body Ngày */}
                    {isExpanded && (
                      <div className="border-t border-slate-200">
                        <div className="divide-y divide-slate-100">
                          {dayViolations.map((v: any) => (
                            <ViolationRow 
                              key={v._id} 
                              violation={v}
                              onOpenEvidence={handleOpenModal}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // Emulation Scores Content
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default PublicViolationReport;