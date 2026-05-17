import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

/**
 * Tính năng xin phép công khai đã bị tắt.
 * Trang này giữ lại để URL /xin-phep không bị 404.
 */
const PublicAbsenceRequest = () => {
  return (
    <div className="min-h-screen animated-gradient-bg flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full text-center space-y-4 py-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mx-auto">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Tính năng tạm ngưng</h1>
        <p className="text-sm text-slate-600">
          Tính năng xin phép công khai hiện không còn hoạt động. Vui lòng liên hệ trực tiếp với giáo viên chủ nhiệm hoặc ban cờ đỏ.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
};

export default PublicAbsenceRequest;
