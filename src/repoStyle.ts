// Repo style learner.
//
// 목적: 팀/저장소의 실제 commit 메시지 스타일을 학습하여, 향후 생성 시 그 스타일에
// 자연스럽게 맞춘다. 모든 도구가 "generic Conventional Commits" 만 박는데,
// 실제 팀들은 제각각 톤(imperative/past, 본문 길이, 이모지 사용, 이슈키 footer 형식)
// 이 다르다. 이 모듈은 git log 를 읽어 그 톤을 추출해 prompt 에 주입한다.
//
// 분석 항목:
//   - Conventional Commit (CC) 헤더 채택률
//   - 자주 쓰는 type / scope
//   - subject 평균 길이 + p90
//   - 본문 (body) 보유율 / 평균 줄 수
//   - bullet 스타일 (- vs * vs 없음)
//   - 출력 언어 비율 (KO / EN — 한글 음절 비율 휴리스틱)
//   - gitmoji 사용률
//   - 이슈키 footer 형식 (Refs: / Closes: / #123 / [AUTH-1])
//
// 저장:
//   ~/.smart-msg/styles/<repoKey>.json
//   repoKey = origin URL 해시 (없으면 cwd 의 SHA1 prefix).
//
// 비-부수효과 함수 (analyzeCommitMessage, aggregateStyle, formatStyleForPrompt)
// 와 git/디스크 영역 (learnStyle, loadStyle, saveStyle) 을 분리해 테스트 가능.
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execa } from "execa";

// 한 commit 의 분석 결과.
export interface CommitFeatures {
  // 첫 줄이 Conventional Commits 헤더 패턴인가? type(scope?)!?: summary
  isCC: boolean;
  type: string | null;
  scope: string | null;
  subject: string;
  subjectLength: number;
  hasGitmoji: boolean;
  // 본문 (subject 다음 빈 줄 이후) 줄 수.
  bodyLines: number;
  // 본문에 bullet 이 있는지. '-' 또는 '*' 시작 라인 비율.
  bulletStyle: "dash" | "star" | "none";
  // 한글 음절(가-힣) 비율 > 0.3 이면 ko 로 판정.
  language: "ko" | "en";
  // 이슈키 footer 매치된 형식. 없으면 null.
  issueRef: "Refs" | "Closes" | "Fixes" | "Resolves" | "hash" | "bracket" | null;
}

// 여러 commit 의 집계 결과.
export interface RepoStyle {
  // 분석한 commit 수.
  sampledCommits: number;
  // CC 채택률 (0.0~1.0).
  ccRatio: number;
  // 상위 type 5 개 + 빈도.
  topTypes: Array<{ name: string; count: number }>;
  // 상위 scope 5 개 + 빈도.
  topScopes: Array<{ name: string; count: number }>;
  // subject 평균 길이 / p90.
  subjectLenAvg: number;
  subjectLenP90: number;
  // 본문 보유율 + 평균 줄 수 (본문 있는 commit 만 대상).
  bodyRatio: number;
  bodyLineAvg: number;
  // bullet 스타일 결정 (본문 있는 commit 중 우세).
  preferredBullet: "dash" | "star" | "none";
  // 언어 비율 + 결정.
  koRatio: number;
  preferredLanguage: "ko" | "en";
  // gitmoji 사용률.
  gitmojiRatio: number;
  // 이슈키 footer 형식 — 가장 흔한 것.
  preferredIssueRef: CommitFeatures["issueRef"];
  // 분석 시각 (ISO).
  analyzedAt: string;
}

