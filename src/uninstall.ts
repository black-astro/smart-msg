// `sm logout` 및 `sm uninstall` 의 동작을 정의한다.
// npm 은 글로벌 패키지 uninstall 시 lifecycle script 의 실행을 차단하므로, 사용자 흔적(특히 API 키)은 직접 정리해야 한다.
import prompts from "prompts";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { execa } from "execa";
import {
  loadConfig,
  saveConfig,
  removeConfigDir,
  getConfigDir,
} from "./config.js";

// `sm logout` — API 키만 제거하고 나머지 설정(언어/강도/톤/hook/폴백 등)은 전부 보존한다.
// 과거에는 명시 필드만 saveConfig 에 다시 적었기에 onFailure/tone/globalHookInstalled 등이
// 사일런트하게 사라지는 사고가 있어, 모든 키 필드만 명시적으로 비우는 방식으로 전환한다.
export async function runLogout(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("로그인 상태가 아닙니다.");
    return;
  }

  const next = { ...cfg };
  delete next.geminiApiKey;
  delete next.groqApiKey;
  delete next.openaiApiKey;
  delete next.claudeApiKey;

  await saveConfig(next);

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

  // 1) 프로젝트 단위 hook 파일을 제거한다.
  const hookPaths = cfg?.installedHooks ?? [];
  let removedHooks = 0;
  for (const hookPath of hookPaths) {
    if (existsSync(hookPath)) {
      await rm(hookPath, { force: true });
      removedHooks++;
    }
  }

  // 2) 글로벌 hook (core.hooksPath) 정리. 설치 직전 값이 있으면 복원, 없으면 unset.
  let restoredGlobal = false;
  if (cfg?.globalHookInstalled) {
    try {
      if (cfg.previousGlobalHooksPath) {
        await execa("git", [
          "config",
          "--global",
          "core.hooksPath",
          cfg.previousGlobalHooksPath,
        ]);
      } else {
        await execa("git", ["config", "--global", "--unset", "core.hooksPath"]);
      }
      restoredGlobal = true;
    } catch {
      // 이미 unset 인 경우 git 이 비정상 코드를 반환할 수 있으나 정상 흐름이다.
    }
  }

  // 3) 설정 디렉토리를 통째로 제거한다. API 키의 완전한 삭제를 보장한다.
  const configDir = getConfigDir();
  const removedConfig = await removeConfigDir();

  // 4) 결과 리포트와 마지막 단계를 안내한다.
  console.log("\n정리 결과:");
  if (removedConfig) console.log(`  - 설정 폴더 제거: ${configDir}`);
  if (removedHooks > 0) console.log(`  - 프로젝트 git hook ${removedHooks} 개 제거`);
  if (restoredGlobal) console.log(`  - 글로벌 git hooksPath 정리`);
  if (!removedConfig && removedHooks === 0 && !restoredGlobal) {
    console.log("  (제거할 항목이 없습니다.)");
  }

  console.log("\n패키지 본체를 제거하려면 다음 명령을 실행합니다.");
  console.log("  npm uninstall -g smart-msg     # 글로벌 설치한 경우");
  console.log("  npm unlink -g smart-msg        # npm link 로 등록한 경우");
}
