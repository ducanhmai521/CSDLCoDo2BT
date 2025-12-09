# CSDL Cờ Đỏ THPTS2BT

Đây là một nền tảng quản lý nền nếp sử dụng [Convex](https://convex.dev) làm backend, [Vite](https://vitejs.dev/) làm frontend và Cloudflare R2 để lưu trữ các file bằng chứng.
Nhằm mục đích nâng cao hiệu quả quản lý nền nếp học sinh.

## Mục lục
- [Lưu ý](#lưu-ý)
- [Hướng dẫn deploy local (dev)](#hướng-dẫn-deploy-local-dev)
  - [Điều kiện](#điều-kiện)
  - [Chạy dự án local](#chạy-dự-án-local)
- [Hướng dẫn triển khai Production](#hướng-dẫn-triển-khai-production)
  - [Điều kiện](#điều-kiện-1)
  - [1. Cài đặt Convex](#1-cài-đặt-convex)
  - [2. Cài đặt Vercel](#2-cài-đặt-vercel)
  - [5. GitHub Actions để deploy code lên Convex tự động khi commit](#5-github-actions-để-deploy-code-lên-convex-tự-động-khi-commit)
- [Biến môi trường](#biến-môi-trường)
  - [JWT](#jwt)
  - [Groq API](#groq-api)
  - [Cloudflare R2](#cloudflare-r2)
- [Đổi tên, logo trường](#đổi-tên-logo-trường)


## Lưu ý 

*   Dự án này là dự án vibecode, có thể có lỗi và các sự tối ưu kém.
*   Dự án này được thiết kế để hoạt động với các 24 lớp với tên là 10A1 -> 12A8, nếu cần sửa đổi (ví dụ 11A, B, C...) sẽ cần phải sửa lại kha khá file, các bạn sẽ phải tự sửa đổi nếu muốn adapt 😔. Bạn vẫn có thể sử dụng code của mình nếu trường của bạn không có đủ 24 lớp như mẫu nhưng tên lớp vẫn fit trong khoảng đó (ví dụ 10A1 -> 12A7 vẫn ok)
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
    *   Thêm các biến môi trường sau (tham khảo cách lấy các key ở dưới):
        *   `JWT_PRIVATE_KEY`
        *   `JWKS`
        *   `GROQ_API_KEY`
        *   `R2_ACCOUNT_ID`
        *   `R2_ACCESS_KEY_ID`
        *   `R2_SECRET_ACCESS_KEY`
        *   `R2_BUCKET_NAME`
        *   `R2_PUBLIC_URL`

6.  **Chạy dự án:**
    *   Mở một cửa sổ terminal.
    *   Chạy lệnh sau để khởi động server:
    ```bash
    npm run dev
    ```
    Trang web của bạn bây giờ sẽ có thể truy cập được tại `http://localhost:5173` (hoặc một cổng khác nếu 5173 đã được sử dụng).

## Hướng dẫn triển khai Production

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

### 5. GitHub Actions để deploy code lên Convex tự động khi commit

Để tự động deploy code lên Convex khi commit bạn có thể dùng GitHub Actions. Repo đã có sẵn file yml workflows, bạn chỉ cần thêm deploy key của dự án Convex vào Github Repo.

1.  **Tạo Workflow GitHub Actions:**
    *   Ở repo của bạn, vào tab "Settings" -> "Secrets and variables" -> "Actions".
    *   Thêm biến `CONVEX_DEPLOY_KEY` vào "Repository secrets".

## Biến môi trường

### JWT

Nền tảng sử dụng Convex Auth.

1.  **Tạo JWT Private Key:**
    *   Bạn cần tự tạo một cặp khóa RSA. 
    *   **Quan trọng:** JWS (JSON Web Signature) algorithm phải được đặt là `RS256`.

2.  **Cấu hình Backend Convex:**
    *   Lưu `JWT_PRIVATE_KEY` và `JWKS` vào Environment Variables trong cài đặt của project Convex (nhớ chú ý môi trường production hay development cloud).

### Groq API

Nền tảng sử dụng Groq API (moonshotai/kimi-k2-instruct) để hỗ trợ việc chuẩn hóa dữ liệu nhập vào.

1. **Lấy API key ở Groq Console:**
    *   Truy cập [Groq Console](https://console.groq.com/).
    *   Tạo một API key.
    *   Lưu API key vào biến môi trường `GROQ_API_KEY`.

### Cloudflare R2

### Bước 1: Tạo R2 Bucket
1. Đăng nhập vào Cloudflare Dashboard
2. Vào R2 Object Storage
3. Tạo bucket mới cho việc lưu trữ ảnh bằng chứng

### Bước 2: Tạo R2 API Token
1. Vào R2 Object Storage > Manage R2 API tokens
2. Tạo token mới với quyền:
   - Object:Read, Object:Write
   - Bucket:Read (cho bucket bạn đã tạo)

### Bước 3: Cấu hình Environment Variables
Thêm các biến môi trường sau vào biến môi trường của dự án Convex của bạn:

```
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_URL=https://your_r2_public_domain.com
```

### Bước 4: Cấu hình Public Access
Nếu bạn muốn ảnh có thể truy cập công khai:
1. Vào R2 Object Storage > Settings
2. Bật "Public access"
3. Cấu hình custom domain nếu cần

### Lưu ý
- `R2_ACCOUNT_ID`: Tìm trong Cloudflare Dashboard > R2 > Overview
- `R2_PUBLIC_URL`: URL công khai để truy cập ảnh (nên dùng custom domain nếu triển khai production)
- Đảm bảo bucket có quyền public read nếu bạn muốn ảnh hiển thị trực tiếp

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
