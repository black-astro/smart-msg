// 모든 AI provider 가 따라야 할 공통 계약.
// router(ai.ts) 는 이 인터페이스만 알고, 실제 구현체(openai.ts, claude.ts) 는 신경 안 씀.
import type { Language, Strength } from "../config.js";

export interface GenerateParams {
  diff: string;
  model: string;
  apiKey: string;
  language: Language;
  strength: Strength;
}

export interface CommitProvider {
  // provider 식별자. 로그/에러 메시지용.
  name: string;

  // 핵심 메서드: diff + 옵션 받아서 커밋 메시지 반환.
  // 모든 인자를 호출 시점에 주입 → provider 객체가 상태를 안 들고 있어서 테스트/교체 쉬움.
  generate(params: GenerateParams): Promise<string>;
}

// 각 provider 가 추천하는 저비용 모델 목록. login 시 사용자에게 선택지로 보여줌.
// 가장 저렴/안정적인 게 맨 앞에 오도록 정렬. gemini/groq 은 무료 티어 모델만 노출.
export const RECOMMENDED_MODELS: Record<"gemini" | "groq" | "openai" | "claude", string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  // Groq 무료 티어 인기 모델. llama-3.1-8b-instant 가 가장 빠르고 commit 메시지엔 충분.
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"],
  openai: ["gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"],
  claude: ["claude-haiku-4-5", "claude-3-5-haiku-latest"],
};
