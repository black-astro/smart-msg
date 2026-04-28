// `sm login` 의 동작을 정의한다. AI provider, 모델, 언어, 강도를 묻고, 브라우저로 키 발급 페이지를 열어 키를 등록한다.
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

// provider 별 키 발급 URL. 사용자의 클릭 및 복사 부담을 줄이기 위해 자동으로 페이지를 연다.
// gemini 는 Google AI Studio 에서 무료로 키를 발급받을 수 있어 카드 등록이 필요 없다.
const KEY_PAGE_URL: Record<Provider, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
};

// 언어 및 강도 선택 흐름은 `sm login` 과 `sm config` 에서 모두 사용하므로 별도 함수로 분리한다.
// initial 값을 받아 기존 설정이 있으면 해당 값을 기본 선택으로 표시하여 변경 시 UX 를 향상시킨다.
export async function pickLanguage(initial?: Language): Promise<Language | null> {
  const { language } = await prompts({
    type: "select",
    name: "language",
    message: "커밋 메시지 출력 언어를 선택합니다.",
    choices: [
      { title: "한국어 (ko)", value: "ko" },
      { title: "English (en)", value: "en" },
    ],
    initial: initial === "en" ? 1 : 0,
  });
  return (language as Language) ?? null;
}

export async function pickStrength(initial?: Strength): Promise<Strength | null> {
  const idx = initial === "middle" ? 1 : initial === "hard" ? 2 : 0;
  const { strength } = await prompts({
    type: "select",
    name: "strength",
    message: "메시지 강도를 선택합니다. (길이 및 상세도)",
    choices: [
      { title: "simple — 한 줄 (Conventional Commit)", value: "simple" },
      { title: "middle — 첫 줄 + 본문 2~5줄", value: "middle" },
      { title: "hard   — 첫 줄 + README 수준 본문", value: "hard" },
    ],
    initial: idx,
  });
  return (strength as Strength) ?? null;
}

