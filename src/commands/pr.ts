// `sm pr` — base..HEAD 의 diff 를 분석하여 PR 본문 (Summary + Test plan) 을 생성한다.
// gh CLI 의존성은 없음. 출력은 stdout 으로 — 사용자가 직접 PR 본문에 복사하거나
// `sm pr | gh pr create --body-file -` 처럼 파이프로 연결 가능.
import { detectBaseRef, getRangeDiff, getRangeCommits } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { t } from "../i18n.js";

export interface PrOptions {
  base?: string;
}

export async function runPr(opts: PrOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  // 1) base 결정. 사용자 지정 > 자동 탐지.
  const base = opts.base ?? (await detectBaseRef());
  if (!base) {
    console.error(m.prNoBase);
    process.exit(1);
  }

  // 2) base..HEAD diff. 비어 있으면 PR 만들 게 없음.
  const diff = await getRangeDiff(base);
  if (!diff.trim()) {
    console.error(m.prNoDiff(base));
    process.exit(1);
  }

  // 3) 보조 컨텍스트로 commit subject 목록도 prompt 끝에 붙이면 모델이 흐름을 더 잘 잡는다.
  //    diff 안에 이미 흐름이 있긴 하지만, 짧은 subject 들은 토큰 비용 거의 없으니 같이 보냄.
  const subjects = await getRangeCommits(base);
  const enriched = subjects.length > 0
    ? `${diff}\n\n[commit history]\n${subjects.map((s) => `- ${s}`).join("\n")}`
    : diff;

  // 4) ai 라우터에 mode: 'pr' 로 위임. branch context (이슈키 footer 포함) 도 자동 처리됨.
  let body: string;
  try {
    body = await generateCommitMessage(enriched, { mode: "pr" });
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  // PR 본문은 그대로 출력. stderr 에 사용 안내 한 줄 추가.
  process.stdout.write(`${body}\n`);
  console.error(`\n${m.prHint}`);
}
