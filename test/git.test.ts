import { describe, it, expect } from "vitest";
import { extractIssueKey, parseNumstat } from "../src/git.js";

describe("extractIssueKey", () => {
  it("extracts JIRA-style keys", () => {
    expect(extractIssueKey("feature/AUTH-123-oauth-login")).toBe("AUTH-123");
    expect(extractIssueKey("AUTH-1")).toBe("AUTH-1");
    expect(extractIssueKey("bugfix/PROJ-9999-some-issue")).toBe("PROJ-9999");
  });

  it("extracts GitHub-style numeric refs", () => {
    expect(extractIssueKey("feature/#123-add-thing")).toBe("#123");
    expect(extractIssueKey("issue-456")).toBe("#456");
    expect(extractIssueKey("gh-789-fix")).toBe("#789");
  });

  it("returns null for branches without a key", () => {
    expect(extractIssueKey("main")).toBeNull();
    expect(extractIssueKey("develop")).toBeNull();
    expect(extractIssueKey("feature/just-a-branch")).toBeNull();
    expect(extractIssueKey("")).toBeNull();
  });

  it("ignores lowercased fake JIRA-like prefixes", () => {
    // 정규식이 대문자 prefix 만 허용. 'foo-123' 은 매치되지 않음.
    expect(extractIssueKey("feature/foo-123-x")).toBeNull();
  });
});

describe("parseNumstat", () => {
  it("parses text-only changes", () => {
    const raw = "10\t5\tsrc/foo.ts\n0\t12\tREADME.md\n";
    const out = parseNumstat(raw);
    expect(out).toEqual([
      { insertions: 10, deletions: 5, file: "src/foo.ts" },
      { insertions: 0, deletions: 12, file: "README.md" },
    ]);
  });

  it("treats binary files (`-`) as zero", () => {
    const raw = "-\t-\tassets/logo.png\n5\t0\tsrc/x.ts\n";
    const out = parseNumstat(raw);
    expect(out).toEqual([
      { insertions: 0, deletions: 0, file: "assets/logo.png" },
      { insertions: 5, deletions: 0, file: "src/x.ts" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseNumstat("")).toEqual([]);
    expect(parseNumstat("\n\n")).toEqual([]);
  });

  it("skips malformed lines without crashing", () => {
    const raw = "garbage line\n10\t5\tsrc/foo.ts\n";
    expect(parseNumstat(raw)).toEqual([
      { insertions: 10, deletions: 5, file: "src/foo.ts" },
    ]);
  });
});
