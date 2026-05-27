// 사용자 facing 메시지의 영어/한국어 사전.
// 기본 표시는 영어이며, sm login 의 첫 단계에서 사용자가 한국어를 선택하면 이후 prompt 가 한국어로 전환된다.
//
// 설계 의도:
//   - 코드 호출부는 t(lang).key 형태로 단순하게 사용한다.
//   - 키는 의미 단위로만 두고, 동적 치환이 필요한 경우 함수로 정의한다.
//   - 사전을 별도 파일로 분리해 메시지 수정 시 다른 로직을 건드리지 않게 한다.
import type { Language } from "./config.js";

export interface Messages {
  // 언어 선택 — 항상 영어 라벨로 표시.
  chooseLanguagePrompt: string;
  langOptionEn: string;
  langOptionKo: string;

  chooseProvider: string;
  providerGeminiLabel: string;
  providerGroqLabel: string;
  providerOpenaiLabel: string;
  providerClaudeLabel: string;
  providerOllamaLabel: string;

  chooseModelDefault: string;
  chooseModelGemini: string;
  chooseModelOllama: string;
  modelCustomEntry: string;
  enterCustomModel: string;
  ollamaEnterBaseUrl: string;

  chooseStrength: string;
  strengthSimple: string;
  strengthMiddle: string;
  strengthHard: string;

  paidNoticeLine1: (label: string) => string;
  paidNoticeLine2: string;
  paidNoticeLine3: string;
  paidNoticeLine4: string;

  openingBrowser: (url: string) => string;
  browserOpenFailed: string;

  securityNotice: string;
  enterApiKey: string;
  keyEmptyCancelled: string;

  loginCompleted: string;

  globalHookIntro1: string;
  globalHookIntro2: string;
  globalHookConfirm: string;
  globalHookInstalled: string;
  globalHookInstalledHint: string;
  globalHookSkipped: string;
  globalHookSkippedTip: string;

  askYesNoInvalid: string;
  askChoiceInvalid: (keys: string) => string;
  cancelled: string;

  // sm config 에서 사용.
  configHeader: string;
  configCurrentProvider: (v: string) => string;
  configCurrentModel: (v: string) => string;
  configCurrentLanguage: (v: string) => string;
  configCurrentStrength: (v: string) => string;
  configCurrentPath: (v: string) => string;
  configChooseTarget: string;
  configTargetLanguage: string;
  configTargetStrength: string;
  configTargetModel: string;
  configTargetCancel: string;
  configChangedLanguage: (v: string) => string;
  configChangedStrength: (v: string) => string;
  configChangedModel: (v: string) => string;
  configChooseModelOf: (provider: string) => string;
  configEnterModel: (provider: string) => string;
  configTargetOnFailure: string;
  configCurrentOnFailure: (v: string) => string;
  configChooseOnFailure: string;
  onFailureFallback: string;
  onFailureAbort: string;
  configChangedOnFailure: (v: string) => string;

  configTargetTone: string;
  configCurrentTone: (v: string) => string;
  configChooseTone: string;
  toneReport: string;
  tonePolite: string;
  configChangedTone: (v: string) => string;

  configTargetGitmoji: string;
  configCurrentGitmoji: (v: string) => string;
  configChooseGitmoji: string;
  configChangedGitmoji: (v: string) => string;

  configTargetAutoIssue: string;
  configCurrentAutoIssue: (v: string) => string;
  configChooseAutoIssue: string;
  configChangedAutoIssue: (v: string) => string;

  configTargetFallback: string;
  configCurrentFallback: (v: string) => string;
  configChooseFallback: string;
  configChangedFallback: (v: string) => string;

  configTargetVerbose: string;
  configCurrentVerbose: (v: string) => string;
  configChooseVerbose: string;
  configChangedVerbose: (v: string) => string;

  configTargetBaseUrl: string;
  configBaseUrlNotApplicable: (provider: string) => string;
  configEnterBaseUrl: (provider: string, current: string) => string;
  configChangedBaseUrl: (v: string) => string;

  // hook 실패 안내.
  hookFailureCommentIntro: string;
  hookFailureCommentCause: (cause: string) => string;

