import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const EviView = () => {
  const location = useLocation();
  const filePath = location.pathname.replace('/eviview/', '');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lấy URL công khai từ R2 dựa trên path
  const publicUrl = useQuery(api.r2.getR2PublicUrl, 
    filePath ? { key: filePath } : "skip"
  );

  useEffect(() => {
    if (publicUrl) {
      setFileUrl(publicUrl);
      setLoading(false);
      
      // Xác định loại file dựa trên phần mở rộng
      const extension = filePath?.split('.').pop()?.toLowerCase() || '';
      setFileType(extension);
    } else if (publicUrl === null) {
      setError("Không thể tải file. File không tồn tại hoặc bạn không có quyền truy cập.");
      setLoading(false);
    }
  }, [publicUrl, filePath]);

  const renderFileContent = () => {
    if (!fileUrl || !fileType) return null;

    // Xử lý hiển thị video
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
    if (videoExtensions.includes(fileType)) {
      return (
        <div className="border rounded-lg overflow-hidden mt-4 max-w-3xl mx-auto">
          <video 
            src={fileUrl} 
            controls 
            className="w-full object-contain"
            preload="auto"
            autoPlay
            playsInline
            controlsList="nodownload"
            disablePictureInPicture
            disableRemotePlayback
          >
            Trình duyệt của bạn không hỗ trợ video.
          </video>
        </div>
      );
    }
    
    // Xử lý hiển thị hình ảnh
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (imageExtensions.includes(fileType)) {
      return (
        <div className="border rounded-lg overflow-hidden mt-4 max-w-3xl mx-auto">
          <img 
            src={fileUrl} 
            alt="Nội dung file" 
            className="w-full object-contain"
            loading="lazy"
          />
        </div>
      );
    }
    
    // Hiển thị thông tin file cho các loại file khác
    return (
      <div className="mt-4 text-center">
        <p className="text-lg">File: {filePath}</p>
        <p className="text-sm text-gray-500">Loại file: {fileType.toUpperCase()}</p>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">CODO2BT R2 Bucket Eviview</h1>
        {loading ? (
          <p className="text-gray-600">Đang tải...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2">
                {filePath?.split('/').pop() || 'File'}
              </h2>
              {renderFileContent()}
            </div>
            <div className="mt-4">
              <a 
                href={fileUrl || '#'} 
                download
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                target="_blank" 
                rel="noopener noreferrer"
              >
                Tải về
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EviView;