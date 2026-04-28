// `sm config` — 설치 이후 언어, 강도, 모델 변경. login 과 달리 키는 변경하지 않는다.
// 메뉴 방식으로 구성하여 사용자가 변경하고자 하는 항목만 빠르게 선택할 수 있도록 한다.
import prompts from "prompts";
import { loadConfig, updateConfig, getConfigPath } from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { pickLanguage, pickStrength } from "./login.js";

export async function runConfig(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("로그인이 되어있지 않습니다. `sm login` 을 먼저 실행하시기 바랍니다.");
    return;
  }

  // 현재 설정을 한눈에 보여주어 사용자가 변경 항목을 결정하는 데 참고하도록 한다.
  console.log("현재 설정:");
  console.log(`  provider : ${cfg.provider}`);
  console.log(`  model    : ${cfg.model}`);
  console.log(`  language : ${cfg.language ?? "(설정되지 않음)"}`);
  console.log(`  strength : ${cfg.strength ?? "(설정되지 않음)"}`);
  console.log(`  config   : ${getConfigPath()}`);
  console.log("");

  // 변경할 항목을 선택한다.
  const { target } = await prompts({
    type: "select",
    name: "target",
    message: "변경할 항목을 선택합니다.",
    choices: [
      { title: "language (커밋 메시지 출력 언어)", value: "language" },
      { title: "strength (메시지 강도)", value: "strength" },
      { title: "model (현재 provider 의 모델)", value: "model" },
      { title: "취소", value: "cancel" },
    ],
    initial: 0,
  });

  if (!target || target === "cancel") {
    console.log("취소되었습니다.");
    return;
  }

  if (target === "language") {
    const language = await pickLanguage(cfg.language);
    if (!language) return;
    await updateConfig({ language });
    console.log(`language 가 ${language} 로 변경되었습니다.`);
    return;
  }

  if (target === "strength") {
    const strength = await pickStrength(cfg.strength);
    if (!strength) return;
    await updateConfig({ strength });
    console.log(`strength 가 ${strength} 로 변경되었습니다.`);
    return;
  }

  if (target === "model") {
    // 현재 provider 의 권장 모델 목록을 보여주고 변경한다.
    const { model } = await prompts({
      type: "select",
      name: "model",
      message: `${cfg.provider} 의 모델을 선택합니다.`,
      choices: RECOMMENDED_MODELS[cfg.provider].map((m) => ({
        title: m,
        value: m,
      })),
      // 현재 모델이 후보에 있으면 그것을 기본값으로 표시한다.
      initial: Math.max(0, RECOMMENDED_MODELS[cfg.provider].indexOf(cfg.model)),
    });
    if (!model) return;
    await updateConfig({ model });
    console.log(`model 이 ${model} 로 변경되었습니다.`);
    return;
  }
}
