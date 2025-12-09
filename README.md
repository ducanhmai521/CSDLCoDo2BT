# CSDL Cờ Đỏ THPTS2BT - Hệ Thống Quản Lý Nền Nếp Học Sinh

## 📋 Tổng Quan

**CSDL Cờ Đỏ THPTS2BT** là một nền tảng quản lý nền nếp học sinh hiện đại, được thiết kế đặc biệt cho trường THPT Số 2 Bảo Thắng. Hệ thống sử dụng công nghệ tiên tiến với:

- **Backend**: Convex - nền tảng database thời gian thực
- **Frontend**: Vite + React với giao diện hiện đại, responsive
- **Lưu trữ file**: Cloudflare R2 cho ảnh bằng chứng vi phạm
- **AI Integration**: Groq API để hỗ trợ xử lý dữ liệu thô

## ✨ Tính Năng Nổi Bật

### 🔐 1. Hệ Thống Xác Thực Đa Cấp
- **Đăng nhập an toàn** với Convex Auth
- **Phân quyền chi tiết**: Admin, Quản lý khối, Người dùng chờ duyệt
- **Chuyển đổi vai trò linh hoạt** cho Admin

### 📊 2. Quản Lý Vi Phạm Thông Minh
- **Ghi nhận vi phạm** theo danh mục chuẩn hóa
- **Hỗ trợ AI nhập liệu**: Tự động chuẩn hóa dữ liệu thô từ văn bản
- **Upload bằng chứng**: Hỗ trợ ảnh và video, tự động nén ảnh
- **Phân loại vi phạm**: Theo học sinh hoặc theo lớp
- **Tính điểm trừ tự động** theo quy định

### 📈 3. Báo Cáo Và Thống Kê
- **Bảng điểm thi đua**: Theo dõi điểm các lớp theo tuần/tháng
- **Báo cáo vi phạm**: Chi tiết theo thời gian, lớp, cá nhân
- **Xuất Excel**: Báo cáo có định dạng đẹp, sẵn sàng in
- **Trang công khai**: Cho phép xem điểm và vi phạm không cần đăng nhập

### 👥 4. Quản Lý Học Sinh
- **Danh sách lớp**: Quản lý 24 lớp (10A1 → 12A8)
- **Tìm kiếm thông minh**: Tìm học sinh theo tên, lớp
- **Import danh sách**: Từ file Excel với template có sẵn
- **Theo dõi nền nếp**: Lịch sử vi phạm của từng học sinh

### 📅 5. Quản Lý Thời Gian
- **Lọc theo tuần**: Tự động xác định tuần hiện tại
- **Lọc theo tháng**: Xem báo cáo tháng cụ thể
- **Khoảng thời gian tùy chỉnh**: Linh hoạt chọn ngày bắt đầu - kết thúc
- **Múi giờ Việt Nam**: Tự động điều chỉnh theo giờ địa phương

### 🔄 6. Cập Nhật Tự Động
- **Real-time sync**: Dữ liệu cập nhật ngay lập tức
- **Auto-refresh**: Không cần F5 để xem dữ liệu mới
- **Caching thông minh**: Tối ưu hiệu suất

### 🌐 7. Trang Công Khai
- **Bảng điểm thi đua**: Xem điểm các lớp theo tuần
- **Báo cáo vi phạm**: Công khai danh sách vi phạm
- **Xin phép**: Form xin phép nghỉ học online
- **Xem bằng chứng**: Truy cập ảnh/video vi phạm

## 🎯 Hướng Dẫn Sử Dụng Chi Tiết

### I. CHO ADMIN (Quản Trị Viên)

#### 1. Dashboard Tổng Quan
- **Xem thống kê nhanh**: Tổng số vi phạm, học sinh, lớp
- **Theo dõi tình hình**: Biểu đồ vi phạm theo thời gian
- **Quản lý người dùng**: Duyệt tài khoản mới, phân quyền

