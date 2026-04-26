import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "./lib/authClient";
import { FiLock, FiX } from "react-icons/fi";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới không khớp.");
      return;
    }
    
    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });
      if (result.error) {
        toast.error("Đổi mật khẩu thất bại. " + result.error.message);
      } else {
        toast.success("Đổi mật khẩu thành công!");
        onClose();
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra khi đổi mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/95 shadow-2xl p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <FiX size={24} />
        </button>
        <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FiLock className="text-primary" /> Đổi mật khẩu
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Mật khẩu cũ</label>
            <input 
              type="password"
              className="auth-input-field w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Mật khẩu mới</label>
            <input 
              type="password"
              className="auth-input-field w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự"
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Nhập lại mật khẩu mới</label>
            <input 
              type="password"
              className="auth-input-field w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-primary text-white hover:bg-primary-hover transition-colors flex items-center gap-2"
            >
              {loading ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
