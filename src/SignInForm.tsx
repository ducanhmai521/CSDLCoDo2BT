"use client";
import { authClient } from "./lib/authClient";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { FiUser, FiLock, FiLogIn, FiUserPlus } from "react-icons/fi";

export function SignInForm() {
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const syncBetterAuthUser = useMutation(api.users.syncBetterAuthUser);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const username = (formData.get("username") as string).trim();
    const password = formData.get("password") as string;
    
    if (flow === "signUp") {
      const confirmPassword = formData.get("confirmPassword") as string;
      if (password.length < 8) {
        toast.error("Mật khẩu phải có ít nhất 8 ký tự.");
        setSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Mật khẩu không khớp.");
        setSubmitting(false);
        return;
      }
    }

    try {
      if (flow === "signIn") {
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
      } else {
        const email = `${username}@internal.local`;
        const result = await authClient.signUp.email({
          email,
          password,
          name: username,
          username,
        } as any);
        if (result.error) {
          const msg = result.error.message ?? "";
          if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist") || msg.toLowerCase().includes("taken")) {
            toast.error("Tên đăng nhập đã tồn tại.");
          } else {
            toast.error("Không thể đăng ký, vui lòng thử lại.");
          }
          return;
        }
        // Sync user to Convex users table
        if (result.data?.user) {
          const u = result.data.user as any;
          await syncBetterAuthUser({
            betterAuthId: u.id,
            username: u.username ?? username,
            email: u.email ?? email,
          });
        }
      }
    } catch (error: unknown) {
      toast.error("Không thể kết nối. Vui lòng thử lại.");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full glass-card-strong">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-2">
          {flow === "signIn" ? (
            <>
              <FiLogIn className="text-primary" /> Đăng nhập
            </>
          ) : (
            <>
              <FiUserPlus className="text-primary" /> Tạo tài khoản
            </>
          )}
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Truy cập hệ thống CSDL Cờ đỏ và quản lý thông tin hiệu quả
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          className={`px-4 py-2 text-sm rounded-2xl border transition-all flex items-center gap-2 ${
            flow === "signIn"
              ? "bg-white/30 text-slate-800 border-white/50 shadow-lg backdrop-blur-sm"
              : "bg-white/10 text-slate-700 border-white/30 hover:bg-white/20 hover:text-slate-800 hover:shadow-md backdrop-blur-sm"
          }`}
          onClick={() => setFlow("signIn")}
        >
          <FiLogIn className="text-primary" /> Đăng nhập
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm rounded-2xl border transition-all flex items-center gap-2 ${
            flow === "signUp"
              ? "bg-white/30 text-slate-800 border-white/50 shadow-lg backdrop-blur-sm"
              : "bg-white/10 text-slate-700 border-white/30 hover:bg-white/20 hover:text-slate-800 hover:shadow-md backdrop-blur-sm"
          }`}
          onClick={() => setFlow("signUp")}
        >
          <FiUserPlus className="text-primary" /> Đăng ký
        </button>
      </div>
      
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <FiUser className="text-primary" /> Tên đăng nhập
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
            <FiLock className="text-primary" /> Mật khẩu
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
        
        {flow === "signUp" && (
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <FiLock className="text-primary" /> Nhập lại mật khẩu
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                className="auth-input-field w-full"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
        )}
        
        <button 
          className="auth-button mt-4 flex items-center justify-center gap-2 relative" 
          type="submit" 
          disabled={submitting}
        >
          {flow === "signIn" ? (
            <>
              <FiLogIn /> Đăng nhập
            </>
          ) : (
            <>
              <FiUserPlus /> Đăng ký
            </>
          )}
          {submitting && (
            <div className="form-loading-spinner ml-2"></div>
          )}
        </button>
        
        {/* Loading Overlay */}
        {submitting && (
          <div className="form-loading-overlay">
            <div className="text-center">
              <div className="form-loading-spinner mx-auto mb-4"></div>
              <p className="text-slate-800 font-semibold">
                {flow === "signIn" ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}
              </p>
            </div>
          </div>
        )}
        
        <div className="text-center text-sm text-slate-700 mt-4 pt-4 border-t border-white/40">
          <span>
            {flow === "signIn" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-bold cursor-pointer transition-colors"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Đăng ký ngay" : "Đăng nhập ngay"}
          </button>
        </div>
      </form>
    </div>
  );
}
