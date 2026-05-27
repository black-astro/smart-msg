// 모든 provider 가 공유하는 프롬프트 빌더. 한 곳에서만 수정하도록 분리.
// 언어(ko/en), 강도(simple/middle/hard), 톤(report/polite) 에 따라 지시문이 달라진다.
import type { Language, Strength, Tone } from "../config.js";
import { prepareDiff } from "../diffUtils.js";

// diff 가 너무 길면 토큰비 폭증 → 앞부분만 사용. 8000 자도 보통 충분.
// 큰 PR/feature 변경에서는 diffUtils.condenseDiff 가 파일별로 앞부분을 분할 채택한다.
const DIFF_LIMIT = 8000;
import type { PrivacyMode } from "../privacyTokenizer.js";

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

// gitmoji prefix. true 일 경우 첫 줄 type 앞에 이모지를 붙이도록 지시.
// 이모지는 conventional commit 의 'type' 매핑이 사실상 표준 (https://gitmoji.dev) 이라 그것을 따른다.
const GITMOJI_INSTRUCTION = `- 첫 줄의 type 앞에 다음 매핑에 따라 이모지를 한 개 붙이세요:
    feat → ✨, fix → 🐛, docs → 📝, refactor → ♻️, perf → ⚡️, test → ✅,
    chore → 🔧, build → 📦, style → 💄
- 예: "✨ feat(auth): add OAuth login flow"`;

export interface BranchContext {
  // 현재 브랜치명. 없으면 미지정.
  name?: string;
  // 브랜치명에서 추출한 이슈 키 (예: AUTH-123). 없으면 미지정.
  issueKey?: string;
}

export interface PromptOptions {
  diff: string;
  language: Language;
  strength: Strength;
  tone: Tone;
  gitmoji?: boolean;
  branch?: BranchContext;
  // PR 본문 / amend 처럼 commit 메시지가 아닌 다른 출력을 만들 때 모드를 바꾸기 위한 옵션.
  // 미설정 시 'commit'.
  mode?: "commit" | "pr" | "split";
  // 사용자가 직접 입력한 "이번 변경의 의도/이유" 한 줄.
  // diff 만으로는 잡히지 않는 "왜" 를 모델에 명시적으로 전달하여
  // 본문의 동기(motivation) 부분을 정확히 작성하도록 가이드한다.
  // 미설정/빈 문자열이면 의도 블록을 생략한다.
  intent?: string;
  // 학습된 repo style 의 사람-읽기 가능한 요약 (formatStyleForPrompt 출력).
  // 있으면 prompt 에 별도 블록으로 주입한다.
  styleHint?: string;
  // PII 토큰화 모드. 미설정 시 'standard' (diffUtils.prepareDiff 의 기본값).
  privacyMode?: PrivacyMode;
}

export function buildPrompt({
  diff,
  language,
  strength,
  tone,
  gitmoji = false,
  branch,
  mode = "commit",
  intent,
  styleHint,
  privacyMode,
}: PromptOptions): string {
  const prepared = prepareDiff(diff, DIFF_LIMIT, privacyMode ?? "standard");

  if (mode === "pr") {
    return buildPrPrompt({ diff: prepared.text, language, branch });
  }
  if (mode === "split") {
    return buildSplitPrompt({ diff: prepared.text, language });
  }

  // 한국어 출력에서만 톤 지시 추가. 영어는 별도 톤 지시 없이 imperative 표준 따름.
  const toneBlock =
    language === "ko"
      ? `\n본문 톤 (한국어 출력):\n${TONE_INSTRUCTIONS_KO[tone]}\n`
      : "";

  const gitmojiBlock = gitmoji ? `\ngitmoji:\n${GITMOJI_INSTRUCTION}\n` : "";

  const branchBlock = buildBranchBlock(branch);

  const intentBlock = buildIntentBlock(intent, strength);

  const styleBlock = buildStyleBlock(styleHint);

  const noticeBlock = buildNoticeBlock(prepared);

  return `너는 senior software engineer야.
아래 git diff (마지막 커밋 이후 스테이징된 변경분)를 보고 Conventional Commit 형식의 커밋 메시지를 만들어줘.

공통 규칙:
- type 후보: feat, fix, refactor, docs, test, chore, perf, build, style
- 너무 사소한 변경보다 핵심 변경 중심
- 메시지 외 다른 텍스트(설명, 코드블록 표시 등) 절대 금지

${LANGUAGE_INSTRUCTIONS[language]}
${toneBlock}${gitmojiBlock}${branchBlock}${intentBlock}${styleBlock}출력 형식:
${STRENGTH_INSTRUCTIONS[strength]}
${noticeBlock}
git diff:
${prepared.text}
`;
}

