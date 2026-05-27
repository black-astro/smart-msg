// `sm amend` — 마지막 commit 의 메시지를 AI 로 재생성하여 git commit --amend.
//
// 사용 시점:
//   - commit 메시지가 마음에 안 들 때 (yet 푸시 전)
//   - hook 이 실패해서 가짜 메시지가 들어갔을 때
//
// 안전장치:
//   - 마지막 commit 의 diff 가 비어있으면 (root commit 이거나 merge) 동작 안 함
//   - amend 전 사용자 확인 1회
import { amend, getLastCommitDiff } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { askChoice } from "../cliPrompt.js";
import { editText } from "../editorEdit.js";
import { t } from "../i18n.js";

export async function runAmend(): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  const diff = await getLastCommitDiff();
  if (!diff.trim()) {
    console.error(m.amendNoLastDiff);
    process.exit(1);
  }

  let message = "";
  for (let i = 0; i < 5; i++) {
    try {
      message = await generateCommitMessage(diff);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }

    console.log(`\n${m.amendGeneratedHeader}`);
    console.log(message);
    console.log("");

    const choice = await askChoice(
      m.amendChoicePrompt,
      [
        { key: "y", label: m.amendChoiceYes },
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
      await amend(message);
      return;
    }
    if (choice === "e") {
      const edited = await editText(message, ".gitcommit");
      if (!edited) {
        console.log(m.cancelled);
        return;
      }
      await amend(edited);
      return;
    }
    console.log(m.regenerating);
  }

  console.log(m.regenLimitReached);
}
