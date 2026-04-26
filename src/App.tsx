import { Authenticated, Unauthenticated, useMutation, useQuery, useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { authClient } from "./lib/authClient";
import { SignInForm } from "./SignInForm";
import { Toaster } from "sonner";
import ProfileCreationForm from "./ProfileCreationForm";
import { Doc } from "../convex/_generated/dataModel";
import AdminDashboard from "./AdminDashboard";
import GradeManagerDashboard from "./GradeManagerDashboard";
import { ForceRefresh } from "./ForceRefresh";
import { FiBarChart2, FiCheckCircle, FiShield, FiDatabase, FiUsers, FiRefreshCw, FiZap, FiTrendingUp, FiLock, FiUser, FiChevronDown, FiLogOut, FiAlertTriangle } from "react-icons/fi";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import PublicViolationReport from "./public/PublicViolationReport";
import EviView from "./public/EviView";
import PublicAbsenceRequest from "./public/PublicAbsenceRequest";
import ReportingLeaderboard from "./ReportingLeaderboard";

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/bang-diem-thi-dua-tho" element={<PublicViolationReport />} />
        <Route path="/bang-bao-cao-vi-pham" element={<PublicViolationReport />} />
        <Route path="/xin-phep" element={<PublicAbsenceRequest />} />
        <Route path="/bang-xep-hang" element={<ReportingLeaderboard />} />
        <Route path="/eviview/*" element={<EviView />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const myProfile = useQuery(api.users.getMyProfile);
  const switchRole = useMutation(api.users.switchRole);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleSwitchRole = async () => {
    try {
      await switchRole();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-300/25 via-blue-200/20 to-teal-300/25 animated-gradient-bg bg-size-200 animate-gradient-slow">
      <header className="sticky top-4 z-10 nav-glass h-16 flex justify-between items-center px-4 md:px-8 mx-4 mt-4 rounded-xl bg-white/50 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-sm">
            <img
              src="https://www.dropbox.com/scl/fi/qhdckf1zj8svntuz93gcq/csdl512.png?rlkey=ms93xygjfp7mzk727hij811po&st=lt8k0y9x&raw=1"
              alt="logo"
              className="w-8 h-8 rounded-lg"
            />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 font-display">CSDL Cờ đỏ THPTS2BT</h2>
            <p className="hidden md:block text-xs text-slate-600">Nền tảng quản lý vi phạm và nền nếp của trường THPT Số 2 Bảo Thắng</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Authenticated>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-2 rounded-full text-slate-700 hover:bg-slate-200/50 transition-all outline-none" title="Tài khoản">
                  <FiUser size={24} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl rounded-2xl" align="end">
                <div className="flex flex-col gap-1">
                  <div className="px-3 py-2 mb-1 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">{myProfile?.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{myProfile?.className} • {translateRole(myProfile?.role || '')}</p>
                  </div>
                  {myProfile && (myProfile.role === 'gradeManager' || myProfile.role === 'admin') && (
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all"
                    >
                      <FiLock className="text-lg opacity-70" />
                      <span>Đổi mật khẩu</span>
                    </button>
                  )}
                  {myProfile?.isSuperUser && (
                    <button
                      onClick={handleSwitchRole}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all"
                    >
                      <FiRefreshCw className="text-lg opacity-70" />
                      <span>Chuyển đổi vai trò</span>
                    </button>
                  )}
                  <div className="h-px bg-slate-200/50 my-1 mx-2" />
                  <button
                    onClick={() => void authClient.signOut()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <FiLogOut className="text-lg opacity-70" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </Authenticated>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Content />
      </main>

      <Toaster position="bottom-center" richColors />

      <footer className="py-6 text-center text-sm text-slate-700 border-t border-white/40 mt-8 nav-glass">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">CSDL Cờ đỏ THPT Số 2 Bảo Thắng - 2025-2026</p>
          <div className="flex justify-center gap-4 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            <a href="https://github.com/ducanhmai521/CSDLCoDo2BT" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors duration-200">
              GitHub Repository
            </a>
            <a href="https://17022008.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors duration-200">
              Liên hệ Dev
            </a>
          </div>
        </div>
      </footer>
      <ForceRefresh />
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}

function Content() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { isAuthenticated: convexIsAuth } = useConvexAuth();
  const myProfile = useQuery(api.users.getMyProfile);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    if (!sessionPending) {
      setHasCheckedAuth(true);
    }
  }, [sessionPending]);

  // Loading if initial check isn't done, or if we have a session but profile is loading
  // Also wait if we have a session but Convex hasn't authenticated yet (prevents Profile flash)
  const isLoading = !hasCheckedAuth || (!!session && !convexIsAuth) || (!!session && myProfile === undefined);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 glass-card">
        <div className="flex flex-col items-center gap-4">
          <div className="form-loading-spinner w-12 h-12 border-t-blue-600"></div>
          <p className="text-slate-700 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <HomepageHero />;
  }

  if (!myProfile) {
    return (
      <div className="glass-card">
        <ProfileCreationForm />
      </div>
    );
  }

  return <Dashboard profile={myProfile} />;
}

function HomepageHero() {
  return (
    <div>
      {/* ── Hero Section ── */}
      <section className="min-h-[calc(100vh-8rem)] flex items-center py-12">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — tagline + features */}
          <div className="flex flex-col text-center lg:text-left gap-8 w-full max-w-2xl mx-auto lg:mx-0">
            {/* Title Area */}
            <div className="space-y-5 flex flex-col items-center lg:items-start">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-sm font-semibold">
                <FiZap className="text-blue-600" />
                Phiên bản 2025-2026
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-slate-900 font-display leading-[1.15] tracking-tight">
                Quản lý nền nếp
                <br className="hidden sm:block" />
                <span className="text-blue-600"> thông minh & hiệu quả</span>
              </h1>
              <p className="text-slate-600 text-lg md:text-xl leading-relaxed max-w-lg">
                Nền tảng chính thức của Đoàn trường THPT Số 2 Bảo Thắng. Giúp số hóa toàn bộ quy trình ghi nhận và xử lý vi phạm.
              </p>
            </div>

            {/* Quick links as buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mt-2 w-full sm:w-auto px-4 sm:px-0">
              <Link
                to="/bang-bao-cao-vi-pham"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <FiBarChart2 className="text-xl" />
                Bảng điểm thi đua
              </Link>
              <Link
                to="/xin-phep"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-slate-700 font-bold shadow-md border border-slate-200 hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <FiCheckCircle className="text-teal-600 text-xl" />
                Xin phép nghỉ học
              </Link>
            </div>
          </div>

          {/* Right — sign-in form */}
          <div className="w-full max-w-sm mx-auto lg:mr-0">
            <SignInForm />
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-16 border-t border-white/20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Tính năng nổi bật</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 font-display">
            Mọi thứ bạn cần, trong một nơi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-blue-500/30 border border-white/30 flex items-center justify-center text-cyan-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiShield />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Ghi nhận vi phạm</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Nhanh chóng, chuẩn hóa theo quy định nhà trường. Phân loại theo khối, lớp, loại lỗi.</p>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400/30 to-indigo-500/30 border border-white/30 flex items-center justify-center text-blue-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiBarChart2 />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Báo cáo thống kê</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Tổng hợp theo tuần, tháng. Trang xem công khai cho phụ huynh và ban giám hiệu.</p>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-400/30 to-purple-500/30 border border-white/30 flex items-center justify-center text-violet-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiZap />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Nhập liệu bằng AI</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Dán danh sách vi phạm thô, AI tự động chuẩn hóa và phân loại chính xác.</p>
              </div>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400/30 to-cyan-500/30 border border-white/30 flex items-center justify-center text-teal-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiTrendingUp />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Bảng xếp hạng</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Hệ thống điểm thưởng cho cờ đỏ báo cáo. Bảng xếp hạng minh bạch, cạnh tranh lành mạnh.</p>
              </div>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400/30 to-blue-500/30 border border-white/30 flex items-center justify-center text-sky-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiUsers />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Phân quyền rõ ràng</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Quản trị viên, quản lý khối với quyền hạn riêng biệt. Dữ liệu được bảo vệ chặt chẽ.</p>
              </div>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="feature-card group">
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-teal-500/30 border border-white/30 flex items-center justify-center text-emerald-600 text-lg group-hover:scale-110 transition-transform duration-300">
                <FiDatabase />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">Dữ liệu tập trung</h3>
                <p className="text-sm text-slate-600 leading-relaxed">Đồng bộ real-time, xuất Excel, lưu trữ lâu dài. Không mất dữ liệu, không trùng lặp.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ profile }: { profile: Doc<"userProfiles"> }) {
  const appealedViolations = useQuery(
    api.violations.getAppealedViolations,
    profile.role === "admin" ? {} : "skip"
  );
  const appealedCount = profile.role === "admin"
    ? (appealedViolations ?? []).length
    : 0;
  return (
    <div>
      <div className="glass-card mb-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">Xin chào, {profile.fullName}!</h1>
        <p className="text-slate-700 mb-4">
          Vai trò của bạn: <span className="font-semibold text-slate-800">{translateRole(profile.role)}</span>
          {profile.role === 'pending' && ' (Đang chờ Quản trị viên duyệt)'}
        </p>
        {profile.role === "admin" && (
          <div className="mt-2">
            {appealedViolations === undefined ? (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-600 text-sm font-semibold shadow-sm animate-pulse">
                Đang kiểm tra báo cáo kháng cáo...
              </div>
            ) : appealedCount > 0 ? (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm font-semibold shadow-sm">
                Có {appealedCount} báo cáo đang chờ xử lý kháng cáo
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm font-semibold shadow-sm">
                Hiện không có báo cáo nào bị kháng cáo.
              </div>
            )}
          </div>
        )}
      </div>

      {profile.role === 'admin' && <AdminDashboard />}
      {profile.role === 'gradeManager' && <GradeManagerDashboard profile={profile} />}
      {profile.role === 'pending' &&
        <div className="glass-card-subtle p-6 border-l-4 border-blue-600">
          <p className="font-bold text-slate-800">Tài khoản của bạn đang được xem xét</p>
          <p className="text-slate-700">Vui lòng chờ Quản trị viên xác minh và cấp quyền truy cập.</p>
        </div>
      }
    </div>
  );
}

function translateRole(role: string) {
  switch (role) {
    case 'admin': return 'Quản trị viên';
    case 'gradeManager': return 'Quản lý Khối';
    case 'pending': return 'Chờ duyệt';
    default: return 'Không xác định';
  }
}