#### 2. Quản Lý Vi Phạm
**Bước 1**: Chọn loại đối tượng
- **Vi phạm cá nhân**: Chọn học sinh cụ thể
- **Vi phạm tập thể**: Chọn cả lớp

**Bước 2**: Nhập thông tin
- **Nhập thủ công**: Điền form chi tiết
- **Dùng AI hỗ trợ**: Paste danh sách thô, AI sẽ parse tự động

**Bước 3**: Upload bằng chứng
- **Kéo thả file**: Hỗ trợ nhiều ảnh/video
- **Tự động nén**: Ảnh >1MB sẽ được nén
- **Xem trước**: Kiểm tra trước khi gửi

**Bước 4**: Xác nhận và lưu
- **Kiểm tra lại**: Xem tổng quan trước khi lưu
- **Lưu vi phạm**: Hệ thống tự tính điểm trừ

#### 3. Xuất Báo Cáo
**Tuần**:
1. Chọn tuần cần xuất
2. Click "Xuất Excel"
3. File sẽ tải về với tên: `vi-pham-tuan-X-ngay-thang-nam.xlsx`

**Tháng**:
1. Chọn tháng cần xuất
2. Click "Xuất Excel"
3. File sẽ tải về với tên: `vi-pham-thang-MM-yyyy.xlsx`

**Tùy chỉnh**:
1. Chọn khoảng ngày bắt đầu - kết thúc
2. Có thể lọc thêm theo khối, lớp
3. Click "Xuất Excel"

#### 4. Quản Lý Danh Sách
**Import học sinh**:
1. Click "Tải template Excel"
2. Điền danh sách theo mẫu
3. Upload file Excel
4. Hệ thống tự động import

**Xem danh sách lớp**:
- Click vào từng lớp để xem chi tiết
- Tìm kiếm học sinh theo tên
- Export danh sách nếu cần

### II. CHO QUẢN LÝ KHỐI

#### 1. Theo Dõi Khối
- **Xem vi phạm khối mình quản lý**
- **Thống kê theo lớp**: Biết lớp nào vi phạm nhiều
- **Theo dõi xu hướng**: Vi phạm tăng hay giảm

#### 2. Ghi Nhận Vi Phạm
- **Quyền ghi nhận**: Chỉ cho khối mình quản lý
- **Cùng quy trình**: Giống Admin nhưng giới hạn phạm vi
- **Không thể xóa**: Chỉ Admin mới có quyền xóa

### III. TRANG CÔNG KHAI (Không Cần Đăng Nhập)

#### 1. Bảng Điểm Thi Đua
**URL**: `/bang-diem-thi-dua-tho`
- **Xem theo tuần**: Mặc định tuần hiện tại
- **Chọn tuần khác**: Từ dropdown hoặc date picker
- **Xếp hạng**: Tự động sắp xếp từ cao xuống thấp

#### 2. Báo Cáo Vi Phạm
**URL**: `/bang-bao-cao-vi-pham`
- **Xem theo tuần**: Mặc định theo tuần hiện tại
- **Click xem chi tiết**: Xem nội dung vi phạm
- **Xem bằng chứng**: Click vào icon để xem ảnh

#### 3. Xin Phép Nghỉ Học
**URL**: `/xin-phep`
- **Form đơn giản**: Họ tên, lớp, lý do, ngày nghỉ
- **Upload file đính kèm**: Giấy khám bệnh, etc.
- **Gửi yêu cầu**

## 🛠️ Cài Đặt Và Triển Khai

### Yêu Cầu Hệ Thống
- **Node.js**: Phiên bản 19 trở lên
- **Git**: Để clone repository
- **Tài khoản**: Convex, Vercel, Cloudflare R2

### Cài Đặt Local (Development)

