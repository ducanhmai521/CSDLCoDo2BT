import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import ProfileCreationForm from "./ProfileCreationForm";
import { Doc } from "../convex/_generated/dataModel";
import AdminDashboard from "./AdminDashboard";
import GradeManagerDashboard from "./GradeManagerDashboard";
import { startOfDay, endOfDay, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useState } from "react";
import { FiBarChart2, FiCheckCircle, FiShield, FiDatabase, FiUsers, FiLogOut } from "react-icons/fi";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-500/40 via-purple-400/30 to-blue-500/40 animated-gradient-bg bg-size-200 animate-gradient-slow">
      <header className="sticky top-0 z-10 bg-white/50 backdrop-blur-xl h-16 flex justify-between items-center border-b border-white/40 shadow-md px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <img src="favicon.ico" alt="favicon" className="w-8 h-8 rounded-lg" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display">CSDL Cờ đỏ THPT Số 2 Bảo Thắng</h2>
            <p className="hidden md:block text-xs text-slate-600">Nền tảng quản lý vi phạm và xếp loại nền nếp học sinh</p>
          </div>
        </div>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Content />
      </main>
      
      <Toaster position="top-center" richColors />
      
      <footer className="py-6 text-center text-sm text-slate-600 border-t border-white/40 mt-8 bg-white/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4">
            <div>
              <p className="font-medium">CSDL Cờ đỏ THPT Số 2 Bảo Thắng - 2025-2026</p>
              <p>Phát triển bởi Mai Đức Anh</p>
            </div>
        </div>
      </footer>
    </div>
  );
    }

function Content() {
  const myProfile = useQuery(api.users.getMyProfile);
  const user = useQuery(api.auth.loggedInUser);

  const isLoading = myProfile === undefined || user === undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 glass-card bg-white/20 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/30 border-t-primary"></div>
          <p className="text-slate-700 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Authenticated>
        {user && !myProfile ? (
          <div className="glass-card bg-white/20 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-lg">
            <ProfileCreationForm />
          </div>
        ) : (
          myProfile && <Dashboard profile={myProfile} />
        )}
      </Authenticated>
      <Unauthenticated>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center glass-card bg-white/20 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-lg">
          <div className="flex flex-col justify-center space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 font-display leading-tight">
                Nâng cao hiệu quả <span className="text-primary">quản lý Cờ đỏ</span>
              </h1>
              <p className="mt-4 text-slate-700 text-lg">
                Hệ thống tập trung quản lý vi phạm, tổng hợp báo cáo, và hỗ trợ ra quyết
                định nhanh chóng cho Ban quản trị nhà trường.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="feature-card bg-white/30 backdrop-blur-sm border border-white/40 shadow-md hover:shadow-lg transition-all">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-lg">
                    <FiShield />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Ghi nhận vi phạm</h3>
                    <p className="text-sm text-slate-600">Nhanh chóng, chuẩn hóa theo quy định</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card bg-white/30 backdrop-blur-sm border border-white/40 shadow-md hover:shadow-lg transition-all">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-lg">
                    <FiBarChart2 />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Báo cáo thống kê</h3>
                    <p className="text-sm text-slate-600">Theo khối, lớp, tuần/tháng</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card bg-white/30 backdrop-blur-sm border border-white/40 shadow-md hover:shadow-lg transition-all">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-lg">
                    <FiUsers />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Phân quyền rõ ràng</h3>
                    <p className="text-sm text-slate-600">Quản trị viên, Quản lý khối</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card bg-white/30 backdrop-blur-sm border border-white/40 shadow-md hover:shadow-lg transition-all">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-lg">
                    <FiDatabase />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800">Dữ liệu an toàn</h3>
                    <p className="text-sm text-slate-600">Bảo vệ và lưu trữ trên nền tảng hiện đại</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-sm text-slate-600 bg-white/30 backdrop-blur-sm p-4 rounded-xl border border-white/40 shadow-md">
              <p className="flex items-center gap-2">
                <FiCheckCircle className="text-accent-green" /> 
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
          <h1 className="text-3xl font-bold mb-2">Xin chào, {profile.fullName}!</h1>
          <p className="text-slate-600 mb-6">
            Vai trò của bạn: <span className="font-semibold">{translateRole(profile.role)}</span>
            {profile.role === 'pending' && ' (Đang chờ Quản trị viên duyệt)'}
          </p>
          
          {profile.role === 'admin' && <AdminDashboard />}
          {profile.role === 'gradeManager' && <GradeManagerDashboard profile={profile} />}
          {profile.role === 'pending' && 
            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md">
              <p className="font-bold">Tài khoản của bạn đang được xem xét</p>
              <p>Vui lòng chờ Quản trị viên xác minh và cấp quyền truy cập.</p>
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
