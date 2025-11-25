import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { api } from "./_generated/api";
import { VIOLATION_CATEGORIES } from "./violationPoints";

// Get the full list of violation names
const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(
  (category) => category.violations
);

export const parseViolationsWithAI = action({
  args: {
    rawText: v.string(),
  },
  handler: async (ctx, { rawText }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing GEMINI_API_KEY environment variable. Please add it to your .env.local file."
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const prompt = `
Bạn là trợ lý cho hệ thống kỷ luật của trường học. Nhiệm vụ của bạn là phân tích văn bản thô chứa danh sách vi phạm của học sinh hoặc lớp và chuyển đổi thành định dạng JSON có cấu trúc.

⚠️ QUY TẮC QUAN TRỌNG NHẤT:
- Format dòng: "[Tên học sinh] [Lớp] [Vi phạm]" hoặc "[Lớp] [Vi phạm]"
- Mọi từ TRƯỚC tên lớp (10A1, 11B2, 12C3...) đều là TÊN HỌC SINH
- Ví dụ: "Trường 12A1 đi muộn" → "Trường" là TÊN HỌC SINH, KHÔNG phải "trường học"
- Ví dụ: "Hùng 11B2 tóc" → "Hùng" là TÊN HỌC SINH
- Ví dụ: "10A8 vệ sinh muộn" → KHÔNG có tên học sinh (vi phạm cấp lớp)

DANH SÁCH CÁC LOẠI VI PHẠM HỢP LỆ:
${ALL_VIOLATIONS.join(", ")}

HƯỚNG DẪN PHÂN TÍCH:

1. TRÍCH XUẤT VI PHẠM:
   - Với mỗi dòng, xác định: tên học sinh (hoặc null nếu là vi phạm cấp lớp), lớp, loại vi phạm, và chi tiết cụ thể
   - Nếu một dòng có nhiều tên học sinh, tạo một mục vi phạm riêng cho mỗi học sinh
   - Nếu một dòng có nhiều vi phạm cho cùng một học sinh, tạo một mục riêng cho mỗi vi phạm
   
   FORMAT NHẬN DẠNG:
   - "[Tên học sinh] [Lớp] [Vi phạm]" → Vi phạm cá nhân
   - "[Lớp] [Vi phạm]" → Vi phạm cấp lớp (không có tên học sinh)
   
   VÍ DỤ CỤ THỂ:
   - "Nguyễn Văn A 10A1 sai đồng phục" → studentName: "Nguyễn Văn A", violatingClass: "10A1"
   - "Trường 12A1 đi muộn" → studentName: "Trường", violatingClass: "12A1" (Trường là TÊN HỌC SINH, không phải "trường học")
   - "Hùng 11B2 tóc" → studentName: "Hùng", violatingClass: "11B2"
   - "Nguyễn Văn A, Trần Thị B 10A1 sai đồng phục" → 2 mục vi phạm riêng biệt
   - "Lê Văn C 11A2 đi muộn, sai đồng phục" → 2 mục vi phạm riêng biệt
   - "10A8 vệ sinh muộn" → 1 mục vi phạm cấp lớp (studentName = null)
   
   LƯU Ý QUAN TRỌNG:
   - Bất kỳ từ nào TRƯỚC tên lớp (format [Khối][Chữ][Số] như 10A1, 11B2, 12C3) đều là TÊN HỌC SINH
   - Tên học sinh có thể là 1 từ (Trường, Hùng, An) hoặc nhiều từ (Nguyễn Văn A, Trần Thị B)
   - KHÔNG nhầm lẫn tên học sinh với các từ khác như "trường học", "lớp học"

2. QUY TẮC CHO CÁC TRƯỜNG:
   
   a) studentName:
      - Giữ nguyên tên như trong văn bản, KHÔNG cố tìm tên đầy đủ
      - Viết hoa chữ cái đầu mỗi từ (ví dụ: "nguyễn văn a" → "Nguyễn Văn A", "trường" → "Trường")
      - Nếu là vi phạm cấp lớp (không có tên trước lớp) → null
      - QUY TẮC: Mọi từ TRƯỚC tên lớp (10A1, 11B2, etc.) đều là tên học sinh
        * "Trường 12A1 đi muộn" → studentName: "Trường" (ĐÚNG)
        * "Hùng 11B2 tóc" → studentName: "Hùng" (ĐÚNG)
        * "An 10A5 sai dp" → studentName: "An" (ĐÚNG)
   
   b) violatingClass:
      - Chuẩn hóa thành chữ IN HOA (ví dụ: "11a8" → "11A8")
      - Format: [Khối][Chữ cái][Số] (ví dụ: "10A1", "11B5", "12C3")
   
   c) violationType:
      - PHẢI là một trong các chuỗi CHÍNH XÁC từ danh sách trên
      - Ánh xạ các từ viết tắt/mô tả phổ biến:
        * "sai dp", "dép lê", "tóc", "đầu tóc", "khuyên tai" → "Sai đồng phục/đầu tóc,..."
        * "vs muộn", "vệ sinh muộn", "vs trễ" → "Vệ sinh muộn"
        * "muộn", "đi muộn", "trễ" → "Đi học muộn có phép" (nếu không nói rõ "không phép")
        * "vắng", "nghỉ" → "Nghỉ học có phép" (nếu không nói rõ "không phép")
        * "xin muộn", "xin đi muộn" → "Đi học muộn có phép"
        * "xin nghỉ", "xin vắng" → "Nghỉ học có phép"
        * "muộn không phép", "đi muộn kp" → "Đi học muộn/nghỉ học không phép"
        * "vắng không phép", "nghỉ kp" → "Đi học muộn/nghỉ học không phép"
   
   d) details:
      - Chi tiết cụ thể của vi phạm được đề cập trong văn bản
      - Chuẩn hóa để trông chuyên nghiệp:
        * Viết hoa chữ cái đầu
        * "vs muộn" → "Vệ sinh muộn"
        * "tóc" → "Đầu tóc"
        * "khuyên tai" → "Đeo khuyên tai"
        * "dép lê" → "Đi dép lê"
        * "sai dp" → "Sai đồng phục"
      - Nếu không có chi tiết cụ thể → chuỗi rỗng ""
   
   e) originalText:
      - Dòng văn bản GỐC CHÍNH XÁC mà vi phạm này được phân tích từ đó

3. QUY TẮC QUAN TRỌNG:
   - Mỗi học sinh chỉ có thể vi phạm 1 lỗi cùng loại tại một thời điểm (không trùng lặp)
   - Một học sinh vẫn có thể có nhiều vi phạm nếu chúng khác loại
   - Mặc định "Có phép" nếu không nói rõ "không phép" hoặc "kp"

4. TRÍCH XUẤT LỚP ĐÃ KIỂM TRA:
   - Tìm dòng bắt đầu với: "ktra:", "ktr:", "check:", "kiểm tra:", hoặc tương tự
   - Trích xuất tên các lớp từ dòng đó
   - Mở rộng các lớp viết tắt:
     * "12a1,2,3,6" → ["12A1", "12A2", "12A3", "12A6"]
     * "10a1, 10a2, 11b3" → ["10A1", "10A2", "11B3"]
   - Chuẩn hóa tất cả tên lớp thành CHỮ IN HOA

VĂN BẢN CẦN PHÂN TÍCH:
"${rawText}"

TRẢ VỀ MỘT ĐỐI TƯỢNG JSON DUY NHẤT VỚI CẤU TRÚC SAU:
{
  "violations": [
    {
      "studentName": "string | null",
      "violatingClass": "string",
      "violationType": "string",
      "details": "string",
      "originalText": "string"
    }
  ],
  "checkedClasses": ["string"]
}

Nếu không tìm thấy lớp đã kiểm tra, trả về mảng rỗng cho "checkedClasses".
CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT GIẢI THÍCH THÊM.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean the response to get only the JSON part
      if (text.includes("```json")) {
        text = text.substring(
          text.indexOf("```json") + 7,
          text.lastIndexOf("```")
        );
      } else if (text.includes("```")) {
        text = text.substring(text.indexOf("```") + 3, text.lastIndexOf("```"));
      }

      const parsedData = JSON.parse(text);

      // Handle cases where the AI might return the old array format
      if (Array.isArray(parsedData)) {
        return { violations: parsedData, checkedClasses: [] };
      }

      // Ensure the new structure is correct, with defaults
      return {
        violations: parsedData.violations || [],
        checkedClasses: parsedData.checkedClasses || [],
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      throw new Error("Failed to parse violations using AI.");
    }
  },

});

