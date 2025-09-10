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
      className="px-4 py-2 rounded-xl bg-red-100 text-red-700 border border-red-200 font-medium 
hover:bg-red-200 hover:text-red-800 transition-all shadow-sm hover:shadow-md 
flex items-center gap-2"
      onClick={() => void signOut()}
    >
      <FiLogOut className="text-primary" />
    </button>
  );
}
