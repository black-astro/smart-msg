#!/usr/bin/env node
// CLI 진입점. npm install -g 로 설치 시 `sm` 명령을 어디에서나 호출 가능.

import "dotenv/config";
import { Command } from "commander";
import prompts from "prompts";
import { getStagedDiff, commit } from "./git.js";
import { generateCommitMessage } from "./ai.js";
import { runLogin } from "./login.js";
import { runLogout, runUninstall } from "./uninstall.js";
import { runInstallHook, runHookHandler } from "./installHook.js";
import { runConfig } from "./configCmd.js";
import { loadConfig, getConfigPath } from "./config.js";

// commander 로 서브커맨드 구조를 구성한다. 새로운 명령은 이 파일에 한 줄 추가하여 확장한다.
const program = new Command();

program
  .name("sm")
  .description("staged 된 git diff 를 분석하여 커밋 메시지를 생성하는 CLI 도구입니다.")
  .version("0.1.0");

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

// `sm status` — 현재 저장된 설정을 출력한다.
program
  .command("status")
  .description("현재 저장된 설정을 출력합니다.")
  .action(async () => {
    const cfg = await loadConfig();
    if (!cfg) {
      console.log("로그인이 되어있지 않습니다. `sm login` 을 실행하시기 바랍니다.");
      return;
    }
    console.log(`provider : ${cfg.provider}`);
    console.log(`model    : ${cfg.model}`);
    console.log(`language : ${cfg.language ?? "(설정되지 않음)"}`);
    console.log(`strength : ${cfg.strength ?? "(설정되지 않음)"}`);
    console.log(`config   : ${getConfigPath()}`);
  });

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
