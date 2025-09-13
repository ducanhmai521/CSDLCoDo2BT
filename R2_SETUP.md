# Hướng dẫn cấu hình Cloudflare R2

## Bước 1: Tạo R2 Bucket
1. Đăng nhập vào Cloudflare Dashboard
2. Vào R2 Object Storage
3. Tạo bucket mới cho việc lưu trữ ảnh bằng chứng

## Bước 2: Tạo R2 API Token
1. Vào R2 Object Storage > Manage R2 API tokens
2. Tạo token mới với quyền:
   - Object:Read, Object:Write
   - Bucket:Read (cho bucket bạn đã tạo)

## Bước 3: Cấu hình Environment Variables
Thêm các biến môi trường sau vào file `.env` của bạn:

```env
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_URL=https://your_r2_public_domain.com
```

## Bước 4: Cấu hình Public Access (Tùy chọn)
Nếu bạn muốn ảnh có thể truy cập công khai:
1. Vào R2 Object Storage > Settings
2. Bật "Public access"
3. Cấu hình custom domain nếu cần

## Lưu ý
- `R2_ACCOUNT_ID`: Tìm trong Cloudflare Dashboard > R2 > Overview
- `R2_PUBLIC_URL`: URL công khai để truy cập ảnh (có thể là custom domain hoặc R2.dev domain)
- Đảm bảo bucket có quyền public read nếu bạn muốn ảnh hiển thị trực tiếp
