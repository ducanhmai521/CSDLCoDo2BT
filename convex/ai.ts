("use node");
import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { api } from "./_generated/api";
import { VIOLATION_CATEGORIES } from "./violationPoints";

// Get the full list of violation names
const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(
  (category) => category.violations
);

// Validation action to double-check and correct AI output
const validateAndCorrectAI = async (
  openai: OpenAI,
  model: string,
  originalText: string,
  firstPassJson: any,
  mode: "attendance" | "violations"
): Promise<any> => {
  const validationPrompt = `
Bạn là trợ lý kiểm tra và sửa lỗi kết quả phân tích báo cáo.

DỮ LIỆU GỐC:
"${originalText}"

KẾT QUẢ PHÂN TÍCH LẦN 1 (JSON):
${JSON.stringify(firstPassJson, null, 2)}

DANH SÁCH VI PHẠM HỢP LỆ:
${ALL_VIOLATIONS.join(", ")}

NHIỆM VỤ:
Kiểm tra kết quả phân tích lần 1 và sửa các lỗi sau (nếu có):

1. ⚠️ LỖI NGHIÊM TRỌNG - PHẢI SỬA:
   - Thiếu học sinh: Nếu dữ liệu gốc có tên học sinh nhưng JSON không có
   - Sai đối tượng (cấp lớp vs học sinh):
     * Nếu câu chỉ có TÊN LỚP + HÀNH VI/VI PHẠM (không có tên người) → studentName PHẢI là null
     * Ví dụ: "10A5 trực muộn", "10A5 vệ sinh muộn", "10A5 không trực nhật" → studentName: null
     * Tuyệt đối KHÔNG tự bịa tên học sinh cho vi phạm cấp lớp
   - Sai tên lớp: Tên lớp không khớp với dữ liệu gốc
   - Sai loại vi phạm: Loại vi phạm không có trong danh sách hợp lệ hoặc không khớp với dữ liệu gốc
   - Thiếu vi phạm: Có vi phạm trong dữ liệu gốc nhưng không có trong JSON
   - studentName = null khi có tên học sinh rõ ràng
   - ⚠️ SAI ÁNH XẠ: Ví dụ details="mang đồ ăn" nhưng violationType="Nghỉ học có phép" → SỬA thành "Đồ ăn."

2. LỖI CẦN KIỂM TRA:
   - Tên học sinh viết sai chính tả
   - ⚠️ THIẾU CHI TIẾT: Nếu dữ liệu gốc có "quần bò", "tóc dài", "dép lê" nhưng details = "" → PHẢI ĐIỀN VÀO
   - Chi tiết vi phạm không chính xác
   - Thiếu thông tin quan trọng

3. ÁNH XẠ VI PHẠM ĐÚNG (PHẢI DÙNG ĐÚNG TÊN):
   - "đồ ăn", "mang đồ ăn" → violationType: "Đồ ăn.", details: "mang đồ ăn"
   - "điện thoại", "dt" → violationType: "Sử dụng điện thoại sai mục đích", details: "điện thoại"
   - "quần bò" → violationType: "Sai đồng phục/đầu tóc,...", details: "quần bò"
   - "tóc dài" → violationType: "Sai đồng phục/đầu tóc,...", details: "tóc dài"
   - "dép lê" → violationType: "Sai đồng phục/đầu tóc,...", details: "dép lê"
   - "vs muộn", "trực nhật muộn" → violationType: "Trực nhật, vệ sinh tự quản muộn, bẩn.", details: ""
   - "hút thuốc" → violationType: "Hút thuốc lá.", details: "hút thuốc"
   - "đánh nhau" → violationType: "Có học sinh đánh nhau.", details: "đánh nhau"

4. QUY TẮC KHÁC:
   - MỖI HỌC SINH = 1 VI PHẠM RIÊNG
   - VI PHẠM CẤP LỚP (không có tên học sinh): studentName = null
   - Tên lớp viết HOA (10a1 → 10A1)
   - Loại vi phạm PHẢI có trong danh sách hợp lệ

TRẢ VỀ JSON ĐÃ SỬA (hoặc giữ nguyên nếu không có lỗi):
{
  "violations": [...],
  "checkedClasses": [...],
  ${mode === "attendance" ? '"attendanceByClass": {...},' : ""}
  "correctionsMade": ["Mô tả lỗi đã sửa 1", "Mô tả lỗi đã sửa 2"],
  "isValid": true/false
}

CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM.
`;

  try {
    const validationCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: validationPrompt }],
      model,
      temperature: 0.05,
      response_format: { type: "json_object" },
    });

    let validationText = validationCompletion.choices[0]?.message?.content || "";
    
    if (validationText.includes("```json")) {
      validationText = validationText.substring(
        validationText.indexOf("```json") + 7,
        validationText.lastIndexOf("```")
      );
    } else if (validationText.includes("```")) {
      validationText = validationText.substring(
        validationText.indexOf("```") + 3,
        validationText.lastIndexOf("```")
      );
    }

    const validatedData = JSON.parse(validationText);
    
    // Log corrections if any were made
    if (validatedData.correctionsMade && validatedData.correctionsMade.length > 0) {
      console.log("AI Corrections made:", validatedData.correctionsMade);
    }
    
    return validatedData;
  } catch (error) {
    console.error("Validation failed, using original result:", error);
    return { ...firstPassJson, correctionsMade: [], isValid: true };
  }
};

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

