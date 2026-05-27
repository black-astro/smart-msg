import { describe, it, expect } from "vitest";
import { extractIssueKey } from "../src/git.js";

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
