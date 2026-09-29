// Default violation categories – can be overridden via the "violationCategories"
// setting stored in the DB (Admin → Cài đặt → Danh mục vi phạm).
// Keep names short: these strings are fed directly to the AI for parsing.
export const VIOLATION_CATEGORIES = [
  {
    name: "I. Tự giác – Chuyên cần & Học tập",
    points: 3,
    violations: [
      "Đi học muộn có phép",
      "Thiếu đồ dùng học tập hoặc thiếu ghế chào cờ",
    ],
  },
  {
    name: "I. Tự giác – Chuyên cần & Học tập (5đ)",
    points: 5,
    violations: [
      "Đi học muộn không phép",
      "Truy bài lộn xộn (đùa nghịch, làm việc riêng, gây ồn...)",
    ],
  },
  {
    name: "I. Tự giác – Báo cáo & Kế hoạch (20đ)",
    points: 20,
    violations: [
      "Nộp danh sách/văn bản/giấy tờ/quỹ không đúng quy định",
      "Không thực hiện đúng yêu cầu phát động cuộc thi/kế hoạch Đoàn trường",
    ],
  },
  {
    name: "II. Tự trọng – Đồng phục & Tác phong (3đ)",
    points: 3,
    violations: [
      "Đồng phục không đúng quy định",
      "Vi phạm quy định đầu tóc/móng tay/xăm trổ/đeo khuyên",
    ],
  },
  {
    name: "II. Tự trọng – Tác phong (5đ)",
    points: 5,
    violations: [
      "Chào cờ/thể dục/ngoại khóa xuống xếp hàng muộn hoặc lộn xộn",
    ],
  },
  {
    name: "II. Tự trọng – Văn hóa ứng xử (10đ)",
    points: 10,
    violations: [
      "Học sinh nói tục, chửi thề",
      "Thái độ không phù hợp với Cờ đỏ",
    ],
  },
  {
    name: "III. Tự chủ – Nề nếp & An toàn mạng (10đ)",
    points: 10,
    violations: [
      "Mua đồ ăn qua hàng rào; mua bán đồ ăn vặt trong trường/lớp",
      "Chạy/nhảy/nô đùa/nói chuyện lớn tiếng khi qua hành lang hiệu bộ",
    ],
  },
  {
    name: "III. Tự chủ – An toàn mạng (20đ)",
    points: 20,
    violations: [
      "Đăng/chia sẻ thông tin sai sự thật, kích động, xúc phạm người khác trên MXH",
    ],
  },
  {
    name: "IV. Tự cẩn – ATGT & Phòng chống bạo lực (3đ)",
    points: 3,
    violations: [
      "Để xe không đúng quy định hoặc thiếu mã QR",
    ],
  },
  {
    name: "IV. Tự cẩn – ATGT & Chất cấm (20đ)",
    points: 20,
    violations: [
      "Học sinh hút thuốc lá/thuốc lá điện tử/thuốc lào",
      "Vi phạm ATGT (không đội mũ, không cài quai, xe phân khối lớn, pô chế, không biển số, dàn hàng, xe ngoài cổng)",
      "Lớp có học sinh đánh nhau/bạo lực học đường",
    ],
  },
  {
    name: "V. Tự rèn – Vệ sinh & Nhiệm vụ tập thể (3đ)",
    points: 3,
    violations: [
      "Thiếu dụng cụ vệ sinh",
      "Cờ đỏ/Trực tuần trực muộn từ 3 phút trở lên",
    ],
  },
  {
    name: "V. Tự rèn – Vệ sinh & Nhiệm vụ tập thể (5đ)",
    points: 5,
    violations: [
      "Trực nhật/vệ sinh tự quản muộn, bẩn, không đổ rác, khu nước bẩn/ướt",
      "Không có thư viện góc lớp hoặc thư viện lộn xộn",
    ],
  },
  {
    name: "V. Tự rèn – Tài sản & Môi trường (10đ)",
    points: 10,
    violations: [
      "Không trực nhật/không vệ sinh khu vực tự quản",
      "Sử dụng điện/nước không tiết kiệm hoặc không đúng mục đích",
      "Làm hư hỏng thiết bị dùng chung/khu CTTN/gây mất vệ sinh khu nước sạch",
      "Không trực Cờ đỏ",
    ],
  },
  {
    name: "V. Tự rèn – Báo cáo trực (20đ)",
    points: 20,
    violations: [
      "Lớp trực tuần hoặc Cờ đỏ không có thông tin/báo cáo trực",
    ],
  },
];

export type ViolationCategory = (typeof VIOLATION_CATEGORIES)[number];