  // sm c / sm amend 에서 사용.
  noStagedChanges: string;
  generatedMessageHeader: string;
  commitChoicePrompt: string;
  commitChoiceYes: string;
  commitChoiceRegen: string;
  commitChoiceEdit: string;
  commitChoiceNo: string;
  regenerating: string;
  regenLimitReached: string;
  dryRunFinished: string;

  // 의도(intent) 입력 단계.
  intentAskHint: string;
  intentAskPrompt: string;
  intentAlwaysEmptyRetry: string;
  intentAccepted: (text: string) => string;
  intentSkippedHint: string;

  // sm config 에서 captureIntent 변경.
  configTargetCaptureIntent: string;
  configCurrentCaptureIntent: (v: string) => string;
  configChooseCaptureIntent: string;
  captureIntentAsk: string;
  captureIntentAlways: string;
  captureIntentNever: string;
  configChangedCaptureIntent: (v: string) => string;

  // 위험도 평가 (P2).
  riskHeader: string;
  riskScoreLine: (bar: string) => string;
  riskReasonLine: (reason: string) => string;
  riskTimeWarning: (warnings: string) => string;
  riskHighConfirm: string;
  riskBlocked: string;
  riskSkipped: string;

  // sm config 에서 riskCheck 변경.
  configTargetRiskCheck: string;
  configCurrentRiskCheck: (v: string) => string;
  configChooseRiskCheck: string;
  riskCheckWarn: string;
  riskCheckOn: string;
  riskCheckOff: string;
  configChangedRiskCheck: (v: string) => string;

  // sm amend.
  amendNoLastDiff: string;
  amendGeneratedHeader: string;
  amendChoicePrompt: string;
  amendChoiceYes: string;

  // sm pr.
  prNoBase: string;
  prNoDiff: (base: string) => string;
  prHint: string;

  // sm split.
  splitHeader: string;
  splitFooterHint: string;

  // 선택 메뉴에서 현재 설정값 옆에 붙이는 마커.
  currentMarker: string;
}

