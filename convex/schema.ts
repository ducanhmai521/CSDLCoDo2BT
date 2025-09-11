import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  userProfiles: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    className: v.string(),
    grade: v.number(),
    role: v.union(
      v.literal("admin"),
      v.literal("gradeManager"),
      v.literal("pending")
    ),
  }).index("by_userId", ["userId"]),

  violations: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(v.literal("student"), v.literal("class")),
    studentName: v.optional(v.string()),
    violatingClass: v.string(),
    violationDate: v.number(),
    violationType: v.string(),
    details: v.optional(v.string()),
    evidenceFileIds: v.optional(v.array(v.id("_storage"))),
    status: v.union(
      v.literal("reported"),
      v.literal("appealed"),
      v.literal("resolved")
    ),
    appealReason: v.optional(v.string()),
    grade: v.number(),
  })
    .index("by_grade", ["grade"])
    .index("by_violatingClass", ["violatingClass"]),

  violationLogs: defineTable({
    violationId: v.id("violations"),
    editorUserId: v.id("users"),
    timestamp: v.number(),
    changes: v.array(
      v.object({
        field: v.string(),
        oldValue: v.string(),
        newValue: v.string(),
      })
    ),
  }).index("by_violationId", ["violationId"]),

  storedFiles: defineTable({
    storageId: v.id("_storage"),
    kind: v.union(v.literal("evidence"), v.literal("excel")),
    timestamp: v.number(),
  }).index("by_kind", ["kind"]),

  studentRoster: defineTable({
    className: v.string(),
    fullName: v.string(),
  }).index("by_class", ["className"]).index("by_name", ["fullName"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  classes: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
