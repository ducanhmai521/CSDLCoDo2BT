# Test Script cho R2 Integration

## Test Cases

### 1. Upload ảnh mới
```bash
# Test upload ảnh qua ViolationReportForm
1. Mở ứng dụng
2. Đăng nhập với tài khoản có quyền báo cáo
3. Tạo báo cáo vi phạm mới với ảnh
4. Kiểm tra:
   - Upload thành công không có lỗi
   - Ảnh hiển thị trong dashboard
   - Ảnh hiển thị trong public table
   - URL ảnh trỏ đến R2 domain
```

### 2. Upload ảnh qua AI Modal
```bash
# Test upload ảnh qua AIViolationInputModal
1. Mở AI Violation Input Modal
2. Nhập dữ liệu vi phạm với ảnh
3. Submit bulk violations
4. Kiểm tra:
   - Tất cả ảnh upload thành công
   - Ảnh hiển thị trong dashboard
   - Ảnh hiển thị trong public table
```

### 3. Hiển thị ảnh cũ (Legacy)
```bash
# Test hiển thị ảnh từ Convex Storage
1. Tìm báo cáo cũ có ảnh từ Convex Storage
2. Kiểm tra:
   - Ảnh vẫn hiển thị bình thường
   - URL ảnh trỏ đến Convex domain
   - Không có lỗi 404 hoặc broken image
```

### 4. Mixed Display
```bash
# Test hiển thị cả ảnh cũ và mới
1. Tìm báo cáo có cả ảnh cũ (Convex) và mới (R2)
2. Kiểm tra:
   - Tất cả ảnh đều hiển thị
   - Không có lỗi console
   - Performance tốt
```

### 5. Error Handling
```bash
# Test xử lý lỗi
1. Tắt R2 credentials (tạm thời)
2. Thử upload ảnh mới
3. Kiểm tra:
   - Hiển thị lỗi rõ ràng
   - Không crash ứng dụng
   - Có thể retry upload
```

## Expected Results

### ✅ Success Cases
- Ảnh mới upload thành công lên R2
- Ảnh hiển thị với URL từ R2 domain
- Ảnh cũ vẫn hiển thị bình thường
- Không có lỗi console
- Performance tốt

### ❌ Failure Cases
- Upload thất bại với lỗi rõ ràng
- Ảnh không hiển thị (broken image)
- Console errors
- App crash

## Performance Metrics
- Upload time: < 5s cho ảnh < 1MB
- Display time: < 2s cho ảnh load
- Error rate: < 1%

## Rollback Plan
Nếu có vấn đề, có thể rollback bằng cách:
1. Comment out R2 code
2. Revert to Convex storage
3. Ảnh cũ vẫn hoạt động bình thường
