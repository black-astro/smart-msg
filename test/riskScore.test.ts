import { describe, it, expect } from "vitest";
import {
  assessRisk,
  evaluateTimeWindow,
  formatRiskBar,
} from "../src/riskScore.js";

// 안전한 시간대로 고정하기 위한 헬퍼.
// 화요일(getDay=2) 14:00 — 평일 낮 → 모든 시간대 가산점 0.
const SAFE_TIME = new Date(2026, 4, 26, 14, 0, 0); // 2026-05-26 화 14:00
const FRIDAY_LATE = new Date(2026, 4, 29, 19, 0, 0); // 2026-05-29 금 19:00
const SUNDAY_MIDDAY = new Date(2026, 4, 31, 13, 0, 0); // 2026-05-31 일 13:00
const TUESDAY_NIGHT = new Date(2026, 4, 26, 23, 30, 0); // 2026-05-26 화 23:30
const TUESDAY_EARLY = new Date(2026, 4, 26, 4, 30, 0); // 2026-05-26 화 04:30

describe("evaluateTimeWindow", () => {
  it("returns no warnings during safe weekday hours", () => {
    const out = evaluateTimeWindow(SAFE_TIME);
    expect(out.warnings).toEqual([]);
    expect(out.dangerous).toBe(false);
  });

  it("flags Friday 18:00+", () => {
    const out = evaluateTimeWindow(FRIDAY_LATE);
    expect(out.dangerous).toBe(true);
    expect(out.warnings.some((w) => w.includes("Friday"))).toBe(true);
  });

  it("flags weekend midday", () => {
    const out = evaluateTimeWindow(SUNDAY_MIDDAY);
    expect(out.dangerous).toBe(true);
    expect(out.warnings.some((w) => w.includes("weekend"))).toBe(true);
  });

  it("flags night hours (22-06)", () => {
    expect(evaluateTimeWindow(TUESDAY_NIGHT).warnings.some((w) => w.includes("night"))).toBe(true);
    expect(evaluateTimeWindow(TUESDAY_EARLY).warnings.some((w) => w.includes("night"))).toBe(true);
  });
});

describe("assessRisk — base & low-risk", () => {
  it("scores 1 for empty changes", () => {
    const a = assessRisk({ changedFiles: [], insertions: 0, deletions: 0 }, SAFE_TIME);
    expect(a.score).toBe(1);
  });

  it("scores 1 for tiny prod-code change", () => {
    const a = assessRisk(
      { changedFiles: ["src/foo.ts"], insertions: 3, deletions: 1 },
      SAFE_TIME,
    );
    expect(a.score).toBe(1);
  });

  it("caps at 2 when only docs/tests changed (even with many files)", () => {
    const a = assessRisk(
      {
        changedFiles: [
          "docs/intro.md",
          "test/foo.test.ts",
          "test/bar.test.ts",
          "spec/baz.spec.ts",
          "README.md",
          "__tests__/q.ts",
          "docs/api.md",
          "test/x.test.ts",
          "test/y.test.ts",
          "test/z.test.ts",
          "docs/changelog.md",
          "docs/migration.md",
        ],
        insertions: 800,
        deletions: 0,
      },
      SAFE_TIME,
    );
    expect(a.score).toBeLessThanOrEqual(2);
    expect(a.reasons.some((r) => /docs|tests/i.test(r))).toBe(true);
  });
});

describe("assessRisk — high-risk factors", () => {
  it("scores 4+ for DB migration", () => {
    const a = assessRisk(
      { changedFiles: ["migrations/0042_add_user.sql"], insertions: 30, deletions: 0 },
      SAFE_TIME,
    );
    expect(a.score).toBeGreaterThanOrEqual(4);
    expect(a.reasons.some((r) => r.includes("DB"))).toBe(true);
  });

  it("flags CI/CD config", () => {
    const a = assessRisk(
      { changedFiles: [".github/workflows/publish.yml"], insertions: 5, deletions: 5 },
      SAFE_TIME,
    );
    expect(a.score).toBeGreaterThanOrEqual(3);
    expect(a.reasons.some((r) => /CI/.test(r))).toBe(true);
  });

  it("flags prod env / config", () => {
    const a = assessRisk(
      { changedFiles: [".env.production", "config/prod.json"], insertions: 4, deletions: 1 },
      SAFE_TIME,
    );
    expect(a.score).toBeGreaterThanOrEqual(3);
    expect(a.reasons.some((r) => /prod/i.test(r))).toBe(true);
  });

  it("does NOT explode score when the same risk category appears in many files", () => {
    const a = assessRisk(
      {
        changedFiles: [
          "migrations/a.sql",
          "migrations/b.sql",
          "migrations/c.sql",
          "migrations/d.sql",
        ],
        insertions: 50,
        deletions: 0,
      },
      SAFE_TIME,
    );
    // DB +3, many files (4 is not > 10), no lockfile, etc. → 1+3 = 4.
    // 5 가 되려면 다른 위험 카테고리가 추가로 있어야 함.
    expect(a.score).toBeLessThanOrEqual(5);
    expect(a.reasons.filter((r) => r.includes("DB")).length).toBe(1);
  });

  it("stacks size + lockfile heuristics", () => {
    const a = assessRisk(
      {
        changedFiles: [
          "package-lock.json",
          ...Array.from({ length: 12 }, (_, i) => `src/m${i}.ts`),
        ],
        insertions: 700,
        deletions: 0,
      },
      SAFE_TIME,
    );
    expect(a.reasons.some((r) => /lockfile/i.test(r))).toBe(true);
    expect(a.reasons.some((r) => /many files/i.test(r))).toBe(true);
    expect(a.reasons.some((r) => /large diff/i.test(r))).toBe(true);
    expect(a.score).toBeGreaterThanOrEqual(4);
  });

  it("propagates dangerous time window into assessment", () => {
    const a = assessRisk(
      { changedFiles: ["src/foo.ts"], insertions: 1, deletions: 0 },
      FRIDAY_LATE,
    );
    expect(a.isDangerousTime).toBe(true);
    expect(a.timeWarnings.length).toBeGreaterThan(0);
  });
});

describe("formatRiskBar", () => {
  it("renders 5-slot bar", () => {
    expect(formatRiskBar(1)).toBe("★☆☆☆☆ (1/5)");
    expect(formatRiskBar(3)).toBe("★★★☆☆ (3/5)");
    expect(formatRiskBar(5)).toBe("★★★★★ (5/5)");
  });
});
