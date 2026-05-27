#!/usr/bin/env node
// CLI 진입점. npm install -g 로 설치 시 `sm` 명령을 어디에서나 호출 가능.
//
// 설정/키는 모두 ~/.smart-msg/config.json 에서 읽으므로 dotenv 의 cwd 의존 자동 로드는 의도적으로 사용하지 않는다.
// (사용자 프로젝트의 무관한 .env 가 의도치 않게 환경에 끼어드는 사고를 막기 위함.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { runLogin } from "./login.js";
import { runLogout, runUninstall } from "./uninstall.js";
import { runInstallHook, runHookHandler } from "./installHook.js";
import { runConfig } from "./configCmd.js";
import { runCompletion } from "./completion.js";
import { runUpdate } from "./update.js";
import { fetchLatestVersion, compareSemver } from "./version.js";
import { loadConfig, getConfigPath } from "./config.js";
import { runCommit } from "./commands/commit.js";
import { runPr } from "./commands/pr.js";
import { runAmend } from "./commands/amend.js";
import { runSplit } from "./commands/split.js";

// `sm --version` 출력값을 package.json 의 version 과 자동 동기화한다.
// 과거 .version("0.1.0") 처럼 하드코딩하면 npm version 으로 버전을 올려도 CLI 출력이 안 바뀌어
// 사용자 입장에서 업데이트 적용 여부를 확인할 수 없는 문제가 있었기에 동기화로 전환한다.
// 빌드 결과는 dist/index.js 이고 패키지 루트의 package.json 을 가리키므로 ../package.json 으로 접근.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
) as { version: string };

// commander 로 서브커맨드 구조를 구성한다. 새로운 명령은 이 파일에 한 줄 추가하여 확장한다.
const program = new Command();

program
  .name("sm")
  .description("staged 된 git diff 를 분석하여 커밋 메시지를 생성하는 CLI 도구입니다.")
  .version(pkg.version);

// `sm login` — AI provider, 모델, 언어, 강도, API 키를 처음 등록한다.
program
  .command("login")
  .description("AI provider, 모델, 언어, 강도, API 키를 설정합니다.")
  .action(runLogin);

// `sm logout` — API 키만 제거한다 (계정 전환 등 가벼운 용도).
program
  .command("logout")
  .description("저장된 API 키를 제거합니다.")
  .action(runLogout);

// `sm config` — 설치 이후 언어, 강도, 모델을 변경한다. 키는 변경하지 않는다.
program
  .command("config")
  .description("출력 언어, 메시지 강도, 모델, 톤, 폴백 등 모든 설정을 변경합니다.")
  .action(runConfig);

// `sm uninstall` — 설정 및 hook 을 모두 제거한다. 패키지 본체 제거 안내까지 포함한다.
program
  .command("uninstall")
  .description("설정과 hook 을 모두 제거합니다. (npm 패키지 본체 제거는 별도로 수행해야 합니다.)")
  .action(runUninstall);

// `sm install-hook` — 현재 프로젝트에 prepare-commit-msg hook 을 설치한다.
// hook 이 설치되면 IntelliJ 커밋 창이나 `git commit` 명령만으로 자동 메시지 생성이 동작한다.
program
  .command("install-hook")
  .description("현재 프로젝트에 git prepare-commit-msg hook 을 설치합니다.")
  .action(runInstallHook);

// `sm hook-run` — hook 이 내부적으로 호출하는 숨은 명령이다. 사용자가 직접 호출하지 않는다.
// 인자: <msgFile> [source]  (git 이 prepare-commit-msg 에 전달하는 값을 그대로 받는다.)
program
  .command("hook-run <msgFile> [source]", { hidden: true })
  .description("(internal) prepare-commit-msg hook 핸들러입니다.")
  .action(async (msgFile: string, source?: string) => {
    await runHookHandler(msgFile, source);
  });

// `sm completion <shell>` — 셸 자동완성 등록 스크립트를 출력한다.
// gh / kubectl / npm 등이 채택한 표준 패턴으로, 사용자가 출력을 자기 셸 rc 파일에 source 한다.
program
  .command("completion [shell]")
  .description("셸 자동완성 등록 스크립트를 출력합니다. (bash, zsh, powershell, clink)")
  .action(async (shell?: string) => {
    await runCompletion(shell);
  });

