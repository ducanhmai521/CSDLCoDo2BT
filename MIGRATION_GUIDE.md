# Hướng dẫn chuyển đổi từ Convex Storage sang R2

## Tổng quan
Hệ thống đã được cập nhật để hỗ trợ lưu trữ ảnh bằng chứng trên Cloudflare R2 thay vì Convex Storage, giúp tiết kiệm bandwidth và chi phí.

## Tính năng mới
- ✅ Upload ảnh trực tiếp lên R2
- ✅ Hiển thị ảnh từ R2 trong dashboard và public table
- ✅ Tương thích ngược với ảnh cũ từ Convex Storage
- ✅ Migration script để chuyển ảnh cũ sang R2

## Cấu hình cần thiết

### 1. Environment Variables
Thêm vào file `.env`:
```env
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_URL=https://your_r2_public_domain.com
```

### 2. R2 Bucket Setup
- Tạo bucket mới trong Cloudflare R2
- Cấu hình public access nếu cần
- Tạo API token với quyền Object:Read, Object:Write

## Migration (Tùy chọn)

### Chuyển ảnh cũ từ Convex sang R2
Nếu bạn muốn chuyển tất cả ảnh hiện có sang R2:

1. **Chạy migration script:**
```bash
# Trong Convex dashboard hoặc sử dụng Convex CLI
npx convex run migrateToR2:batchMigrateToR2
```

2. **Kiểm tra kết quả:**
Script sẽ trả về thống kê về số lượng ảnh đã chuyển thành công/thất bại.

### Lưu ý về Migration
- Migration là tùy chọn - hệ thống vẫn hoạt động với ảnh cũ
- Ảnh cũ vẫn hiển thị bình thường từ Convex Storage
- Ảnh mới sẽ được lưu trên R2
- Có thể chạy migration nhiều lần an toàn

## Kiểm tra hoạt động

### 1. Upload ảnh mới
- Tạo báo cáo vi phạm mới với ảnh
- Kiểm tra ảnh hiển thị trong dashboard
- Kiểm tra ảnh hiển thị trong public table

### 2. Hiển thị ảnh cũ
- Kiểm tra ảnh cũ vẫn hiển thị bình thường
- Cả ảnh cũ và mới đều hiển thị trong cùng một danh sách

## Troubleshooting

### Lỗi upload ảnh
- Kiểm tra R2 credentials
- Kiểm tra bucket permissions
- Kiểm tra network connectivity

### Ảnh không hiển thị
- Kiểm tra R2_PUBLIC_URL configuration
- Kiểm tra bucket public access settings
- Kiểm tra CORS settings nếu cần

### Migration thất bại
- Kiểm tra R2 credentials
- Kiểm tra bucket permissions
- Chạy lại migration cho các file thất bại

## Lợi ích
- **Tiết kiệm chi phí**: R2 có giá rẻ hơn Convex Storage
- **Bandwidth miễn phí**: Không tính phí bandwidth cho R2
- **Hiệu suất tốt**: CDN của Cloudflare
- **Tương thích ngược**: Không ảnh hưởng đến dữ liệu cũ
