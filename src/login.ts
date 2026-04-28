// `sm login` 의 동작을 정의한다. 첫 단계에서 언어를 선택하고, 이후 모든 prompt 가 그 언어로 진행된다.
// 메시지의 디폴트는 영어이며, 사용자가 한국어를 선택한 경우에만 한국어로 표시된다.
// AI provider, 모델, 강도, API 키, 글로벌 hook 설치까지 한 흐름으로 묶는다.
import prompts from "prompts";
import open from "open";
import {
  updateConfig,
  type Provider,
  type Language,
  type Strength,
} from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { runInstallHookGlobal } from "./installHook.js";
import { t, type Messages } from "./i18n.js";

// provider 별 키 발급 URL. 사용자의 클릭 및 복사 부담을 줄이기 위해 자동으로 페이지를 연다.
// gemini 는 Google AI Studio 에서 무료로 키를 발급받을 수 있어 카드 등록이 필요 없다.
const KEY_PAGE_URL: Record<Provider, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
};

// y/Y/n/N/빈입력만 허용하는 엄격한 yes-no 프롬프트.
// prompts 의 'confirm' 타입은 첫 글자를 누르는 즉시 응답이 확정되어 사용자가 의도치 않게
// 키를 잘못 누르면 그대로 진행되는 문제가 있다. 이 헬퍼는:
//   - 입력 종료를 항상 'Enter' 키로 강제 (text 타입 사용)
//   - 빈 입력 (그냥 Enter) → defaultYes 값
//   - y / Y → true,  n / N → false
//   - 그 외 입력 → 안내 후 동일 질문 재출제 (다음 단계로 넘어가지 않음)
//   - Ctrl+C 등으로 취소 (응답 자체가 undefined) → null 반환
async function askYesNo(message: string, defaultYes: boolean, m: Messages): Promise<boolean | null> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  while (true) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `${message} ${hint}`,
    });

    if (answer === undefined) return null;

    const normalized = String(answer).trim();

    if (normalized === "") return defaultYes;
    if (normalized === "y" || normalized === "Y") return true;
    if (normalized === "n" || normalized === "N") return false;

    console.log(m.askYesNoInvalid);
  }
}

// 언어 선택. 첫 진입 시점에는 사용자가 아직 언어를 고르지 않았으므로 안내문을 영어로 표시한다.
// sm config 에서 호출되는 경우엔 기존 언어로 표시되도록 lang 인자를 받을 수 있게 분리해 두었다.
// initial 값을 받으면 sm config 흐름에서 현재 언어가 기본 선택으로 표시된다.
export async function pickLanguage(
  initial?: Language,
  displayLang: Language = "en",
): Promise<Language | null> {
  const m = t(displayLang);
  const { language } = await prompts({
    type: "select",
    name: "language",
    message: m.chooseLanguagePrompt,
    choices: [
      { title: m.langOptionEn, value: "en" },
      { title: m.langOptionKo, value: "ko" },
    ],
    initial: initial === "ko" ? 1 : 0,
  });
  return (language as Language) ?? null;
}

export async function pickStrength(
  initial?: Strength,
  displayLang: Language = "en",
): Promise<Strength | null> {
  const m = t(displayLang);
  const idx = initial === "middle" ? 1 : initial === "hard" ? 2 : 0;
  const { strength } = await prompts({
    type: "select",
    name: "strength",
    message: m.chooseStrength,
    choices: [
      { title: m.strengthSimple, value: "simple" },
      { title: m.strengthMiddle, value: "middle" },
      { title: m.strengthHard, value: "hard" },
    ],
    initial: idx,
  });
  return (strength as Strength) ?? null;
}

