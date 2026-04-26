import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins/username";
import { admin } from "better-auth/plugins/admin";
import { convex } from "@convex-dev/better-auth/plugins";
import { createClient } from "@convex-dev/better-auth";
import { components } from "../_generated/api";
import authConfig from "../auth.config";
import schema from "./schema";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { DataModel } from "../_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth as any,
  { local: { schema } }
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => ({
  appName: "CSDL Cờ đỏ",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authComponent.adapter(ctx),
  emailAndPassword: { enabled: true },
  plugins: [
    username(),
    admin(),
    convex({ authConfig }),
  ],
});

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