// 모델/외부 호출 시 prompt 에 주입할 사람-읽기 가능한 요약.
export function formatStyleForPrompt(style: RepoStyle): string {
  const lines: string[] = [];
  lines.push(`저장소 commit 스타일 (최근 ${style.sampledCommits} 개 분석):`);
  if (style.ccRatio >= 0.6) {
    lines.push(`- Conventional Commits 채택률 ${pct(style.ccRatio)} — type(scope): summary 형식을 강하게 따름`);
  } else if (style.ccRatio >= 0.2) {
    lines.push(`- Conventional Commits 부분 사용 (${pct(style.ccRatio)}) — 가능하면 CC 형식, 단 강제 아님`);
  } else {
    lines.push(`- Conventional Commits 미사용 (${pct(style.ccRatio)}) — 자유 형식 우선`);
  }
  if (style.topTypes.length > 0) {
    lines.push(`- 자주 쓰는 type: ${style.topTypes.map((t) => t.name).join(", ")}`);
  }
  if (style.topScopes.length > 0) {
    lines.push(`- 자주 쓰는 scope: ${style.topScopes.map((s) => s.name).join(", ")}`);
  }
  lines.push(`- subject 길이: 평균 ${Math.round(style.subjectLenAvg)}자 / p90 ${Math.round(style.subjectLenP90)}자`);
  if (style.bodyRatio >= 0.5) {
    lines.push(`- 본문 보유율 ${pct(style.bodyRatio)} — 본문을 적극 포함하는 편. 평균 ${Math.round(style.bodyLineAvg)} 줄.`);
    if (style.preferredBullet !== "none") {
      lines.push(`- 본문 bullet 스타일: '${style.preferredBullet === "dash" ? "-" : "*"}'`);
    }
  } else {
    lines.push(`- 본문 보유율 ${pct(style.bodyRatio)} — 한 줄 commit 비중 큼.`);
  }
  lines.push(`- 출력 언어: ${style.preferredLanguage === "ko" ? "한국어" : "영어"} (KO 비율 ${pct(style.koRatio)})`);
  if (style.gitmojiRatio >= 0.3) {
    lines.push(`- gitmoji 사용률 ${pct(style.gitmojiRatio)} — type 앞에 이모지 prefix 권장`);
  }
  if (style.preferredIssueRef) {
    lines.push(`- 이슈 footer 형식: ${style.preferredIssueRef}`);
  }
  lines.push(`이 스타일을 best-effort 로 반영하되, 기본 출력 형식 (Conventional Commit 또는 자유) 은 그대로 따르세요.`);
  return lines.join("\n");
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// 단일 commit 메시지 분석.
export function analyzeCommitMessage(raw: string): CommitFeatures {
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  const lines = trimmed.split("\n");
  const subjectLine = lines[0] ?? "";

  // gitmoji prefix 분리 (있어도 type 매치는 그 뒤를 본다).
  const gitmojiMatch = subjectLine.match(/^([✨🐛📝♻️⚡️✅🔧📦💄🎉🚀]+)\s+(.*)$/);
  const hasGitmoji = Boolean(gitmojiMatch);
  const afterEmoji = gitmojiMatch ? gitmojiMatch[2] : subjectLine;

  // Conventional Commit 헤더 매치: type(scope?)!?: summary
  // type 은 소문자 단어 (영문자만), scope 는 영숫자+-_/.
  const cc = afterEmoji.match(/^([a-z]+)(\(([^)]+)\))?(!)?:\s+(.+)$/);
  const isCC = Boolean(cc);
  const type = cc ? cc[1] : null;
  const scope = cc ? cc[3] ?? null : null;
  const subject = cc ? cc[5] : afterEmoji;
  const subjectLength = subject.length;

  // 본문 분석 — subject + 빈 줄 다음부터.
  // body 시작 위치: 첫 빈 줄 다음 줄.
  let bodyStart = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "" || lines[i].trim() === "") {
      bodyStart = i + 1;
      break;
    }
  }
  const bodyLinesArr = bodyStart > 0 ? lines.slice(bodyStart).filter((l) => l.trim() !== "") : [];
  const bodyLines = bodyLinesArr.length;

  // bullet 스타일.
  let bulletStyle: "dash" | "star" | "none" = "none";
  if (bodyLinesArr.length > 0) {
    const dashCount = bodyLinesArr.filter((l) => /^\s*-\s+/.test(l)).length;
    const starCount = bodyLinesArr.filter((l) => /^\s*\*\s+/.test(l)).length;
    if (dashCount > starCount && dashCount >= Math.max(1, bodyLinesArr.length * 0.3)) bulletStyle = "dash";
    else if (starCount > 0 && starCount >= Math.max(1, bodyLinesArr.length * 0.3)) bulletStyle = "star";
  }

  // 언어 판정 — 한글 음절 비율.
  const hangul = (trimmed.match(/[가-힣]/g) ?? []).length;
  const totalAlpha = (trimmed.match(/[A-Za-z가-힣]/g) ?? []).length;
  const koRatio = totalAlpha === 0 ? 0 : hangul / totalAlpha;
  const language: "ko" | "en" = koRatio > 0.3 ? "ko" : "en";

  // 이슈 footer 형식 (메시지 어디에든).
  let issueRef: CommitFeatures["issueRef"] = null;
  if (/^Refs:\s+/im.test(trimmed)) issueRef = "Refs";
  else if (/^Closes:?\s+/im.test(trimmed)) issueRef = "Closes";
  else if (/^Fixes:?\s+/im.test(trimmed)) issueRef = "Fixes";
  else if (/^Resolves:?\s+/im.test(trimmed)) issueRef = "Resolves";
  else if (/\[[A-Z][A-Z0-9]{1,9}-\d+\]/.test(trimmed)) issueRef = "bracket";
  else if (/#\d{1,6}\b/.test(trimmed)) issueRef = "hash";

  return {
    isCC,
    type,
    scope,
    subject,
    subjectLength,
    hasGitmoji,
    bodyLines,
    bulletStyle,
    language,
    issueRef,
  };
}

