// `sm login` 의 동작을 정의한다. AI provider, 모델, 언어, 강도를 묻고, 브라우저로 키 발급 페이지를 열어 키를 등록한다.
import prompts from "prompts";
import open from "open";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  updateConfig,
  type Provider,
  type Language,
  type Strength,
} from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";
import { runInstallHook } from "./installHook.js";

// provider 별 키 발급 URL. 사용자의 클릭 및 복사 부담을 줄이기 위해 자동으로 페이지를 연다.
const KEY_PAGE_URL: Record<Provider, string> = {
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
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: "사용할 AI provider 를 선택합니다.",
    choices: [
      { title: "OpenAI (GPT)", value: "openai" },
      { title: "Anthropic (Claude)", value: "claude" },
    ],
    initial: 0,
  });

  // 사용자가 Ctrl+C 로 취소한 경우 prompts 는 undefined 를 반환하므로 안전하게 종료한다.
  if (!provider) {
    console.log("취소되었습니다.");
    return;
  }

  // 2) 모델 선택. provider 별 권장 모델은 RECOMMENDED_MODELS 에서 가져온다.
  const { model } = await prompts({
    type: "select",
    name: "model",
    message: "모델을 선택합니다. (저비용 순)",
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
  const baseFields = { provider, model, language, strength };
  const patch =
    provider === "openai"
      ? { ...baseFields, openaiApiKey: apiKey }
      : { ...baseFields, claudeApiKey: apiKey };

  await updateConfig(patch);

  console.log(`\n설정이 완료되었습니다. 어떤 프로젝트에서든 \`sm c\` 명령으로 커밋 메시지를 생성할 수 있습니다.`);
  console.log(`설정 변경은 \`sm config\` 명령으로 수행합니다.`);

  // 7) 현재 폴더가 git 저장소인 경우, IDE 통합을 원하는 사용자를 위해 hook 설치를 제안한다.
  //    이 흐름이 있어야 사용자가 별도로 install-hook 을 기억하고 실행할 필요가 없다.
  const isGitRepo = existsSync(join(process.cwd(), ".git"));
  if (isGitRepo) {
    console.log("");
    const { wantHook } = await prompts({
      type: "confirm",
      name: "wantHook",
      message:
        "현재 폴더가 git 저장소입니다. 이 프로젝트에 prepare-commit-msg hook 도 설치하시겠습니까? (IntelliJ 등 IDE 커밋 창에서 자동 메시지가 동작합니다.)",
      initial: true,
    });
    if (wantHook) {
      await runInstallHook();
    } else {
      console.log("hook 설치는 건너뛰었습니다. 추후 `sm install-hook` 으로 설치 가능합니다.");
    }
  } else {
    console.log("");
    console.log("팁: 프로젝트 루트에서 `sm install-hook` 을 실행하면 IDE 커밋 창에서도 자동 메시지가 동작합니다.");
  }
}
