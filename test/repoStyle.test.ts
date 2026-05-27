import { describe, it, expect } from "vitest";
import {
  aggregateStyle,
  analyzeCommitMessage,
  formatStyleForPrompt,
} from "../src/repoStyle.js";

describe("analyzeCommitMessage", () => {
  it("recognizes Conventional Commit header with scope", () => {
    const f = analyzeCommitMessage("feat(auth): add OAuth login flow");
    expect(f.isCC).toBe(true);
    expect(f.type).toBe("feat");
    expect(f.scope).toBe("auth");
    expect(f.subject).toBe("add OAuth login flow");
  });

  it("recognizes CC without scope", () => {
    const f = analyzeCommitMessage("fix: trailing newline in log writer");
    expect(f.isCC).toBe(true);
    expect(f.type).toBe("fix");
    expect(f.scope).toBeNull();
  });

  it("treats non-CC subject as free form", () => {
    const f = analyzeCommitMessage("Add login redirect");
    expect(f.isCC).toBe(false);
    expect(f.type).toBeNull();
    expect(f.subject).toBe("Add login redirect");
  });

  it("detects gitmoji prefix and strips for CC match", () => {
    const f = analyzeCommitMessage("✨ feat(auth): OAuth");
    expect(f.hasGitmoji).toBe(true);
    expect(f.isCC).toBe(true);
    expect(f.type).toBe("feat");
  });

  it("counts body lines (excluding blank)", () => {
    const msg = [
      "feat: thing",
      "",
      "- bullet 1",
      "- bullet 2",
      "",
      "- bullet 3",
    ].join("\n");
    const f = analyzeCommitMessage(msg);
    expect(f.bodyLines).toBe(3);
    expect(f.bulletStyle).toBe("dash");
  });

  it("detects star bullets when majority", () => {
    const msg = [
      "feat: thing",
      "",
      "* a",
      "* b",
      "* c",
    ].join("\n");
    expect(analyzeCommitMessage(msg).bulletStyle).toBe("star");
  });

  it("flags Korean output when hangul ratio > 0.3", () => {
    const f = analyzeCommitMessage("feat(auth): 로그인 흐름 정리");
    expect(f.language).toBe("ko");
  });

  it("flags English output otherwise", () => {
    expect(analyzeCommitMessage("feat: add OAuth login flow").language).toBe("en");
  });

  it("detects issue footer formats", () => {
    expect(analyzeCommitMessage("fix: x\n\nRefs: AUTH-1").issueRef).toBe("Refs");
    expect(analyzeCommitMessage("fix: x\n\nCloses #12").issueRef).toBe("Closes");
    expect(analyzeCommitMessage("fix: x [AUTH-1]").issueRef).toBe("bracket");
    expect(analyzeCommitMessage("fix: x  closes #42").issueRef).toBe("hash");
    expect(analyzeCommitMessage("fix: x").issueRef).toBeNull();
  });
});

describe("aggregateStyle", () => {
  it("returns empty style for empty input", () => {
    const s = aggregateStyle([]);
    expect(s.sampledCommits).toBe(0);
    expect(s.ccRatio).toBe(0);
    expect(s.topTypes).toEqual([]);
  });

  it("computes CC ratio + top types/scopes", () => {
    const msgs = [
      "feat(auth): a",
      "feat(auth): b",
      "fix(billing): c",
      "fix: d",
      "chore: e",
      "random non-CC commit",
    ];
    const s = aggregateStyle(msgs.map(analyzeCommitMessage));
    expect(s.sampledCommits).toBe(6);
    expect(s.ccRatio).toBeCloseTo(5 / 6, 2);
    expect(s.topTypes[0].name).toBe("feat");
    expect(s.topTypes[0].count).toBe(2);
    expect(s.topScopes[0].name).toBe("auth");
  });

  it("computes subject length stats", () => {
    const msgs = ["feat: " + "a".repeat(20), "feat: " + "b".repeat(40)];
    const s = aggregateStyle(msgs.map(analyzeCommitMessage));
    expect(s.subjectLenAvg).toBeGreaterThan(0);
    expect(s.subjectLenP90).toBeGreaterThanOrEqual(s.subjectLenAvg);
  });

  it("picks preferred language by KO ratio threshold", () => {
    const features = [
      analyzeCommitMessage("feat: 로그인 흐름 정리"),
      analyzeCommitMessage("feat: 회원가입 로직 수정"),
      analyzeCommitMessage("feat: english only"),
    ];
    expect(aggregateStyle(features).preferredLanguage).toBe("ko");
  });

  it("picks preferred bullet style by majority", () => {
    const ko = [
      "feat: a\n\n- x\n- y",
      "feat: b\n\n- p\n- q",
      "feat: c\n\n* z",
    ];
    expect(aggregateStyle(ko.map(analyzeCommitMessage)).preferredBullet).toBe("dash");
  });

  it("picks preferred issue ref by frequency", () => {
    const msgs = [
      "feat: a\n\nRefs: AUTH-1",
      "feat: b\n\nRefs: AUTH-2",
      "feat: c\n\nCloses #3",
    ];
    expect(aggregateStyle(msgs.map(analyzeCommitMessage)).preferredIssueRef).toBe("Refs");
  });
});

describe("formatStyleForPrompt", () => {
  it("emits multi-line summary including CC ratio + sample size", () => {
    const msgs = [
      "feat(auth): a",
      "feat(auth): b",
      "fix(billing): c",
    ];
    const out = formatStyleForPrompt(aggregateStyle(msgs.map(analyzeCommitMessage)));
    expect(out).toContain("최근 3 개 분석");
    expect(out).toContain("Conventional Commits");
    expect(out).toContain("자주 쓰는 type");
  });
});
