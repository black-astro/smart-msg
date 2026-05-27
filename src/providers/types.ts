// 모든 AI provider 가 따라야 할 공통 계약.
// router(ai.ts) 는 이 인터페이스만 알고, 실제 구현체(openai.ts, claude.ts) 는 신경 안 씀.
import type { Language, Strength, Tone } from "../config.js";
import type { BranchContext } from "./prompt.js";

export interface GenerateParams {
  diff: string;
  model: string;
  apiKey: string;
  language: Language;
  strength: Strength;
  tone: Tone;
  // gitmoji prefix 사용 여부. 미설정 시 false.
  gitmoji?: boolean;
  // 브랜치/이슈키 컨텍스트. footer 자동 첨부는 router 가, prompt 주입은 buildPrompt 가 담당.
  branch?: BranchContext;
  // PR / split 등 다른 출력 모드. 미설정 시 일반 commit 메시지.
  mode?: "commit" | "pr" | "split";
  // diff 자체를 직접 넘기지 않고 풀 diff (range 등) 를 넘기는 mode 인 경우에도 동일한 GenerateParams 를 재사용.
  // provider 측은 diff 의 의미가 commit/pr/split 중 무엇인지 신경쓰지 않고 그대로 prompt 에 전달한다.
  // OpenAI 호환 endpoint 의 base URL (있다면 사용).
  baseUrl?: string;
  // verbose 출력 여부.
  verbose?: boolean;
  // 사용자가 입력한 "이번 변경의 의도/이유" 한 줄. router → provider → buildPrompt 로 그대로 전달된다.
  // 빈 문자열/undefined 면 의도 블록은 생성되지 않는다.
  intent?: string;
  // 학습된 repo style 의 사람-읽기 가능한 요약. 있으면 prompt 에 별도 블록으로 주입된다.
  styleHint?: string;
  // PII 토큰화 모드. router → provider → buildPrompt 그대로 전달. 미설정 시 'standard'.
  privacyMode?: "off" | "standard" | "strict";
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
// ollama 는 로컬 설치된 모델명을 사용하므로 자주 쓰이는 후보만 추천 (사용자가 직접 입력도 가능).
export const RECOMMENDED_MODELS: Record<
  "gemini" | "groq" | "openai" | "claude" | "ollama",
  string[]
> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  // Groq 무료 티어 인기 모델. llama-3.1-8b-instant 가 가장 빠르고 commit 메시지엔 충분.
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"],
  openai: ["gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"],
  claude: ["claude-haiku-4-5", "claude-3-5-haiku-latest"],
  // ollama 는 사용자 환경에 깔린 모델에 따라 다르므로 가장 흔한 후보만.
  ollama: ["llama3.2", "qwen2.5-coder", "mistral", "phi3"],
};