const en: Messages = {
  chooseLanguagePrompt: "Choose your language",
  langOptionEn: "English (en)",
  langOptionKo: "한국어 (ko)",

  chooseProvider: "Choose AI provider",
  providerGeminiLabel: "Google Gemini  - Free tier (may return 503 under high demand)",
  providerGroqLabel:   "Groq (Llama)   - Free tier, fast & stable (recommended for free use)",
  providerOpenaiLabel: "OpenAI (GPT)   - Pay-as-you-go (paid)",
  providerClaudeLabel: "Anthropic Claude - Pay-as-you-go (paid)",
  providerOllamaLabel: "Ollama (local)  - Local LLM, no API key required",

  chooseModelDefault: "Choose a model (cheapest first)",
  chooseModelGemini: "Choose a model (free tier available)",
  chooseModelOllama: "Choose an Ollama model (or enter custom)",
  modelCustomEntry: "(enter a custom model name)",
  enterCustomModel: "Enter the model name installed in your Ollama",
  ollamaEnterBaseUrl: "Enter Ollama base URL (default: http://localhost:11434)",

  chooseStrength: "Choose message strength (length and detail level)",
  strengthSimple: "simple - one line (Conventional Commit)",
  strengthMiddle: "middle - first line + 2-5 body lines",
  strengthHard:   "hard   - first line + README-level body",

  paidNoticeLine1: (label) => `[Notice] ${label} API is pay-as-you-go.`,
  paidNoticeLine2: "         ChatGPT Plus / Claude Max subscriptions do NOT cover API calls.",
  paidNoticeLine3: "         You must register a card or top up credits in the provider console.",
  paidNoticeLine4: "         To use it for free, choose 'Google Gemini', 'Groq', or 'Ollama' instead.",

  openingBrowser: (url) => `\nOpening API key issuance page in your browser: ${url}`,
  browserOpenFailed: "(Failed to open browser automatically. Please open the URL above manually.)",

  securityNotice: "(Security notice) Your key will be shown on screen. Cover the screen if others are nearby.",
  enterApiKey: "Enter the issued API key",
  keyEmptyCancelled: "No key entered. Cancelled.",

  loginCompleted: "\nAccount setup completed.",

  globalHookIntro1: "To enable automatic message generation in every git repository with just 'git commit',",
  globalHookIntro2: "smart-msg can install a global git hook. This is applied once for your user environment.",
  globalHookConfirm: "Install the global hook?",
  globalHookInstalled: "\nInstallation completed. From any git repository, the following commands will auto-generate messages:",
  globalHookInstalledHint: "Run `sm config` to change settings later.",
  globalHookSkipped: "\nGlobal hook installation skipped.",
  globalHookSkippedTip: "Use `sm c` from the command line, or re-run `sm login` later to set it up.",

  askYesNoInvalid: "Only y / Y / n / N or empty input (Enter) is allowed.",
  askChoiceInvalid: (keys) => `Please enter one of: ${keys} (or Enter for default).`,
  cancelled: "Cancelled.",

  configHeader: "Current settings:",
  configCurrentProvider: (v) => `  provider : ${v}`,
  configCurrentModel:    (v) => `  model    : ${v}`,
  configCurrentLanguage: (v) => `  language : ${v}`,
  configCurrentStrength: (v) => `  strength : ${v}`,
  configCurrentPath:     (v) => `  config   : ${v}`,
  configChooseTarget: "Choose what to change",
  configTargetLanguage: "language (commit message output language)",
  configTargetStrength: "strength (message strength)",
  configTargetModel: "model (model of current provider)",
  configTargetCancel: "cancel",
  configChangedLanguage: (v) => `language changed to ${v}.`,
  configChangedStrength: (v) => `strength changed to ${v}.`,
  configChangedModel:    (v) => `model changed to ${v}.`,
  configChooseModelOf: (provider) => `Choose ${provider} model`,
  configEnterModel: (provider) => `Enter the ${provider} model name`,
  configTargetOnFailure: "on-failure (behavior when AI call fails)",
  configCurrentOnFailure: (v) => `  on-failure: ${v}`,
  configChooseOnFailure: "Choose hook behavior when AI call fails",
  onFailureFallback: "fallback - open editor with empty template (write manually)",
  onFailureAbort: "abort   - leave message empty so git aborts the commit",
  configChangedOnFailure: (v) => `on-failure changed to ${v}.`,

  configTargetTone: "tone (Korean output ending style)",
  configCurrentTone: (v) => `  tone     : ${v}`,
  configChooseTone: "Choose Korean output tone (no effect on English)",
  toneReport: "report - noun-form / informal (e.g. \"메뉴 항목 추가\")",
  tonePolite: "polite - formal endings (e.g. \"~했습니다\", \"~합니다\")",
  configChangedTone: (v) => `tone changed to ${v}.`,

  configTargetGitmoji: "gitmoji (prefix commit type with an emoji)",
  configCurrentGitmoji: (v) => `  gitmoji  : ${v}`,
  configChooseGitmoji: "Use gitmoji prefix (e.g. \"✨ feat: ...\")?",
  configChangedGitmoji: (v) => `gitmoji turned ${v}.`,

  configTargetAutoIssue: "autoIssue (extract issue key from branch and append Refs:)",
  configCurrentAutoIssue: (v) => `  autoIssue: ${v}`,
  configChooseAutoIssue: "Auto-append 'Refs: <KEY>' from branch name (e.g. AUTH-123-...)?",
  configChangedAutoIssue: (v) => `autoIssue turned ${v}.`,

  configTargetFallback: "fallback (provider to try when the primary one fails)",
  configCurrentFallback: (v) => `  fallback : ${v}`,
  configChooseFallback: "Choose fallback provider (used when the primary one fails)",
  configChangedFallback: (v) => `fallback set to ${v}.`,

  configTargetVerbose: "verbose (print prompt/response to stderr)",
  configCurrentVerbose: (v) => `  verbose  : ${v}`,
  configChooseVerbose: "Print prompt/response to stderr for debugging?",
  configChangedVerbose: (v) => `verbose turned ${v}.`,

  configTargetBaseUrl: "baseUrl (custom endpoint for openai/ollama)",
  configBaseUrlNotApplicable: (p) => `Custom baseUrl is only applicable to 'openai' or 'ollama'. Current provider: ${p}`,
  configEnterBaseUrl: (p, cur) => `Enter base URL for ${p} (current: ${cur}; empty = default)`,
  configChangedBaseUrl: (v) => `baseUrl changed to ${v}.`,

  hookFailureCommentIntro: "smart-msg: AI message generation failed. Write manually here, or run `sm c` to retry.",
  hookFailureCommentCause: (cause) => `cause: ${cause}`,

  noStagedChanges: "No staged changes. Please run 'git add' first.",
  generatedMessageHeader: "Generated commit message:",
  commitChoicePrompt: "Proceed with this commit?",
  commitChoiceYes: "commit as-is",
  commitChoiceRegen: "regenerate the message",
  commitChoiceEdit: "open editor to edit then commit",
  commitChoiceNo: "cancel",
  regenerating: "Regenerating...",
  regenLimitReached: "Reached regeneration limit. Cancelled.",
  dryRunFinished: "(dry-run) Skipping git commit.",

  intentAskHint: "(Optional) One line on WHY you're making this change. Empty to skip.",
  intentAskPrompt: "Intent (why)",
  intentAlwaysEmptyRetry: "Intent is required (captureIntent=always). Please type one line, or run with --no-intent to skip.",
  intentAccepted: (text) => `Intent recorded: "${text}"`,
  intentSkippedHint: "(no intent — generating from diff only)",

  configTargetCaptureIntent: "captureIntent (ask 'why' before generating commit message)",
  configCurrentCaptureIntent: (v) => `  intent   : ${v}`,
  configChooseCaptureIntent: "When should `sm c` ask for the change intent?",
  captureIntentAsk: "ask    - prompt every time, empty Enter to skip (default)",
  captureIntentAlways: "always - require a non-empty intent (strong self-discipline mode)",
  captureIntentNever: "never  - never prompt (use --intent or SM_INTENT env to provide)",
  configChangedCaptureIntent: (v) => `captureIntent changed to ${v}.`,

  riskHeader: "Risk assessment:",
  riskScoreLine: (bar) => `  score  : ${bar}`,
  riskReasonLine: (reason) => `  - ${reason}`,
  riskTimeWarning: (warnings) => `  time   : ⚠ dangerous time window (${warnings})`,
  riskHighConfirm: "High-risk commit detected. Proceed anyway?",
  riskBlocked: "Cancelled due to high-risk commit.",
  riskSkipped: "(risk check skipped)",

  configTargetRiskCheck: "riskCheck (assess change risk before committing)",
  configCurrentRiskCheck: (v) => `  risk     : ${v}`,
  configChooseRiskCheck: "How should `sm c` handle high-risk changes?",
  riskCheckWarn: "warn - score 4+ only confirms during dangerous time window (default)",
  riskCheckOn:   "on   - score 4+ always confirms",
  riskCheckOff:  "off  - do not assess risk at all",
  configChangedRiskCheck: (v) => `riskCheck changed to ${v}.`,

  amendNoLastDiff: "No diff found for the last commit (root commit or merge). Aborted.",
  amendGeneratedHeader: "Generated commit message (for amend):",
  amendChoicePrompt: "Amend last commit with this message?",
  amendChoiceYes: "amend as-is",

  prNoBase: "Could not detect base ref (origin/main / main / master / develop). Specify with --base.",
  prNoDiff: (base) => `No diff between ${base} and HEAD. Nothing to PR.`,
  prHint: "(Tip) Pipe into gh: sm pr | gh pr create --body-file -",

  splitHeader: "Suggested commit split:",
  splitFooterHint: "Follow the steps above with 'git reset HEAD <file>' + 'git add <file>' per group, then 'sm c'.",

  currentMarker: "  ★ (current)",
};

