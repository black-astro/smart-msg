// Claude(Anthropic) provider 구현. CommitProvider 인터페이스 동일하게 만족.
// SDK 미설치 환경 고려해서 우선 fetch 로 직접 호출 (의존성 최소).
// 추후 @anthropic-ai/sdk 도입 시 이 파일만 교체하면 router 는 변경 없음.
import type { CommitProvider } from "./types.js";
import { buildPrompt } from "./prompt.js";
import { fetchWithRetry } from "./_retry.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const claudeProvider: CommitProvider = {
  name: "claude",

  async generate({ diff, model, apiKey, language, strength }) {
    // 강도별 max_tokens 조정 → simple 은 출력 짧으니 토큰 한도도 작게 (비용 절감).
    // 한국어는 영어 대비 토큰 효율이 낮아 동일 줄 수에서 토큰을 더 많이 소모하므로,
    // 본문이 잘려 첫 줄만 남는 사고를 막기 위해 ko 일 때 50% 가량 여유를 더한다.
    const baseTokens = strength === "simple" ? 120 : strength === "middle" ? 500 : 1000;
    const maxTokens = language === "ko" ? Math.round(baseTokens * 1.5) : baseTokens;

    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "user", content: buildPrompt({ diff, language, strength }) },
      ],
    });

    // 429/5xx 같은 transient 에러는 짧은 백오프로 자동 재시도. Anthropic 도 점진적 rate limit/과부하가 있다.
    // signal 은 헬퍼의 30초 타임아웃 — 무한 대기 차단.
    const res = await fetchWithRetry((signal) =>
      fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body,
        signal,
      }),
    );

    if (!res.ok) {
      // 에러 본문도 같이 던져야 사용자가 키 만료/모델 오타 등 원인 파악 가능.
      const text = await res.text();
      throw new Error(`Claude API ${res.status}: ${text}`);
    }

    // Anthropic 응답: { content: [{ type: "text", text: "..." }, ...] }
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");

    return text.trim();
  },
};
