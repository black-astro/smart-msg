import { describe, it, expect } from "vitest";
import {
  detectReverts,
  isInterestingLine,
  parseUnifiedDiff,
  summarizeHits,
  type RecentCommit,
} from "../src/revertDetector.js";

describe("parseUnifiedDiff", () => {
  it("parses a single-file diff", () => {
    const diff = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,3 +1,4 @@",
      " import x from 'y';",
      "+const NEW = 1;",
      " const KEEP = 2;",
      "-const REMOVED = 3;",
    ].join("\n");
    const out = parseUnifiedDiff(diff);
    expect(out).toHaveLength(1);
    expect(out[0].file).toBe("src/foo.ts");
    expect(out[0].addedLines).toEqual(["const NEW = 1;"]);
    expect(out[0].removedLines).toEqual(["const REMOVED = 3;"]);
  });

  it("handles multiple files", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "+++ b/a.ts",
      "+only in a",
      "diff --git a/b.ts b/b.ts",
      "+++ b/b.ts",
      "-only in b",
    ].join("\n");
    const out = parseUnifiedDiff(diff);
    expect(out.map((e) => e.file)).toEqual(["a.ts", "b.ts"]);
    expect(out[0].addedLines).toEqual(["only in a"]);
    expect(out[1].removedLines).toEqual(["only in b"]);
  });

  it("excludes diff header lines (--- a/, +++ b/) from added/removed", () => {
    const diff = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "+real add",
      "-real del",
    ].join("\n");
    const out = parseUnifiedDiff(diff);
    expect(out[0].addedLines).toEqual(["real add"]);
    expect(out[0].removedLines).toEqual(["real del"]);
  });

  it("returns empty when diff has no entries", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("nothing useful here\n")).toEqual([]);
  });
});

describe("isInterestingLine", () => {
  it("rejects short / bracket-only / import / single-keyword lines", () => {
    expect(isInterestingLine("")).toBe(false);
    expect(isInterestingLine("a")).toBe(false);
    expect(isInterestingLine("}")).toBe(false);
    expect(isInterestingLine("})")).toBe(false);
    expect(isInterestingLine("import foo from 'bar';")).toBe(false);
    expect(isInterestingLine("from 'x';")).toBe(false);
    expect(isInterestingLine("return;")).toBe(false);
    expect(isInterestingLine("break;")).toBe(false);
  });

  it("accepts substantive code lines", () => {
    expect(isInterestingLine("const VALUE = 42;")).toBe(true);
    expect(isInterestingLine("if (user.isAdmin) {")).toBe(true);
    expect(isInterestingLine("session.token = token;")).toBe(true);
  });
});

describe("detectReverts", () => {
  it("flags a stage that removes a line a recent commit added", () => {
    const staged = parseUnifiedDiff(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "+++ b/src/foo.ts",
        "-session.token = token;",
      ].join("\n"),
    );
    const recent: RecentCommit[] = [
      {
        sha: "abc1234567",
        subject: "auth: persist session token",
        files: [
          {
            file: "src/foo.ts",
            addedLines: ["session.token = token;"],
            removedLines: [],
          },
        ],
      },
    ];
    const hits = detectReverts(staged, recent);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("removal-of-recent-add");
    expect(hits[0].file).toBe("src/foo.ts");
    expect(hits[0].recentCommit.sha).toBe("abc1234567");
  });

  it("flags a stage that re-adds a line a recent commit removed", () => {
    const staged = parseUnifiedDiff(
      [
        "diff --git a/src/foo.ts b/src/foo.ts",
        "+++ b/src/foo.ts",
        "+const LEGACY_FLAG = true;",
      ].join("\n"),
    );
    const recent: RecentCommit[] = [
      {
        sha: "def0000000",
        subject: "chore: remove legacy flag",
        files: [
          {
            file: "src/foo.ts",
            addedLines: [],
            removedLines: ["const LEGACY_FLAG = true;"],
          },
        ],
      },
    ];
    const hits = detectReverts(staged, recent);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("readd-of-recent-remove");
  });

  it("does not match across different files (avoid false positives on common lines)", () => {
    const staged = parseUnifiedDiff(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "+++ b/src/a.ts",
        "-some shared boilerplate line",
      ].join("\n"),
    );
    const recent: RecentCommit[] = [
      {
        sha: "aaa",
        subject: "...",
        files: [
          {
            file: "src/OTHER.ts",
            addedLines: ["some shared boilerplate line"],
            removedLines: [],
          },
        ],
      },
    ];
    expect(detectReverts(staged, recent)).toEqual([]);
  });

  it("ignores noise lines (brackets / imports / short)", () => {
    const staged = parseUnifiedDiff(
      [
        "diff --git a/x.ts b/x.ts",
        "+++ b/x.ts",
        "-}",
        "-import x from 'y';",
        "-return;",
      ].join("\n"),
    );
    const recent: RecentCommit[] = [
      {
        sha: "x",
        subject: "anything",
        files: [
          {
            file: "x.ts",
            addedLines: ["}", "import x from 'y';", "return;"],
            removedLines: [],
          },
        ],
      },
    ];
    expect(detectReverts(staged, recent)).toEqual([]);
  });

  it("caps hits per (commit, file) at 3 to prevent visual flooding", () => {
    const stagedLines = Array.from({ length: 10 }, (_, i) => `meaningful line ${i};`);
    const staged = parseUnifiedDiff(
      [
        "diff --git a/x.ts b/x.ts",
        "+++ b/x.ts",
        ...stagedLines.map((l) => `-${l}`),
      ].join("\n"),
    );
    const recent: RecentCommit[] = [
      {
        sha: "abc",
        subject: "added many lines",
        files: [
          {
            file: "x.ts",
            addedLines: stagedLines,
            removedLines: [],
          },
        ],
      },
    ];
    const hits = detectReverts(staged, recent);
    expect(hits.length).toBe(3);
  });
});

describe("summarizeHits", () => {
  it("groups by (kind, sha, file) and shows up to 3 lines", () => {
    const hits = [
      { file: "x.ts", line: "a = 1;", kind: "removal-of-recent-add" as const, recentCommit: { sha: "abc1234567", subject: "S" } },
      { file: "x.ts", line: "b = 2;", kind: "removal-of-recent-add" as const, recentCommit: { sha: "abc1234567", subject: "S" } },
    ];
    const out = summarizeHits(hits);
    expect(out[0]).toContain("x.ts");
    expect(out[0]).toContain("removes line(s) added in");
    expect(out[0]).toContain("abc1234");
    expect(out).toContain('    - a = 1;');
    expect(out).toContain('    - b = 2;');
  });
});
