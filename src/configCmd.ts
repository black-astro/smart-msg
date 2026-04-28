// `sm config` — 설치 후 언어/강도/모델 변경. login 과 달리 키는 안 건드림.
// 메뉴 방식 → 한 번에 다 묻지 않고 사용자가 원하는 항목만 골라서 빠르게 변경.
import prompts from "prompts";
import { loadConfig, updateConfig, getConfigPath } from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { pickLanguage, pickStrength } from "./login.js";

export async function runConfig(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("아직 로그인 안 됨. `sm login` 을 먼저 실행하세요.");
    return;
  }

  // 현재 설정 한눈에 보여주기 → 뭘 바꿀지 결정에 도움.
  console.log("현재 설정:");
  console.log(`  provider : ${cfg.provider}`);
  console.log(`  model    : ${cfg.model}`);
  console.log(`  language : ${cfg.language ?? "(미설정)"}`);
  console.log(`  strength : ${cfg.strength ?? "(미설정)"}`);
  console.log(`  config   : ${getConfigPath()}`);
  console.log("");

  // 무엇을 바꿀지 메뉴.
  const { target } = await prompts({
    type: "select",
    name: "target",
    message: "무엇을 바꿀까요?",
    choices: [
      { title: "language (커밋 메시지 언어)", value: "language" },
      { title: "strength (메시지 강도)", value: "strength" },
      { title: "model (현재 provider 의 모델)", value: "model" },
      { title: "취소", value: "cancel" },
    ],
    initial: 0,
  });

  if (!target || target === "cancel") {
    console.log("취소됨");
    return;
  }

  if (target === "language") {
    const language = await pickLanguage(cfg.language);
    if (!language) return;
    await updateConfig({ language });
    console.log(`✓ language → ${language}`);
    return;
  }

  if (target === "strength") {
    const strength = await pickStrength(cfg.strength);
    if (!strength) return;
    await updateConfig({ strength });
    console.log(`✓ strength → ${strength}`);
    return;
  }

  if (target === "model") {
    // 현재 provider 기준으로 모델 후보 보여주고 변경.
    const { model } = await prompts({
      type: "select",
      name: "model",
      message: `${cfg.provider} 모델 선택`,
      choices: RECOMMENDED_MODELS[cfg.provider].map((m) => ({
        title: m,
        value: m,
      })),
      // 현재 모델이 후보에 있으면 그걸 기본 선택.
      initial: Math.max(0, RECOMMENDED_MODELS[cfg.provider].indexOf(cfg.model)),
    });
    if (!model) return;
    await updateConfig({ model });
    console.log(`✓ model → ${model}`);
    return;
  }
}