function extractJsonFromModelText(text: string): string {
  let out = text || "";
  if (out.includes("```json")) {
    out = out.substring(out.indexOf("```json") + 7, out.lastIndexOf("```"));
  } else if (out.includes("```")) {
    out = out.substring(out.indexOf("```") + 3, out.lastIndexOf("```"));
  }
  return out.trim();
}

function parseModelList(raw: string): Array<string> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => String(x).trim())
        .filter(Boolean);
    }
  } catch {
    // ignore, try plain split below
  }
  return trimmed
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getModelCandidates(ctx: any): Promise<Array<string>> {
  const configuredModels = await ctx.runQuery(api.users.getSetting, { key: "aiModels" });
  const configuredModel = await ctx.runQuery(api.users.getSetting, { key: "aiModel" });

  const modelsFromList =
    typeof configuredModels === "string" ? parseModelList(configuredModels) : [];
  const modelFromSingle =
    typeof configuredModel === "string" ? parseModelList(configuredModel) : [];
  const modelFromEnv =
    process.env.OPENROUTER_MODEL?.trim() ? [process.env.OPENROUTER_MODEL.trim()] : [];

  const candidates = [
    ...modelsFromList,
    ...modelFromSingle,
    ...modelFromEnv,
    DEFAULT_OPENROUTER_MODEL,
  ];

  // de-dupe preserving order
  const seen = new Set<string>();
  const out: Array<string> = [];
  for (const m of candidates) {
    const key = m.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function createJsonChatWithFallback(args: {
  openai: OpenAI;
  models: Array<string>;
  prompt: string;
  temperature: number;
}): Promise<{ text: string; usedModel: string }> {
  let lastError: unknown = null;
  for (const m of args.models) {
    try {
      const chatCompletion = await args.openai.chat.completions.create({
        messages: [{ role: "user", content: args.prompt }],
        model: m,
        temperature: args.temperature,
        response_format: { type: "json_object" },
      });
      const text = extractJsonFromModelText(chatCompletion.choices[0]?.message?.content || "");
      return { text, usedModel: m };
    } catch (err) {
      lastError = err;
      console.warn("OpenRouter model failed, trying fallback:", m, err);
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All OpenRouter models failed.");
}

// Mode for "Cờ đỏ" - attendance checking with violations
export const parseAttendanceWithAI = action({
  args: {
    rawText: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.object({
    violations: v.array(v.object({
      studentName: v.union(v.string(), v.null()),
      violatingClass: v.string(),
      violationType: v.string(),
      details: v.string(),
      originalText: v.string(),
    })),
    checkedClasses: v.array(v.string()),
    attendanceByClass: v.record(v.string(), v.object({
      absentStudents: v.array(v.string()),
      lateStudents: v.array(v.string()),
    })),
    usedModel: v.string(),
    correctionsMade: v.array(v.string()),
  }),
  handler: async (ctx, { rawText, model }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENROUTER_API_KEY environment variable.");
    }

    // NOTE: ignore client-provided `model` to avoid client-side model selection
    void model;

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        // Optional but recommended by OpenRouter (safe defaults)
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "CSDLCoDo2BT",
      },
    });

    const modelCandidates = await getModelCandidates(ctx);

    const prompt = `
Bạn là trợ lý phân tích báo cáo CỜ ĐỎ của trường học. Cờ đỏ đi từng lớp để kiểm tra sĩ số và vi phạm.

DANH SÁCH VI PHẠM HỢP LỆ:
${ALL_VIOLATIONS.join(", ")}

NHIỆM VỤ:
1. Xác định các lớp đã kiểm tra
2. Với mỗi lớp, trích xuất:
   - Học sinh vắng/nghỉ (tự động gán "Nghỉ học có phép")
   - Học sinh đi muộn (tự động gán "Đi học muộn có phép")
   - Các vi phạm khác (sai đồng phục, vệ sinh muộn, etc.)

⚠️ QUY TẮC QUAN TRỌNG NHẤT:
- MỖI HỌC SINH PHẢI CÓ MỘT VI PHẠM RIÊNG BIỆT
- KHÔNG BAO GIỜ để studentName = null khi có tên học sinh
- Nếu có nhiều học sinh cùng vi phạm → TẠO NHIỀU MỤC VI PHẠM RIÊNG
- VI PHẠM CẤP LỚP: nếu dòng chỉ có TÊN LỚP + NỘI DUNG VI PHẠM (không có tên học sinh) → studentName PHẢI là null
  Ví dụ: "10A5 trực muộn", "10A5 vệ sinh muộn" → { studentName: null, violatingClass: "10A5", ... }

FORMAT LINH HOẠT - AI CẦN HIỂU:
- "10A1: vắng: An, Bình" → TẠO 2 VI PHẠM:
  * {studentName: "An", violatingClass: "10A1", violationType: "Nghỉ học có phép"}
  * {studentName: "Bình", violatingClass: "10A1", violationType: "Nghỉ học có phép"}
  
- "10A1 vắng An Bình" → TẠO 2 VI PHẠM (tương tự trên)

- "10A1: An, Bình vắng" → TẠO 2 VI PHẠM (tương tự trên)

- "10A1 nghỉ: An, Bình" → TẠO 2 VI PHẠM (tương tự trên)

- "10A1: muộn: Cường" → TẠO 1 VI PHẠM:
  * {studentName: "Cường", violatingClass: "10A1", violationType: "Đi học muộn có phép"}

- "10A1 Cường muộn" → TẠO 1 VI PHẠM (tương tự trên)

- "10A1: Dũng sai dp" → TẠO 1 VI PHẠM:
  * {studentName: "Dũng", violatingClass: "10A1", violationType: "Sai đồng phục/đầu tóc,..."}

- "10A1 vs muộn" → TẠO 1 VI PHẠM CẤP LỚP (KHÔNG có tên học sinh):
  * {studentName: null, violatingClass: "10A1", violationType: "Vệ sinh muộn"}
- "10A5 trực muộn" → TẠO 1 VI PHẠM CẤP LỚP (KHÔNG có tên học sinh):
  * {studentName: null, violatingClass: "10A5", violationType: "Trực nhật, vệ sinh tự quản muộn, bẩn.", details: "" }

- "10A1 đủ" hoặc "10A1 ok" → Không có vắng, không có vi phạm

QUY TẮC PHÂN TÍCH:
1. Tên lớp: Chuẩn hóa thành IN HOA (10a1 → 10A1)
2. Tên học sinh: Viết hoa chữ cái đầu mỗi từ
3. Từ khóa vắng/nghỉ: "vắng", "nghỉ", "absent", "v"
4. Từ khóa muộn: "muộn", "trễ", "late", "m"
5. ⚠️ ÁNH XẠ VI PHẠM - ĐỌC KỸ (PHẢI DÙNG ĐÚNG TÊN TRONG DANH SÁCH):
   - "sai dp", "dp", "đồng phục", "dép lê", "tóc", "đầu tóc" → "Sai đồng phục/đầu tóc,..."
   - "vs muộn", "vệ sinh muộn", "trực nhật muộn" → "Trực nhật, vệ sinh tự quản muộn, bẩn."
   - "đồ ăn", "mang đồ ăn", "ăn uống" → "Đồ ăn."
   - "điện thoại", "dt", "phone" → "Sử dụng điện thoại sai mục đích"
   - "muộn" (không có "kp") → "Đi học muộn có phép"
   - "muộn kp", "muộn không phép" → "Đi học muộn/nghỉ học không phép"
   - "vắng", "nghỉ" → "Nghỉ học có phép"
   - "không trực nhật", "không vs" → "Không trực nhật, vệ sinh khu vực tự quản."
   - "hút thuốc" → "Hút thuốc lá."
6. ⚠️ PHẦN DETAILS - CỰC KỲ QUAN TRỌNG:
   - LUÔN LUÔN điền chi tiết cụ thể vào trường "details"
   - Ví dụ: "Văn quần bò" → violationType: "Sai đồng phục/đầu tóc,...", details: "quần bò"
   - Ví dụ: "An tóc dài" → violationType: "Sai đồng phục/đầu tóc,...", details: "tóc dài"
   - Ví dụ: "Bình mang đồ ăn" → violationType: "Đồ ăn.", details: "mang đồ ăn"
   - Ví dụ: "Cường dép lê" → violationType: "Sai đồng phục/đầu tóc,...", details: "dép lê"
   - Ví dụ: "Dũng điện thoại" → violationType: "Sử dụng điện thoại sai mục đích", details: "điện thoại"
   - CHỈ để details = "" khi KHÔNG có thông tin cụ thể (vắng, muộn có phép)
7. ⚠️ NHIỀU HỌC SINH: Nếu có danh sách tên (An, Bình, Cường) → TẠO VI PHẠM RIÊNG CHO MỖI NGƯỜI

VĂN BẢN:
"${rawText}"

TRẢ VỀ JSON theo dạng:
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
  "checkedClasses": ["10A1", "10A2"],
  "attendanceByClass": {
    "10A1": {
      "absentStudents": ["Nguyễn Văn An"],
      "lateStudents": ["Trần Văn Bình"]
    }
  }
}

VÍ DỤ CỤ THỂ:
Input: "12a1 trường, kiểm nghỉ, văn quần bò, hùng mang đồ ăn"
Output:
{
  "violations": [
    {
      "studentName": "Trường",
      "violatingClass": "12A1",
      "violationType": "Nghỉ học có phép",
      "details": "",
      "originalText": "12a1 trường, kiểm nghỉ, văn quần bò, hùng mang đồ ăn"
    },
    {
      "studentName": "Kiểm",
      "violatingClass": "12A1",
      "violationType": "Nghỉ học có phép",
      "details": "",
      "originalText": "12a1 trường, kiểm nghỉ, văn quần bò, hùng mang đồ ăn"
    },
    {
      "studentName": "Văn",
      "violatingClass": "12A1",
      "violationType": "Sai đồng phục/đầu tóc,...",
      "details": "quần bò",
      "originalText": "12a1 trường, kiểm nghỉ, văn quần bò, hùng mang đồ ăn"
    },
    {
      "studentName": "Hùng",
      "violatingClass": "12A1",
      "violationType": "Đồ ăn.",
      "details": "mang đồ ăn",
      "originalText": "12a1 trường, kiểm nghỉ, văn quần bò, hùng mang đồ ăn"
    }
  ],
  "checkedClasses": ["12A1"],
  "attendanceByClass": {
    "12A1": {
      "absentStudents": ["Trường", "Kiểm"],
      "lateStudents": []
    }
  }
}

LƯU Ý:
- ⚠️ MỖI HỌC SINH = 1 VI PHẠM RIÊNG (studentName PHẢI có giá trị)
- Vi phạm cấp lớp (KHÔNG có tên học sinh): studentName = null
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM
`;

    try {
      const firstPass = await createJsonChatWithFallback({
        openai,
        models: modelCandidates,
        prompt,
        temperature: 0.1,
      });

      const parsedData = JSON.parse(firstPass.text);
      
      // Double-check with validation pass
      const validatedData = await validateAndCorrectAI(
        openai,
        firstPass.usedModel,
        rawText,
        parsedData,
        "attendance"
      );
      
      return {
        violations: validatedData.violations || [],
        checkedClasses: validatedData.checkedClasses || [],
        attendanceByClass: validatedData.attendanceByClass || {},
        usedModel: firstPass.usedModel,
        correctionsMade: Array.isArray(validatedData.correctionsMade) ? validatedData.correctionsMade : [],
      };
    } catch (error) {
      console.error("Error calling OpenRouter:", error);
      throw new Error("Failed to parse attendance using AI.");
    }
  },
});

// Mode for "Lớp trực tuần" - violations only (gate duty)
export const parseViolationsWithAI = action({
  args: {
    rawText: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.object({
    violations: v.array(v.object({
      studentName: v.union(v.string(), v.null()),
      violatingClass: v.string(),
      violationType: v.string(),
      details: v.string(),
      originalText: v.string(),
    })),
    checkedClasses: v.array(v.string()),
    usedModel: v.string(),
    correctionsMade: v.array(v.string()),
  }),
  handler: async (ctx, { rawText, model }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENROUTER_API_KEY environment variable.");
    }

    // NOTE: ignore client-provided `model` to avoid client-side model selection
    void model;

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "CSDLCoDo2BT",
      },
    });

    const modelCandidates = await getModelCandidates(ctx);

    const prompt = `
Bạn là trợ lý phân tích báo cáo LỚP TRỰC TUẦN. Lớp trực tuần đứng cổng trường kiểm tra vi phạm của học sinh vào trường.

DANH SÁCH VI PHẠM HỢP LỆ:
${ALL_VIOLATIONS.join(", ")}

⚠️ QUY TẮC QUAN TRỌNG NHẤT - ĐỌC KỸ:
1. MỌI VI PHẠM PHẢI CÓ studentName (chỉ để null khi là vi phạm cấp lớp)
2. Nếu có từ KHÔNG phải tên lớp và KHÔNG phải loại vi phạm → ĐÓ LÀ TÊN HỌC SINH
3. Tên học sinh có thể là BẤT KỲ TỪ NÀO, kể cả "Trường", "Kiểm", "An", "Bình", v.v.
4. VI PHẠM CẤP LỚP: nếu chỉ có TÊN LỚP + NỘI DUNG VI PHẠM (không có tên người) → studentName PHẢI là null
   Ví dụ: "10A5 trực muộn", "10A5 không trực nhật" → studentName: null
   Tuyệt đối KHÔNG tự bịa tên học sinh

NHẬN DẠNG TÊN HỌC SINH:
- Tên lớp: Pattern [Số][Chữ][Số] (10A1, 11B2, 12C3)
- Loại vi phạm: "sai dp", "tóc", "muộn", "vs muộn", "đồng phục", v.v.
- TẤT CẢ CÁC TỪ KHÁC → TÊN HỌC SINH

VÍ DỤ QUAN TRỌNG:
✅ "Trường 10A1 sai dp" → studentName: "Trường" (KHÔNG phải từ khóa "trường học")
✅ "Kiểm 10A1 tóc" → studentName: "Kiểm" (KHÔNG phải từ khóa "kiểm tra")
✅ "An 10A1 muộn" → studentName: "An"
✅ "10A1 Bình sai dp" → studentName: "Bình"
✅ "Cường tóc 10A1" → studentName: "Cường"
✅ "10A1 Dũng, Hùng dp" → TẠO 2 VI PHẠM RIÊNG:
   * {studentName: "Dũng", violatingClass: "10A1", violationType: "Sai đồng phục/đầu tóc,..."}
   * {studentName: "Hùng", violatingClass: "10A1", violationType: "Sai đồng phục/đầu tóc,..."}
✅ "10A5 trực muộn" → VI PHẠM CẤP LỚP:
   * {studentName: null, violatingClass: "10A5", violationType: "Trực nhật, vệ sinh tự quản muộn, bẩn.", details: "" }

FORMAT LINH HOẠT:
- "An 10A1 sai dp" → An, lớp 10A1, sai đồng phục
- "10A1 An sai dp" → An, lớp 10A1, sai đồng phục
- "An sai dp 10A1" → An, lớp 10A1, sai đồng phục
- "Nguyễn Văn An 10A1 tóc dài" → Nguyễn Văn An, lớp 10A1
- "10A1 Bình, Cường tóc" → 2 vi phạm riêng (Bình và Cường)
- "An 10A1 muộn" → An đi muộn có phép (mặc định)
- "An 10A1 muộn kp" → An đi muộn không phép

⚠️ ÁNH XẠ VI PHẠM - PHẢI DÙNG ĐÚNG TÊN TRONG DANH SÁCH:
- "sai dp", "dp", "đồng phục", "dép lê", "tóc", "đầu tóc" → "Sai đồng phục/đầu tóc,..."
- "muộn", "trễ" (không có "kp") → "Đi học muộn có phép"
- "muộn kp", "muộn không phép" → "Đi học muộn/nghỉ học không phép"
- "đồ ăn", "mang đồ ăn", "ăn uống" → "Đồ ăn."
- "điện thoại", "dt", "phone" → "Sử dụng điện thoại sai mục đích"
- "hút thuốc" → "Hút thuốc lá."
- "đánh nhau" → "Có học sinh đánh nhau."

⚠️ PHẦN DETAILS - CỰC KỲ QUAN TRỌNG:
- LUÔN LUÔN điền chi tiết cụ thể vào trường "details"
- Ví dụ: "Văn quần bò" → violationType: "Sai đồng phục/đầu tóc,...", details: "quần bò"
- Ví dụ: "An tóc dài" → violationType: "Sai đồng phục/đầu tóc,...", details: "tóc dài"
- Ví dụ: "Bình mang đồ ăn" → violationType: "Đồ ăn.", details: "mang đồ ăn"
- Ví dụ: "Cường dép lê" → violationType: "Sai đồng phục/đầu tóc,...", details: "dép lê"
- Ví dụ: "Dũng điện thoại" → violationType: "Sử dụng điện thoại sai mục đích", details: "điện thoại"
- CHỈ để details = "" khi KHÔNG có thông tin cụ thể

VĂN BẢN:
"${rawText}"

TRẢ VỀ JSON:
{
  "violations": [
    {
      "studentName": "string",
      "violatingClass": "string",
      "violationType": "string",
      "details": "string",
      "originalText": "string"
    }
  ],
  "checkedClasses": []
}

LƯU Ý CUỐI CÙNG:
- ⚠️ MỌI TỪ KHÔNG PHẢI TÊN LỚP VÀ KHÔNG PHẢI VI PHẠM = TÊN HỌC SINH
- Nếu KHÔNG có tên học sinh trong câu → studentName = null (vi phạm cấp lớp)
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM
`;

    try {
      const firstPass = await createJsonChatWithFallback({
        openai,
        models: modelCandidates,
        prompt,
        temperature: 0.1,
      });

      const parsedData = JSON.parse(firstPass.text);

      const normalizedData = Array.isArray(parsedData) 
        ? { violations: parsedData, checkedClasses: [] }
        : { violations: parsedData.violations || [], checkedClasses: parsedData.checkedClasses || [] };

      // Double-check with validation pass
      const validatedData = await validateAndCorrectAI(
        openai,
        firstPass.usedModel,
        rawText,
        normalizedData,
        "violations"
      );

      return {
        violations: validatedData.violations || [],
        checkedClasses: validatedData.checkedClasses || [],
        usedModel: firstPass.usedModel,
        correctionsMade: Array.isArray(validatedData.correctionsMade) ? validatedData.correctionsMade : [],
      };
    } catch (error) {
      console.error("Error calling OpenRouter:", error);
      throw new Error("Failed to parse violations using AI.");
    }
  },
});

