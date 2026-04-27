import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/bang-diem-thi-dua-tho",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const scores = await ctx.runQuery(api.violations.getPublicEmulationScores, {});
    return new Response(JSON.stringify(scores), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
    path: "/bang-bao-cao-vi-pham",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const violations = await ctx.runQuery(api.violations.getPublicViolations, {});
      return new Response(JSON.stringify(violations), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
});

http.route({
  path: "/api/zalo-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const zaloSecret = request.headers.get("x-bot-api-secret-token");
      const expectedSecret = process.env.ZALO_WEBHOOK_SECRET;
      
      if (expectedSecret && zaloSecret !== expectedSecret) {
        console.warn("Webhook Secret mismatch!");
        // Chặn request nếu không khớp
        return new Response("Unauthorized", { status: 401 }); 
      }

      const body = await request.json();
      console.log("Webhook Body received:", JSON.stringify(body));

      // Hỗ trợ cả 2 định dạng event của Zalo
      if (body.event_name !== "user_send_text" && body.event_name !== "message.text.received") {
        console.log("Bỏ qua event vì không phải tin nhắn text:", body.event_name);
        return new Response("OK", { status: 200 });
      }

      // Trích xuất text và chatId từ 2 định dạng payload khác nhau
      const text: string = (body.message?.text || "").trim();
      // Với user_send_text thì id ở body.sender.id, với message.text.received thì id ở body.message.from.id hoặc chat.id
      const chatId: string = body.sender?.id || body.message?.from?.id || body.message?.chat?.id;

      if (!text || !chatId) {
        console.log("Thiếu text hoặc chatId. Text:", text, "ChatId:", chatId);
        return new Response("OK", { status: 200 });
      }

      console.log(`Đã trích xuất tin nhắn: ChatId=${chatId}, Text="${text}". Đang gọi Action xử lý...`);
      // Delegate to the Node.js action for bot processing & reply
      await ctx.runAction(internal.zalo.processZaloMessage, { text, chatId });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Zalo webhook error:", error);
      return new Response("OK", { status: 200 });
    }
  }),
});

export default http;
