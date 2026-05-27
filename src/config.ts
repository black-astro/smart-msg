// 사용자별 설정을 ~/.smart-msg/config.json 에 저장/로드.
// 모든 프로젝트에서 공유되어야 하므로 홈 디렉토리에 둠.
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

// 어떤 AI 를 쓰는지 식별하는 태그. 새 provider 추가하면 여기 늘리면 됨.
// gemini / groq 모두 무료 티어 보유. groq 은 자체 LPU 인프라로 503 빈도가 낮은 안정적 무료 대안.
// ollama 는 로컬 실행 LLM (인터넷 불필요 + 회사 보안 환경에 적합) — 기본 endpoint 는 http://localhost:11434.
export type Provider = "gemini" | "groq" | "openai" | "claude" | "ollama";

// 커밋 메시지 출력 언어.
export type Language = "ko" | "en";

// 메시지 길이/상세도 단계.
//   simple: 한 줄 (Conventional Commit 형식만)
//   middle: 첫 줄 + 본문 2~5줄
//   hard  : 첫 줄 + 본문 (간단한 README 수준 — 동기/변경점/영향)
export type Strength = "simple" | "middle" | "hard";

// AI 호출 실패 시 hook 의 동작.
//   fallback: 안내 코멘트가 담긴 빈 메시지 템플릿을 적어 git 에디터가 열리고 사용자가 직접 작성 (기본)
//   abort   : 메시지를 비워둬 git 이 'empty commit message' 로 commit 을 취소
// hook 컨텍스트(특히 IDE) 에서는 인터랙티브 prompt 가 신뢰성 부족하므로
// 매번 묻지 않고 사용자가 미리 선택해두는 방식을 채택한다.
export type OnFailure = "fallback" | "abort";

// 한국어 출력 시 본문 종결 톤. 영어 출력에는 영향이 없다 (imperative 가 표준).
//   report (기본): 명사형/음슴체. "메뉴 항목 추가", "엔드포인트 분리" — 기술 보고서 톤.
//   polite       : 정중체. "~했습니다", "~합니다" — 격식 있는 글말 톤.
// 새로운 사용자 + 기존 사용자(미설정) 모두 'report' 로 동작.
export type Tone = "report" | "polite";

// `sm c` 가 메시지 생성 전에 "이번 변경의 의도/이유" 한 줄을 물어볼지 결정.
//   ask    (기본): TTY 환경일 때만 묻고, 빈 입력 (그냥 Enter) 으로 스킵 가능. 의도가 있으면 prompt 에 포함.
//   always       : TTY 환경에서 비어있지 않은 의도를 요구. 비어있으면 다시 묻는다. (강제 — 강한 자기 규율 모드)
//   never        : 묻지 않음. --intent <text> 플래그나 SM_INTENT env 로 명시 입력했을 때만 사용.
// non-TTY (hook, pipe, CI) 환경에서는 ask/always 라도 prompt 가 동작하지 않으므로 SM_INTENT env 만 참조한다.
export type CaptureIntent = "ask" | "always" | "never";

// `sm c` 가 commit 직전에 변경의 위험도를 평가하고 어떻게 대응할지.
//   warn (기본): 평가 후 점수와 사유를 보여주고, 점수 4 이상 + 위험 시간대일 때만 confirm. 그 외엔 안내만.
//   on        : 점수 4 이상이면 항상 confirm (시간대 무관).
//   off       : 평가 자체 수행 안 함.
// 위험 시간대(주말/금요일 늦은 시각/야간) 는 점수와 별도로 추가 경고로 표시된다.
export type RiskCheck = "warn" | "on" | "off";

// 최근 N 개 commit 을 스캔해서 staged 변경이 그것을 (부분) 되돌리는지 감지.
//   on (기본): 감지되면 안내만. commit 자체는 막지 않는다.
//   off      : 감지 안 함.
// false-positive 가 발생할 수 있는 영역이라 기본은 비차단성 안내로 둔다.
export type RevertCheck = "on" | "off";

