// `sm config` — 설치 이후 언어, 강도, 모델 변경. login 과 달리 키는 변경하지 않는다.
// 표시 언어는 현재 저장된 cfg.language 를 따른다 (한국어 사용자 → 한국어, 그 외 → 영어).
import prompts from "prompts";
import { loadConfig, updateConfig, getConfigPath, type Language, type OnFailure, type Tone } from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { pickLanguage, pickStrength } from "./login.js";
import { t } from "./i18n.js";

export async function runConfig(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    // 로그인 전에는 사용자 선호 언어를 알 수 없으므로 영어로 안내한다.
    console.log("Not logged in. Please run `sm login` first.");
    return;
  }

  // 표시 언어 결정. 기존 사용자가 ko 로 저장해둔 경우 한국어 표시.
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
      { title: m.configTargetOnFailure, value: "onFailure" },
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
    // 변경 결과 안내는 새 언어로 표시 → 사용자가 즉시 적용 결과를 체감.
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
    const { model } = await prompts({
      type: "select",
      name: "model",
      message: m.configChooseModelOf(cfg.provider),
      choices: RECOMMENDED_MODELS[cfg.provider].map((name) => ({
        title: name === cfg.model ? `${name}${m.currentMarker}` : name,
        value: name,
      })),
      initial: Math.max(0, RECOMMENDED_MODELS[cfg.provider].indexOf(cfg.model)),
    });
    if (!model) return;
    await updateConfig({ model });
    console.log(m.configChangedModel(model));
    return;
  }
}
