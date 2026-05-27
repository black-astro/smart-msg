import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/providers/prompt.js";

describe("buildPrompt", () => {
  it("includes Korean tone block only for ko", () => {
    const ko = buildPrompt({
      diff: "diff --git a/x b/x\n+a",
      language: "ko",
      strength: "middle",
      tone: "report",
    });
    expect(ko).toContain("본문 톤 (한국어 출력):");

    const en = buildPrompt({
      diff: "diff --git a/x b/x\n+a",
      language: "en",
      strength: "middle",
      tone: "report",
    });
    expect(en).not.toContain("본문 톤 (한국어 출력):");
  });

  it("includes gitmoji block only when enabled", () => {
    const off = buildPrompt({ diff: "x", language: "en", strength: "simple", tone: "report" });
    expect(off).not.toContain("gitmoji:");
    const on = buildPrompt({ diff: "x", language: "en", strength: "simple", tone: "report", gitmoji: true });
    expect(on).toContain("gitmoji:");
    expect(on).toContain("✨");
  });

  it("includes branch block when branch context provided", () => {
    const out = buildPrompt({
      diff: "x",
      language: "en",
      strength: "simple",
      tone: "report",
      branch: { name: "feature/AUTH-1-test", issueKey: "AUTH-1" },
    });
    expect(out).toContain("브랜치 컨텍스트:");
    expect(out).toContain("AUTH-1");
  });

  it("uses PR template in mode='pr'", () => {
    const out = buildPrompt({
      diff: "x",
      language: "en",
      strength: "simple",
      tone: "report",
      mode: "pr",
    });
    expect(out).toContain("## Summary");
    expect(out).toContain("## Test plan");
  });

  it("uses split template in mode='split'", () => {
    const out = buildPrompt({
      diff: "x",
      language: "en",
      strength: "simple",
      tone: "report",
      mode: "split",
    });
    expect(out).toContain("의미 단위로 나누면");
  });
});
