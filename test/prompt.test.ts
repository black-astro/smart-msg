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

  it("omits intent block when intent is undefined / empty / whitespace", () => {
    const base = {
      diff: "x",
      language: "en" as const,
      strength: "middle" as const,
      tone: "report" as const,
    };
    expect(buildPrompt({ ...base })).not.toContain("사용자 의도");
    expect(buildPrompt({ ...base, intent: "" })).not.toContain("사용자 의도");
    expect(buildPrompt({ ...base, intent: "   " })).not.toContain("사용자 의도");
  });

  it("includes intent block when a non-empty intent is provided", () => {
    const out = buildPrompt({
      diff: "x",
      language: "ko",
      strength: "middle",
      tone: "report",
      intent: "IE 에서 로그인 리다이렉트 루프 수정",
    });
    expect(out).toContain("사용자 의도");
    expect(out).toContain("IE 에서 로그인 리다이렉트 루프 수정");
    // middle/hard 에는 본문 동기 영역에 반영하라는 가이드가 포함되어야 한다.
    expect(out).toContain("변경 동기");
  });

  it("uses summary-line guidance when strength=simple", () => {
    const out = buildPrompt({
      diff: "x",
      language: "en",
      strength: "simple",
      tone: "report",
      intent: "fixing login loop in IE",
    });
    expect(out).toContain("사용자 의도");
    expect(out).toContain("summary (한 줄)");
    // simple 일 때는 본문 변경 동기 가이드는 들어가면 안 됨 (본문 자체가 없음).
    expect(out).not.toContain("'변경 동기'");
  });

  it("trims intent before embedding in the prompt", () => {
    const out = buildPrompt({
      diff: "x",
      language: "en",
      strength: "middle",
      tone: "report",
      intent: "   trim test   ",
    });
    // 큰따옴표로 둘러싸인 raw intent 가 trim 된 형태로 들어있어야 한다.
    expect(out).toContain('"trim test"');
    expect(out).not.toContain('"   trim test   "');
  });
});
