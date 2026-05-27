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
import { t } from "./i18n.js";
import { askYesNo } from "./cliPrompt.js";

// provider 별 키 발급 URL. 사용자의 클릭 및 복사 부담을 줄이기 위해 자동으로 페이지를 연다.
// ollama 는 키 불필요 → URL 없음.
const KEY_PAGE_URL: Record<Exclude<Provider, "ollama">, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  groq: "https://console.groq.com/keys",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
};

function withMarker(title: string, isCurrent: boolean, marker: string): string {
  return isCurrent ? `${title}${marker}` : title;
}

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
      { title: withMarker(m.langOptionEn, initial === "en", m.currentMarker), value: "en" },
      { title: withMarker(m.langOptionKo, initial === "ko", m.currentMarker), value: "ko" },
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
      { title: withMarker(m.strengthSimple, initial === "simple", m.currentMarker), value: "simple" },
      { title: withMarker(m.strengthMiddle, initial === "middle", m.currentMarker), value: "middle" },
      { title: withMarker(m.strengthHard, initial === "hard", m.currentMarker), value: "hard" },
    ],
    initial: idx,
  });
  return (strength as Strength) ?? null;
}

export async function runLogin(): Promise<void> {
  // 1) 언어 선택.
  const language = await pickLanguage(undefined, "en");
  if (!language) {
    console.log(t("en").cancelled);
    return;
  }

  const m = t(language);

  // 2) AI provider 선택.
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: m.chooseProvider,
    choices: [
      { title: m.providerGeminiLabel, value: "gemini" },
      { title: m.providerGroqLabel, value: "groq" },
      { title: m.providerOpenaiLabel, value: "openai" },
      { title: m.providerClaudeLabel, value: "claude" },
      { title: m.providerOllamaLabel, value: "ollama" },
    ],
    initial: 0,
  });

  if (!provider) {
    console.log(m.cancelled);
    return;
  }

  // 3) 모델 선택. ollama 는 권장 목록 + "직접 입력" 옵션도 제공.
  let model: string | undefined;
  if (provider === "ollama") {
    const list = RECOMMENDED_MODELS.ollama;
    const { picked } = await prompts({
      type: "select",
      name: "picked",
      message: m.chooseModelOllama,
      choices: [
        ...list.map((name) => ({ title: name, value: name })),
        { title: m.modelCustomEntry, value: "__custom__" },
      ],
      initial: 0,
    });
    if (!picked) {
      console.log(m.cancelled);
      return;
    }
    if (picked === "__custom__") {
      const { entered } = await prompts({
        type: "text",
        name: "entered",
        message: m.enterCustomModel,
      });
      model = typeof entered === "string" ? entered.trim() : "";
      if (!model) {
        console.log(m.cancelled);
        return;
      }
    } else {
      model = picked;
    }
  } else {
    const modelMessage =
      provider === "gemini" || provider === "groq"
        ? m.chooseModelGemini
        : m.chooseModelDefault;
    const choices = RECOMMENDED_MODELS[provider as keyof typeof RECOMMENDED_MODELS];
    const { picked } = await prompts({
      type: "select",
      name: "picked",
      message: modelMessage,
      choices: choices.map((name: string) => ({ title: name, value: name })),
      initial: 0,
    });
    if (!picked) {
      console.log(m.cancelled);
      return;
    }
    model = picked;
  }

  // 4) 강도.
  const strength = await pickStrength(undefined, language);
  if (!strength) {
    console.log(m.cancelled);
    return;
  }

  // 5) 유료 provider 안내.
  if (provider === "openai" || provider === "claude") {
    const label = provider === "openai" ? "OpenAI" : "Anthropic Claude";
    console.log("");
    console.log(m.paidNoticeLine1(label));
    console.log(m.paidNoticeLine2);
    console.log(m.paidNoticeLine3);
    console.log(m.paidNoticeLine4);
  }

  // 6) ollama 는 키 불필요. 그 외엔 키 발급 페이지 자동 오픈 + 입력.
  let trimmedKey = "";
  let ollamaBaseUrl: string | undefined;
  if (provider === "ollama") {
    // 사용자에게 endpoint 확인 한 번. 기본은 http://localhost:11434.
    const { url } = await prompts({
      type: "text",
      name: "url",
      message: m.ollamaEnterBaseUrl,
      initial: "http://localhost:11434",
    });
    ollamaBaseUrl = typeof url === "string" ? url.trim() : "";
    if (!ollamaBaseUrl) ollamaBaseUrl = "http://localhost:11434";
  } else {
    const url = KEY_PAGE_URL[provider as Exclude<Provider, "ollama">];
    console.log(m.openingBrowser(url));
    try {
      await open(url);
    } catch {
      console.log(m.browserOpenFailed);
    }

    console.log("");
    console.log(m.securityNotice);

    const { apiKey } = await prompts({
      type: "text",
      name: "apiKey",
      message: m.enterApiKey,
    });

    trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";

    if (!trimmedKey) {
      console.log(m.keyEmptyCancelled);
      return;
    }
  }

  // 7) config 저장. provider 별 키 필드는 독립적으로 보관.
  const baseFields = { provider, model, language, strength } as const;
  let patch: Record<string, unknown> = { ...baseFields };
  if (provider === "gemini")  patch = { ...patch, geminiApiKey: trimmedKey };
  if (provider === "groq")    patch = { ...patch, groqApiKey: trimmedKey };
  if (provider === "openai")  patch = { ...patch, openaiApiKey: trimmedKey };
  if (provider === "claude")  patch = { ...patch, claudeApiKey: trimmedKey };
  if (provider === "ollama")  patch = { ...patch, ollamaBaseUrl };

  await updateConfig(patch);

  console.log(m.loginCompleted);

  // 8) 글로벌 hook 자동 설치.
  console.log("");
  console.log(m.globalHookIntro1);
  console.log(m.globalHookIntro2);
  const wantGlobal = await askYesNo(m.globalHookConfirm, true, language);

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
