// OpenAI provider 구현. CommitProvider 인터페이스만 만족시키면 됨.
// baseUrl 옵션으로 Azure OpenAI / vLLM / OpenRouter 등 OpenAI 호환 endpoint 도 사용 가능.
import OpenAI from "openai";
import type { CommitProvider } from "./types.js";
import { buildPrompt } from "./prompt.js";

export const openaiProvider: CommitProvider = {
  name: "openai",

  async generate({ diff, model, apiKey, language, strength, tone, gitmoji, branch, mode, baseUrl, verbose, intent, styleHint }) {
    // 매번 새 client 만듦 — apiKey 가 호출마다 달라질 수 있고 (멀티 계정 등)
    // 어차피 한 번만 호출하니 성능 영향 없음.
    const client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    const prompt = buildPrompt({ diff, language, strength, tone, gitmoji, branch, mode, intent, styleHint });
    if (verbose) console.error(`[sm verbose] openai prompt:\n${prompt}\n---`);

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    // OpenAI Responses API 는 output_text 에 최종 텍스트가 들어옴.
    const out = response.output_text.trim();
    if (verbose) console.error(`[sm verbose] openai response:\n${out}\n---`);
    return out;
  },
};
