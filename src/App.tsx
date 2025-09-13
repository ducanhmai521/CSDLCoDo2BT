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
import { FiBarChart2, FiCheckCircle, FiShield, FiDatabase, FiUsers, FiRefreshCw } from "react-icons/fi";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicEmulationScoreTable from "./public/PublicEmulationScoreTable";
import PublicViolationReport from "./public/PublicViolationReport";

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/bang-diem-thi-dua-tho" element={<PublicEmulationScoreTable />} />
        <Route path="/bang-bao-cao-vi-pham" element={<PublicViolationReport />} />
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-500/40 via-purple-400/30 to-blue-500/40 animated-gradient-bg bg-size-200 animate-gradient-slow">
      <header className="sticky top-0 z-10 nav-glass h-16 flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-sm">
            <img src="https://www.dropbox.com/scl/fi/23fj64gvknqcw0fu6ibzw/icon.ico?rlkey=t0qmc0ffbkoh5z16g5xts105w&st=for1a0hd&raw=1" alt="favicon" className="w-8 h-8 rounded-lg" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display">CSDL Cờ đỏ THPTS2BT</h2>
            <p className="hidden md:block text-xs text-slate-600">Nền tảng quản lý vi phạm và nền nếp của trường THPT Số 2 Bảo Thắng</p>
          </div>
        </div>
        <Authenticated>
          <div className="flex items-center gap-4">
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
          </div>
        </Authenticated>
      </header>
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Content />
      </main>
      
      <Toaster position="top-center" richColors />
      
      <footer className="py-6 text-center text-sm text-slate-700 border-t border-white/40 mt-8 nav-glass">
        <div className="max-w-7xl mx-auto px-4">
            <div>
              <p className="font-medium text-slate-800">CSDL Cờ đỏ THPT Số 2 Bảo Thắng - 2025-2026</p>
              <p className="text-slate-700">Phát triển bởi Mai Đức Anh</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center glass-card">
          <div className="flex flex-col justify-center space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 font-display leading-tight">
                Nâng cao hiệu quả <span className="text-primary">quản lý nền nếp học sinh</span>
              </h1>
              <p className="mt-4 text-slate-700 text-lg">
                Hệ thống tập trung quản lý vi phạm, tổng hợp báo cáo, và hỗ trợ ra quyết
                định nhanh chóng cho Ban quản trị nhà trường.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="feature-card">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-primary text-lg">
                    <FiShield />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Ghi nhận vi phạm</h3>
                    <p className="text-sm text-slate-600">Nhanh chóng, chuẩn hóa theo quy định</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-primary text-lg">
                    <FiBarChart2 />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Báo cáo thống kê</h3>
                    <p className="text-sm text-slate-600">Theo tuần/tháng, với trang xem công khai</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-primary text-lg">
                    <FiUsers />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Tự động nhập liệu bằng AI</h3>
                    <p className="text-sm text-slate-600">Chuẩn hóa danh sách lỗi thô</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-primary text-lg">
                    <FiDatabase />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Giao diện thân thiện</h3>
                    <p className="text-sm text-slate-600">Dễ sử dụng, thân thiện với người dùng</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-sm text-slate-600 glass-card-subtle p-4">
              <p className="flex items-center gap-2">
                <FiCheckCircle className="text-green-600" /> 
                Hệ thống được cập nhật liên tục với các tính năng mới
              </p>
            </div>
          </div>
          
          <div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
    }

    function Dashboard({ profile }: { profile: Doc<"userProfiles"> }) {
      return (
        <div>
          <div className="glass-card mb-6">
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Xin chào, {profile.fullName}! 👋</h1>
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
