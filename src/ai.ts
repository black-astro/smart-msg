// AI router. config 를 읽어서 어떤 provider 를 쓸지 결정하고 위임.
// 이 파일은 "어디서 호출하든" 단일 진입점이 되어야 함 → 외부에서는 generateCommitMessage 만 알면 됨.
import { loadConfig, type Config, type Provider } from "./config.js";
import type { CommitProvider } from "./providers/types.js";
import type { BranchContext } from "./providers/prompt.js";
import { openaiProvider } from "./providers/openai.js";
import { claudeProvider } from "./providers/claude.js";
import { geminiProvider } from "./providers/gemini.js";
import { groqProvider } from "./providers/groq.js";
import { ollamaProvider } from "./providers/ollama.js";
import { getCurrentBranch, extractIssueKey } from "./git.js";

// provider 식별자 → 실제 구현체 매핑. 새 provider 추가 시 이 객체에 한 줄만 추가.
const PROVIDERS: Record<Provider, CommitProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  openai: openaiProvider,
  claude: claudeProvider,
  ollama: ollamaProvider,
};

export interface GenerateOptions {
  // commit / pr / split. 기본 commit.
  mode?: "commit" | "pr" | "split";
  // 브랜치 컨텍스트 자동 수집 여부. 기본 true. PR 명령처럼 base 비교가 따로 있는 경우엔 호출자가 직접 제어.
  collectBranch?: boolean;
}

export async function generateCommitMessage(
  diff: string,
  opts: GenerateOptions = {},
): Promise<string> {
  // 1) config 없으면 사용자가 아직 로그인 안 한 것 → 친절한 안내 후 종료.
  const config = await loadConfig();
  if (!config) {
    throw new Error("로그인이 필요합니다. `sm login` 을 먼저 실행하시기 바랍니다.");
  }

  // 2) 브랜치 컨텍스트 수집. autoIssue 가 켜져 있을 때만 issueKey 가 의미를 가지지만,
  //    브랜치명 자체는 모델이 scope 잡기에 유용하므로 기본 수집한다.
  const branch = opts.collectBranch === false ? undefined : await collectBranch(config);

  // 3) primary provider 시도. 실패 시 fallbackProvider 가 있고 키가 등록되어 있으면 한 번 더 시도.
  const verbose = config.verbose === true || process.env.SM_DEBUG === "1";
  const mode = opts.mode ?? "commit";

  try {
    const primary = await callProvider(config, config.provider, diff, branch, mode, verbose);
    return appendIssueFooter(primary, config, branch);
  } catch (e) {
    const primaryErr = e as Error;
    const fb = config.fallbackProvider;
    if (fb && fb !== config.provider && hasKeyFor(config, fb)) {
      if (verbose) console.error(`[sm verbose] primary ${config.provider} failed (${primaryErr.message}); falling back to ${fb}`);
      try {
        const fallbackOut = await callProvider(config, fb, diff, branch, mode, verbose);
        return appendIssueFooter(fallbackOut, config, branch);
      } catch (e2) {
        const secondErr = e2 as Error;
        throw new Error(`${config.provider} 실패: ${primaryErr.message}\n폴백 ${fb} 도 실패: ${secondErr.message}`);
      }
    }
    throw primaryErr;
  }
}

async function callProvider(
  config: Config,
  providerId: Provider,
  diff: string,
  branch: BranchContext | undefined,
  mode: "commit" | "pr" | "split",
  verbose: boolean,
): Promise<string> {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`알 수 없는 provider 입니다: ${providerId}`);
  }

  // ollama 는 API 키 불필요 (빈 문자열 OK). 그 외는 provider 별 키 검증.
  const apiKey = getApiKey(config, providerId);
  if (providerId !== "ollama" && !apiKey) {
    throw new Error(
      `${providerId} API 키가 없습니다. \`sm login\` 명령으로 다시 로그인하시기 바랍니다.`,
    );
  }

  // ollama 는 모델이 provider 별 권장 목록에 없을 수도 있어 (사용자가 직접 설치한 모델),
  // primary 와 fallback 의 모델이 같아도 되는지 보장이 안 됨.
  // 폴백 시 모델을 그대로 쓰면 호환 안 될 수 있으므로 권장 목록의 첫 번째를 사용.
  const model = providerId === config.provider
    ? config.model
    : pickFallbackModel(providerId);

  const baseUrl = providerId === "openai"
    ? config.openaiBaseUrl
    : providerId === "ollama"
      ? config.ollamaBaseUrl
      : undefined;

  return provider.generate({
    diff,
    model,
    apiKey: apiKey ?? "",
    language: config.language ?? "en",
    strength: config.strength ?? "simple",
    tone: config.tone ?? "report",
    gitmoji: config.gitmoji ?? false,
    branch,
    mode,
    baseUrl,
    verbose,
  });
}

function getApiKey(config: Config, providerId: Provider): string | undefined {
  switch (providerId) {
    case "gemini":
      return config.geminiApiKey;
    case "groq":
      return config.groqApiKey;
    case "openai":
      return config.openaiApiKey;
    case "claude":
      return config.claudeApiKey;
    case "ollama":
      return ""; // 키 불필요.
  }
}

function hasKeyFor(config: Config, providerId: Provider): boolean {
  if (providerId === "ollama") return true;
  return Boolean(getApiKey(config, providerId));
}

// 폴백 provider 의 모델 선택. 일단 권장 목록의 첫 번째.
// (config.model 은 primary provider 의 것이라 그대로 쓸 수 없다.)
function pickFallbackModel(providerId: Provider): string {
  // 정적 import 회피를 위해 inline.
  const fallback: Record<Provider, string> = {
    gemini: "gemini-2.5-flash",
    groq: "llama-3.1-8b-instant",
    openai: "gpt-4.1-nano",
    claude: "claude-haiku-4-5",
    ollama: "llama3.2",
  };
  return fallback[providerId];
}

async function collectBranch(config: Config): Promise<BranchContext | undefined> {
  const name = await getCurrentBranch();
  if (!name) return undefined;
  const issueKey = config.autoIssue ? (extractIssueKey(name) ?? undefined) : undefined;
  return { name, issueKey };
}

// autoIssue 가 켜져 있고 issueKey 가 추출된 경우 footer 에 'Refs: <KEY>' 자동 첨부.
// 단, 이미 메시지 본문에 키가 포함된 경우 (모델이 알아서 적은 경우) 중복 첨부하지 않는다.
function appendIssueFooter(message: string, config: Config, branch?: BranchContext): string {
  if (!config.autoIssue) return message;
  const key = branch?.issueKey;
  if (!key) return message;
  if (message.includes(key)) return message;
  return `${message.replace(/\s+$/, "")}\n\nRefs: ${key}\n`;
}
