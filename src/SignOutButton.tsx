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
      className="px-4 py-2 rounded-xl bg-white/90 text-slate-700 border border-white/50 font-medium hover:bg-white hover:text-primary transition-all shadow-sm hover:shadow-md flex items-center gap-2"
      onClick={() => void signOut()}
    >
      <FiLogOut className="text-primary" />
      <span>Đăng xuất</span>
    </button>
  );
}