// 사용자 의도(why)를 prompt 에 명시 주입.
// strength 가 simple (한 줄) 이면 본문 자체가 없으므로 의도는 summary 에 녹여 쓰도록 지시한다.
// middle/hard 면 본문의 "변경 동기" 영역을 사용자 표현으로 채우도록 지시.
// 빈 문자열/공백만/undefined → 블록 자체를 생성하지 않음 (모델이 "(사용자 입력 없음)" 같은 표현을 본문에 그대로 적는 사고 방지).
function buildIntentBlock(intent: string | undefined, strength: Strength): string {
  if (!intent) return "";
  const trimmed = intent.trim();
  if (!trimmed) return "";
  // 모델이 본문에 그대로 따옴표로 복사하지 않도록 명시. 또한 사용자가 적은 표현을 본문 "동기" 의 근거로 쓰되,
  // 사실 검증은 diff 와 교차로 — 둘이 모순되면 diff 우선이라고 알려준다.
  const guidance =
    strength === "simple"
      ? "- summary (한 줄) 에 사용자 의도를 자연스럽게 반영하되, 그대로 인용하지 마세요."
      : "- 본문의 '변경 동기' / 첫 bullet 에 사용자 의도를 핵심 근거로 반영하세요.\n- 따옴표로 그대로 복사하지 말고 자연스러운 commit 본문 표현으로 풀어쓰세요.\n- 사용자 의도와 diff 가 모순될 경우 diff 의 실제 변경을 우선합니다 (의도는 보조 정보).";
  return `\n사용자 의도 (이번 변경의 \"왜\"):\n- "${trimmed}"\n${guidance}\n`;
}

// 학습된 repo style 블록.
// styleHint 가 비어있거나 undefined 이면 블록 자체 생성 안 함.
function buildStyleBlock(styleHint: string | undefined): string {
  if (!styleHint) return "";
  return `\n${styleHint}\n`;
}

function buildBranchBlock(branch?: BranchContext): string {
  if (!branch?.name && !branch?.issueKey) return "";
  const parts: string[] = ["\n브랜치 컨텍스트:"];
  if (branch.name) parts.push(`- 현재 브랜치명: ${branch.name}`);
  if (branch.issueKey) parts.push(`- 추출된 이슈 키: ${branch.issueKey} (이 정보는 footer 에 자동 추가되므로 본문에 다시 적지 마세요)`);
  return `${parts.join("\n")}\n`;
}

function buildNoticeBlock(prepared: { masked: boolean; truncated: boolean; piiTokenized?: number }): string {
  const lines: string[] = [];
  if (prepared.masked) lines.push("- 일부 라인은 [REDACTED] 로 치환되어 있습니다 (민감정보 마스킹). 마스킹된 값에 대한 추측은 하지 마세요.");
  if (prepared.piiTokenized && prepared.piiTokenized > 0) {
    lines.push("- 일부 식별자가 <EMAIL_N> / <URL_AUTH_N> / <UUID_N> / <IP_N> / <CC_N> / <PHONE_N> / <JWT_N> / <BEARER_N> / <URL_N> 형태의 토큰으로 치환되어 있습니다. 토큰을 원본처럼 추측하지 말고, 본문에서 필요하면 그대로 토큰을 사용하세요.");
  }
  if (prepared.truncated) lines.push("- 본 diff 는 길이 제한으로 일부가 축약되었습니다.");
  if (lines.length === 0) return "";
  return `\n주의:\n${lines.join("\n")}\n`;
}

// PR 본문 생성 프롬프트. summary + 변경점 + 테스트 plan 까지.
function buildPrPrompt(opts: { diff: string; language: Language; branch?: BranchContext }): string {
  const lang = opts.language === "ko" ? "한국어" : "영어";
  const branchBlock = buildBranchBlock(opts.branch);
  return `너는 senior software engineer야.
아래 git diff (이번 PR 의 모든 변경) 를 읽고 PR 본문을 ${lang}로 작성해줘.

출력 형식:
## Summary
- 3~6개 bullet. 변경 동기 / 핵심 변경 / 영향 위주.

## Test plan
- 사용자가 이 PR 을 검증할 수 있는 체크리스트. "[ ] ..." 형태로 3~6개.

규칙:
- 마크다운 헤더 (##) 를 그대로 사용.
- 다른 텍스트 (설명, 코드블록 fence 등) 절대 추가 금지.
${branchBlock}
git diff:
${opts.diff}
`;
}

// diff 분할 제안 프롬프트.
// 모델이 "현재 staged 변경을 의미 단위로 묶어보면 어떤 commit 들로 나눌 수 있을지" 를 제안한다.
// 실제 split 은 사용자가 수동으로 git reset + git add 로 처리해야 한다 (자동 split 은 위험하므로 안내만).
function buildSplitPrompt(opts: { diff: string; language: Language }): string {
  const lang = opts.language === "ko" ? "한국어" : "영어";
  return `너는 senior software engineer야.
아래 git diff 는 한 번의 commit 으로 묶기엔 너무 큰 것 같다. 의미 단위로 나누면 어떤 commit 들이 좋을지 ${lang}로 제안해줘.

출력 형식 (정확히 이 구조):
제안: N 개의 commit 으로 분할 권장

[1] feat(scope): ...
파일:
  - path/to/file1
  - path/to/file2
이유: 한 줄

[2] fix(scope): ...
파일:
  - path/to/file3
이유: 한 줄

... (필요 시 더)

규칙:
- 각 commit 은 1줄 요약 + 영향 파일 목록 + 한 줄 이유로만 구성.
- 코드블록 / 마크다운 헤더 사용 금지.
- 마지막에 "다음 단계:" 섹션에서 사용자에게 git reset → 파일별 git add 절차를 안내.

git diff:
${opts.diff}
`;
}
