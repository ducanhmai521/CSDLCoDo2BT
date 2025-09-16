import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./components/ui/button";
import { useEffect, useState } from "react";
import { RefreshCcw} from "lucide-react";

export function ForceRefresh() {
  const webVer = useQuery(api.version.getWebVer);
  const user = useQuery(api.users.getMyProfile);
  const updateMyWebVer = useMutation(api.version.updateMyWebVer);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (webVer === undefined || user === undefined || !user) return;
    if (user.webVer === undefined || user.webVer < webVer) {
      setShowNotification(true);
    }
  }, [webVer, user]);

  if (!showNotification) return null;

  return (
    <div className="fixed bottom-4 right-4 glass-card-strong p-6 shadow-2xl z-50 animate-float">
      <div className="flex items-start gap-3">
        <div className="text-2xl text-primary"><RefreshCcw className="w-8 h-8" /></div>
        <div className="flex-1">
          <p className="text-slate-800 font-semibold mb-2">Đã có phiên bản web mới!</p>
          <p className="text-slate-700 text-sm mb-4">Vui lòng cập nhật để tránh sai sót khi nhập liệu.</p>
          <Button
            onClick={() => {
              updateMyWebVer({ webVer: webVer! });
              window.location.reload();
            }}
            className="btn-glass-primary w-full"
          >
            Cập nhật ngay
          </Button>
        </div>
      </div>
    </div>
  );
}