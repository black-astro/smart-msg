import { describe, it, expect } from "vitest";
import {
  classifyFiles,
  formatProposal,
  groupClassified,
  isWhitespaceOnly,
  proposeFromStaged,
} from "../src/semanticSplit.js";
import type { ParsedFileDiff } from "../src/revertDetector.js";

function f(
  file: string,
  addedLines: string[] = [],
  removedLines: string[] = [],
): ParsedFileDiff {
  return { file, addedLines, removedLines };
}

describe("isWhitespaceOnly", () => {
  it("returns true when added/removed multisets match after trim", () => {
    expect(isWhitespaceOnly(["  const x = 1;"], ["const x = 1;"])).toBe(true);
    expect(isWhitespaceOnly(["\tfoo", "  bar"], ["foo", "bar"])).toBe(true);
  });

  it("returns false when content actually differs", () => {
    expect(isWhitespaceOnly(["const y = 1;"], ["const x = 1;"])).toBe(false);
  });

  it("returns false when sizes differ", () => {
    expect(isWhitespaceOnly(["x", "y"], ["x"])).toBe(false);
  });

  it("returns false for empty changes", () => {
    expect(isWhitespaceOnly([], [])).toBe(false);
  });
});

describe("classifyFiles", () => {
  it("classifies docs", () => {
    const c = classifyFiles([f("README.md", ["x"], []), f("docs/intro.md", ["y"], [])]);
    expect(c.map((x) => x.kind)).toEqual(["docs", "docs"]);
  });

  it("classifies tests", () => {
    const c = classifyFiles([
      f("test/foo.test.ts", ["x"], []),
      f("__tests__/bar.ts", ["x"], []),
      f("spec/baz.spec.ts", ["x"], []),
    ]);
    expect(c.map((x) => x.kind)).toEqual(["tests", "tests", "tests"]);
  });

  it("classifies CI configs", () => {
    expect(classifyFiles([f(".github/workflows/ci.yml", ["x"], [])])[0].kind).toBe("ci");
    expect(classifyFiles([f("Jenkinsfile", ["x"], [])])[0].kind).toBe("ci");
  });

  it("classifies deps", () => {
    expect(classifyFiles([f("package.json", ["x"], [])])[0].kind).toBe("deps");
    expect(classifyFiles([f("yarn.lock", ["x"], [])])[0].kind).toBe("deps");
    expect(classifyFiles([f("Cargo.lock", ["x"], [])])[0].kind).toBe("deps");
  });

  it("classifies config", () => {
    expect(classifyFiles([f(".env.production", ["x"], [])])[0].kind).toBe("config");
    expect(classifyFiles([f("config/app.json", ["x"], [])])[0].kind).toBe("config");
  });

  it("classifies type declarations", () => {
    expect(classifyFiles([f("types/global.d.ts", ["x"], [])])[0].kind).toBe("typesOnly");
  });

  it("classifies whitespace-only changes as formatting", () => {
    const c = classifyFiles([f("src/foo.ts", ["  bar"], ["bar"])]);
    expect(c[0].kind).toBe("formatting");
  });

  it("falls back to feature for normal code", () => {
    expect(classifyFiles([f("src/foo.ts", ["const NEW_VAL = 1;"], [])])[0].kind).toBe("feature");
  });
});

describe("groupClassified", () => {
  it("returns shouldSplit=false for empty", () => {
    expect(groupClassified([]).shouldSplit).toBe(false);
  });

  it("returns shouldSplit=false for single-kind", () => {
    const single = classifyFiles([f("src/a.ts", ["x"], []), f("src/b.ts", ["y"], [])]);
    const p = groupClassified(single);
    expect(p.groups).toHaveLength(1);
    expect(p.shouldSplit).toBe(false);
  });

  it("splits into groups by kind", () => {
    const classified = classifyFiles([
      f("src/feat.ts", ["const A = 1;"], []),
      f("test/feat.test.ts", ["it('a', ...)"], []),
      f("README.md", ["new docs"], []),
    ]);
    const p = groupClassified(classified);
    expect(p.shouldSplit).toBe(true);
    expect(p.groups.map((g) => g.kind).sort()).toEqual(["docs", "feature", "tests"]);
  });

  it("orders groups: chores first, feature last", () => {
    const classified = classifyFiles([
      f("src/feat.ts", ["const A = 1;"], []),
      f("docs/intro.md", ["docs"], []),
      f("package.json", ["{}"], []),
      f("src/style.ts", ["  bar"], ["bar"]),
    ]);
    const p = groupClassified(classified);
    const order = p.groups.map((g) => g.kind);
    // formatting → deps → docs → feature
    expect(order).toEqual(["formatting", "deps", "docs", "feature"]);
  });

  it("computes per-group line totals", () => {
    const classified = classifyFiles([
      f("src/a.ts", ["+1", "+2", "+3"], ["-1"]),
      f("src/b.ts", ["+1"], []),
    ]);
    const p = groupClassified(classified);
    expect(p.groups[0].insertions).toBe(4);
    expect(p.groups[0].deletions).toBe(1);
  });
});

describe("formatProposal", () => {
  it("returns single-group message when no split needed", () => {
    const p = proposeFromStaged([f("src/a.ts", ["x"], [])]);
    expect(formatProposal(p)).toContain("no split needed");
  });

  it("emits numbered groups + git command sequence", () => {
    const p = proposeFromStaged([
      f("src/a.ts", ["x"], []),
      f("README.md", ["docs"], []),
    ]);
    const out = formatProposal(p);
    expect(out).toContain("Suggested split: 2 groups");
    expect(out).toContain("git reset HEAD");
    expect(out).toContain("git add");
    expect(out).toMatch(/\[1\]/);
    expect(out).toMatch(/\[2\]/);
  });
});
