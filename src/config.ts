// 사용자별 설정을 ~/.smart-msg/config.json 에 저장/로드.
// 모든 프로젝트에서 공유되어야 하므로 홈 디렉토리에 둠.
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

// 어떤 AI 를 쓰는지 식별하는 태그. 새 provider 추가하면 여기 늘리면 됨.
export type Provider = "openai" | "claude";

// 커밋 메시지 출력 언어.
export type Language = "ko" | "en";

// 메시지 길이/상세도 단계.
//   simple: 한 줄 (Conventional Commit 형식만)
//   middle: 첫 줄 + 본문 2~5줄
//   hard  : 첫 줄 + 본문 (간단한 README 수준 — 동기/변경점/영향)
export type Strength = "simple" | "middle" | "hard";

// config 파일에 저장되는 전체 형태. 키는 provider 별로 따로 들고 있음
// → 사용자가 둘 다 로그인해두고 provider 만 바꿔서 쓸 수 있게.
export interface Config {
  provider: Provider;
  model: string;
  language: Language;
  strength: Strength;
  openaiApiKey?: string;
  claudeApiKey?: string;
  // 우리가 깔아준 git hook 경로 목록. uninstall 시 자동 제거하려고 추적.
  installedHooks?: string[];
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
