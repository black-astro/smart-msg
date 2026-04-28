// Groq provider 구현. OpenAI 호환 API 형식을 사용한다.
// Gemini 무료 티어가 503 을 자주 뱉는 사용자를 위한 안정적 무료 대안.
//
// 특징:
//   - 카드 등록 없이 무료 티어 가능 (RPM/RPD 제한은 있으나 commit 용도엔 충분)
//   - 자체 LPU 인프라로 응답 속도가 매우 빠름 (초당 500+ 토큰)
//   - 호스팅 모델: Llama 3.3 / 3.1, Gemma2 등 오픈소스 계열
import type { CommitProvider } from "./types.js";
import { buildPrompt } from "./prompt.js";
import { fetchWithRetry } from "./_retry.js";

// Groq 의 OpenAI 호환 엔드포인트. messages/model/max_tokens 등 OpenAI 와 동일 스키마.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const groqProvider: CommitProvider = {
  name: "groq",

  async generate({ diff, model, apiKey, language, strength }) {
    // 한국어는 영어 대비 토큰 효율이 낮아 본문이 잘리지 않도록 1.5배 여유.
    const baseTokens =
      strength === "simple" ? 120 : strength === "middle" ? 500 : 1000;
    const maxTokens = language === "ko" ? Math.round(baseTokens * 1.5) : baseTokens;

    const body = JSON.stringify({
      model,
      messages: [
        { role: "user", content: buildPrompt({ diff, language, strength }) },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    });

    const res = await fetchWithRetry((signal) =>
      fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body,
        signal,
      }),
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API ${res.status}: ${text}`);
    }

    // OpenAI 호환 응답: { choices: [{ message: { content } }] }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return (data.choices?.[0]?.message?.content ?? "").trim();
  },
};
