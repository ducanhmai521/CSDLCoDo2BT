import { createApi } from "@convex-dev/better-auth";
import { username } from "better-auth/plugins/username";
import { admin } from "better-auth/plugins/admin";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "../auth.config";
import schema from "./schema";
import type { BetterAuthOptions } from "better-auth";

// createApi needs auth options WITHOUT the database field
// (it provides its own adapter internally)
const adapterOptions = {
  appName: "CSDL Cờ đỏ",
  emailAndPassword: { enabled: true },
  plugins: [
    username(),
    admin(),
    convex({ authConfig }),
  ],
} satisfies BetterAuthOptions;

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, () => adapterOptions);
