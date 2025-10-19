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
          <div className="relative">
            <video 
              controls 
              className="w-full object-contain"
              preload="auto"
              playsInline
              controlsList="nodownload"
              disablePictureInPicture
              disableRemotePlayback
              onError={(e) => console.error("Video error:", e)}
            >
              {/* Sử dụng source thay vì src để có thể thiết lập type */}
              <source 
                src={fileUrl} 
                type={`video/${fileType === 'mov' ? 'quicktime' : fileType}`} 
              />
              Trình duyệt của bạn không hỗ trợ video.
            </video>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
              Nếu video bị dừng, hãy tải về để xem.
            </div>
          </div>
          <div className="mt-2 text-center">
            <a 
              href={fileUrl || '#'} 
              download={filePath?.split('/').pop() || 'video'}
              className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Tải video về để xem
            </a>
          </div>
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
          <div className="mt-2 text-center">
            <a 
              href={fileUrl || '#'} 
              download={filePath?.split('/').pop() || 'image'}
              className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Tải ảnh về
            </a>
          </div>
        </div>
      );
    }
    
    // Hiển thị thông tin file cho các loại file khác
    return (
      <div className="mt-4 text-center">
        <p className="text-lg">File: {filePath}</p>
        <p className="text-sm text-gray-500">Loại file: {fileType.toUpperCase()}</p>
        <div className="mt-2">
          <a 
            href={fileUrl || '#'} 
            download={filePath?.split('/').pop() || 'file'}
            className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Tải file về
          </a>
        </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default EviView;