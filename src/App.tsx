import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import ProfileCreationForm from "./ProfileCreationForm";
import { Doc } from "../convex/_generated/dataModel";
import AdminDashboard from "./AdminDashboard";
import GradeManagerDashboard from "./GradeManagerDashboard";
import { ForceRefresh } from "./ForceRefresh";
import { FiBarChart2, FiCheckCircle, FiShield, FiDatabase, FiUsers, FiRefreshCw, FiZap, FiTrendingUp } from "react-icons/fi";
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
            <img src="/favicon.ico" alt="favicon" className="w-8 h-8 rounded-lg" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 font-display">CSDL Cờ đỏ THPTS2BT</h2>
            <p className="hidden md:block text-xs text-slate-600">Nền tảng quản lý vi phạm và nền nếp của trường THPT Số 2 Bảo Thắng</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Authenticated>
            {myProfile?.isSuperUser && (
              <button
                onClick={handleSwitchRole}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors p-2 rounded-xl hover:bg-white/20"
                title="Switch Role"
              >
                <FiRefreshCw />
              </button>
            )}
            <SignOutButton />
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
    </div>
  );
    }

function Content() {
  const myProfile = useQuery(api.users.getMyProfile);
  const user = useQuery(api.auth.loggedInUser);

  const isLoading = myProfile === undefined || user === undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 glass-card">
        <div className="flex flex-col items-center gap-4">
          <div className="form-loading-spinner w-12 h-12"></div>
          <p className="text-slate-700 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Authenticated>
        {user && !myProfile ? (
          <div className="glass-card">
            <ProfileCreationForm />
          </div>
        ) : (
          myProfile && <Dashboard profile={myProfile} />
        )}
      </Authenticated>
      <Unauthenticated>
        <HomepageHero />
      </Unauthenticated>
    </div>
  );
    }

function HomepageHero() {
  return (
    <div>
      {/* ── Hero Section ── */}
      <section className="min-h-screen flex items-center py-12">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — logo + branding + tagline */}
          <div className="flex flex-col gap-7">
            {/* Logo + identity stack */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-sm border border-white/50 shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src="/favicon.ico"
                  alt="logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">

                {/* School name */}
                <p className="text-sm font-semibold text-slate-600 leading-tight">Đoàn trường THPT Số 2 Bảo Thắng</p>
                {/* System name */}
                <h2 className="text-xl font-extrabold text-slate-900 font-display leading-tight tracking-tight">CSDL Cờ Đỏ</h2>
              </div>
            </div>

            {/* Divider */}
            <div className="w-12 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>

            {/* Title */}
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold text-slate-900 font-display leading-[1.15] tracking-tight">
                Quản lý nền nếp
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
                  thông minh
                </span>
              </h1>
              <p className="mt-4 text-slate-600 text-lg leading-relaxed max-w-md">
                Nền tảng chính thức của Đoàn trường THPT Số 2 Bảo Thắng.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-800 font-display">100%</p>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Số hóa</p>
              </div>
              <div className="w-px h-10 bg-white/40"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-800 font-display">AI</p>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Nhập liệu</p>
              </div>
              <div className="w-px h-10 bg-white/40"></div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-800 font-display">Real-time</p>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Đồng bộ</p>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              <Link
                to="/bang-bao-cao-vi-pham"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/25 border border-white/40 backdrop-blur-sm text-sm font-semibold text-slate-700 hover:bg-white/40 hover:text-slate-900 hover:shadow-md transition-all duration-200"
              >
                <FiBarChart2 className="text-cyan-600" />
                Báo cáo vi phạm công khai
              </Link>
              <Link
                to="/xin-phep"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/25 border border-white/40 backdrop-blur-sm text-sm font-semibold text-slate-700 hover:bg-white/40 hover:text-slate-900 hover:shadow-md transition-all duration-200"
              >
                <FiCheckCircle className="text-teal-600" />
                Xin phép nghỉ học
              </Link>
            </div>

            {/* Scroll hint */}
            <div className="hidden lg:flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest">
              <span>Xem tính năng</span>
              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Right — sign-in form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
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

        {/* Bottom note */}
        <div className="mt-10 flex justify-center">
          <div className="glass-card-subtle px-6 py-3 flex items-center gap-3 text-sm text-slate-600">
            <FiCheckCircle className="text-green-500 shrink-0" />
            <span>Hệ thống được cập nhật liên tục — năm học 2025–2026</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ profile }: { profile: Doc<"userProfiles"> }) {
      return (
        <div>
          <div className="glass-card mb-6">
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Xin chào, {profile.fullName}!</h1>
            <p className="text-slate-700 mb-4">
              Vai trò của bạn: <span className="font-semibold text-slate-800">{translateRole(profile.role)}</span>
              {profile.role === 'pending' && ' (Đang chờ Quản trị viên duyệt)'}
            </p>
          </div>
          
          {profile.role === 'admin' && <AdminDashboard />}
          {profile.role === 'gradeManager' && <GradeManagerDashboard profile={profile} />}
          {profile.role === 'pending' && 
            <div className="glass-card-subtle p-6 border-l-4 border-blue-600">
              <p className="font-bold text-slate-800">⏳ Tài khoản của bạn đang được xem xét</p>
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
