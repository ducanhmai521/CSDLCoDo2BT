"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { FiMail, FiLock, FiLogIn, FiUserPlus } from "react-icons/fi";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full animated-gradient-bg rounded-2xl p-6 shadow-lg border border-white/30">
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
        <p className="mt-2 text-sm text-slate-600">
          Truy cập hệ thống CSDL Cờ đỏ và quản lý thông tin hiệu quả
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          className={`px-4 py-2 text-sm rounded-xl border transition-all flex items-center gap-2 ${
            flow === "signIn"
              ? "bg-primary text-white border-primary shadow-md"
              : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white hover:shadow-md"
          }`}
          onClick={() => setFlow("signIn")}
        >
          <FiLogIn /> Đăng nhập
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm rounded-xl border transition-all flex items-center gap-2 ${
            flow === "signUp"
              ? "bg-primary text-white border-primary shadow-md"
              : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white hover:shadow-md"
          }`}
          onClick={() => setFlow("signUp")}
        >
          <FiUserPlus /> Đăng ký
        </button>
      </div>
      
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Sai mật khẩu, vui lòng thử lại.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Không thể đăng nhập, bạn có muốn đăng ký?"
                  : "Không thể đăng ký, bạn có muốn đăng nhập?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <FiMail className="text-primary" /> Email
          </label>
          <div className="relative">
            <input
              id="email"
              className="auth-input-field w-full"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
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
        
        <button 
          className="auth-button mt-4 flex items-center justify-center gap-2" 
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
            <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
          )}
        </button>
        
        <div className="text-center text-sm text-slate-600 mt-4 pt-4 border-t border-slate-200/50">
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
