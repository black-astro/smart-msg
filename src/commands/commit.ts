// `sm c` 본체. staged diff → AI 메시지 생성 → y/r/e/n 선택 → commit.
//
// 선택지:
//   y (기본): 그대로 commit
//   r       : 다시 생성 (사용자가 결과가 마음에 안 들 때)
//   e       : 에디터로 열어서 수정 후 commit
//   n       : 취소
import { getStagedDiff, commit } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { askChoice } from "../cliPrompt.js";
import { editText } from "../editorEdit.js";
import { t } from "../i18n.js";

export interface CommitOptions {
  dryRun?: boolean;
}

export async function runCommit(opts: CommitOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  const diff = await getStagedDiff();
  if (!diff.trim()) {
    console.log(m.noStagedChanges);
    process.exit(1);
  }

  // 사용자가 'r' 로 재생성을 원할 수 있어 루프.
  let message = "";
  for (let i = 0; i < 5; i++) {
    try {
      message = await generateCommitMessage(diff);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }

    console.log(`\n${m.generatedMessageHeader}`);
    console.log(message);
    console.log("");

    if (opts.dryRun) {
      console.log(m.dryRunFinished);
      return;
    }

    const choice = await askChoice(
      m.commitChoicePrompt,
      [
        { key: "y", label: m.commitChoiceYes },
        { key: "r", label: m.commitChoiceRegen },
        { key: "e", label: m.commitChoiceEdit },
        { key: "n", label: m.commitChoiceNo },
      ],
      "y",
      lang,
    );

    if (choice === null || choice === "n") {
      console.log(m.cancelled);
      return;
    }

    if (choice === "y") {
      await commit(message);
      return;
    }

    if (choice === "e") {
      const edited = await editText(message, ".gitcommit");
      if (!edited) {
        console.log(m.cancelled);
        return;
      }
      await commit(edited);
      return;
    }

    // 'r' — 다시 생성. 루프 계속.
    console.log(m.regenerating);
  }

  console.log(m.regenLimitReached);
}