export async function runLogin(): Promise<void> {
  // 1) 언어 선택 — 가장 먼저 묻는다. 디폴트 언어는 영어이며 사용자가 한국어를 고르면
  //    이후 단계가 한국어로 표시된다. 이 단계의 안내문 자체는 영어로 표시된다.
  const language = await pickLanguage(undefined, "en");
  if (!language) {
    console.log(t("en").cancelled);
    return;
  }

  // 이후 모든 prompt 는 사용자가 선택한 언어로 표시된다.
  const m = t(language);

  // 2) AI provider 선택. Gemini 가 권장 (무료 티어). OpenAI / Claude 는 라벨에 유료 표기.
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: m.chooseProvider,
    choices: [
      { title: m.providerGeminiLabel, value: "gemini" },
      { title: m.providerOpenaiLabel, value: "openai" },
      { title: m.providerClaudeLabel, value: "claude" },
    ],
    initial: 0,
  });

  if (!provider) {
    console.log(m.cancelled);
    return;
  }

  // 3) 모델 선택. provider 별 권장 모델 목록을 그대로 노출.
  const modelMessage =
    provider === "gemini" ? m.chooseModelGemini : m.chooseModelDefault;
  const { model } = await prompts({
    type: "select",
    name: "model",
    message: modelMessage,
    choices: RECOMMENDED_MODELS[provider as Provider].map((name) => ({
      title: name,
      value: name,
    })),
    initial: 0,
  });

  if (!model) {
    console.log(m.cancelled);
    return;
  }

  // 4) 메시지 강도 선택. (언어는 1단계에서 이미 결정)
  const strength = await pickStrength(undefined, language);
  if (!strength) {
    console.log(m.cancelled);
    return;
  }

  // 5) 유료 provider 의 경우 결제 안내 한 번 더. ChatGPT Plus / Claude Max 구독과의 혼동 방지.
  if (provider === "openai" || provider === "claude") {
    const label = provider === "openai" ? "OpenAI" : "Anthropic Claude";
    console.log("");
    console.log(m.paidNoticeLine1(label));
    console.log(m.paidNoticeLine2);
    console.log(m.paidNoticeLine3);
    console.log(m.paidNoticeLine4);
  }

  // 6) 키 발급 페이지 자동 오픈.
  const url = KEY_PAGE_URL[provider as Provider];
  console.log(m.openingBrowser(url));
  try {
    await open(url);
  } catch {
    console.log(m.browserOpenFailed);
  }

  // 7) 키 입력. text 타입(평문 표시) 으로 사용자가 붙여넣기 결과를 시각적으로 확인 가능.
  //    붙여넣기 시 끝에 따라붙는 개행/공백은 trim 으로 제거 (인증 헤더 깨짐 방지).
  console.log("");
  console.log(m.securityNotice);

  const { apiKey } = await prompts({
    type: "text",
    name: "apiKey",
    message: m.enterApiKey,
  });

  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";

  if (!trimmedKey) {
    console.log(m.keyEmptyCancelled);
    return;
  }

  // 8) config 저장. provider 별 키 필드는 독립적으로 보관해 다른 provider 키를 보존한다.
  const baseFields = { provider, model, language, strength };
  const patch =
    provider === "gemini"
      ? { ...baseFields, geminiApiKey: trimmedKey }
      : provider === "openai"
        ? { ...baseFields, openaiApiKey: trimmedKey }
        : { ...baseFields, claudeApiKey: trimmedKey };

  await updateConfig(patch);

  console.log(m.loginCompleted);

  // 9) 글로벌 hook 자동 설치. 엔터 강제 + y/n 검증 루프(askYesNo) 로 사고 방지.
  console.log("");
  console.log(m.globalHookIntro1);
  console.log(m.globalHookIntro2);
  const wantGlobal = await askYesNo(m.globalHookConfirm, true, m);

  if (wantGlobal === null) {
    console.log(m.cancelled);
    return;
  }

  if (wantGlobal) {
    const installed = await runInstallHookGlobal();
    if (installed) {
      console.log(m.globalHookInstalled);
      console.log("");
      console.log("  git add .");
      console.log("  git commit");
      console.log("");
      console.log(m.globalHookInstalledHint);
    }
  } else {
    console.log(m.globalHookSkipped);
    console.log(m.globalHookSkippedTip);
  }
}
