// Ollama provider 구현 — 로컬 LLM. 인터넷 / API 키 불필요.
//
// 기본 endpoint: http://localhost:11434
// 사용자가 다른 호스트(원격 ollama 서버)를 쓸 경우 cfg.ollamaBaseUrl 로 지정 가능.
// API 키는 불필요하지만 CommitProvider 계약을 따르기 위해 빈 문자열을 받는다.
//
// Ollama 의 /api/generate 는 기본적으로 stream 응답이지만 stream:false 옵션으로 단일 JSON 반환 가능.
// 본 도구는 단일 응답만 필요하므로 항상 stream:false 사용.
import type { CommitProvider } from "./types.js";
import { buildPrompt } from "./prompt.js";
import { fetchWithRetry } from "./_retry.js";

const DEFAULT_BASE_URL = "http://localhost:11434";

export const ollamaProvider: CommitProvider = {
  name: "ollama",

  async generate({ diff, model, language, strength, tone, gitmoji, branch, mode, baseUrl, verbose }) {
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/api/generate`;

    const prompt = buildPrompt({ diff, language, strength, tone, gitmoji, branch, mode });
    if (verbose) console.error(`[sm verbose] ollama prompt:\n${prompt}\n---`);

    const body = JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.4,
        // 강도별 출력 토큰 한도 — 한국어는 1.5배.
        num_predict: predictTokens(strength, language === "ko"),
      },
    });

    const res = await fetchWithRetry((signal) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal,
      }),
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { response?: string };
    const out = (data.response ?? "").trim();
    if (verbose) console.error(`[sm verbose] ollama response:\n${out}\n---`);
    return out;
  },
};

function predictTokens(strength: string, ko: boolean): number {
  const base = strength === "simple" ? 120 : strength === "middle" ? 500 : 1000;
  return ko ? Math.round(base * 1.5) : base;
}
