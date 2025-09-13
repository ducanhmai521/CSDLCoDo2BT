"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { FiLogOut } from "react-icons/fi";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-slate-800 border border-white/30 font-medium 
hover:bg-white/30 hover:shadow-lg transition-all duration-300 shadow-lg
flex items-center gap-2"
      onClick={() => void signOut()}
    >
      <FiLogOut className="text-primary" />
      <span className="hidden sm:inline">Đăng xuất</span>
    </button>
  );
}
