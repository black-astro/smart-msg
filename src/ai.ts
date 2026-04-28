// AI router. config 를 읽어서 어떤 provider 를 쓸지 결정하고 위임.
// 이 파일은 "어디서 호출하든" 단일 진입점이 되어야 함 → 외부에서는 generateCommitMessage 만 알면 됨.
import { loadConfig } from "./config.js";
import type { CommitProvider } from "./providers/types.js";
import { openaiProvider } from "./providers/openai.js";
import { claudeProvider } from "./providers/claude.js";

// provider 식별자 → 실제 구현체 매핑. 새 provider 추가 시 이 객체에 한 줄만 추가.
const PROVIDERS: Record<string, CommitProvider> = {
  openai: openaiProvider,
  claude: claudeProvider,
};

export async function generateCommitMessage(diff: string): Promise<string> {
  // 1) config 없으면 사용자가 아직 로그인 안 한 것 → 친절한 안내 후 종료.
  const config = await loadConfig();
  if (!config) {
    throw new Error("로그인이 필요합니다. `sm login` 을 먼저 실행하시기 바랍니다.");
  }

  // 2) provider 객체 가져오기. 알 수 없는 값이면 config 손상 의심 → 명시적으로 에러.
  const provider = PROVIDERS[config.provider];
  if (!provider) {
    throw new Error(`알 수 없는 provider 입니다: ${config.provider}`);
  }

  // 3) provider 별로 키가 따로 저장되어 있음. 해당 provider 키만 꺼내서 전달.
  const apiKey =
    config.provider === "openai" ? config.openaiApiKey : config.claudeApiKey;
  if (!apiKey) {
    throw new Error(
      `${config.provider} API 키가 없습니다. \`sm login\` 명령으로 다시 로그인하시기 바랍니다.`,
    );
  }

  // 4) 실제 호출. language/strength 도 같이 전달.
  //    오래된 config (필드 없음) 도 부드럽게 동작하도록 기본값 설정 → 마이그레이션 부담 줄임.
  return provider.generate({
    diff,
    model: config.model,
    apiKey,
    language: config.language ?? "en",
    strength: config.strength ?? "simple",
  });
}
