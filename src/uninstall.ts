// `sm logout` 및 `sm uninstall` 의 동작을 정의한다.
// npm 은 글로벌 패키지 uninstall 시 lifecycle script 의 실행을 차단하므로, 사용자 흔적(특히 API 키)은 직접 정리해야 한다.
import prompts from "prompts";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import {
  loadConfig,
  saveConfig,
  removeConfigDir,
  getConfigDir,
} from "./config.js";

// `sm logout` — 키만 제거한다. hook 추적 정보는 보존하여 이후 uninstall 이 hook 을 정리할 수 있게 한다.
export async function runLogout(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("로그인 상태가 아닙니다.");
    return;
  }

  // hook 정보, 언어, 강도는 보존하고 인증 관련 필드만 제거한 후 다시 저장한다.
  await saveConfig({
    provider: cfg.provider,
    model: cfg.model,
    language: cfg.language,
    strength: cfg.strength,
    installedHooks: cfg.installedHooks,
  });

  console.log("로그아웃이 완료되었습니다. 저장된 API 키가 제거되었습니다.");
  console.log("다시 사용하려면 `sm login` 을 실행합니다.");
}

// `sm uninstall` — 모든 흔적을 제거하고 마지막 단계를 안내한다.
// 1) 우리가 설치한 git hook 을 제거한다 (config 에 기록된 경로 기준).
// 2) ~/.smart-msg 디렉토리를 통째로 제거한다.
// 3) "마지막으로 npm uninstall -g" 안내를 출력한다 (npm 글로벌 패키지 본체는 lifecycle 차단으로 인해 직접 제거 불가).
export async function runUninstall(): Promise<void> {
  // 사용자에게 한 번 더 확인을 받는다. 위험한 명령은 항상 confirm 을 거친다.
  const { ok } = await prompts({
    type: "confirm",
    name: "ok",
    message: "모든 설정과 hook 을 제거합니다. 계속하시겠습니까?",
    initial: false,
  });
  if (!ok) {
    console.log("취소되었습니다.");
    return;
  }

  const cfg = await loadConfig();

  // 1) hook 파일을 제거한다. config 에 기록되지 않았을 가능성을 고려하여 옵셔널 처리한다.
  const hookPaths = cfg?.installedHooks ?? [];
  let removedHooks = 0;
  for (const hookPath of hookPaths) {
    if (existsSync(hookPath)) {
      await rm(hookPath, { force: true });
      removedHooks++;
    }
  }

  // 2) 설정 디렉토리를 통째로 제거한다. API 키의 완전한 삭제를 보장한다.
  const configDir = getConfigDir();
  const removedConfig = await removeConfigDir();

  // 3) 결과 리포트와 마지막 단계를 안내한다.
  console.log("\n정리 결과:");
  if (removedConfig) console.log(`  - 설정 폴더 제거: ${configDir}`);
  if (removedHooks > 0) console.log(`  - git hook ${removedHooks} 개 제거`);
  if (!removedConfig && removedHooks === 0) {
    console.log("  (제거할 항목이 없습니다.)");
  }

  console.log("\n패키지 본체를 제거하려면 다음 명령을 실행합니다.");
  console.log("  npm uninstall -g smart-msg     # 글로벌 설치한 경우");
  console.log("  npm unlink -g smart-msg        # npm link 로 등록한 경우");
}
