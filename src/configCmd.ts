// `sm config` — 설치 이후 모든 설정 (언어/강도/모델/톤/onFailure/gitmoji/autoIssue/fallback/verbose/baseUrl) 변경.
// 표시 언어는 현재 저장된 cfg.language 를 따른다 (한국어 사용자 → 한국어, 그 외 → 영어).
import prompts from "prompts";
import {
  loadConfig,
  updateConfig,
  getConfigPath,
  type Language,
  type OnFailure,
  type Tone,
  type Provider,
  type CaptureIntent,
  type RiskCheck,
  type RevertCheck,
  type PrivacyMode,
} from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { pickLanguage, pickStrength } from "./login.js";
import { t } from "./i18n.js";

export async function runConfig(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("Not logged in. Please run `sm login` first.");
    return;
  }

  const displayLang: Language = cfg.language ?? "en";
  const m = t(displayLang);

  // 현재 설정 한눈에 표시.
  console.log(m.configHeader);
  console.log(m.configCurrentProvider(cfg.provider));
  console.log(m.configCurrentModel(cfg.model));
  console.log(m.configCurrentLanguage(cfg.language ?? "(not set)"));
  console.log(m.configCurrentStrength(cfg.strength ?? "(not set)"));
  console.log(m.configCurrentOnFailure(cfg.onFailure ?? "fallback"));
  console.log(m.configCurrentTone(cfg.tone ?? "report"));
  console.log(m.configCurrentGitmoji(cfg.gitmoji ? "on" : "off"));
  console.log(m.configCurrentAutoIssue(cfg.autoIssue ? "on" : "off"));
  console.log(m.configCurrentFallback(cfg.fallbackProvider ?? "(none)"));
  console.log(m.configCurrentVerbose(cfg.verbose ? "on" : "off"));
  console.log(m.configCurrentCaptureIntent(cfg.captureIntent ?? "ask"));
  console.log(m.configCurrentRiskCheck(cfg.riskCheck ?? "warn"));
  console.log(m.configCurrentRevertCheck(cfg.revertCheck ?? "on"));
  console.log(m.configCurrentPrivacyMode(cfg.privacyMode ?? "standard"));
  console.log(m.configCurrentPath(getConfigPath()));
  console.log("");

  const { target } = await prompts({
    type: "select",
    name: "target",
    message: m.configChooseTarget,
    choices: [
      { title: m.configTargetLanguage, value: "language" },
      { title: m.configTargetStrength, value: "strength" },
      { title: m.configTargetModel, value: "model" },
      { title: m.configTargetTone, value: "tone" },
      { title: m.configTargetGitmoji, value: "gitmoji" },
      { title: m.configTargetAutoIssue, value: "autoIssue" },
      { title: m.configTargetFallback, value: "fallback" },
      { title: m.configTargetOnFailure, value: "onFailure" },
      { title: m.configTargetVerbose, value: "verbose" },
      { title: m.configTargetCaptureIntent, value: "captureIntent" },
      { title: m.configTargetRiskCheck, value: "riskCheck" },
      { title: m.configTargetRevertCheck, value: "revertCheck" },
      { title: m.configTargetPrivacyMode, value: "privacyMode" },
      { title: m.configTargetBaseUrl, value: "baseUrl" },
      { title: m.configTargetCancel, value: "cancel" },
    ],
    initial: 0,
  });

  if (!target || target === "cancel") {
    console.log(m.cancelled);
    return;
  }

  if (target === "language") {
    const language = await pickLanguage(cfg.language, displayLang);
    if (!language) return;
    await updateConfig({ language });
    console.log(t(language).configChangedLanguage(language));
    return;
  }

  if (target === "strength") {
    const strength = await pickStrength(cfg.strength, displayLang);
    if (!strength) return;
    await updateConfig({ strength });
    console.log(m.configChangedStrength(strength));
    return;
  }

  if (target === "tone") {
    const current: Tone = cfg.tone ?? "report";
    const { tone } = await prompts({
      type: "select",
      name: "tone",
      message: m.configChooseTone,
      choices: [
        { title: current === "report" ? `${m.toneReport}${m.currentMarker}` : m.toneReport, value: "report" },
        { title: current === "polite" ? `${m.tonePolite}${m.currentMarker}` : m.tonePolite, value: "polite" },
      ],
      initial: current === "polite" ? 1 : 0,
    });
    if (!tone) return;
    await updateConfig({ tone: tone as Tone });
    console.log(m.configChangedTone(tone));
    return;
  }

  if (target === "onFailure") {
    const current: OnFailure = cfg.onFailure ?? "fallback";
    const { onFailure } = await prompts({
      type: "select",
      name: "onFailure",
      message: m.configChooseOnFailure,
      choices: [
        { title: current === "fallback" ? `${m.onFailureFallback}${m.currentMarker}` : m.onFailureFallback, value: "fallback" },
        { title: current === "abort"    ? `${m.onFailureAbort}${m.currentMarker}`    : m.onFailureAbort,    value: "abort"    },
      ],
      initial: current === "abort" ? 1 : 0,
    });
    if (!onFailure) return;
    await updateConfig({ onFailure: onFailure as OnFailure });
    console.log(m.configChangedOnFailure(onFailure));
    return;
  }

  if (target === "model") {
    const choices = RECOMMENDED_MODELS[cfg.provider as keyof typeof RECOMMENDED_MODELS] ?? [];
    if (choices.length === 0) {
      // ollama 등 사용자 환경에 따라 모델 후보가 다른 경우 직접 입력.
      const { model } = await prompts({
        type: "text",
        name: "model",
        message: m.configEnterModel(cfg.provider),
        initial: cfg.model,
      });
      if (!model) return;
      await updateConfig({ model });
      console.log(m.configChangedModel(model));
      return;
    }
    const { model } = await prompts({
      type: "select",
      name: "model",
      message: m.configChooseModelOf(cfg.provider),
      choices: choices.map((name: string) => ({
        title: name === cfg.model ? `${name}${m.currentMarker}` : name,
        value: name,
      })),
      initial: Math.max(0, choices.indexOf(cfg.model)),
    });
    if (!model) return;
    await updateConfig({ model });
    console.log(m.configChangedModel(model));
    return;
  }

  if (target === "gitmoji") {
    const current = cfg.gitmoji === true;
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseGitmoji,
      choices: [
        { title: current === false ? `off${m.currentMarker}` : "off", value: false },
        { title: current === true  ? `on${m.currentMarker}`  : "on",  value: true  },
      ],
      initial: current ? 1 : 0,
    });
    if (v === undefined) return;
    await updateConfig({ gitmoji: v });
    console.log(m.configChangedGitmoji(v ? "on" : "off"));
    return;
  }

  if (target === "autoIssue") {
    const current = cfg.autoIssue === true;
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseAutoIssue,
      choices: [
        { title: current === false ? `off${m.currentMarker}` : "off", value: false },
        { title: current === true  ? `on${m.currentMarker}`  : "on",  value: true  },
      ],
      initial: current ? 1 : 0,
    });
    if (v === undefined) return;
    await updateConfig({ autoIssue: v });
    console.log(m.configChangedAutoIssue(v ? "on" : "off"));
    return;
  }

  if (target === "verbose") {
    const current = cfg.verbose === true;
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseVerbose,
      choices: [
        { title: current === false ? `off${m.currentMarker}` : "off", value: false },
        { title: current === true  ? `on${m.currentMarker}`  : "on",  value: true  },
      ],
      initial: current ? 1 : 0,
    });
    if (v === undefined) return;
    await updateConfig({ verbose: v });
    console.log(m.configChangedVerbose(v ? "on" : "off"));
    return;
  }

  if (target === "fallback") {
    const current = cfg.fallbackProvider;
    const choices: Array<{ title: string; value: Provider | "" }> = [
      { title: !current ? `(none)${m.currentMarker}` : "(none)", value: "" },
      ...(["gemini", "groq", "openai", "claude", "ollama"] as Provider[])
        .filter((p) => p !== cfg.provider)
        .map((p) => ({
          title: current === p ? `${p}${m.currentMarker}` : p,
          value: p as Provider | "",
        })),
    ];
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseFallback,
      choices,
      initial: 0,
    });
    if (v === undefined) return;
    const next = v === "" ? undefined : (v as Provider);
    await updateConfig({ fallbackProvider: next });
    console.log(m.configChangedFallback(next ?? "(none)"));
    return;
  }

  if (target === "captureIntent") {
    const current: CaptureIntent = cfg.captureIntent ?? "ask";
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseCaptureIntent,
      choices: [
        { title: current === "ask"    ? `${m.captureIntentAsk}${m.currentMarker}`    : m.captureIntentAsk,    value: "ask"    },
        { title: current === "always" ? `${m.captureIntentAlways}${m.currentMarker}` : m.captureIntentAlways, value: "always" },
        { title: current === "never"  ? `${m.captureIntentNever}${m.currentMarker}`  : m.captureIntentNever,  value: "never"  },
      ],
      initial: current === "always" ? 1 : current === "never" ? 2 : 0,
    });
    if (!v) return;
    await updateConfig({ captureIntent: v as CaptureIntent });
    console.log(m.configChangedCaptureIntent(v));
    return;
  }

  if (target === "riskCheck") {
    const current: RiskCheck = cfg.riskCheck ?? "warn";
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseRiskCheck,
      choices: [
        { title: current === "warn" ? `${m.riskCheckWarn}${m.currentMarker}` : m.riskCheckWarn, value: "warn" },
        { title: current === "on"   ? `${m.riskCheckOn}${m.currentMarker}`   : m.riskCheckOn,   value: "on"   },
        { title: current === "off"  ? `${m.riskCheckOff}${m.currentMarker}`  : m.riskCheckOff,  value: "off"  },
      ],
      initial: current === "on" ? 1 : current === "off" ? 2 : 0,
    });
    if (!v) return;
    await updateConfig({ riskCheck: v as RiskCheck });
    console.log(m.configChangedRiskCheck(v));
    return;
  }

  if (target === "revertCheck") {
    const current: RevertCheck = cfg.revertCheck ?? "on";
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChooseRevertCheck,
      choices: [
        { title: current === "on"  ? `${m.revertCheckOn}${m.currentMarker}`  : m.revertCheckOn,  value: "on"  },
        { title: current === "off" ? `${m.revertCheckOff}${m.currentMarker}` : m.revertCheckOff, value: "off" },
      ],
      initial: current === "off" ? 1 : 0,
    });
    if (!v) return;
    await updateConfig({ revertCheck: v as RevertCheck });
    console.log(m.configChangedRevertCheck(v));
    return;
  }

  if (target === "privacyMode") {
    const current: PrivacyMode = cfg.privacyMode ?? "standard";
    const { v } = await prompts({
      type: "select",
      name: "v",
      message: m.configChoosePrivacyMode,
      choices: [
        { title: current === "off"      ? `${m.privacyModeOff}${m.currentMarker}`      : m.privacyModeOff,      value: "off"      },
        { title: current === "standard" ? `${m.privacyModeStandard}${m.currentMarker}` : m.privacyModeStandard, value: "standard" },
        { title: current === "strict"   ? `${m.privacyModeStrict}${m.currentMarker}`   : m.privacyModeStrict,   value: "strict"   },
      ],
      initial: current === "off" ? 0 : current === "strict" ? 2 : 1,
    });
    if (!v) return;
    await updateConfig({ privacyMode: v as PrivacyMode });
    console.log(m.configChangedPrivacyMode(v));
    return;
  }

  if (target === "baseUrl") {
    // openai 또는 ollama 의 base URL 변경. 다른 provider 면 안내만.
    if (cfg.provider !== "openai" && cfg.provider !== "ollama") {
      console.log(m.configBaseUrlNotApplicable(cfg.provider));
      return;
    }
    const currentVal = cfg.provider === "openai" ? cfg.openaiBaseUrl : cfg.ollamaBaseUrl;
    const { v } = await prompts({
      type: "text",
      name: "v",
      message: m.configEnterBaseUrl(cfg.provider, currentVal ?? "(default)"),
      initial: currentVal ?? "",
    });
    if (v === undefined) return;
    const trimmed = String(v).trim();
    const patch = cfg.provider === "openai"
      ? { openaiBaseUrl: trimmed || undefined }
      : { ollamaBaseUrl: trimmed || undefined };
    await updateConfig(patch);
    console.log(m.configChangedBaseUrl(trimmed || "(default)"));
    return;
  }
}
