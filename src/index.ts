#!/usr/bin/env node
// CLI 진입점. npm install -g 로 깔면 `sm` 명령으로 어디서든 호출 가능.

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

// commander 로 서브커맨드 구조 만들기. 나중에 install-hook 등 더 추가하기 쉬움.
const program = new Command();

program
  .name("sm")
  .description("AI git commit message generator")
  .version("0.1.0");

// `sm login` — AI/모델 선택하고 키 저장. 처음 한 번만 실행하면 됨.
program
  .command("login")
  .description("AI 선택 + 모델 선택 + API 키 등록")
  .action(runLogin);

// `sm logout` — API 키만 제거 (계정 전환용). 가벼움.
program.command("logout").description("저장된 API 키 제거").action(runLogout);

// `sm config` — 설치 후 언어/강도/모델 변경. 키는 안 건드림.
program
  .command("config")
  .description("language / strength / model 변경")
  .action(runConfig);

// `sm uninstall` — 모든 흔적 제거 (config 폴더 + hook). 마지막 단계 안내까지.
program
  .command("uninstall")
  .description("설정/hook 모두 제거 (npm 패키지 제거는 별도)")
  .action(runUninstall);

// `sm install-hook` — 현재 프로젝트에 prepare-commit-msg hook 설치.
// 이 hook 이 깔리면 IntelliJ 커밋 창 / `git commit` 만으로 자동 메시지 채움.
program
  .command("install-hook")
  .description("현재 프로젝트에 git prepare-commit-msg hook 설치")
  .action(runInstallHook);

// `sm hook-run` — hook 이 내부적으로 호출하는 숨은 명령. 사용자가 직접 부르지 않음.
// 인자: <msgFile> [source]  (git 이 prepare-commit-msg 에 넘기는 값 그대로 전달됨)
program
  .command("hook-run <msgFile> [source]", { hidden: true })
  .description("(internal) prepare-commit-msg hook 핸들러")
  .action(async (msgFile: string, source?: string) => {
    await runHookHandler(msgFile, source);
  });

// `sm status` — 현재 어떤 설정으로 돌아가는지 확인용. 디버깅에 유용.
program
  .command("status")
  .description("현재 저장된 설정 표시")
  .action(async () => {
    const cfg = await loadConfig();
    if (!cfg) {
      console.log("아직 로그인 안 됨. `sm login` 을 실행하세요.");
      return;
    }
    console.log(`provider : ${cfg.provider}`);
    console.log(`model    : ${cfg.model}`);
    console.log(`language : ${cfg.language ?? "(미설정)"}`);
    console.log(`strength : ${cfg.strength ?? "(미설정)"}`);
    console.log(`config   : ${getConfigPath()}`);
  });

// `sm commit` (또는 `sm c`) — 본 게임. staged diff → AI → 사용자 확인 → 커밋.
program
  .command("commit")
  .alias("c")
  .description("Generate commit message from staged diff")
  .action(async () => {
    // 1) staged 된 diff 가져오기. git add 안 했으면 빈 문자열.
    const diff = await getStagedDiff();

    if (!diff.trim()) {
      console.log("No staged changes. Run git add first.");
      process.exit(1);
    }

    // 2) AI 호출. 로그인 안 됐으면 ai.ts 에서 친절한 에러 던져줌.
    let message: string;
    try {
      message = await generateCommitMessage(diff);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }

    console.log("\n추천 커밋 메시지:");
    console.log(message);

    // 3) 바로 커밋하지 말고 사용자에게 한 번 더 확인.
    const answer = await prompts({
      type: "confirm",
      name: "ok",
      message: "이 메시지로 커밋할까요?",
      initial: true,
    });

    if (!answer.ok) {
      console.log("취소됨");
      return;
    }

    // 4) 확인되면 실제 git commit 실행.
    await commit(message);
  });

program.parse();