export async function runLogin(): Promise<void> {
  // 1) AI provider 선택. prompts 의 select 타입은 화살표 키로 선택 가능하다.
  //    Gemini 는 무료 티어가 넉넉하여 기본 권장으로 맨 위에 두고 initial 도 0 으로 지정한다.
  //    OpenAI / Claude 는 종량제(유료) 임을 사용자가 선택 단계에서 즉시 인지할 수 있도록 라벨에 명시한다.
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: "사용할 AI provider 를 선택합니다.",
    choices: [
      { title: "Google Gemini  — 무료 티어 제공 (권장)", value: "gemini" },
      { title: "OpenAI (GPT)   — API 사용량 만큼 과금 (유료)", value: "openai" },
      { title: "Anthropic Claude — API 사용량 만큼 과금 (유료)", value: "claude" },
    ],
    initial: 0,
  });

  // 사용자가 Ctrl+C 로 취소한 경우 prompts 는 undefined 를 반환하므로 안전하게 종료한다.
  if (!provider) {
    console.log("취소되었습니다.");
    return;
  }

  // 2) 모델 선택. provider 별 권장 모델은 RECOMMENDED_MODELS 에서 가져온다.
  //    Gemini 는 권장 모델이 모두 무료 티어 대상이라 안내 문구를 다르게 표시한다.
  const modelMessage =
    provider === "gemini"
      ? "모델을 선택합니다. (무료 티어 사용 가능)"
      : "모델을 선택합니다. (저비용 순)";
  const { model } = await prompts({
    type: "select",
    name: "model",
    message: modelMessage,
    choices: RECOMMENDED_MODELS[provider as Provider].map((m) => ({
      title: m,
      value: m,
    })),
    initial: 0,
  });

  if (!model) {
    console.log("취소되었습니다.");
    return;
  }

  // 3) 언어 및 강도 선택. 키 발급 단계 이전에 모든 옵션을 결정해 둔다.
  const language = await pickLanguage();
  if (!language) {
    console.log("취소되었습니다.");
    return;
  }
  const strength = await pickStrength();
  if (!strength) {
    console.log("취소되었습니다.");
    return;
  }

  // 4) 브라우저에서 API 키 발급 페이지를 자동으로 연다. 자동 오픈에 실패한 경우 URL 을 안내한다.
  //    OpenAI / Claude 는 API 가 종량제이므로 키 발급 직전에 한 번 더 비용 발생 사실을 안내한다.
  //    ChatGPT Plus / Claude Max 등 구독 결제와는 별개의 결제 체계임을 사용자가 혼동하지 않게 한다.
  if (provider === "openai" || provider === "claude") {
    const label = provider === "openai" ? "OpenAI" : "Anthropic Claude";
    console.log("");
    console.log(`[안내] ${label} API 는 사용량 기반 종량제입니다.`);
    console.log("       ChatGPT Plus / Claude Max 등의 구독 결제로는 API 호출이 동작하지 않으며,");
    console.log("       콘솔에서 별도로 카드 등록 또는 크레딧 충전이 필요합니다.");
    console.log("       무료로 사용하시려면 'Google Gemini' 를 선택하시기 바랍니다.");
  }

  const url = KEY_PAGE_URL[provider as Provider];
  console.log(`\n브라우저에서 API 키 발급 페이지를 엽니다: ${url}`);
  try {
    await open(url);
  } catch {
    console.log("(브라우저 자동 오픈에 실패하였습니다. 위 URL 을 직접 열어주시기 바랍니다.)");
  }

  // 5) 키 입력을 받는다. password 타입은 입력 시 화면에 노출되지 않으므로 어깨너머 노출을 방지한다.
  const { apiKey } = await prompts({
    type: "password",
    name: "apiKey",
    message: "발급된 API 키를 입력합니다.",
  });

  if (!apiKey) {
    console.log("키가 입력되지 않아 취소되었습니다.");
    return;
  }

  // 6) config 에 저장한다. provider 별 키 필드를 분기하여 다른 provider 의 키는 보존한다.
  //    동일한 사용자가 Gemini / OpenAI / Claude 키를 모두 등록해두고 `sm config` 에서 전환할 수 있게
  //    각 키는 독립적으로 보관한다.
  const baseFields = { provider, model, language, strength };
  const patch =
    provider === "gemini"
      ? { ...baseFields, geminiApiKey: apiKey }
      : provider === "openai"
        ? { ...baseFields, openaiApiKey: apiKey }
        : { ...baseFields, claudeApiKey: apiKey };

  await updateConfig(patch);

  console.log(`\n계정 설정이 완료되었습니다.`);

  // 7) 글로벌 hook 자동 설치. 한 번만 동의받으면 모든 git 저장소에서 자동으로 동작한다.
  //    사용자가 매 프로젝트마다 install-hook 을 수동 실행할 필요가 없어진다.
  console.log("");
  console.log("이제 모든 git 저장소에서 'git commit' 만으로 자동 메시지 생성을 사용할 수 있도록");
  console.log("글로벌 git hook 을 설치합니다. 이 설정은 사용자 환경 전체에 한 번만 적용됩니다.");
  const { wantGlobal } = await prompts({
    type: "confirm",
    name: "wantGlobal",
    message: "글로벌 hook 을 설치하시겠습니까?",
    initial: true,
  });

  if (wantGlobal) {
    const installed = await runInstallHookGlobal();
    if (installed) {
      console.log("\n설치가 완료되었습니다. 어떤 git 저장소에서든 다음 명령만으로 자동 메시지가 생성됩니다.");
      console.log("");
      console.log("  git add .");
      console.log("  git commit");
      console.log("");
      console.log("설정 변경은 `sm config` 명령으로 수행합니다.");
    }
  } else {
    console.log("\n글로벌 hook 설치를 건너뛰었습니다.");
    console.log("명령줄에서 `sm c` 로 사용하시거나, 추후 `sm login` 을 다시 실행하여 설정할 수 있습니다.");
  }
}
