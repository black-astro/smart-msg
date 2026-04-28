// `sm update` — 사용자가 npm install -g smart-msg@latest 를 직접 입력하지 않아도
// CLI 한 줄로 자체 업데이트할 수 있게 한다.
//
// 동작:
//   1) 현재 버전 / 최신 버전 출력
//   2) 동일하면 안내 후 종료 (네트워크 실패 시에도 안전하게 안내)
//   3) 다르면 npm install -g smart-msg@latest 를 자식 프로세스로 실행하고 stdio 를 그대로 출력
//
// 의도적으로 npm 명령을 그대로 호출한다 (corepack, pnpm 등 다른 패키지 매니저는 다루지 않음).
// 글로벌 CLI 도구는 압도적으로 npm 으로 설치되며, 사용자가 npm 외 매니저를 쓰는 경우엔
// 그쪽 명령을 직접 실행하면 되므로 여기서는 가장 흔한 케이스만 자동화한다.
import { execa } from "execa";
import { getCurrentVersion, fetchLatestVersion, compareSemver } from "./version.js";

export async function runUpdate(): Promise<void> {
  const current = getCurrentVersion();
  const latest = await fetchLatestVersion();

  console.log(`현재 버전 : ${current}`);

  if (!latest) {
    // 네트워크/registry 일시 장애. 업데이트를 강행하지 않고 사용자가 판단하도록 안내한다.
    console.log("최신 버전을 확인하지 못했습니다. 잠시 후 다시 시도하시기 바랍니다.");
    return;
  }

  console.log(`최신 버전 : ${latest}`);

  const cmp = compareSemver(current, latest);
  if (cmp >= 0) {
    console.log("이미 최신 버전입니다.");
    return;
  }

  console.log(`\n업데이트를 시작합니다. (npm install -g smart-msg@latest)\n`);

  try {
    // stdio: 'inherit' 로 npm 진행 로그를 사용자가 그대로 볼 수 있게 한다.
    // Windows 의 npm.cmd 자동 처리는 execa 가 담당.
    await execa("npm", ["install", "-g", "smart-msg@latest"], { stdio: "inherit" });
    console.log(`\n업데이트가 완료되었습니다. (${current} → ${latest})`);
    console.log("새 셸 세션부터 즉시 적용됩니다.");
  } catch (e) {
    // 권한 문제(Linux/macOS sudo, Windows 관리자) 등 실패 케이스에 대해 사용자가 다음 행동을 알 수 있도록 안내.
    console.error("\n업데이트가 실패했습니다.");
    console.error((e as Error).message);
    console.error("\n수동으로 다음 명령을 실행하시기 바랍니다.");
    console.error("  npm install -g smart-msg@latest");
    process.exit(1);
  }
}
