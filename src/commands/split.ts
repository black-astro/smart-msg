// `sm split` — staged diff 분할 제안.
//
// 1) 로컬 휴리스틱 제안 (semanticSplit): LLM 없이 빠르고 결정적. 카테고리별 묶음 + git 명령 동봉.
// 2) AI 텍스트 제안 (mode=split): LLM 이 본 의미 단위 그룹화 — 자유 형식 보조.
//
// 두 제안은 독립적. 사용자는 어느 쪽이든 따라가면 됨.
// --no-ai 로 LLM 호출 생략 (네트워크 차단 환경 / 비용 절감).
// --local-only 는 --no-ai 와 동일.
import { getStagedDiff } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { t } from "../i18n.js";
import { parseUnifiedDiff } from "../revertDetector.js";
import { formatProposal, proposeFromStaged } from "../semanticSplit.js";

export interface SplitOptions {
  // true 면 LLM 호출 생략.
  noAi?: boolean;
}

export async function runSplit(opts: SplitOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  const diff = await getStagedDiff();
  if (!diff.trim()) {
    console.log(m.noStagedChanges);
    process.exit(1);
  }

  // 1) 로컬 휴리스틱 제안 — 즉시 출력 (빠름, 결정적).
  const staged = parseUnifiedDiff(diff);
  const proposal = proposeFromStaged(staged);

  console.log(`\n${m.splitLocalHeader}`);
  if (proposal.shouldSplit) {
    console.log(formatProposal(proposal));
  } else {
    console.log(m.splitLocalNoSplit);
  }
  console.log("");

  // 2) LLM 텍스트 제안 — 옵션 / 네트워크 가능할 때만.
  if (opts.noAi) {
    console.log(m.splitAiSkipped);
    return;
  }

  let text: string;
  try {
    text = await generateCommitMessage(diff, { mode: "split" });
  } catch (e) {
    console.error(`\n${m.splitAiFailed((e as Error).message)}`);
    return;
  }

  console.log(`\n${m.splitAiHeader}\n`);
  console.log(text);
  console.log("");
  console.log(m.splitFooterHint);
}
