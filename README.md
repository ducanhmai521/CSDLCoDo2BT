# CSDL Cờ Đỏ THPTS2BT - Hệ Thống Quản Lý Nền Nếp Học Sinh

## 📋 Tổng Quan

**CSDL Cờ Đỏ THPTS2BT** là một nền tảng quản lý nền nếp học sinh hiện đại, được thiết kế đặc biệt cho trường THPT Số 2 Bảo Thắng. Hệ thống sử dụng công nghệ tiên tiến với:

- **Backend**: Convex - nền tảng database thời gian thực
- **Frontend**: Vite + React với giao diện hiện đại, responsive
- **Lưu trữ file**: Cloudflare R2 cho ảnh bằng chứng vi phạm
- **AI Integration**: Gemini và OpenRouter (OpenAI-compatible) để hỗ trợ xử lý dữ liệu thô

## ✨ Tính Năng Nổi Bật

### 🔐 1. Hệ Thống Xác Thực Đa Cấp
- **Đăng nhập an toàn, dễ dàng quản lý** với Better Auth
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

## 🛠️ Hướng Dẫn Cài Đặt Và Triển Khai Chi Tiết

Dưới đây là hướng dẫn chi tiết từng bước để cài đặt project này chạy thực tế, đặc biệt là cách thiết lập **Better Auth**, AI và lưu trữ file.

