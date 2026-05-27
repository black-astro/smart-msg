// Auto-revert detector.
//
// 목적: 사용자가 commit 직전 스테이징한 변경이 최근 N 개 commit 중 하나를 (부분적으로) 되돌리는지 감지.
//
// 시나리오:
//   1) bug A fix → 며칠 뒤 다른 작업으로 bug B 처리 중 무관한 라인을 무심코 되돌림 → bug A 재발.
//   2) refactor 진행 중, 과거 commit 에서 의도적으로 제거했던 코드를 다시 추가.
//
// 알고리즘:
//   - staged diff 를 (file → addedLines / removedLines) 로 파싱.
//   - 최근 N 개 commit 의 patch 를 같은 형태로 파싱.
//   - 같은 파일 안에서 "stage 가 제거하는 라인 ↔ 과거 commit 이 추가한 라인" 매칭 → 잠재 revert.
//   - 또는 "stage 가 추가하는 라인 ↔ 과거 commit 이 제거한 라인" 매칭 → 재추가 (이전 fix 무효화 가능성).
//
// 노이즈 억제:
//   - 빈 줄, 너무 짧은 라인 (3 자 미만), 단일 brace/bracket, common boilerplate import 는 제외.
//   - 같은 파일 안에서만 매칭 (path 매칭이 안 되면 dropping false positive).
//   - rename 추적은 하지 않음 (false positive 가 더 많아짐).
//   - 같은 commit 에서 한 파일당 최대 3 개 hit 만 (시각적 폭증 방지).
//
// 성능:
//   - 기본 lookback = 20 commit. config 로 조정 가능 (`revertLookback`).
//   - 라인 set 으로 O(N) 매칭.
import { execa } from "execa";

export interface RevertHit {
  // 잠재 revert 가 일어난 파일.
  file: string;
  // 매칭된 라인 (앞뒤 공백 trim 후).
  line: string;
  // 매칭 종류.
  //   removal-of-recent-add  : stage 가 라인을 제거, 과거 commit 이 같은 라인을 추가
  //   readd-of-recent-remove : stage 가 라인을 추가, 과거 commit 이 같은 라인을 제거
  kind: "removal-of-recent-add" | "readd-of-recent-remove";
  // 매칭된 과거 commit.
  recentCommit: { sha: string; subject: string };
}

export interface ParsedFileDiff {
  file: string;
  addedLines: string[];
  removedLines: string[];
}

// 단일 commit 의 patch (`git show -p` 또는 `git log -p` 출력의 한 단위).
export interface RecentCommit {
  sha: string;
  subject: string;
  files: ParsedFileDiff[];
}

// `git diff` 출력에서 파일별 added/removed 라인 추출.
// 단일 unified diff (commit 전체 또는 staged 전체) 를 한 번에 처리할 수 있도록 설계.
//
// 파싱 규칙:
//   - "diff --git a/<old> b/<new>" 가 새 파일 entry 시작.
//   - "+++ b/<path>" 가 실제 파일 경로 (정확한 권장 형태). 없으면 git header 의 b/ 경로 사용.
//   - "+" / "-" 로 시작하는 hunk 라인만 사용 (단, "+++"/"---" 헤더 자체는 제외).
export function parseUnifiedDiff(diff: string): ParsedFileDiff[] {
  const entries: ParsedFileDiff[] = [];
  let current: ParsedFileDiff | null = null;
  let fallbackPath = "";

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current) entries.push(current);
      // "diff --git a/foo b/foo" 에서 b/ 쪽을 fallback path 로 사용.
      const m = line.match(/diff --git a\/(.+?) b\/(.+)$/);
      fallbackPath = m ? m[2] : "";
      current = { file: fallbackPath, addedLines: [], removedLines: [] };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+++ b/")) {
      current.file = line.slice("+++ b/".length);
      continue;
    }
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      // 헤더 행 — added/removed 카운트 대상 아님.
      continue;
    }
    if (line.startsWith("+")) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith("-")) {
      current.removedLines.push(line.slice(1));
    }
  }
  if (current) entries.push(current);
  return entries.filter((e) => e.file);
}

