// 사용자 facing 메시지의 영어/한국어 사전.
// 기본 표시는 영어이며, sm login 의 첫 단계에서 사용자가 한국어를 선택하면 이후 prompt 가 한국어로 전환된다.
//
// 설계 의도:
//   - 코드 호출부는 t(lang).key 형태로 단순하게 사용한다.
//   - 키는 의미 단위로만 두고, 동적 치환이 필요한 경우 함수로 정의한다.
//   - 사전을 별도 파일로 분리해 메시지 수정 시 다른 로직을 건드리지 않게 한다.
import type { Language } from "./config.js";

export interface Messages {
  // 언어 선택 (이 단계는 항상 영어 라벨로 안내한다 - 아직 사용자가 언어를 고르지 않은 시점이므로).
  // 따라서 이 키만 별도로 사용되며, 다른 키들은 lang 결정 후 표시된다.
  chooseLanguagePrompt: string;
  langOptionEn: string;
  langOptionKo: string;

  chooseProvider: string;
  providerGeminiLabel: string;
  providerGroqLabel: string;
  providerOpenaiLabel: string;
  providerClaudeLabel: string;

  chooseModelDefault: string;
  chooseModelGemini: string;

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
  configTargetOnFailure: string;
  configCurrentOnFailure: (v: string) => string;
  configChooseOnFailure: string;
  onFailureFallback: string;
  onFailureAbort: string;
  configChangedOnFailure: (v: string) => string;

  // hook 실패 안내 (msgFile 코멘트 + stderr).
  hookFailureCommentIntro: string;
  hookFailureCommentCause: (cause: string) => string;

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

  chooseModelDefault: "Choose a model (cheapest first)",
  chooseModelGemini: "Choose a model (free tier available)",

  chooseStrength: "Choose message strength (length and detail level)",
  strengthSimple: "simple - one line (Conventional Commit)",
  strengthMiddle: "middle - first line + 2-5 body lines",
  strengthHard:   "hard   - first line + README-level body",

  paidNoticeLine1: (label) => `[Notice] ${label} API is pay-as-you-go.`,
  paidNoticeLine2: "         ChatGPT Plus / Claude Max subscriptions do NOT cover API calls.",
  paidNoticeLine3: "         You must register a card or top up credits in the provider console.",
  paidNoticeLine4: "         To use it for free, choose 'Google Gemini' instead.",

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
  configTargetOnFailure: "on-failure (behavior when AI call fails)",
  configCurrentOnFailure: (v) => `  on-failure: ${v}`,
  configChooseOnFailure: "Choose hook behavior when AI call fails",
  onFailureFallback: "fallback - open editor with empty template (write manually)",
  onFailureAbort: "abort   - leave message empty so git aborts the commit",
  configChangedOnFailure: (v) => `on-failure changed to ${v}.`,

  hookFailureCommentIntro: "smart-msg: AI message generation failed. Write manually here, or run `sm c` to retry.",
  hookFailureCommentCause: (cause) => `cause: ${cause}`,

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

  chooseModelDefault: "모델을 선택합니다. (저비용 순)",
  chooseModelGemini: "모델을 선택합니다. (무료 티어 사용 가능)",

  chooseStrength: "메시지 강도를 선택합니다. (길이 및 상세도)",
  strengthSimple: "simple — 한 줄 (Conventional Commit)",
  strengthMiddle: "middle — 첫 줄 + 본문 2~5줄",
  strengthHard:   "hard   — 첫 줄 + README 수준 본문",

  paidNoticeLine1: (label) => `[안내] ${label} API 는 사용량 기반 종량제입니다.`,
  paidNoticeLine2: "       ChatGPT Plus / Claude Max 등의 구독 결제로는 API 호출이 동작하지 않으며,",
  paidNoticeLine3: "       콘솔에서 별도로 카드 등록 또는 크레딧 충전이 필요합니다.",
  paidNoticeLine4: "       무료로 사용하시려면 'Google Gemini' 를 선택하시기 바랍니다.",

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
  configTargetOnFailure: "on-failure (AI 호출 실패 시 동작)",
  configCurrentOnFailure: (v) => `  on-failure: ${v}`,
  configChooseOnFailure: "AI 호출 실패 시의 hook 동작을 선택합니다.",
  onFailureFallback: "fallback - 안내가 담긴 빈 템플릿으로 에디터 열기 (직접 작성)",
  onFailureAbort: "abort    - 메시지를 비워둬 git 이 commit 자체를 취소",
  configChangedOnFailure: (v) => `on-failure 가 ${v} 로 변경되었습니다.`,

  hookFailureCommentIntro: "smart-msg: AI 메시지 자동 생성에 실패했습니다. 여기에 직접 작성하시거나 'sm c' 로 다시 시도하시기 바랍니다.",
  hookFailureCommentCause: (cause) => `원인: ${cause}`,

  currentMarker: "  ★ (현재 설정)",
};

// 외부 사용 진입점. cfg.language 가 비어있는 경우 (sm login 의 첫 단계 등) 에는 호출자가 "en" 을 명시한다.
export function t(lang: Language): Messages {
  return lang === "ko" ? ko : en;
}
