// 모든 provider 가 공유하는 프롬프트 빌더. 한 곳에서만 수정하도록 분리.
// 언어(ko/en), 강도(simple/middle/hard), 톤(report/polite) 에 따라 지시문이 달라진다.
import type { Language, Strength, Tone } from "../config.js";

// diff 가 너무 길면 토큰비 폭증 → 앞부분만 사용. 8000 자도 보통 충분.
const DIFF_LIMIT = 8000;

// 강도별 출력 형식 지시문. 모델한테 분명한 형태를 알려주는 게 결과 일관성 핵심.
// middle/hard 는 작은 변경에서도 모델이 본문을 생략하지 않도록 "본문 생략은 잘못된 응답" 을 명시한다.
const STRENGTH_INSTRUCTIONS: Record<Strength, string> = {
  simple: `- 한 줄로만 출력
- 형식: type(scope): summary
- 다른 텍스트 출력 금지`,

  middle: `반드시 다음 구조로 출력하세요. 본문 생략은 잘못된 응답입니다.
- 첫 줄: type(scope): summary  (한 줄)
- 빈 줄 한 줄
- 본문: 정확히 2~5줄. 각 줄은 bullet ("- ..." 형태)
- 변경이 작아 보이더라도 변경 동기 1줄 + 주요 변경 1~3줄을 반드시 포함
- "왜" 와 "무엇을" 위주, 구현 세부는 생략
- 첫 줄만 출력하고 끝내면 잘못된 응답입니다`,

  hard: `반드시 다음 구조로 출력하세요. 본문 섹션 누락은 잘못된 응답입니다.
- 첫 줄: type(scope): summary  (한 줄)
- 빈 줄 한 줄
- 본문 섹션 (간단한 README 수준):
  * 변경 동기 (1~2줄)
  * 주요 변경점 (bullet 3~6개)
  * 영향/주의사항 (있으면 1~2줄)
- 코드 블록/마크다운 헤더는 사용하지 말고 일반 텍스트로
- 변경이 작아 보여도 위 세 섹션을 모두 채울 것`,
};

// 언어별 출력 언어 지시문. ko 면 한국어로, en 이면 영어로.
const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  ko: "- 출력 언어: 한국어 (단, type 이름은 영어 그대로: feat/fix/...)",
  en: "- 출력 언어: 영어",
};

// 한국어 출력 시 본문 톤 지시문.
// 영어는 commit 메시지가 imperative 가 표준이라 톤 옵션이 의미 없으므로 영어에는 적용하지 않는다.
const TONE_INSTRUCTIONS_KO: Record<Tone, string> = {
  report: `- 본문 종결은 명사형 또는 음슴체 (예: "메뉴 항목 추가", "엔드포인트 분리", "스레드 풀 제거. 필요 시 추후 확장.")
- "합니다", "했습니다", "있습니다", "됩니다" 같은 정중체 종결어미 사용 금지
- 마침표는 있어도 되고 없어도 됨. 간결한 기술 보고서 톤
- 좋은 예: "권한 관리 화면에 메뉴 항목과 권한 정의 추가"
- 좋은 예: "/ci-list 의 pageType switch 를 개별 엔드포인트로 분리"
- 좋은 예: "단일/벌크/열람 구분은 요청 바디의 isBulk / isReadSample 플래그로 결정"
- 나쁜 예: "권한 관리 화면에 메뉴 항목을 추가했습니다."
- 나쁜 예: "엔드포인트로 분리하기 위해 변경했습니다."`,

  polite: `- 본문은 정중체("~했습니다", "~합니다") 사용 가능
- 격식 있는 글말 톤`,
};

export interface PromptOptions {
  diff: string;
  language: Language;
  strength: Strength;
  tone: Tone;
}

export function buildPrompt({ diff, language, strength, tone }: PromptOptions): string {
  const limited = diff.slice(0, DIFF_LIMIT);

  // 한국어 출력에서만 톤 지시 추가. 영어는 별도 톤 지시 없이 imperative 표준 따름.
  const toneBlock =
    language === "ko"
      ? `\n본문 톤 (한국어 출력):\n${TONE_INSTRUCTIONS_KO[tone]}\n`
      : "";

  return `너는 senior software engineer야.
아래 git diff (마지막 커밋 이후 스테이징된 변경분)를 보고 Conventional Commit 형식의 커밋 메시지를 만들어줘.

공통 규칙:
- type 후보: feat, fix, refactor, docs, test, chore, perf, build, style
- 너무 사소한 변경보다 핵심 변경 중심
- 메시지 외 다른 텍스트(설명, 코드블록 표시 등) 절대 금지

${LANGUAGE_INSTRUCTIONS[language]}
${toneBlock}
출력 형식:
${STRENGTH_INSTRUCTIONS[strength]}

git diff:
${limited}
`;
}