// 매칭에 쓰일 만큼 "의미있는" 라인인지 판정.
// 너무 짧거나 brace/bracket 만 있는 라인은 노이즈가 많아 매칭 후보에서 제외.
export function isInterestingLine(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 4) return false;
  // 단순 닫는/여는 괄호류
  if (/^[\{\}\[\]\(\)]+$/.test(t)) return false;
  // 단순 import 한 줄도 자주 중복 → 노이즈로 처리.
  if (/^import\s+/.test(t) || /^from\s+["']/.test(t)) return false;
  // 한 단어 + 세미콜론만인 라인 (return; / break; / continue;) 도 노이즈.
  if (/^[a-zA-Z_]\w*;$/.test(t)) return false;
  return true;
}

// staged diff vs 최근 commit 들 → revert hit 목록.
export function detectReverts(
  staged: ParsedFileDiff[],
  recent: RecentCommit[],
): RevertHit[] {
  const hits: RevertHit[] = [];

  // file 별 stage 의 added/removed set 사전 계산.
  const stagedByFile = new Map<string, { added: Set<string>; removed: Set<string> }>();
  for (const s of staged) {
    const added = new Set(s.addedLines.map((l) => l.trim()).filter(isInterestingLine));
    const removed = new Set(s.removedLines.map((l) => l.trim()).filter(isInterestingLine));
    stagedByFile.set(s.file, { added, removed });
  }

  // 최근 commit 들 순회. 같은 파일에서만 매칭.
  // 같은 (file, commit) 쌍에서 hit 가 폭증하는 것을 막기 위해 3 개로 cap.
  for (const c of recent) {
    for (const cf of c.files) {
      const stageFile = stagedByFile.get(cf.file);
      if (!stageFile) continue;

      const cfAdded = cf.addedLines.map((l) => l.trim()).filter(isInterestingLine);
      const cfRemoved = cf.removedLines.map((l) => l.trim()).filter(isInterestingLine);
      let perCommitFileCount = 0;

      // stage 가 제거하는 라인이 과거 commit 의 added 에 있음 → revert.
      for (const ccAdded of cfAdded) {
        if (perCommitFileCount >= 3) break;
        if (stageFile.removed.has(ccAdded)) {
          hits.push({
            file: cf.file,
            line: ccAdded,
            kind: "removal-of-recent-add",
            recentCommit: { sha: c.sha, subject: c.subject },
          });
          perCommitFileCount++;
        }
      }

      // stage 가 추가하는 라인이 과거 commit 의 removed 에 있음 → 재추가.
      for (const ccRemoved of cfRemoved) {
        if (perCommitFileCount >= 3) break;
        if (stageFile.added.has(ccRemoved)) {
          hits.push({
            file: cf.file,
            line: ccRemoved,
            kind: "readd-of-recent-remove",
            recentCommit: { sha: c.sha, subject: c.subject },
          });
          perCommitFileCount++;
        }
      }
    }
  }

  return hits;
}

// `git log -p -<N>` 출력에서 commit 단위로 파싱한다.
// "commit <sha>\nAuthor: ...\nDate: ...\n\n    <subject>\n..." 패턴.
// 보다 안전하게 `--format=%n--commit--%n%H%n%s%n--diff--%n` 같은 sentinel 을 쓰는 게 정공법이라
// 그쪽으로 구현한다.
export async function getRecentCommitsWithPatches(
  lookback: number,
): Promise<RecentCommit[]> {
  const SENTINEL_START = "===SM_COMMIT_START===";
  const SENTINEL_DIFF = "===SM_DIFF_START===";
  // sentinel + sha + subject + diff body 의 stream.
  const { stdout } = await execa("git", [
    "log",
    `-${lookback}`,
    "--no-merges",
    `--pretty=format:${SENTINEL_START}%H%n%s%n${SENTINEL_DIFF}`,
    "-p",
    "--no-color",
  ]);

  const commits: RecentCommit[] = [];
  const chunks = stdout.split(SENTINEL_START).filter(Boolean);
  for (const chunk of chunks) {
    const diffMarkerIdx = chunk.indexOf(SENTINEL_DIFF);
    if (diffMarkerIdx < 0) continue;
    const header = chunk.slice(0, diffMarkerIdx);
    const diff = chunk.slice(diffMarkerIdx + SENTINEL_DIFF.length);
    const [sha, subject = ""] = header.split("\n");
    if (!sha) continue;
    commits.push({
      sha: sha.trim(),
      subject: subject.trim(),
      files: parseUnifiedDiff(diff),
    });
  }

  return commits;
}

// 사용자에게 보여줄 hit 요약 — 너무 많은 hit 가 한꺼번에 나오는 것을 막고 핵심만.
// 같은 commit 에서 같은 종류로 여러 hit 가 있으면 한 줄로 그룹.
export function summarizeHits(hits: RevertHit[]): string[] {
  if (hits.length === 0) return [];
  const groups = new Map<string, { kind: RevertHit["kind"]; sha: string; subject: string; file: string; lines: string[] }>();
  for (const h of hits) {
    const key = `${h.kind}|${h.recentCommit.sha}|${h.file}`;
    const existing = groups.get(key);
    if (existing) {
      if (existing.lines.length < 3) existing.lines.push(h.line);
    } else {
      groups.set(key, {
        kind: h.kind,
        sha: h.recentCommit.sha,
        subject: h.recentCommit.subject,
        file: h.file,
        lines: [h.line],
      });
    }
  }
  const lines: string[] = [];
  for (const g of groups.values()) {
    const shortSha = g.sha.slice(0, 7);
    const direction =
      g.kind === "removal-of-recent-add"
        ? "removes line(s) added in"
        : "re-adds line(s) removed in";
    lines.push(`${g.file}: ${direction} ${shortSha} \"${g.subject}\"`);
    for (const l of g.lines) {
      const preview = l.length > 80 ? l.slice(0, 77) + "..." : l;
      lines.push(`    ${g.kind === "removal-of-recent-add" ? "-" : "+"} ${preview}`);
    }
  }
  return lines;
}
