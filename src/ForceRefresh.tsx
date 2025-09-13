import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./components/ui/button";
import { useEffect, useState } from "react";

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
    <div className="fixed bottom-4 right-4 bg-yellow-200 p-4 rounded-lg shadow-lg z-50">
      <p className="mb-2">Đã có phiên bản web mới. Vui lòng cập nhật để tránh sai sót khi nhập liệu.</p>
      <Button
        onClick={() => {
          updateMyWebVer({ webVer: webVer! });
          window.location.reload();
        }}
      >
        Cập nhật
      </Button>
    </div>
  );
}