// 집계.
export function aggregateStyle(features: CommitFeatures[]): RepoStyle {
  const n = features.length;
  if (n === 0) {
    return emptyStyle();
  }

  const ccCount = features.filter((f) => f.isCC).length;
  const ccRatio = ccCount / n;

  // type/scope 빈도.
  const topTypes = topN(features.map((f) => f.type).filter((t): t is string => Boolean(t)), 5);
  const topScopes = topN(features.map((f) => f.scope).filter((s): s is string => Boolean(s)), 5);

  // subject 길이. P90 = 1-indexed nearest-rank 방식 → ceil(0.9 * N) 번째.
  // n=2 일 때 ceil(1.8)=2 → lens[1] (큰 쪽). n=10 일 때 9 번째 (lens[8]). 표본이 1 개여도 안전.
  const lens = features.map((f) => f.subjectLength).filter((l) => l > 0).sort((a, b) => a - b);
  const subjectLenAvg = lens.length > 0 ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const subjectLenP90 =
    lens.length > 0
      ? lens[Math.min(lens.length - 1, Math.max(0, Math.ceil(0.9 * lens.length) - 1))]
      : 0;

  // 본문.
  const withBody = features.filter((f) => f.bodyLines > 0);
  const bodyRatio = withBody.length / n;
  const bodyLineAvg = withBody.length > 0 ? withBody.reduce((a, b) => a + b.bodyLines, 0) / withBody.length : 0;
  const dashCount = features.filter((f) => f.bulletStyle === "dash").length;
  const starCount = features.filter((f) => f.bulletStyle === "star").length;
  const preferredBullet: "dash" | "star" | "none" =
    dashCount === 0 && starCount === 0 ? "none" : dashCount >= starCount ? "dash" : "star";

  // 언어.
  const koCount = features.filter((f) => f.language === "ko").length;
  const koRatio = koCount / n;
  const preferredLanguage: "ko" | "en" = koRatio >= 0.5 ? "ko" : "en";

  // gitmoji.
  const gitmojiRatio = features.filter((f) => f.hasGitmoji).length / n;

  // 이슈 footer.
  const refCounts = new Map<NonNullable<CommitFeatures["issueRef"]>, number>();
  for (const f of features) {
    if (!f.issueRef) continue;
    refCounts.set(f.issueRef, (refCounts.get(f.issueRef) ?? 0) + 1);
  }
  const preferredIssueRef =
    refCounts.size === 0
      ? null
      : [...refCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return {
    sampledCommits: n,
    ccRatio,
    topTypes,
    topScopes,
    subjectLenAvg,
    subjectLenP90,
    bodyRatio,
    bodyLineAvg,
    preferredBullet,
    koRatio,
    preferredLanguage,
    gitmojiRatio,
    preferredIssueRef,
    analyzedAt: new Date().toISOString(),
  };
}

function emptyStyle(): RepoStyle {
  return {
    sampledCommits: 0,
    ccRatio: 0,
    topTypes: [],
    topScopes: [],
    subjectLenAvg: 0,
    subjectLenP90: 0,
    bodyRatio: 0,
    bodyLineAvg: 0,
    preferredBullet: "none",
    koRatio: 0,
    preferredLanguage: "en",
    gitmojiRatio: 0,
    preferredIssueRef: null,
    analyzedAt: new Date().toISOString(),
  };
}

function topN(values: string[], n: number): Array<{ name: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

// repo 식별자 — origin URL 이 있으면 그것의 SHA1 prefix, 없으면 cwd 의 SHA1 prefix.
export async function deriveRepoKey(): Promise<string> {
  try {
    const { stdout } = await execa("git", ["config", "--get", "remote.origin.url"]);
    const url = stdout.trim();
    if (url) return sha1(url).slice(0, 16);
  } catch {
    // remote 없으면 fallback.
  }
  return sha1(process.cwd()).slice(0, 16);
}

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

const STYLE_DIR = join(homedir(), ".smart-msg", "styles");

export function getStylePath(repoKey: string): string {
  return join(STYLE_DIR, `${repoKey}.json`);
}

// 디스크 영역.
export async function loadStyle(repoKey: string): Promise<RepoStyle | null> {
  const p = getStylePath(repoKey);
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, "utf-8");
    return JSON.parse(raw) as RepoStyle;
  } catch {
    return null;
  }
}

export async function saveStyle(repoKey: string, style: RepoStyle): Promise<void> {
  if (!existsSync(STYLE_DIR)) {
    await mkdir(STYLE_DIR, { recursive: true });
  }
  await writeFile(getStylePath(repoKey), JSON.stringify(style, null, 2), "utf-8");
}

export async function clearStyle(repoKey: string): Promise<boolean> {
  const p = getStylePath(repoKey);
  if (!existsSync(p)) return false;
  await rm(p, { force: true });
  return true;
}

// git log 에서 최근 N 개 commit 메시지를 분석한다.
// merge commit 은 제외 — auto-generated subject 가 통계를 흐림.
// sentinel 기반 stream 파싱으로 multi-line subject/body 도 안전.
export async function learnStyle(sample: number): Promise<RepoStyle> {
  const SENTINEL = "===SM_MSG_START===";
  const { stdout } = await execa("git", [
    "log",
    `-${sample}`,
    "--no-merges",
    `--pretty=format:${SENTINEL}%B`,
  ]);
  const messages = stdout
    .split(SENTINEL)
    .map((s) => s.trim())
    .filter(Boolean);
  const features = messages.map(analyzeCommitMessage);
  return aggregateStyle(features);
}
