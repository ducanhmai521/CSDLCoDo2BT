import { FormEvent, useState } from "react";
    import { useMutation } from "convex/react";
    import { api } from "../convex/_generated/api";
    import { toast } from "sonner";

    export default function ProfileCreationForm() {
      const [fullName, setFullName] = useState("");
      const [className, setClassName] = useState("");
      const createMyProfile = useMutation(api.users.createMyProfile);

      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
          await createMyProfile({ fullName, className });
          toast.success("Đã gửi yêu cầu tạo hồ sơ. Vui lòng chờ duyệt.");
        } catch (error) {
          toast.error((error as Error).message);
        }
      };

      return (
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Hoàn tất Hồ sơ</h2>
          <p className="text-slate-600 text-center mb-6">
            Vui lòng cung cấp thông tin của bạn để tiếp tục.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              className="auth-input-field"
              placeholder="Họ và Tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              className="auth-input-field"
              placeholder="Lớp (ví dụ: 10A1, 11B5)"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
            />
            <button type="submit" className="auth-button">
              Gửi đi
            </button>
          </form>
        </div>
      );
    }
