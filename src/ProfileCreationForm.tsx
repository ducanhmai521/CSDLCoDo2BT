import { FormEvent, useState } from "react";
    import { useMutation } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { toast } from "sonner";

    export default function ProfileCreationForm() {
      const [fullName, setFullName] = useState("");
      const [className, setClassName] = useState("");
      const [isSubmitting, setIsSubmitting] = useState(false);
      const createMyProfile = useMutation(api.users.createMyProfile);

      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
          await createMyProfile({ fullName, className });
          toast.success("Đã gửi yêu cầu tạo hồ sơ. Vui lòng chờ duyệt.");
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setIsSubmitting(false);
        }
      };

      return (
        <div className="max-w-md mx-auto relative">
          <h2 className="text-2xl font-bold text-center mb-2 text-slate-800">Hoàn tất Hồ sơ</h2>
          <p className="text-slate-700 text-center mb-6">
            Vui lòng cung cấp thông tin của bạn để tiếp tục.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
            <input
              className="auth-input-field"
              placeholder="Họ và Tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <input
              className="auth-input-field"
              placeholder="Lớp (ví dụ: 10A1, 11B5)"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="form-loading-spinner mr-2"></div>
                  Đang gửi...
                </>
              ) : (
                'Gửi đi'
              )}
            </button>
            
            {/* Loading Overlay */}
            {isSubmitting && (
              <div className="form-loading-overlay">
                <div className="text-center">
                  <div className="form-loading-spinner mx-auto mb-4"></div>
                  <p className="text-slate-800 font-semibold">Đang tạo hồ sơ...</p>
                </div>
              </div>
            )}
          </form>
        </div>
      );
    }
