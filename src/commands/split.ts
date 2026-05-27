// `sm split` — 큰 staged diff 를 AI 가 분석하여 "이런 식으로 commit 을 나눠보면 어떨까" 안내.
// 자동 split 은 위험 (잘못 묶이면 사용자 작업을 망침) 하므로, 텍스트 제안만 출력하고 사용자가 직접 git reset + git add 진행.
import { getStagedDiff } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { t } from "../i18n.js";

export async function runSplit(): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  const diff = await getStagedDiff();
  if (!diff.trim()) {
    console.log(m.noStagedChanges);
    process.exit(1);
  }

  let text: string;
  try {
    text = await generateCommitMessage(diff, { mode: "split" });
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  console.log(`\n${m.splitHeader}\n`);
  console.log(text);
  console.log("");
  console.log(m.splitFooterHint);
}
