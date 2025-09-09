/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adminMaintenance from "../adminMaintenance.js";
import type * as adminTools from "../adminTools.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as excelExport from "../excelExport.js";
import type * as http from "../http.js";
import type * as router from "../router.js";
import type * as users from "../users.js";
import type * as violationPoints from "../violationPoints.js";
import type * as violations from "../violations.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adminMaintenance: typeof adminMaintenance;
  adminTools: typeof adminTools;
  ai: typeof ai;
  auth: typeof auth;
  excelExport: typeof excelExport;
  http: typeof http;
  router: typeof router;
  users: typeof users;
  violationPoints: typeof violationPoints;
  violations: typeof violations;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