const ko: Messages = {
  chooseLanguagePrompt: "언어를 선택하세요",
  langOptionEn: "English (en)",
  langOptionKo: "한국어 (ko)",

  chooseProvider: "사용할 AI provider 를 선택합니다",
  providerGeminiLabel: "Google Gemini  — 무료 티어 (트래픽 몰리면 503 응답 잦음)",
  providerGroqLabel:   "Groq (Llama)   — 무료 티어, 빠르고 안정적 (무료 사용 권장)",
  providerOpenaiLabel: "OpenAI (GPT)   — API 사용량 만큼 과금 (유료)",
  providerClaudeLabel: "Anthropic Claude — API 사용량 만큼 과금 (유료)",
  providerOllamaLabel: "Ollama (로컬)   — 로컬 LLM, API 키 불필요",

  chooseModelDefault: "모델을 선택합니다. (저비용 순)",
  chooseModelGemini: "모델을 선택합니다. (무료 티어 사용 가능)",
  chooseModelOllama: "Ollama 모델을 선택합니다. (직접 입력도 가능)",
  modelCustomEntry: "(직접 입력)",
  enterCustomModel: "Ollama 에 설치된 모델명을 입력하시기 바랍니다.",
  ollamaEnterBaseUrl: "Ollama base URL 을 입력합니다. (기본: http://localhost:11434)",

  chooseStrength: "메시지 강도를 선택합니다. (길이 및 상세도)",
  strengthSimple: "simple — 한 줄 (Conventional Commit)",
  strengthMiddle: "middle — 첫 줄 + 본문 2~5줄",
  strengthHard:   "hard   — 첫 줄 + README 수준 본문",

  paidNoticeLine1: (label) => `[안내] ${label} API 는 사용량 기반 종량제입니다.`,
  paidNoticeLine2: "       ChatGPT Plus / Claude Max 등의 구독 결제로는 API 호출이 동작하지 않으며,",
  paidNoticeLine3: "       콘솔에서 별도로 카드 등록 또는 크레딧 충전이 필요합니다.",
  paidNoticeLine4: "       무료로 사용하시려면 'Google Gemini', 'Groq', 'Ollama' 중 하나를 선택하시기 바랍니다.",

  openingBrowser: (url) => `\n브라우저에서 API 키 발급 페이지를 엽니다: ${url}`,
  browserOpenFailed: "(브라우저 자동 오픈에 실패하였습니다. 위 URL 을 직접 열어주시기 바랍니다.)",

  securityNotice: "(보안 안내) 입력하신 키가 화면에 그대로 표시됩니다. 주변에 사람이 있으면 화면을 잠시 가려주세요.",
  enterApiKey: "발급된 API 키를 입력합니다.",
  keyEmptyCancelled: "키가 입력되지 않아 취소되었습니다.",

  loginCompleted: "\n계정 설정이 완료되었습니다.",

  globalHookIntro1: "이제 모든 git 저장소에서 'git commit' 만으로 자동 메시지 생성을 사용할 수 있도록",
  globalHookIntro2: "글로벌 git hook 을 설치합니다. 이 설정은 사용자 환경 전체에 한 번만 적용됩니다.",
  globalHookConfirm: "글로벌 hook 을 설치하시겠습니까?",
  globalHookInstalled: "\n설치가 완료되었습니다. 어떤 git 저장소에서든 다음 명령만으로 자동 메시지가 생성됩니다.",
  globalHookInstalledHint: "설정 변경은 `sm config` 명령으로 수행합니다.",
  globalHookSkipped: "\n글로벌 hook 설치를 건너뛰었습니다.",
  globalHookSkippedTip: "명령줄에서 `sm c` 로 사용하시거나, 추후 `sm login` 을 다시 실행하여 설정할 수 있습니다.",

  askYesNoInvalid: "y / Y / n / N 또는 빈 입력(Enter) 만 입력 가능합니다.",
  askChoiceInvalid: (keys) => `다음 중 하나만 입력 가능합니다: ${keys} (또는 Enter 로 기본값).`,
  cancelled: "취소되었습니다.",

  configHeader: "현재 설정:",
  configCurrentProvider: (v) => `  provider : ${v}`,
  configCurrentModel:    (v) => `  model    : ${v}`,
  configCurrentLanguage: (v) => `  language : ${v}`,
  configCurrentStrength: (v) => `  strength : ${v}`,
  configCurrentPath:     (v) => `  config   : ${v}`,
  configChooseTarget: "변경할 항목을 선택합니다.",
  configTargetLanguage: "language (커밋 메시지 출력 언어)",
  configTargetStrength: "strength (메시지 강도)",
  configTargetModel: "model (현재 provider 의 모델)",
  configTargetCancel: "취소",
  configChangedLanguage: (v) => `language 가 ${v} 로 변경되었습니다.`,
  configChangedStrength: (v) => `strength 가 ${v} 로 변경되었습니다.`,
  configChangedModel:    (v) => `model 이 ${v} 로 변경되었습니다.`,
  configChooseModelOf: (provider) => `${provider} 의 모델을 선택합니다.`,
  configEnterModel: (provider) => `${provider} 모델명을 입력합니다.`,
  configTargetOnFailure: "on-failure (AI 호출 실패 시 동작)",
  configCurrentOnFailure: (v) => `  on-failure: ${v}`,
  configChooseOnFailure: "AI 호출 실패 시의 hook 동작을 선택합니다.",
  onFailureFallback: "fallback - 안내가 담긴 빈 템플릿으로 에디터 열기 (직접 작성)",
  onFailureAbort: "abort    - 메시지를 비워둬 git 이 commit 자체를 취소",
  configChangedOnFailure: (v) => `on-failure 가 ${v} 로 변경되었습니다.`,

  configTargetTone: "tone (한국어 출력 종결 톤)",
  configCurrentTone: (v) => `  tone     : ${v}`,
  configChooseTone: "한국어 출력 톤을 선택합니다. (영어 출력에는 영향 없음)",
  toneReport: "report - 명사형/음슴체 (예: \"메뉴 항목 추가\", \"엔드포인트 분리\")",
  tonePolite: "polite - 정중체 (예: \"~했습니다\", \"~합니다\")",
  configChangedTone: (v) => `tone 이 ${v} 로 변경되었습니다.`,

  configTargetGitmoji: "gitmoji (commit type 앞에 이모지 prefix)",
  configCurrentGitmoji: (v) => `  gitmoji  : ${v}`,
  configChooseGitmoji: "gitmoji prefix 를 사용하시겠습니까? (예: \"✨ feat: ...\")",
  configChangedGitmoji: (v) => `gitmoji 가 ${v} 로 변경되었습니다.`,

  configTargetAutoIssue: "autoIssue (브랜치명에서 이슈키 추출 후 Refs: 자동 첨부)",
  configCurrentAutoIssue: (v) => `  autoIssue: ${v}`,
  configChooseAutoIssue: "브랜치명(AUTH-123-...) 에서 추출한 이슈키를 'Refs:' footer 로 자동 추가하시겠습니까?",
  configChangedAutoIssue: (v) => `autoIssue 가 ${v} 로 변경되었습니다.`,

  configTargetFallback: "fallback (메인 provider 실패 시 대체 provider)",
  configCurrentFallback: (v) => `  fallback : ${v}`,
  configChooseFallback: "메인 provider 실패 시 자동으로 시도할 폴백 provider 를 선택합니다.",
  configChangedFallback: (v) => `fallback 이 ${v} 로 변경되었습니다.`,

  configTargetVerbose: "verbose (prompt / 응답 stderr 출력)",
  configCurrentVerbose: (v) => `  verbose  : ${v}`,
  configChooseVerbose: "디버그용으로 prompt / 응답을 stderr 에 출력하시겠습니까?",
  configChangedVerbose: (v) => `verbose 가 ${v} 로 변경되었습니다.`,

  configTargetBaseUrl: "baseUrl (openai/ollama custom endpoint)",
  configBaseUrlNotApplicable: (p) => `baseUrl 은 'openai' 또는 'ollama' provider 에만 적용됩니다. 현재: ${p}`,
  configEnterBaseUrl: (p, cur) => `${p} 의 base URL 을 입력합니다. (현재: ${cur}, 빈 입력 = 기본값)`,
  configChangedBaseUrl: (v) => `baseUrl 이 ${v} 로 변경되었습니다.`,

  hookFailureCommentIntro: "smart-msg: AI 메시지 자동 생성에 실패했습니다. 여기에 직접 작성하시거나 'sm c' 로 다시 시도하시기 바랍니다.",
  hookFailureCommentCause: (cause) => `원인: ${cause}`,

  noStagedChanges: "스테이지된 변경사항이 없습니다. 먼저 git add 를 실행하시기 바랍니다.",
  generatedMessageHeader: "생성된 커밋 메시지:",
  commitChoicePrompt: "이 메시지로 커밋을 진행하시겠습니까?",
  commitChoiceYes: "그대로 commit",
  commitChoiceRegen: "메시지 다시 생성",
  commitChoiceEdit: "에디터로 열어 수정 후 commit",
  commitChoiceNo: "취소",
  regenerating: "다시 생성하는 중...",
  regenLimitReached: "재생성 횟수 한도에 도달하여 취소되었습니다.",
  dryRunFinished: "(dry-run) git commit 은 실행하지 않습니다.",

  intentAskHint: "(선택) 이번 변경을 \"왜\" 하시는지 한 줄로 적어주세요. 그냥 Enter 누르면 건너뜁니다.",
  intentAskPrompt: "변경 의도 (왜)",
  intentAlwaysEmptyRetry: "의도 입력이 필수입니다 (captureIntent=always). 한 줄 입력하시거나 --no-intent 옵션으로 실행하시기 바랍니다.",
  intentAccepted: (text) => `의도 기록: "${text}"`,
  intentSkippedHint: "(의도 없음 — diff 만으로 생성합니다)",

  configTargetCaptureIntent: "captureIntent (커밋 전 \"왜\" 한 줄 입력 모드)",
  configCurrentCaptureIntent: (v) => `  intent   : ${v}`,
  configChooseCaptureIntent: "`sm c` 가 의도(왜) 를 언제 물을지 선택합니다.",
  captureIntentAsk: "ask    - 매번 묻고, 빈 입력은 스킵 (기본)",
  captureIntentAlways: "always - 비어있지 않은 의도 강제 입력 (강한 자기 규율 모드)",
  captureIntentNever: "never  - 절대 묻지 않음 (--intent 또는 SM_INTENT env 만 사용)",
  configChangedCaptureIntent: (v) => `captureIntent 가 ${v} 로 변경되었습니다.`,

  riskHeader: "위험도 평가:",
  riskScoreLine: (bar) => `  점수    : ${bar}`,
  riskReasonLine: (reason) => `  - ${reason}`,
  riskTimeWarning: (warnings) => `  시간대  : ⚠ 위험 시간대 (${warnings})`,
  riskHighConfirm: "고위험 변경입니다. 그래도 진행하시겠습니까?",
  riskBlocked: "고위험 변경으로 인해 취소되었습니다.",
  riskSkipped: "(위험도 평가 건너뜀)",

  configTargetRiskCheck: "riskCheck (커밋 전 변경 위험도 평가)",
  configCurrentRiskCheck: (v) => `  risk     : ${v}`,
  configChooseRiskCheck: "`sm c` 가 고위험 변경을 어떻게 처리할지 선택합니다.",
  riskCheckWarn: "warn - 점수 4 이상 + 위험 시간대일 때만 confirm (기본)",
  riskCheckOn:   "on   - 점수 4 이상이면 항상 confirm",
  riskCheckOff:  "off  - 평가 자체 수행 안 함",
  configChangedRiskCheck: (v) => `riskCheck 가 ${v} 로 변경되었습니다.`,

  amendNoLastDiff: "마지막 commit 의 diff 가 비어있습니다 (root commit / merge). 중단합니다.",
  amendGeneratedHeader: "생성된 커밋 메시지 (amend 용):",
  amendChoicePrompt: "이 메시지로 마지막 commit 을 amend 하시겠습니까?",
  amendChoiceYes: "그대로 amend",

  prNoBase: "base ref 를 자동으로 찾지 못했습니다 (origin/main / main / master / develop). --base 로 지정해주세요.",
  prNoDiff: (base) => `${base} 와 HEAD 의 diff 가 비어있습니다. PR 만들 변경이 없습니다.`,
  prHint: "(팁) gh 와 파이프 연결: sm pr | gh pr create --body-file -",

  splitHeader: "분할 commit 제안:",
  splitFooterHint: "위 안내에 따라 그룹별로 'git reset HEAD <file>' + 'git add <file>' 수행 후 'sm c' 로 commit 하시기 바랍니다.",

  currentMarker: "  ★ (현재 설정)",
};

// 외부 사용 진입점. cfg.language 가 비어있는 경우 (sm login 의 첫 단계 등) 에는 호출자가 "en" 을 명시한다.
export function t(lang: Language): Messages {
  return lang === "ko" ? ko : en;
}
