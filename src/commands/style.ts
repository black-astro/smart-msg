// `sm style` 본체. 학습 / 조회 / 삭제 3 가지 서브명령으로 구성.
//
//   sm style learn [--sample N]  : git log 최근 N (기본 200) 개를 분석해 ~/.smart-msg/styles/<repoKey>.json 저장
//   sm style show                 : 현재 저장된 스타일을 사람-읽기 가능한 형태로 출력
//   sm style clear                : 저장된 스타일 파일 제거
//
// 학습된 스타일이 있으면 `sm c` 가 prompt 에 자동 주입한다 (실제 주입은 ai.ts/buildPrompt 측).
import {
  clearStyle,
  deriveRepoKey,
  formatStyleForPrompt,
  getStylePath,
  learnStyle,
  loadStyle,
  saveStyle,
} from "../repoStyle.js";
import { loadConfig } from "../config.js";
import { t } from "../i18n.js";

export interface StyleLearnOptions {
  sample?: number;
}

export async function runStyleLearn(opts: StyleLearnOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const m = t(cfg?.language ?? "en");
  const sample = clampSample(opts.sample ?? 200);

  const repoKey = await deriveRepoKey();
  console.log(m.styleLearning(sample));

  let style;
  try {
    style = await learnStyle(sample);
  } catch (e) {
    console.error(m.styleLearnFailed((e as Error).message));
    process.exit(1);
  }

  if (style.sampledCommits === 0) {
    console.log(m.styleNoCommits);
    return;
  }

  await saveStyle(repoKey, style);
  console.log(m.styleLearned(style.sampledCommits, getStylePath(repoKey)));
  console.log("");
  console.log(formatStyleForPrompt(style));
}

export async function runStyleShow(): Promise<void> {
  const cfg = await loadConfig();
  const m = t(cfg?.language ?? "en");
  const repoKey = await deriveRepoKey();
  const style = await loadStyle(repoKey);
  if (!style) {
    console.log(m.styleNotLearned);
    return;
  }
  console.log(m.styleShowHeader(getStylePath(repoKey), style.analyzedAt));
  console.log("");
  console.log(formatStyleForPrompt(style));
}

export async function runStyleClear(): Promise<void> {
  const cfg = await loadConfig();
  const m = t(cfg?.language ?? "en");
  const repoKey = await deriveRepoKey();
  const removed = await clearStyle(repoKey);
  if (removed) console.log(m.styleCleared(getStylePath(repoKey)));
  else console.log(m.styleNotLearned);
}

function clampSample(n: number): number {
  if (!Number.isFinite(n)) return 200;
  return Math.max(10, Math.min(2000, Math.floor(n)));
}