### 1. Yêu Cầu Hệ Thống
- **Node.js**: Phiên bản 18+ (khuyên dùng 20.x)
- **Git**: Để clone source code
- Các tài khoản dịch vụ cần thiết:
  - Tài khoản [Convex](https://convex.dev) (Miễn phí)
  - Tài khoản [OpenRouter](https://openrouter.ai) (để gọi API AI)
  - Tài khoản [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (để lưu ảnh/video)

### 2. Khởi Tạo Dự Án Local

Mở Terminal và chạy các lệnh sau:

```bash
# 1. Clone repository
git clone https://github.com/ducanhmai521/CSDLCoDo2BT
cd CSDLCoDo2BT

# 2. Cài đặt các thư viện (dependencies)
npm install
```

### 3. Cấu hình Convex Backend

Khởi tạo project trên Convex:
```bash
npx convex dev
```
- Lệnh này sẽ yêu cầu bạn đăng nhập Convex (bằng GitHub).
- Nó sẽ tự tạo một project Convex mới và liên kết với code local của bạn.
- Bạn có thể ấn `Ctrl + C` để dừng tạm thời nếu cần thiết lập biến môi trường ở bước sau.

### 4. Cấu Hình Biến Môi Trường (Environment Variables)

Hệ thống cần các biến môi trường được lưu trữ bảo mật trên server của Convex (không nằm trong `.env` của thư mục code). Để cài đặt, bạn mở dashboard của Convex (vào [dashboard.convex.dev](https://dashboard.convex.dev)), chọn project của mình, rồi vào tab **Settings > Environment Variables**, hoặc chạy các lệnh dưới đây trong Terminal.

#### A. Thiết Lập Better Auth (Bắt Buộc)

Better Auth là hệ thống quản lý đăng nhập và phiên làm việc (session). Nó cần 2 biến chính:

1. **`BETTER_AUTH_SECRET`**: Khóa bí mật dùng để mã hóa token. Phải là một chuỗi ngẫu nhiên dài và bảo mật (ít nhất 32 ký tự).
   - **Cách tạo custom key nhanh nhất**: 
     - Mở Terminal (PowerShell/Bash) và gõ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     - Hoặc dùng công cụ [Generate Secret](https://generate-secret.vercel.app/32)
   - Lệnh lưu vào Convex:
     ```bash
     npx convex env set BETTER_AUTH_SECRET "CHUỖI_BẠN_VỪA_TẠO_VÀO_ĐÂY"
     ```

2. **`BETTER_AUTH_URL`**: Đường dẫn gốc trang web của bạn (không có dấu `/` ở cuối).
   - Khi chạy ở môi trường **Local/Dev**:
     ```bash
     npx convex env set BETTER_AUTH_URL "http://localhost:5173"
     ```
   - Khi chạy trên **Production** (ví dụ trang web là `https://codo2bt.vercel.app`):
     ```bash
     npx convex env set BETTER_AUTH_URL "https://codo2bt.vercel.app"
     ```

#### B. Thiết Lập Cloudflare R2 (Bắt Buộc Để Lưu Ảnh)

Dự án dùng Cloudflare R2 (miễn phí 10GB) để lưu trữ bằng chứng vi phạm. Bạn vào Dashboard Cloudflare > R2, tạo Bucket mới và xin thông tin API Token. Sau đó nhập:

```bash
npx convex env set R2_ACCOUNT_ID "id_tài_khoản_cloudflare_của_bạn"
npx convex env set R2_ACCESS_KEY_ID "r2_access_key_bạn_vừa_tạo"
npx convex env set R2_SECRET_ACCESS_KEY "r2_secret_key_bạn_vừa_tạo"
npx convex env set R2_BUCKET_NAME "tên_bucket_của_bạn"
npx convex env set R2_PUBLIC_URL "url_public_r2_của_bạn"
```
*(Ghi chú: `R2_PUBLIC_URL` thường có định dạng `https://pub-xxxxxx.r2.dev`)*

#### C. Thiết Lập OpenRouter AI (Tùy Chọn nhưng khuyên dùng)

Để tính năng AI (tự động điền vi phạm) hoạt động, bạn lấy API Key từ OpenRouter.

```bash
npx convex env set OPENROUTER_API_KEY "sk-or-v1-..."
npx convex env set OPENROUTER_MODEL "openai/gpt-4o-mini"
```

### 5. Chạy Dự Án

Sau khi cài đặt xong biến môi trường, hãy mở 2 tab Terminal:

**Terminal 1 (Backend - Convex):**
```bash
npx convex dev
```
Lệnh này sẽ tự động chạy server database và sync liên tục mọi thay đổi bạn viết trong thư mục `convex/`.

**Terminal 2 (Frontend - Vite):**
```bash
npm run dev
```
Trình duyệt sẽ tự động mở lên tại `http://localhost:5173`. Bạn đã có thể bắt đầu sử dụng!

---

### 🚀 Hướng Dẫn Triển Khai Lên Môi Trường Thật (Production Deploy)

Khi bạn muốn chạy thực tế, Frontend thường được host trên Vercel hoặc Cloudflare Pages. 

1. Push code của bạn lên một GitHub Repository.
2. Đăng nhập vào [Vercel](https://vercel.com) > Add New Project > Import repo của bạn.
3. Trong phần **Environment Variables** trên Vercel, bạn cần điền các biến Frontend:
   - `VITE_CONVEX_URL="đường_dẫn_convex_production_của_bạn"` (Lấy từ Convex Dashboard)
4. Trên hệ thống của **Convex** (chuyển sang môi trường Production):
   - Vào Settings > Environment Variables.
   - Thêm đầy đủ lại các biến `BETTER_AUTH_SECRET`, `R2_...`, `OPENROUTER_...` như bước 4.
   - ⚠️ **QUAN TRỌNG:** Phải đổi biến `BETTER_AUTH_URL` thành tên miền chính thức của bạn (ví dụ `https://codo2bt.vercel.app`).

### Mật Khẩu Admin Mặc Định Là Gì?
Khi cài mới hoàn toàn, database sẽ trống. Hãy vào bảng `users` trên Convex Dashboard để tự thêm bản ghi Admin đầu tiên, hoặc bạn có thể tạo qua form public rồi vào Dashboard Convex phân quyền Role thành `"admin"`.

## 📁 Cấu Trúc Dự Án

```
CSDLCoDo2BT/
├── convex/                 # Backend logic & Database Schema
│   ├── betterAuth/         # Module quản lý Authentication (BetterAuth)
│   ├── violations.ts       # Logic ghi nhận vi phạm
│   ├── users.ts            # Quản lý người dùng, học sinh
│   ├── ai.ts               # Logic gọi AI xử lý thô
│   ├── r2.ts               # Tương tác với Cloudflare R2
│   └── excelExport.ts      # Tạo báo cáo Excel
├── src/
│   ├── components/         # Các mảnh UI nhỏ (Buttons, Modals...)
│   ├── public/             # Trang công khai (Bảng điểm thi đua, Form xin phép)
│   ├── AdminDashboard.tsx  # Giao diện chính quyền Admin
│   └── ViolationReportForm.tsx # Form thao tác báo cáo
└── README.md
```

## ⚠️ Lưu Ý Quan Trọng
- **Bảo mật:** Không bao giờ lưu trực tiếp API keys vào code. Chỉ sử dụng lệnh `npx convex env set` hoặc nhập trên giao diện web của Convex.
- **Tên lớp:** Hệ thống mặc định cấu hình tĩnh 24 lớp (`10A1` đến `12A8`). Nếu sửa đổi, cần cập nhật file `src/lib/utils.ts` và các bộ lọc tìm kiếm.

## 🤝 Đóng Góp

Chúng tôi welcome mọi đóng góp! Nếu bạn:
- **Phát hiện lỗi**: Tạo issue trên GitHub
- **Muốn thêm tính năng**: Fork và tạo pull request

## 📄 License

Project này được license theo GPL-3.0.