// config 파일에 저장되는 전체 형태. 키는 provider 별로 따로 들고 있음
// → 사용자가 둘 다 로그인해두고 provider 만 바꿔서 쓸 수 있게.
export interface Config {
  provider: Provider;
  model: string;
  language: Language;
  strength: Strength;
  geminiApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  // AI 호출 실패 시 hook 의 동작. 미설정 시 'fallback' (안전한 기본값).
  onFailure?: OnFailure;
  // 한국어 출력 톤. 미설정 시 'report' (보고서 톤).
  tone?: Tone;
  // 프로젝트 단위로 깔아준 git hook 경로 목록. uninstall 시 자동 제거하려고 추적.
  installedHooks?: string[];
  // 글로벌 hook (core.hooksPath) 설치 여부. uninstall 시 정리 대상 식별용.
  globalHookInstalled?: boolean;
  // 글로벌 hook 설치 직전의 core.hooksPath 값. uninstall 시 복원하기 위해 보관.
  previousGlobalHooksPath?: string;

  // 메인 provider 가 실패 (503/timeout 등) 했을 때 자동으로 시도할 다른 provider.
  // 키가 등록되어 있어야 폴백이 동작한다. 미설정 시 폴백 없음.
  fallbackProvider?: Provider;

  // type 앞에 gitmoji 를 붙일지. 예: feat → ✨ feat. 미설정 시 false.
  gitmoji?: boolean;

  // 브랜치명에서 ISSUE-KEY (예: AUTH-123) 를 추출해 footer 에 'Refs: AUTH-123' 자동 첨부.
  // 미설정 시 false. 정규식은 git.ts 의 extractIssueKey 참조.
  autoIssue?: boolean;

  // 추가 디버그 출력. true 시 prompt/응답을 stderr 에 출력 (사용자 진단용).
  // 환경변수 SM_DEBUG=1 로도 동일하게 활성화 가능.
  verbose?: boolean;

  // Ollama endpoint URL. 미설정 시 http://localhost:11434.
  ollamaBaseUrl?: string;

  // OpenAI 호환 endpoint 의 base URL (Azure OpenAI, vLLM, OpenRouter 등).
  // 미설정 시 OpenAI 기본 endpoint 사용.
  openaiBaseUrl?: string;

  // `sm c` 의도 입력 모드. 미설정 시 'ask'.
  // 자세한 의미는 위 CaptureIntent 정의 참조.
  captureIntent?: CaptureIntent;

  // `sm c` 위험도 평가 모드. 미설정 시 'warn'.
  // 자세한 의미는 위 RiskCheck 정의 참조.
  riskCheck?: RiskCheck;

  // 최근 commit 대비 revert 감지 모드. 미설정 시 'on'.
  revertCheck?: RevertCheck;
  // 스캔할 commit 개수. 미설정 시 20.
  revertLookback?: number;
}

// 파일 경로는 한 곳에서만 계산. 다른 곳에서 직접 경로 만들지 않게 export.
const CONFIG_DIR = join(homedir(), ".smart-msg");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// 설정 읽기. 파일이 없으면 null → 호출자가 "로그인 먼저 하세요" 안내 가능.
export async function loadConfig(): Promise<Config | null> {
  if (!existsSync(CONFIG_PATH)) return null;
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Config;
}

// 설정 쓰기. 디렉토리 없으면 만들어주고, JSON 들여쓰기는 사람이 열어봐도 보기 좋게.
export async function saveConfig(config: Config): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// 부분 업데이트용. login 시 일부 필드만 바꾸고 나머지는 유지하기 위함.
export async function updateConfig(patch: Partial<Config>): Promise<Config> {
  const current = (await loadConfig()) ?? ({} as Config);
  const next = { ...current, ...patch } as Config;
  await saveConfig(next);
  return next;
}

// config 폴더를 통째로 제거. uninstall 시 사용 → API 키 잔존 방지.
// recursive + force 로 폴더 안 모든 파일 정리. 없어도 에러 안 남.
export async function removeConfigDir(): Promise<boolean> {
  if (!existsSync(CONFIG_DIR)) return false;
  await rm(CONFIG_DIR, { recursive: true, force: true });
  return true;
}

// 사용자에게 보여주거나 디버깅용. 다른 모듈에서 경로 알고 싶을 때.
export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