```bash
# 1. Clone repository
git clone https://github.com/ducanhmai521/CSDLCoDo2BT
cd CSDLCoDo2BT

# 2. Cài dependencies
npm install

# 3. Khởi tạo Convex
npx convex dev

# 4. Chạy project (mở 2 terminal)
npm run dev:frontend  # Terminal 1 - Frontend
npm run dev:backend # Terminal 2 - Backend
```

### Triển Khai Production

#### 1. Chuẩn Bị
- **Convex**: Tạo project production, lấy deployment key
- **Vercel**: Import từ GitHub, cấu hình environment variables
- **Cloudflare R2**: Tạo bucket, API token

#### 2. Environment Variables
Cần cấu hình đầy đủ các biến:
```
# JWT & Auth
JWT_PRIVATE_KEY=your_jwt_private_key
JWKS=your_jwks_json

# Groq AI
GROQ_API_KEY=your_groq_api_key

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=your_r2_public_url

# Deployment
VITE_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOYMENT_KEY=your_convex_deploy_key
```

#### 3. GitHub Actions (Tùy Chọn)
- **Tự động deploy**: Khi push code lên GitHub
- **Cấu hình**: Thêm `CONVEX_DEPLOY_KEY` vào GitHub Secrets

## 📁 Cấu Trúc Dự Án

```
CSDLCoDo2BT/
├── convex/                 # Backend logic
│   ├── violations.ts       # Logic vi phạm
│   ├── users.ts           # Quản lý người dùng
│   ├── ai.ts              # AI integration
│   ├── r2.ts              # Cloudflare R2
│   └── excelExport.ts     # Xuất Excel
├── src/
│   ├── components/        # UI components
│   ├── public/            # Trang công khai
│   ├── AdminDashboard.tsx # Dashboard Admin
│   ├── ViolationReportForm.tsx # Form báo cáo
│   └── AIViolationInputModal.tsx # AI helper
└── README.md
```

## 🔧 Tùy Chỉnh Cho Trường Của Bạn

### 1. Đổi Tên Trường
- **File**: `index.html` - thay đổi `<title>`
- **File**: `src/App.tsx` - thay đổi tên trong header và footer
- **File**: `src/public/*.tsx` - thay đổi tiêu đề các bảng công khai

### 2. Đổi Logo
- **Icon**: Thay thế `icon.ico` và `favicon.ico`
- **Logo header**: Đổi URL trong `src/App.tsx`
- **Logo public**: Đổi trong các file `src/public/*.tsx`

### 3. Điều Chỉnh Danh Mục Vi Phạm
- **File**: `convex/violationPoints.ts`
- **Cấu trúc**: Categories → Violations → Điểm trừ
- **Tùy chỉnh**: Thêm, sửa, xóa theo quy định trường bạn

### 4. Số Lượng Lớp
- **Mặc định**: 24 lớp (10A1 → 12A8)
- **Thay đổi**: Cần sửa nhiều file, xem lưu ý bên dưới

## ⚠️ Lưu Ý Quan Trọng

### 1. Giới Hạn Thiết Kế
- **Số lớp**: Code được thiết kế cho 24 lớp cố định
- **Tên lớp**: Theo format 10A1, 11A2, 12A8...
- **Nếu khác**: Cần chỉnh sửa nhiều file, không khuyến khích cho người không chuyên

### 2. Bảo Mật
- **JWT Keys**: Tự tạo cặp khóa RSA, đảm bảo an toàn
- **API Keys**: Không commit lên GitHub
- **File upload**: Có giới hạn kích thước, tự động nén

### 3. Performance
- **Real-time**: Dữ liệu cập nhật ngay lập tức
- **Caching**: Tự động cache để tối ưu
- **Lazy loading**: Chỉ load data khi cần

## 🤝 Đóng Góp

Chúng tôi welcome mọi đóng góp! Nếu bạn:
- **Phát hiện lỗi**: Tạo issue trên GitHub
- **Muốn thêm tính năng**: Fork và tạo pull request

## 📄 License

Project này được license theo GPL-3.0.