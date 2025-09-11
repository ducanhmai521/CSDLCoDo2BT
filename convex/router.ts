import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

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

export default http;
