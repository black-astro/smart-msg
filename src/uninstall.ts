// `sm logout` / `sm uninstall` 동작.
// npm 이 글로벌 uninstall 시 스크립트를 막아둬서, 사용자 흔적(특히 API 키)은 직접 지워야 함.
import prompts from "prompts";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import {
  loadConfig,
  saveConfig,
  removeConfigDir,
  getConfigDir,
} from "./config.js";

// `sm logout` — 키만 비우기 (API 키 제거). hook 추적 정보는 보존 → 나중에 uninstall 이 hook 정리 가능.
export async function runLogout(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log("로그인 상태가 아닙니다.");
    return;
  }

  // hook 정보·언어·강도는 보존, 인증 관련 필드만 제거해서 다시 저장.
  await saveConfig({
    provider: cfg.provider,
    model: cfg.model,
    language: cfg.language,
    strength: cfg.strength,
    installedHooks: cfg.installedHooks,
  });

  console.log("로그아웃 완료. 저장된 API 키를 제거했어요.");
  console.log("다시 사용하려면 `sm login`.");
}

// `sm uninstall` — 모든 흔적 제거 + 마지막 단계 안내.
// 1) 우리가 설치한 git hook 들 제거 (config 에 기록된 경로 기준)
// 2) ~/.smart-msg 폴더 통째로 삭제
// 3) 사용자에게 "마지막으로 npm uninstall -g" 한 줄 안내 (npm 글로벌 패키지 자체는 못 지움)
export async function runUninstall(): Promise<void> {
  // 사용자에게 한 번 더 확인 → 실수 방지. 위험한 명령은 항상 confirm.
  const { ok } = await prompts({
    type: "confirm",
    name: "ok",
    message: "정말 모든 설정과 hook 을 삭제할까요?",
    initial: false,
  });
  if (!ok) {
    console.log("취소됨");
    return;
  }

  const cfg = await loadConfig();

  // 1) hook 파일들 제거. config 에 기록 안 돼 있을 수도 있으니 안전하게 옵셔널 처리.
  const hookPaths = cfg?.installedHooks ?? [];
  let removedHooks = 0;
  for (const hookPath of hookPaths) {
    if (existsSync(hookPath)) {
      await rm(hookPath, { force: true });
      removedHooks++;
    }
  }

  // 2) 설정 디렉토리 통째 제거 → API 키 완전 삭제 보장.
  const configDir = getConfigDir();
  const removedConfig = await removeConfigDir();

  // 3) 결과 리포트 + 마지막 단계 안내.
  console.log("\n정리 결과:");
  if (removedConfig) console.log(`  ✓ 설정 폴더 삭제: ${configDir}`);
  if (removedHooks > 0) console.log(`  ✓ git hook ${removedHooks}개 제거`);
  if (!removedConfig && removedHooks === 0) {
    console.log("  (정리할 흔적 없음)");
  }

  console.log("\n마지막으로 패키지 자체를 지우려면:");
  console.log("  npm uninstall -g smart-msg     # 글로벌 설치한 경우");
  console.log("  npm unlink -g smart-msg        # npm link 로 등록한 경우");
}
