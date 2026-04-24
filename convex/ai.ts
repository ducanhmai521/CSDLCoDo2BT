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

const VIOLATION_LIST_WITH_ID = ALL_VIOLATIONS.map((v, i) => `${i}: "${v}"`).join("\n");

// Validation action to double-check and correct AI output
const validateAndCorrectAI = async (
  openai: OpenAI,
  model: string,
  originalText: string,
  firstPassJson: any,
  mode: "attendance" | "violations",
  debug: boolean
): Promise<{ data: any; correctionsMade: string[]; changed: boolean; verificationMode: "diff" | "full_fallback" }> => {
  const validationPrompt = `
Bạn là trợ lý kiểm tra và sửa lỗi kết quả phân tích báo cáo.

DỮ LIỆU GỐC:
"${originalText}"

KẾT QUẢ PHÂN TÍCH LẦN 1 (JSON):
${JSON.stringify(firstPassJson, null, 2)}

DANH SÁCH VI PHẠM HỢP LỆ (SỐ THỨ TỰ: TÊN):
${VIOLATION_LIST_WITH_ID}

NHIỆM VỤ:
Kiểm tra kết quả phân tích lần 1 và sửa các lỗi sau (nếu có):

1. ⚠️ LỖI NGHIÊM TRỌNG - PHẢI SỬA:
   - Thiếu học sinh: Nếu dữ liệu gốc có tên học sinh nhưng JSON không có
   - Sai đối tượng (cấp lớp vs học sinh):
     * Nếu câu chỉ có TÊN LỚP + HÀNH VI/VI PHẠM (không có tên người) → studentName PHẢI là null
     * Tuyệt đối KHÔNG tự bịa tên học sinh cho vi phạm cấp lớp
   - Sai tên lớp: Tên lớp không khớp với dữ liệu gốc
   - Sai loại vi phạm: ID vi phạm (violationId) không hợp lệ hoặc không khớp với dữ liệu gốc
   - Thiếu vi phạm: Có vi phạm trong dữ liệu gốc nhưng không có trong JSON
   - studentName = null khi có tên học sinh rõ ràng

2. LỖI CẦN KIỂM TRA:
   - Tên học sinh viết sai chính tả
   - ⚠️ THIẾU CHI TIẾT: Nếu dữ liệu gốc có "quần bò", "tóc dài", "dép lê" nhưng details = "" → PHẢI ĐIỀN VÀO

3. ÁNH XẠ VI PHẠM ĐÚNG (PHẢI DÙNG ĐÚNG SỐ THỨ TỰ violationId):
   - "đồ ăn", "mang đồ ăn" → violationId tương ứng với "Đồ ăn."
   - "điện thoại", "dt" → violationId tương ứng với "Sử dụng điện thoại sai mục đích"
   - "quần bò", "tóc dài", "dép lê" → violationId tương ứng với "Sai đồng phục/đầu tóc,..."
   - "vs muộn", "trực nhật muộn" → violationId tương ứng với "Trực nhật, vệ sinh tự quản muộn, bẩn."
   - "hút thuốc" → violationId tương ứng với "Hút thuốc lá."
   - "đánh nhau" → violationId tương ứng với "Có học sinh đánh nhau."
   - "atgt", "không gương", "không mũ", "không đội mũ", "xe máy", "giao thông" → violationId tương ứng với "Vi phạm ATGT."

4. QUY TẮC KHÁC:
   - ⚠️ MỘT HỌC SINH CÓ THỂ MẮC NHIỀU LỖI: Ví dụ "Khải 10A4 dép lê, học muộn" → TẠO 2 VI PHẠM RIÊNG (cùng Khải, cùng 10A4 nhưng khác violationId).
   - MỖI HỌC SINH/MỖI LỖI = 1 VI PHẠM RIÊNG
   - VI PHẠM CẤP LỚP (không có tên học sinh): studentName = null
   - Tên lớp viết HOA (10a1 → 10A1)

TRẢ VỀ JSON THEO CHẾ ĐỘ DIFF ĐỂ TIẾT KIỆM TOKEN:
{
  "changed": true/false,
  ${debug ? '"correctionsMade": ["..."],' : ""}
  "correctedData": {
    "violations": [
      {
        "studentName": "string | null",
        "violatingClass": "string",
        "violationId": number,
        "details": "string",
        "originalText": "string"
      }
    ],
    "checkedClasses": [...],
    ${mode === "attendance" ? '"attendanceByClass": {...},' : ""}
    "isValid": true/false
  }
}

QUY TẮC OUTPUT:
- Nếu KHÔNG cần sửa gì: trả {"changed": false${debug ? ', "correctionsMade": []' : ""}} và KHÔNG gửi correctedData.
- Nếu CÓ sửa: trả changed=true và đặt correctedData đầy đủ.${debug ? ' Nếu có thể, ghi correctionsMade ngắn gọn.' : ' KHÔNG trả correctionsMade.'}
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM.
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

    const validatedData = JSON.parse(validationText) as {
      changed?: boolean;
      correctionsMade?: string[];
      correctedData?: any;
    };
    const changed = Boolean(validatedData?.changed);
    const correctionsMade = Array.isArray(validatedData?.correctionsMade)
      ? validatedData.correctionsMade.map((x) => String(x))
      : [];
    if (!changed) {
      return {
        data: firstPassJson,
        correctionsMade,
        changed: false,
        verificationMode: "diff",
      };
    }
    const correctedData = validatedData?.correctedData;
    if (!correctedData || typeof correctedData !== "object") {
      return {
        data: firstPassJson,
        correctionsMade: correctionsMade.length > 0 ? correctionsMade : ["Verifier returned changed=true but missing correctedData"],
        changed: false,
        verificationMode: "full_fallback",
      };
    }
    return {
      data: correctedData,
      correctionsMade,
      changed: true,
      verificationMode: "diff",
    };
  } catch (error) {
    console.error("Validation failed, using original result:", error);
    return { data: { ...firstPassJson, isValid: true }, correctionsMade: [], changed: false, verificationMode: "full_fallback" };
  }
};

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

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

type ProviderName = "gemini" | "openrouter";

type ProviderAttempt = {
  provider: ProviderName;
  client: OpenAI;
  models: Array<string>;
};

type ProviderCallResult = {
  text: string;
  usedModel: string;
  usedProvider: ProviderName;
  client: OpenAI;
  trace: string[];
};

async function getGeminiModelCandidates(ctx: any): Promise<Array<string>> {
  const configuredGeminiModels = await ctx.runQuery(api.users.getSetting, { key: "geminiModels" });
  const modelsFromSetting =
    typeof configuredGeminiModels === "string" ? parseModelList(configuredGeminiModels) : [];
  const modelFromEnv =
    process.env.GEMINI_MODEL?.trim() ? [process.env.GEMINI_MODEL.trim()] : [];

  const candidates = [...modelsFromSetting, ...modelFromEnv, DEFAULT_GEMINI_MODEL];

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

async function getOpenRouterModelCandidates(ctx: any): Promise<Array<string>> {
  const configuredOpenRouterModels = await ctx.runQuery(api.users.getSetting, { key: "openrouterModels" });
  const modelsFromDedicatedSetting =
    typeof configuredOpenRouterModels === "string" ? parseModelList(configuredOpenRouterModels) : [];
  const legacyModels = await getModelCandidates(ctx);

  const candidates = [...modelsFromDedicatedSetting, ...legacyModels];
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
  attempts: Array<ProviderAttempt>;
  prompt: string;
  temperature: number;
}): Promise<ProviderCallResult> {
  let lastError: unknown = null;
  const trace: string[] = [];
  for (const attempt of args.attempts) {
    trace.push(`provider:${attempt.provider}:start`);
    for (const m of attempt.models) {
      trace.push(`provider:${attempt.provider}:model:${m}:try`);
      try {
        const chatCompletion = await attempt.client.chat.completions.create({
          messages: [{ role: "user", content: args.prompt }],
          model: m,
          temperature: args.temperature,
          response_format: { type: "json_object" },
        });
        const text = extractJsonFromModelText(chatCompletion.choices[0]?.message?.content || "");
        trace.push(`provider:${attempt.provider}:model:${m}:ok`);
        return { text, usedModel: m, usedProvider: attempt.provider, client: attempt.client, trace };
      } catch (err) {
        lastError = err;
        console.warn(`${attempt.provider} model failed, trying fallback:`, m, err);
        trace.push(`provider:${attempt.provider}:model:${m}:fail`);
        continue;
      }
    }
    trace.push(`provider:${attempt.provider}:exhausted`);
  }
  throw lastError instanceof Error ? lastError : new Error("All Gemini/OpenRouter models failed.");
}

// Mode for "Cờ đỏ" - attendance checking with violations
export const parseAttendanceWithAI = action({
  args: {
    rawText: v.string(),
    model: v.optional(v.string()),
    debug: v.optional(v.boolean()),
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
    aiDebug: v.object({
      firstPassTrace: v.array(v.string()),
      verificationChanged: v.boolean(),
      verificationMode: v.string(),
    }),
  }),
  handler: async (ctx, { rawText, model, debug }) => {
    // NOTE: ignore client-provided `model` to avoid client-side model selection
    void model;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiModels = await getGeminiModelCandidates(ctx);
    const openRouterModels = await getOpenRouterModelCandidates(ctx);
    const attempts: Array<ProviderAttempt> = [];

    if (geminiApiKey && geminiModels.length > 0) {
      attempts.push({
        provider: "gemini",
        client: new OpenAI({
          apiKey: geminiApiKey,
          baseURL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
        }),
        models: geminiModels,
      });
    }

    if (openRouterApiKey && openRouterModels.length > 0) {
      attempts.push({
        provider: "openrouter",
        client: new OpenAI({
          apiKey: openRouterApiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost",
            "X-Title": process.env.OPENROUTER_APP_NAME ?? "CSDLCoDo2BT",
          },
        }),
        models: openRouterModels,
      });
    }

    if (attempts.length === 0) {
      throw new Error("Missing AI provider config. Please set GEMINI_API_KEY or OPENROUTER_API_KEY.");
    }

    const prompt = `
Bạn là trợ lý phân tích báo cáo CỜ ĐỎ của trường học. Cờ đỏ đi từng lớp để kiểm tra sĩ số và vi phạm.

DANH SÁCH VI PHẠM HỢP LỆ (SỐ THỨ TỰ: TÊN):
${VIOLATION_LIST_WITH_ID}

NHIỆM VỤ:
1. Xác định các lớp đã kiểm tra
2. Với mỗi lớp, trích xuất:
   - Học sinh vắng/nghỉ (tự động gán ID của "Nghỉ học có phép")
   - Học sinh đi muộn (tự động gán ID của "Đi học muộn có phép")
   - Các vi phạm khác (sai đồng phục, vệ sinh muộn, etc.)

⚠️ QUY TẮC QUAN TRỌNG NHẤT:
- MỖI HỌC SINH/MỖI LỖI PHẢI LÀ MỘT VI PHẠM RIÊNG BIỆT
- KHÔNG BAO GIỜ để studentName = null khi có tên học sinh
- Nếu có nhiều học sinh cùng vi phạm → TẠO NHIỀU MỤC VI PHẠM RIÊNG
- ⚠️ Nếu 1 học sinh mắc nhiều lỗi (ví dụ "Khải 10A4 dép lê, học muộn") → TẠO 2 MỤC VI PHẠM RIÊNG (cùng Khải, cùng 10A4, nhưng khác violationId)
- VI PHẠM CẤP LỚP: nếu dòng chỉ có TÊN LỚP + NỘI DUNG VI PHẠM (không có tên học sinh) → studentName PHẢI là null
  Ví dụ: "10A5 trực muộn", "10A5 vệ sinh muộn" → { studentName: null, violatingClass: "10A5", ... }

QUY TẮC PHÂN TÍCH:
1. Tên lớp: Chuẩn hóa thành IN HOA (10a1 → 10A1)
2. Tên học sinh: Viết hoa chữ cái đầu mỗi từ
3. Từ khóa vắng/nghỉ: "vắng", "nghỉ", "absent", "v"
4. Từ khóa muộn: "muộn", "trễ", "late", "m"
5. ⚠️ ÁNH XẠ VI PHẠM - ĐỌC KỸ (PHẢI DÙNG ĐÚNG SỐ THỨ TỰ violationId):
   - "sai dp", "dp", "đồng phục", "dép lê", "tóc", "đầu tóc" → ID của "Sai đồng phục/đầu tóc,..."
   - "vs muộn", "vệ sinh muộn", "trực nhật muộn" → ID của "Trực nhật, vệ sinh tự quản muộn, bẩn."
   - "đồ ăn", "mang đồ ăn", "ăn uống" → ID của "Đồ ăn."
   - "điện thoại", "dt", "phone" → ID của "Sử dụng điện thoại sai mục đích"
   - "muộn" (không có "kp") → ID của "Đi học muộn có phép"
   - "muộn kp", "muộn không phép" → ID của "Đi học muộn/nghỉ học không phép"
   - "vắng", "nghỉ" → ID của "Nghỉ học có phép"
   - "không trực nhật", "không vs" → ID của "Không trực nhật, vệ sinh khu vực tự quản."
   - "hút thuốc" → ID của "Hút thuốc lá."
   - "atgt", "không gương", "không mũ", "không đội mũ", "xe máy", "giao thông" → ID của "Vi phạm ATGT."
6. ⚠️ PHẦN DETAILS - CỰC KỲ QUAN TRỌNG:
   - LUÔN LUÔN điền chi tiết cụ thể vào trường "details"
   - Ví dụ: "Văn quần bò" → details: "quần bò"
   - Ví dụ: "An tóc dài" → details: "tóc dài"
   - Ví dụ: "Bình mang đồ ăn" → details: "mang đồ ăn"
   - CHỈ để details = "" khi KHÔNG có thông tin cụ thể (vắng, muộn có phép)

VĂN BẢN:
"${rawText}"

TRẢ VỀ JSON theo dạng:
{
  "violations": [
    {
      "studentName": "string | null",
      "violatingClass": "string",
      "violationId": number,
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

LƯU Ý:
- ⚠️ MỖI HỌC SINH = 1 VI PHẠM RIÊNG (studentName PHẢI có giá trị)
- Vi phạm cấp lớp (KHÔNG có tên học sinh): studentName = null
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM. KHÔNG GIẢI THÍCH.
`;

    try {
      const firstPass = await createJsonChatWithFallback({
        attempts,
        prompt,
        temperature: 0.1,
      });

      const parsedData = JSON.parse(firstPass.text);
      
      // Double-check with validation pass
      const validationResult = await validateAndCorrectAI(
        firstPass.client,
        firstPass.usedModel,
        rawText,
        parsedData,
        "attendance",
        Boolean(debug)
      );
      
      const finalData = validationResult.data ?? parsedData;
      const mappedViolations = (finalData.violations || []).map((v: any) => {
        const type = typeof v.violationId === 'number' && ALL_VIOLATIONS[v.violationId] 
          ? ALL_VIOLATIONS[v.violationId] 
          : v.violationType || ALL_VIOLATIONS[0];
        
        return {
          studentName: v.studentName,
          violatingClass: v.violatingClass,
          violationType: type,
          details: v.details || "",
          originalText: v.originalText || "",
        };
      });
      
      return {
        violations: mappedViolations,
        checkedClasses: finalData.checkedClasses || [],
        attendanceByClass: finalData.attendanceByClass || {},
        usedModel: `${firstPass.usedProvider}:${firstPass.usedModel}`,
        correctionsMade: debug ? validationResult.correctionsMade : [],
        aiDebug: {
          firstPassTrace: firstPass.trace,
          verificationChanged: validationResult.changed,
          verificationMode: validationResult.verificationMode,
        },
      };
    } catch (error) {
      console.error("Error calling AI providers:", error);
      throw new Error("Failed to parse attendance using AI.");
    }
  },
});

// Mode for "Lớp trực tuần" - violations only (gate duty)
export const parseViolationsWithAI = action({
  args: {
    rawText: v.string(),
    model: v.optional(v.string()),
    debug: v.optional(v.boolean()),
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
    aiDebug: v.object({
      firstPassTrace: v.array(v.string()),
      verificationChanged: v.boolean(),
      verificationMode: v.string(),
    }),
  }),
  handler: async (ctx, { rawText, model, debug }) => {
    // NOTE: ignore client-provided `model` to avoid client-side model selection
    void model;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiModels = await getGeminiModelCandidates(ctx);
    const openRouterModels = await getOpenRouterModelCandidates(ctx);
    const attempts: Array<ProviderAttempt> = [];

    if (geminiApiKey && geminiModels.length > 0) {
      attempts.push({
        provider: "gemini",
        client: new OpenAI({
          apiKey: geminiApiKey,
          baseURL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
        }),
        models: geminiModels,
      });
    }

    if (openRouterApiKey && openRouterModels.length > 0) {
      attempts.push({
        provider: "openrouter",
        client: new OpenAI({
          apiKey: openRouterApiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost",
            "X-Title": process.env.OPENROUTER_APP_NAME ?? "CSDLCoDo2BT",
          },
        }),
        models: openRouterModels,
      });
    }

    if (attempts.length === 0) {
      throw new Error("Missing AI provider config. Please set GEMINI_API_KEY or OPENROUTER_API_KEY.");
    }

    const prompt = `
Bạn là trợ lý phân tích báo cáo LỚP TRỰC TUẦN. Lớp trực tuần đứng cổng trường kiểm tra vi phạm của học sinh vào trường.

DANH SÁCH VI PHẠM HỢP LỆ (SỐ THỨ TỰ: TÊN):
${VIOLATION_LIST_WITH_ID}

⚠️ QUY TẮC QUAN TRỌNG NHẤT - ĐỌC KỸ:
1. MỌI VI PHẠM PHẢI CÓ studentName (chỉ để null khi là vi phạm cấp lớp)
2. Nếu có từ KHÔNG phải tên lớp và KHÔNG phải loại vi phạm → ĐÓ LÀ TÊN HỌC SINH
3. Tên học sinh có thể là BẤT KỲ TỪ NÀO, kể cả "Trường", "Kiểm", "An", "Bình", v.v.
4. ⚠️ Nếu 1 học sinh mắc NHIỀU lỗi (ví dụ "Khải 10A4 dép lê, học muộn") → PHẢI tạo ra NHIỀU object vi phạm riêng biệt (mỗi object là 1 lỗi, nhưng cùng tên Khải, cùng lớp 10A4).
5. VI PHẠM CẤP LỚP: nếu chỉ có TÊN LỚP + NỘI DUNG VI PHẠM (không có tên người) → studentName PHẢI là null
   Ví dụ: "10A5 trực muộn", "10A5 không trực nhật" → studentName: null
   Tuyệt đối KHÔNG tự bịa tên học sinh

NHẬN DẠNG TÊN HỌC SINH:
- Tên lớp: Pattern [Số][Chữ][Số] (10A1, 11B2, 12C3)
- Loại vi phạm: "sai dp", "tóc", "muộn", "vs muộn", "đồng phục", v.v.
- TẤT CẢ CÁC TỪ KHÁC → TÊN HỌC SINH

⚠️ ÁNH XẠ VI PHẠM - PHẢI DÙNG ĐÚNG SỐ THỨ TỰ violationId:
- "sai dp", "dp", "đồng phục", "dép lê", "tóc", "đầu tóc" → ID của "Sai đồng phục/đầu tóc,..."
- "muộn", "trễ" (không có "kp") → ID của "Đi học muộn có phép"
- "muộn kp", "muộn không phép" → ID của "Đi học muộn/nghỉ học không phép"
- "đồ ăn", "mang đồ ăn", "ăn uống" → ID của "Đồ ăn."
- "điện thoại", "dt", "phone" → ID của "Sử dụng điện thoại sai mục đích"
- "hút thuốc" → ID của "Hút thuốc lá."
- "đánh nhau" → ID của "Có học sinh đánh nhau."
- "atgt", "không gương", "không mũ", "không đội mũ", "xe máy", "giao thông" → ID của "Vi phạm ATGT."

⚠️ PHẦN DETAILS - CỰC KỲ QUAN TRỌNG:
- LUÔN LUÔN điền chi tiết cụ thể vào trường "details"
- Ví dụ: "Văn quần bò" → details: "quần bò"
- Ví dụ: "An tóc dài" → details: "tóc dài"
- Ví dụ: "Bình mang đồ ăn" → details: "mang đồ ăn"
- CHỈ để details = "" khi KHÔNG có thông tin cụ thể

VĂN BẢN:
"${rawText}"

TRẢ VỀ JSON:
{
  "violations": [
    {
      "studentName": "string | null",
      "violatingClass": "string",
      "violationId": number,
      "details": "string",
      "originalText": "string"
    }
  ],
  "checkedClasses": []
}

LƯU Ý CUỐI CÙNG:
- ⚠️ MỌI TỪ KHÔNG PHẢI TÊN LỚP VÀ KHÔNG PHẢI VI PHẠM = TÊN HỌC SINH
- Nếu KHÔNG có tên học sinh trong câu → studentName = null (vi phạm cấp lớp)
- CHỈ TRẢ VỀ JSON, KHÔNG TEXT THÊM. KHÔNG GIẢI THÍCH.
`;

    try {
      const firstPass = await createJsonChatWithFallback({
        attempts,
        prompt,
        temperature: 0.1,
      });

      const parsedData = JSON.parse(firstPass.text);

      const normalizedData = Array.isArray(parsedData) 
        ? { violations: parsedData, checkedClasses: [] }
        : { violations: parsedData.violations || [], checkedClasses: parsedData.checkedClasses || [] };

      // Double-check with validation pass
      const validationResult = await validateAndCorrectAI(
        firstPass.client,
        firstPass.usedModel,
        rawText,
        normalizedData,
        "violations",
        Boolean(debug)
      );

      const finalData = validationResult.data ?? normalizedData;
      const mappedViolations = (finalData.violations || []).map((v: any) => {
        const type = typeof v.violationId === 'number' && ALL_VIOLATIONS[v.violationId] 
          ? ALL_VIOLATIONS[v.violationId] 
          : v.violationType || ALL_VIOLATIONS[0];
        
        return {
          studentName: v.studentName,
          violatingClass: v.violatingClass,
          violationType: type,
          details: v.details || "",
          originalText: v.originalText || "",
        };
      });

      return {
        violations: mappedViolations,
        checkedClasses: finalData.checkedClasses || [],
        usedModel: `${firstPass.usedProvider}:${firstPass.usedModel}`,
        correctionsMade: debug ? validationResult.correctionsMade : [],
        aiDebug: {
          firstPassTrace: firstPass.trace,
          verificationChanged: validationResult.changed,
          verificationMode: validationResult.verificationMode,
        },
      };
    } catch (error) {
      console.error("Error calling AI providers:", error);
      throw new Error("Failed to parse violations using AI.");
    }
  },
});

