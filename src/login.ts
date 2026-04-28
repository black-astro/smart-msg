// `sm login` 의 동작. 사용자에게 AI/모델/언어/강도 묻고, 브라우저로 키 발급 페이지 띄우고, 키 받아서 저장.
import prompts from "prompts";
import open from "open";
import {
  updateConfig,
  type Provider,
  type Language,
  type Strength,
} from "./config.js";
import { RECOMMENDED_MODELS } from "./providers/types.js";

// provider 별 키 발급 URL. 사용자가 클릭/복붙 안 해도 되게 자동으로 열어줌.
const KEY_PAGE_URL: Record<Provider, string> = {
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
};

// 언어/강도 선택 흐름은 `sm login` 과 `sm config` 둘 다에서 쓰니 별도로 분리.
// initial 값을 받아서 기존 설정이 있으면 그걸 기본 선택으로 표시 → 변경 시 UX 좋게.
export async function pickLanguage(initial?: Language): Promise<Language | null> {
  const { language } = await prompts({
    type: "select",
    name: "language",
    message: "커밋 메시지 언어",
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
    message: "메시지 강도 (길이/상세도)",
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
  // 1) AI 선택. prompts 의 select 타입은 화살표 키로 고를 수 있어 UX 좋음.
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: "사용할 AI 를 고르세요",
    choices: [
      { title: "OpenAI (GPT)", value: "openai" },
      { title: "Anthropic (Claude)", value: "claude" },
    ],
    initial: 0,
  });

  // 사용자가 Ctrl+C 등으로 취소한 경우 prompts 는 undefined 반환 → 안전하게 종료.
  if (!provider) {
    console.log("취소됨");
    return;
  }

  // 2) 모델 선택. provider 마다 추천 모델이 달라서 RECOMMENDED_MODELS 에서 꺼냄.
  const { model } = await prompts({
    type: "select",
    name: "model",
    message: "모델을 고르세요 (저렴한 순)",
    choices: RECOMMENDED_MODELS[provider as Provider].map((m) => ({
      title: m,
      value: m,
    })),
    initial: 0,
  });

  if (!model) {
    console.log("취소됨");
    return;
  }

  // 3) 언어 + 강도 선택. 키 발급 전에 묻기 → 키 입력만 끝나면 바로 사용 가능 상태.
  const language = await pickLanguage();
  if (!language) {
    console.log("취소됨");
    return;
  }
  const strength = await pickStrength();
  if (!strength) {
    console.log("취소됨");
    return;
  }

  // 4) 브라우저로 키 발급 페이지 자동 오픈. 실패해도(서버환경 등) URL 안내는 출력.
  const url = KEY_PAGE_URL[provider as Provider];
  console.log(`\n브라우저에서 API 키 발급 페이지를 엽니다: ${url}`);
  try {
    await open(url);
  } catch {
    console.log("(브라우저 자동 오픈 실패 — 위 URL 을 직접 여세요)");
  }

  // 5) 키 입력 받기. password 타입이면 입력 시 화면에 노출 안 됨 → 어깨너머 유출 방지.
  const { apiKey } = await prompts({
    type: "password",
    name: "apiKey",
    message: "발급한 API 키를 붙여넣으세요",
  });

  if (!apiKey) {
    console.log("키 입력이 비어있어 취소됩니다");
    return;
  }

  // 6) config 저장. provider 별 키 필드를 분기해서 넣음 → 다른 provider 키는 보존.
  const baseFields = { provider, model, language, strength };
  const patch =
    provider === "openai"
      ? { ...baseFields, openaiApiKey: apiKey }
      : { ...baseFields, claudeApiKey: apiKey };

  await updateConfig(patch);

  console.log(`\n완료! 이제 어느 프로젝트에서든 \`sm c\` 로 커밋 메시지를 만들 수 있어요.`);
  console.log(`설정 변경: \`sm config\``);
}
