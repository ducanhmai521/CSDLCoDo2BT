"use client";
import { authClient } from "./lib/authClient";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { FiUser, FiLock, FiLogIn, FiHelpCircle } from "react-icons/fi";

export function SignInForm() {
  const [submitting, setSubmitting] = useState(false);
  const syncBetterAuthUser = useMutation(api.users.syncBetterAuthUser);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const username = (formData.get("username") as string).trim();
    const password = formData.get("password") as string;
    
    try {
      const result = await authClient.signIn.username({ username, password });
      if (result.error) {
        const msg = result.error.message ?? "";
        if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("password") || msg.toLowerCase().includes("credentials")) {
          toast.error("Sai tên đăng nhập hoặc mật khẩu.");
        } else {
          toast.error("Không thể đăng nhập, vui lòng thử lại.");
        }
        return;
      }
      // Sync user to Convex users table
      if (result.data?.user) {
        const u = result.data.user as any;
        await syncBetterAuthUser({
          betterAuthId: u.id,
          username: u.username ?? username,
          email: u.email ?? `${username}@internal.local`,
        });
      }
    } catch (error: unknown) {
      toast.error("Không thể kết nối. Vui lòng thử lại.");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info("Để cấp lại mật khẩu, vui lòng nhắn tin Zalo cho quản trị viên qua SĐT: 0375530961", { duration: 8000 });
  };

  return (
    <div className="w-full glass-card-strong">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-2">
          <FiLogIn className="text-cyan-600" /> Đăng nhập
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Truy cập hệ thống quản lý CSDL Cờ đỏ
        </p>
      </div>
      
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <FiUser className="text-cyan-600" /> Tên đăng nhập
          </label>
          <div className="relative">
            <input
              id="username"
              className="auth-input-field w-full"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Nhập tên đăng nhập"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <FiLock className="text-cyan-600" /> Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              className="auth-input-field w-full"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        
        <button 
          className="auth-button mt-4 flex items-center justify-center gap-2 relative" 
          type="submit" 
          disabled={submitting}
        >
          <FiLogIn /> Đăng nhập
          {submitting && (
            <div className="form-loading-spinner ml-2 border-t-white"></div>
          )}
        </button>
        
        {/* Loading Overlay */}
        {submitting && (
          <div className="form-loading-overlay">
            <div className="text-center">
              <div className="form-loading-spinner mx-auto mb-4 border-t-cyan-500 border-white/50 w-10 h-10 border-[3px]"></div>
              <p className="text-slate-800 font-semibold">
                Đang đăng nhập...
              </p>
            </div>
          </div>
        )}
        
        <div className="text-center text-sm text-slate-700 mt-4 pt-4 border-t border-white/40">
          <button
            type="button"
            className="text-cyan-700 hover:text-cyan-800 hover:underline font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 mx-auto"
            onClick={handleForgotPassword}
          >
            <FiHelpCircle /> Quên mật khẩu?
          </button>
        </div>
      </form>
    </div>
  );
}
