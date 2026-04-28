// 두 provider 가 공유하는 프롬프트 빌더. 한 곳에서만 수정하도록 분리.
// 언어(ko/en) 와 강도(simple/middle/hard) 에 따라 지시문이 달라짐.
import type { Language, Strength } from "../config.js";

// diff 가 너무 길면 토큰비 폭증 → 앞부분만 사용. 8000 자도 보통 충분.
const DIFF_LIMIT = 8000;

// 강도별 출력 형식 지시문. 모델한테 분명한 형태를 알려주는 게 결과 일관성 핵심.
const STRENGTH_INSTRUCTIONS: Record<Strength, string> = {
  simple: `- 한 줄로만 출력
- 형식: type(scope): summary
- 다른 텍스트 출력 금지`,

  middle: `- 첫 줄: type(scope): summary  (한 줄)
- 빈 줄 한 줄
- 본문: 2~5줄. 각 줄은 짧은 bullet ("- ..." 형태) 또는 평문
- 본문은 "왜" 와 "무엇을" 위주, 구현 세부는 생략`,

  hard: `- 첫 줄: type(scope): summary  (한 줄)
- 빈 줄 한 줄
- 본문 섹션 (간단한 README 수준):
  * 변경 동기 (1~2줄)
  * 주요 변경점 (bullet 3~6개)
  * 영향/주의사항 (있으면 1~2줄)
- 코드 블록/마크다운 헤더는 사용하지 말고 일반 텍스트로`,
};

// 언어별 출력 언어 지시문. ko 면 한국어로, en 이면 영어로.
const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  ko: "- 출력 언어: 한국어 (단, type 이름은 영어 그대로: feat/fix/...)",
  en: "- 출력 언어: 영어",
};

export interface PromptOptions {
  diff: string;
  language: Language;
  strength: Strength;
}

export function buildPrompt({ diff, language, strength }: PromptOptions): string {
  const limited = diff.slice(0, DIFF_LIMIT);

  return `너는 senior software engineer야.
아래 git diff (마지막 커밋 이후 스테이징된 변경분)를 보고 Conventional Commit 형식의 커밋 메시지를 만들어줘.

공통 규칙:
- type 후보: feat, fix, refactor, docs, test, chore, perf, build, style
- 너무 사소한 변경보다 핵심 변경 중심
- 메시지 외 다른 텍스트(설명, 코드블록 표시 등) 절대 금지

${LANGUAGE_INSTRUCTIONS[language]}

출력 형식:
${STRENGTH_INSTRUCTIONS[strength]}

git diff:
${limited}
`;
}
