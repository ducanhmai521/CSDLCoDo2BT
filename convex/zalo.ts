"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { VIOLATION_CATEGORIES } from "./violationPoints";

// ─── Zalo Bot API helper ────────────────────────────────────────────────

/**
 * Send a text message to a Zalo user via the Zalo Bot Platform API.
 * Endpoint: https://bot-api.zaloplatforms.com/bot<TOKEN>/sendMessage
 */
async function zaloSendMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  console.log(`Zalo API (zaloSendMessage): Đang gửi đến ${chatId}...`);
  try {
    const res = await fetch(`https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`Zalo API gửi lỗi ${res.status}: ${body}`);
    } else {
      console.log(`Zalo API gửi thành công! Phản hồi từ Zalo: ${body}`);
    }
  } catch (err) {
    console.error("Lỗi khi gọi fetch Zalo API:", err);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build a violation points lookup map from VIOLATION_CATEGORIES.
 */
function buildPointsMap(): Map<string, number> {
  const map = new Map<string, number>();
  VIOLATION_CATEGORIES.forEach((cat) => {
    cat.violations.forEach((name) => {
      map.set(name, cat.points);
    });
  });
  return map;
}

/**
 * Format a Vietnamese date string (dd/MM) from a timestamp (UTC+7).
 */
function formatDateVN(ts: number): string {
  const d = new Date(ts + 7 * 60 * 60 * 1000); // shift to UTC+7
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Regex to match class queries from Zalo messages.
 * Examples:
 *   "10A5"          -> class = 10A5, weekNumber = undefined
 *   "12a1 tuần 32"  -> class = 12A1, weekNumber = 32
 *   "11B2 tuan 5"   -> class = 11B2, weekNumber = 5
 */
const CLASS_QUERY_REGEX =
  /^([1][0-2][a-zA-Z]\d{1,2})(?:\s+tu[aâă]n\s+(\d+))?$/i;

// ─── Main action ────────────────────────────────────────────────────────

/**
 * Internal action called by the httpAction webhook handler.
 * Handles the Zalo bot message processing and reply in a Node.js runtime.
 */
export const processZaloMessage = internalAction({
  args: {
    text: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const { text, chatId } = args;
    console.log(`[processZaloMessage] Bắt đầu xử lý cho chatId: ${chatId}`);

    // Validate token
    const accessToken = process.env.ZALO_OA_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[processZaloMessage] LỖI: Biến môi trường ZALO_OA_ACCESS_TOKEN chưa được cài đặt!");
      return;
    }

    // Match the class query regex
    const match = text.match(CLASS_QUERY_REGEX);

    if (!match) {
      console.log(`[processZaloMessage] Lệnh không hợp lệ ("${text}"), gửi tin nhắn hướng dẫn.`);
      // Send a help message
      const helpText = [
        "📋 Hướng dẫn tra cứu vi phạm:",
        "",
        "🔹 Gửi tên lớp để xem vi phạm tuần hiện tại:",
        '   Ví dụ: 10A5, 12B1',
        "",
        "🔹 Gửi tên lớp + số tuần để xem tuần cụ thể:",
        '   Ví dụ: 10A5 tuần 32, 12A1 tuan 5',
      ].join("\n");

      await zaloSendMessage(accessToken, chatId, helpText);
      return;
    }

    // Extract class name and optional week number
    const className = match[1];
    const weekNumber = match[2] ? parseInt(match[2], 10) : undefined;

    console.log(`[processZaloMessage] Querying DB: class=${className}, week=${weekNumber ?? 'hiện tại'}`);

    // Query violations from the database
    const result: any = await ctx.runQuery(
      internal.botQueries.getViolationsForBot,
      { className, weekNumber }
    );

    const { violations, academicWeek, className: normalizedClass } = result;
    console.log(`[processZaloMessage] Tìm thấy ${violations.length} vi phạm cho lớp ${normalizedClass} tuần ${academicWeek}`);

    // Format the response
    if (violations.length === 0) {
      const noViolationMsg = `✨ Tuyệt vời! Lớp ${normalizedClass} không có vi phạm nào trong tuần ${academicWeek}.`;
      await zaloSendMessage(accessToken, chatId, noViolationMsg);
      return;
    }

    // Build violation report
    const pointsMap = buildPointsMap();
    let totalPoints = 0;
    const lines: string[] = [
      `🚨 Vi phạm lớp ${normalizedClass} — Tuần ${academicWeek}`,
      `${"─".repeat(25)}`,
    ];

    violations.forEach((v: any, i: number) => {
      const pts = pointsMap.get(v.violationType) ?? 0;
      totalPoints += pts;

      const dateStr = formatDateVN(v.violationDate);
      const ptsLabel = pts > 0 ? ` (-${pts}đ)` : "";

      if (v.targetType === "student" && v.studentName) {
        // Student-level violation
        lines.push(
          `${i + 1}. 👤 ${v.studentName}`,
          `   📝 ${v.violationType}${ptsLabel}`,
          `   📅 ${dateStr}${v.details ? ` • ${v.details}` : ""}`
        );
      } else {
        // Class-level violation
        lines.push(
          `${i + 1}. 📝 ${v.violationType}${ptsLabel}`,
          `   📅 ${dateStr}${v.details ? ` • ${v.details}` : ""}`
        );
      }
    });

    lines.push(
      `${"─".repeat(25)}`,
      `📊 Tổng: ${violations.length} vi phạm | -${totalPoints} điểm`
    );

    await zaloSendMessage(accessToken, chatId, lines.join("\n"));
  },
});
