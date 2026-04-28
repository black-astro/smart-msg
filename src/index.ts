#!/usr/bin/env node
// CLI 진입점. npm install -g 로 설치 시 `sm` 명령을 어디에서나 호출 가능.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import prompts from "prompts";
import { getStagedDiff, commit } from "./git.js";
import { generateCommitMessage } from "./ai.js";
import { runLogin } from "./login.js";
import { runLogout, runUninstall } from "./uninstall.js";
import { runInstallHook, runHookHandler } from "./installHook.js";
import { runConfig } from "./configCmd.js";
import { runCompletion } from "./completion.js";
import { runUpdate } from "./update.js";
import { fetchLatestVersion, compareSemver } from "./version.js";
import { loadConfig, getConfigPath } from "./config.js";

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
  .description("출력 언어, 메시지 강도, 모델을 변경합니다.")
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
program
  .command("commit")
  .alias("c")
  .description("staged diff 에서 커밋 메시지를 생성하고 커밋을 수행합니다.")
  .action(async () => {
    // 1) staged 된 diff 를 가져온다. git add 가 수행되지 않았다면 빈 문자열을 반환한다.
    const diff = await getStagedDiff();

    if (!diff.trim()) {
      console.log("스테이지된 변경사항이 없습니다. 먼저 git add 를 실행하시기 바랍니다.");
      process.exit(1);
    }

    // 2) AI 를 호출한다. 로그인이 되어있지 않은 경우 ai.ts 에서 안내 에러를 던진다.
    let message: string;
    try {
      message = await generateCommitMessage(diff);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }

    console.log("\n생성된 커밋 메시지:");
    console.log(message);

    // 3) 바로 커밋하지 않고 사용자에게 한 번 더 확인한다.
    const answer = await prompts({
      type: "confirm",
      name: "ok",
      message: "이 메시지로 커밋을 진행하시겠습니까?",
      initial: true,
    });

    if (!answer.ok) {
      console.log("취소되었습니다.");
      return;
    }

    // 4) 확인된 경우 실제 git commit 을 실행한다.
    await commit(message);
  });

program.parse();