// `sm status` — 현재 저장된 설정과 버전 정보를 출력한다.
// 버전 비교는 npm registry 에 query 를 보내므로 네트워크가 끊겨있어도 본 출력 자체는 깨지지 않게 처리한다.
program
  .command("status")
  .description("현재 저장된 설정과 버전(현재/최신) 을 출력합니다.")
  .action(async () => {
    const cfg = await loadConfig();
    const current = pkg.version;

    // 설정 부분 — 로그인 안 한 경우 안내. 단, 버전 정보는 그래도 표시한다.
    if (cfg) {
      console.log(`provider : ${cfg.provider}`);
      console.log(`model    : ${cfg.model}`);
      console.log(`language : ${cfg.language ?? "(not set)"}`);
      console.log(`strength : ${cfg.strength ?? "(not set)"}`);
      console.log(`tone     : ${cfg.tone ?? "report"}`);
      console.log(`gitmoji  : ${cfg.gitmoji ? "on" : "off"}`);
      console.log(`autoIssue: ${cfg.autoIssue ? "on" : "off"}`);
      console.log(`fallback : ${cfg.fallbackProvider ?? "(none)"}`);
      console.log(`onFail   : ${cfg.onFailure ?? "fallback"}`);
      console.log(`verbose  : ${cfg.verbose ? "on" : "off"}`);
      console.log(`intent   : ${cfg.captureIntent ?? "ask"}`);
      console.log(`risk     : ${cfg.riskCheck ?? "warn"}`);
      console.log(`config   : ${getConfigPath()}`);
    } else {
      console.log("Not logged in. Run `sm login` to set up.");
    }

    // 최신 버전 조회. 네트워크 실패 시 latest 만 '?' 로 표기하고 본 명령은 정상 종료한다.
    const latest = await fetchLatestVersion();
    if (!latest) {
      console.log(`version  : ${current} (latest: unknown — network unavailable)`);
      return;
    }

    const cmp = compareSemver(current, latest);
    if (cmp >= 0) {
      console.log(`version  : ${current} (latest: ${latest}, up to date)`);
    } else {
      console.log(`version  : ${current} → latest ${latest}  ⇣  run \`sm update\` to upgrade`);
    }
  });

// `sm update` — npm install -g smart-msg@latest 를 자식 프로세스로 실행해 자체 업데이트한다.
program
  .command("update")
  .description("smart-msg 를 npm registry 의 최신 버전으로 업데이트합니다.")
  .action(runUpdate);

// `sm commit` (또는 `sm c`) — staged diff 를 기반으로 메시지를 생성하고 커밋한다.
//
// --intent <text>  : 의도(왜) 를 한 줄로 명시 입력. 인터랙티브 prompt 를 건너뛴다.
// --no-intent      : 의도 prompt 를 강제로 건너뛴다 (captureIntent=always 라도).
// 의도가 비어있거나 noIntent 인 경우 기존처럼 diff 만 보고 생성한다.
program
  .command("commit")
  .alias("c")
  .option("--dry-run", "메시지만 출력하고 commit 은 실행하지 않습니다.")
  .option("--intent <text>", "이번 변경의 '왜' 를 한 줄로 명시 (인터랙티브 prompt 우회).")
  .option("--no-intent", "의도 입력 prompt 를 강제로 건너뜁니다 (captureIntent=always 우회).")
  .option("--skip-risk", "위험도 평가/confirm 단계를 건너뜁니다.")
  .description("staged diff 에서 커밋 메시지를 생성하고 커밋을 수행합니다.")
  .action(async (opts: { dryRun?: boolean; intent?: string | false; skipRisk?: boolean }) => {
    // commander 는 --no-intent 가 켜진 경우 opts.intent 를 false 로 설정한다.
    // typeof === "string" 인 경우에만 사용자가 텍스트를 명시한 것으로 간주한다.
    const intent = typeof opts.intent === "string" ? opts.intent : undefined;
    const noIntent = opts.intent === false;
    await runCommit({
      dryRun: opts.dryRun === true,
      intent,
      noIntent,
      skipRisk: opts.skipRisk === true,
    });
  });

// `sm pr` — base..HEAD 의 변경을 분석하여 PR 본문 (Summary + Test plan) 을 생성한다.
program
  .command("pr")
  .option("--base <ref>", "비교 base ref 를 지정합니다. 미지정 시 origin/main 등 자동 탐지.")
  .description("현재 브랜치의 base..HEAD 변경으로 PR 본문 초안을 생성합니다.")
  .action(async (opts: { base?: string }) => {
    await runPr({ base: opts.base });
  });

// `sm amend` — 마지막 commit 의 메시지만 다시 생성하여 amend.
program
  .command("amend")
  .description("마지막 commit 의 메시지를 다시 생성하여 git commit --amend 합니다.")
  .action(async () => {
    await runAmend();
  });

// `sm split` — 큰 staged diff 를 의미 단위 commit 들로 어떻게 나눌지 AI 가 제안한다.
program
  .command("split")
  .description("staged diff 를 의미 단위 commit 들로 분할하는 방법을 AI 가 제안합니다.")
  .action(async () => {
    await runSplit();
  });

// 인자 없이 sm 만 실행한 경우 — 로그인 안내 + 빠른 시작 가이드. commander 기본 도움말보다 친절.
if (process.argv.length <= 2) {
  void (async () => {
    const cfg = await loadConfig();
    console.log(`sm (smart-msg) v${pkg.version} — AI git commit message generator`);
    console.log("");
    if (!cfg) {
      console.log("아직 로그인되지 않았습니다. 다음 명령으로 시작하세요:");
      console.log("  sm login");
      console.log("");
      console.log("자세한 도움말: sm --help");
    } else {
      console.log(`provider : ${cfg.provider}  /  model: ${cfg.model}`);
      console.log("");
      console.log("자주 쓰는 명령:");
      console.log("  sm c        # staged diff 로 메시지 생성 + commit");
      console.log("  sm pr       # 현재 브랜치 변경으로 PR 본문 생성");
      console.log("  sm amend    # 마지막 commit 메시지 재생성");
      console.log("  sm split    # 큰 staged diff 분할 제안");
      console.log("  sm config   # 설정 변경");
      console.log("  sm status   # 현재 설정 + 버전 확인");
      console.log("");
      console.log("전체 명령 목록: sm --help");
    }
    process.exit(0);
  })();
} else {
  program.parse();
}
