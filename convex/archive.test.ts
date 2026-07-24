import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { resolveSchoolYear, sanitizeUsers, buildZipFileName } from "./archiveActions";

describe("Property-based tests: admin-archive", () => {
  // Feature: admin-archive, Property 3: School Year Resolver – tháng 9 đến 12
  test("P3: tháng 9-12 → Y-(Y+1)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 9, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const date = new Date(Date.UTC(year, month - 1, day) - 7 * 3600000);
          expect(resolveSchoolYear(date)).toBe(`${year}-${year + 1}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-archive, Property 4: School Year Resolver – tháng 1 đến 8
  test("P4: tháng 1-8 → (Y-1)-Y", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2001, max: 2099 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const date = new Date(Date.UTC(year, month - 1, day) - 7 * 3600000);
          expect(resolveSchoolYear(date)).toBe(`${year - 1}-${year}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-archive, Property 5: Định dạng nhãn năm học
  test("P5: output luôn là YYYY-YYYY (9 ký tự)", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }),
        (date) => {
          const result = resolveSchoolYear(date);
          expect(result).toMatch(/^\d{4}-\d{4}$/);
          expect(result).toHaveLength(9);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: admin-archive, Property 8: Dữ liệu users không chứa trường nhạy cảm
  test("P8: sanitizeUsers không chứa betterAuthId/tokenIdentifier/email", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            _id: fc.string({ minLength: 1 }),
            username: fc.option(fc.string()),
            betterAuthId: fc.option(fc.string()),
            tokenIdentifier: fc.option(fc.string()),
            email: fc.option(fc.string()),
          })
        ),
        (users) => {
          const sanitized = sanitizeUsers(users);
          for (const u of sanitized) {
            expect(u).not.toHaveProperty("betterAuthId");
            expect(u).not.toHaveProperty("tokenIdentifier");
            expect(u).not.toHaveProperty("email");
            expect(u).toHaveProperty("_id");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-archive, Property 12: Tên file ZIP khớp pattern chuẩn
  test("P12: buildZipFileName khớp pattern archive-{schoolYear}-{YYYY}-{MM}-{DD}.zip", () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 2000, max: 2099 })
          .chain((y) =>
            fc
              .integer({ min: 1, max: 8 })
              .map((_m) => ({ y, label: `${y - 1}-${y}` }))
          ),
        fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }),
        ({ label }, date) => {
          const result = buildZipFileName(label, date);
          expect(result).toMatch(/^archive-\d{4}-\d{4}-\d{4}-\d{2}-\d{2}\.zip$/);
          expect(result.startsWith(`archive-${label}-`)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Validates: Requirements 2.2, 2.3, 3.5, 5.2
describe("Unit tests (example-based): admin-archive helper functions", () => {
  // --- resolveSchoolYear ---

  test("resolveSchoolYear: tháng 9 năm 2025 → '2025-2026'", () => {
    // UTC+7 midnight of 2025-09-01 → UTC time is 2025-08-31T17:00:00Z
    const date = new Date("2025-08-31T17:00:00Z");
    expect(resolveSchoolYear(date)).toBe("2025-2026");
  });

  test("resolveSchoolYear: tháng 1 năm 2026 → '2025-2026'", () => {
    // UTC+7 midnight of 2026-01-15 → UTC time is 2026-01-14T17:00:00Z
    const date = new Date("2026-01-14T17:00:00Z");
    expect(resolveSchoolYear(date)).toBe("2025-2026");
  });

  test("resolveSchoolYear: tháng 8 năm 2026 → '2025-2026'", () => {
    // UTC+7 noon of 2026-08-15 → UTC time is 2026-08-15T05:00:00Z
    const date = new Date("2026-08-15T05:00:00Z");
    expect(resolveSchoolYear(date)).toBe("2025-2026");
  });

  test("resolveSchoolYear: tháng 12 năm 2025 → '2025-2026'", () => {
    // UTC+7 noon of 2025-12-25 → UTC time is 2025-12-25T05:00:00Z
    const date = new Date("2025-12-25T05:00:00Z");
    expect(resolveSchoolYear(date)).toBe("2025-2026");
  });

  // --- buildZipFileName ---

  test("buildZipFileName: '2025-2026' + 2026-01-15T01:00:00Z → 'archive-2025-2026-2026-01-15.zip' (UTC+7 = 08:00)", () => {
    // 2026-01-15T01:00:00Z + 7h = 2026-01-15T08:00:00 UTC+7 → date part is 2026-01-15
    const date = new Date("2026-01-15T01:00:00Z");
    expect(buildZipFileName("2025-2026", date)).toBe("archive-2025-2026-2026-01-15.zip");
  });

  // --- sanitizeUsers ---

  test("sanitizeUsers: users với đầy đủ trường nhạy cảm → chỉ giữ _id và username", () => {
    const users = [
      {
        _id: "user1",
        username: "alice",
        betterAuthId: "auth-abc",
        tokenIdentifier: "token-xyz",
        email: "alice@example.com",
      },
      {
        _id: "user2",
        username: "bob",
        betterAuthId: "auth-def",
        tokenIdentifier: "token-uvw",
        email: "bob@example.com",
      },
    ];

    const sanitized = sanitizeUsers(users);

    expect(sanitized).toHaveLength(2);

    expect(sanitized[0]).toEqual({ _id: "user1", username: "alice" });
    expect(sanitized[0]).not.toHaveProperty("betterAuthId");
    expect(sanitized[0]).not.toHaveProperty("tokenIdentifier");
    expect(sanitized[0]).not.toHaveProperty("email");

    expect(sanitized[1]).toEqual({ _id: "user2", username: "bob" });
    expect(sanitized[1]).not.toHaveProperty("betterAuthId");
    expect(sanitized[1]).not.toHaveProperty("tokenIdentifier");
    expect(sanitized[1]).not.toHaveProperty("email");
  });

  test("sanitizeUsers: array rỗng → trả về array rỗng", () => {
    expect(sanitizeUsers([])).toEqual([]);
  });
});
