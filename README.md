# CSDL Cờ Đỏ THPTS2BT

Đây là một nền tảng quản lý nền nếp sử dụng [Convex](https://convex.dev) làm backend.
Nhằm mục đích nâng cao hiệu quả quản lý nền nếp học sinh.

## Cấu trúc dự án

Mã nguồn frontend được xây dựng bằng [Vite](https://vitejs.dev/).

Mã nguồn backend được đặt trong thư mục `convex`.

Lệnh `npm run dev` sẽ khởi động cả máy chủ frontend và backend.

## Lưu ý 

*   Dự án này là dự án vibecode, có thể có lỗi và các sự tối ưu kém.
*   Dự án này được thiết kế để hoạt động với các 24 lớp với tên là 10A1 -> 12A8, nếu cần sửa đổi (ví dụ 11A, B, C...) sẽ cần phải sửa lại kha khá hàm và cả prompt AI, các bạn sẽ phải tự sửa đổi nếu muốn adapt 😔. Bạn vẫn có thể sử dụng code của mình nếu trường của bạn không có đủ 24 lớp như mẫu nhưng tên lớp vẫn fit trong khoảng đó (ví dụ 10A1 -> 12A7 vẫn ok)
*   Bạn có thể thoải mái fork repo của mình và sửa đổi code để sử dụng cho trường của bạn. Nếu bạn phát triển được tính năng nào hay ho thì báo mình để cập nhật vào repo gốc nhé hẹ hẹ (hứa sẽ credit đầy đủ) 😊

## Hướng dẫn deploy local (dev)

Các bước để chạy dự án trên máy tính của bạn cho mục đích phát triển.

### Điều kiện

*   Đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 18+).
*   Đã cài đặt [Git](https://git-scm.com/).
*   Tài khoản [Convex](https://convex.dev/).

### Chạy dự án local   

1.  **Clone repository về máy:**
    ```bash
    git clone https://github.com/ducanhmai521/CSDLCoDo2BT
    cd CSDLCoDo2BT
    ```

2.  **Cài đặt các dependencies:**
    ```bash
    npm install
    ```

3.  **Khởi tạo Convex và chạy backend local:**
    Chạy lệnh sau và làm theo các hướng dẫn trên màn hình để đăng nhập và khởi tạo dự án Convex của bạn.
    ```bash
    npx convex dev
    ```
    Sau khi chạy thành công, lệnh này sẽ khởi động một backend server local.

4.  **Cấu hình biến môi trường cho Backend:**
    *   Trong khi `npx convex dev` đang chạy, mở trình duyệt và truy cập vào Convex dashboard của project.
    *   Vào tab "Settings" -> "Environment Variables".
    *   Thêm các biến môi trường sau (tương tự như hướng dẫn triển khai production ở dưới):
        *   `JWT_PRIVATE_KEY`
        *   `JWKS`
        *   `GEMINI_API_KEY`

6.  **Chạy dự án:**
    *   Mở một cửa sổ terminal.
    *   Chạy lệnh sau để khởi động server:
    ```bash
    npm run dev
    ```
    Trang web của bạn bây giờ sẽ có thể truy cập được tại `http://localhost:5173` (hoặc một cổng khác nếu 5173 đã được sử dụng).

## Hướng dẫn triển khai

Các bước để triển khai production web.

### Điều kiện

*   Tài khoản [Vercel](https://vercel.com/).
*   Tài khoản [GitHub](https://github.com/).
*   Tài khoản [Convex](https://convex.dev/).

### 1. Cài đặt Convex

1.  **Tạo một dự án Convex mới (bỏ qua nếu đã tạo ở phần deploy local):**
    *   Truy cập [Convex Dashboard](https://dashboard.convex.dev/).
    *   Tạo một dự án mới.

2.  **Lấy Deploy Key:**
    *   Trong Convex Dashboard của dự án vừa tạo, đi tới "Settings" -> "Deploy Keys" (nhớ là chọn production thay vì development cloud).
    *   Tạo một key mới và sao chép.

### 2. Cài đặt Vercel

1.  **Tạo một dự án Vercel mới:**
    *   Truy cập vào Vercel và tạo một dự án mới.
    *   Nhập dự án từ GitHub Repository của bạn.

2.  **Cấu hình Biến môi trường (Environment Variables):**
    *   Trong cài đặt dự án Vercel của bạn, điều hướng đến phần "Environment Variables".
    *   Thêm biến môi trường sau:
        *   `VITE_CONVEX_URL`: URL của deployment Convex production của bạn.
        *   `CONVEX_DEPLOYMENT_KEY`: Key deploy Convex bạn đã sao chép ở bước trước.

### 3. JWT

Nền tảng sử dụng Convex Auth.

1.  **Tạo JWT Private Key:**
    *   Bạn cần tự tạo một cặp khóa RSA. 
    *   **Quan trọng:** JWS (JSON Web Signature) algorithm phải được đặt là `RS256`.

2.  **Cấu hình Backend Convex:**
    *   Lưu `JWT_PRIVATE_KEY` và `JWKS` vào Environment Variables trong cài đặt của project Convex (nhớ là chọn production thay vì development cloud).

### 4. Gemini API

Nền tảng sử dụng Gemini API (2.5-flash-lite) để hỗ trợ việc chuẩn hóa dữ liệu nhập vào.

1. **Lấy API key ở Google AI Studio:**
    *   Truy cập [Google AI Studio](https://aistudio.google.com/).
    *   Tạo một API key.
    *   Lưu API key vào biến môi trường `GEMINI_API_KEY` trong cài đặt của project Convex (nhớ là chọn production thay vì development cloud).

### 5. GitHub Actions để deploy code lên Convex tự động khi commit

Để tự động deploy code lên Convex khi commit bạn có thể dùng GitHub Actions. Repo đã có sẵn file yml workflows, bạn chỉ cần thêm deploy key của dự án Convex vào Github Repo.

1.  **Tạo Workflow GitHub Actions:**
    *   Ở repo của bạn, vào tab "Settings" -> "Secrets and variables" -> "Actions".
    *   Thêm biến CONVEX_DEPLOY_KEY vào "Repository secrets".

## Đổi tên, logo trường

Để thay đổi tên của web theo tên trường:

1.  **Cập nhật `index.html` (tên xuất hiện ở title bar):**
    *   Mở tệp `index.html`.
    *   Thay đổi thẻ `<title>` thành tên trường của bạn.

2.  **Cập nhật `App.tsx` (tên,logo xuất hiện ở Header):**
    *   Mở tệp `App.tsx`.
    *   Thay đổi các dòng sau theo ý của bạn:
    ```
    <h2 className="text-lg font-extrabold text-slate-800 font-display">CSDL Cờ đỏ THPTS2BT</h2>
    <p className="hidden md:block text-xs text-slate-600">Nền tảng quản lý vi phạm và nền nếp của trường THPT Số 2 Bảo Thắng</p>
    ```
    và
    ```
    <p className="font-medium">CSDL Cờ đỏ THPT Số 2 Bảo Thắng - 2025-2026</p>
    <p className="text-xs text-slate-600">Phát triển bởi Mai Đức Anh</p>
    ```
    *   Sửa dòng sau thành link file (raw) của logo trường, nên sử dụng png trong suốt:
    ```
    <img src="https://www.dropbox.com/scl/fi/23fj64gvknqcw0fu6ibzw/icon.ico?rlkey=t0qmc0ffbkoh5z16g5xts105w&st=for1a0hd&raw=1" alt="favicon" className="w-8 h-8 rounded-lg" />
    ```

3.  **Cập nhật `icon.ico` (icon của web):**
    *   Đổi file này thành logo trường của bạn (để nguyên tên là `icon.ico`, nên sử dụng ico trong suốt).

4. **Cập nhật các tiêu đề ở các bảng public:**
    *   Mở tệp `PublicEmulationScoreTable.tsx`.
    *   Thay đổi tiêu đề của bảng theo ý của bạn:
    ```
    <h1 className="text-2xl font-bold text-center mb-2">CSDL CỜ ĐỎ THPTS2BT | BẢNG ĐIỂM THI ĐUA THÔ</h1>
    ```
    *   Mở tệp `PublicViolationReport.tsx`.
    *   Thay đổi tiêu đề của bảng theo ý của bạn:
    ```
    <h1 className="text-2xl font-bold text-center mb-2">CSDL CỜ ĐỎ THPTS2BT | BÁO CÁO VI PHẠM</h1>
    ```