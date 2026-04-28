// Google Gemini provider 구현. 무료 티어가 넉넉해 기본 provider 로 사용.
// SDK 미설치 환경 고려해 fetch 로 직접 호출. 의존성을 늘리지 않기 위함.
import type { CommitProvider } from "./types.js";
import { buildPrompt } from "./prompt.js";
import { fetchWithRetry } from "./_retry.js";

// Gemini 는 모델명을 URL 경로에 포함하고, API 키는 query string 으로 전달한다.
// 예: /v1beta/models/gemini-2.5-flash:generateContent?key=...
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiProvider: CommitProvider = {
  name: "gemini",

  async generate({ diff, model, apiKey, language, strength }) {
    // 강도별 출력 토큰 한도. simple 은 짧으니 한도도 작게 → 비용/시간 모두 절감.
    const maxOutputTokens =
      strength === "simple" ? 120 : strength === "middle" ? 400 : 800;

    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt({ diff, language, strength }) }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        // 커밋 메시지는 결정적인 출력이 더 유용함. 너무 0 에 가까우면 단조로워지므로 살짝만.
        temperature: 0.4,
      },
    });

    // 503/429/5xx 같은 transient 에러는 짧은 백오프로 자동 재시도한다.
    // signal 은 헬퍼가 제공하는 30초 타임아웃 — 무한 대기 차단.
    // Gemini 의 'high demand' 503 은 흔하며, 한 번 더 시도하면 대부분 성공한다.
    const res = await fetchWithRetry((signal) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal,
      }),
    );

    if (!res.ok) {
      // 재시도까지 모두 실패한 경우. 에러 본문도 같이 노출해야 키 만료/모델 오타 등 원인 파악 가능.
      const text = await res.text();
      throw new Error(`Gemini API ${res.status}: ${text}`);
    }

    // Gemini 응답: { candidates: [{ content: { parts: [{ text }] } }] }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";

    return text.trim();
  },
};
