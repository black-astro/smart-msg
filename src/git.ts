// git 명령 래퍼. 현재 디렉터리에서 git 실행하므로 어떤 프로젝트(자바/IntelliJ 등)에서 호출해도 동작.
import { execa } from "execa";

// 스테이징된 변경사항(diff)만 가져옴. 워킹 디렉터리 변경은 무시 → AI 가 의도된 것만 보게 함.
export async function getStagedDiff(): Promise<string> {
  const { stdout } = await execa("git", ["diff", "--staged"]);
  return stdout;
}

// 실제 커밋 실행. stdio: inherit 으로 git 출력(훅 결과 등)을 사용자 터미널에 그대로 보여줌.
export async function commit(message: string): Promise<void> {
  await execa("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
}

// 커밋 메시지를 인자로 git commit --amend 를 수행한다. sm amend 에서 사용.
export async function amend(message: string): Promise<void> {
  await execa("git", ["commit", "--amend", "-m", message], {
    stdio: "inherit",
  });
}

// 현재 브랜치명. detached HEAD 면 'HEAD' 반환 → 호출자가 의미 없는 값으로 취급할 수 있게 빈 문자열로 정규화.
export async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const name = stdout.trim();
    return name === "HEAD" ? "" : name;
  } catch {
    return "";
  }
}

// base 브랜치 .. HEAD 의 diff. PR 본문 / split 명령 등에서 사용.
// base 후보를 우선순위로 시도하고 모두 실패하면 빈 문자열.
export async function getRangeDiff(baseRef: string): Promise<string> {
  try {
    const { stdout } = await execa("git", ["diff", `${baseRef}...HEAD`]);
    return stdout;
  } catch {
    return "";
  }
}

// 마지막 commit 이 건드린 변경분. amend 시 활용한다.
// HEAD~1 이 없는 경우 (첫 commit 직후) 도 안전하게 빈 문자열.
export async function getLastCommitDiff(): Promise<string> {
  try {
    const { stdout } = await execa("git", ["diff", "HEAD~1", "HEAD"]);
    return stdout;
  } catch {
    return "";
  }
}

// `${baseRef}..HEAD` 의 commit 메시지 목록 (subject 만). PR 본문 보조 컨텍스트.
export async function getRangeCommits(baseRef: string): Promise<string[]> {
  try {
    const { stdout } = await execa("git", ["log", `${baseRef}..HEAD`, "--pretty=format:%s"]);
    if (!stdout.trim()) return [];
    return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// PR 의 base 후보를 탐지. 일반적으로 main / master / develop 중 존재하는 첫 번째.
// origin/<ref> 가 있으면 더 정확하므로 origin/ 접두를 우선 시도.
const BASE_CANDIDATES = ["origin/main", "origin/master", "origin/develop", "main", "master", "develop"];
export async function detectBaseRef(): Promise<string | null> {
  for (const ref of BASE_CANDIDATES) {
    try {
      await execa("git", ["rev-parse", "--verify", "--quiet", ref]);
      return ref;
    } catch {
      // 다음 후보로.
    }
  }
  return null;
}

// 브랜치명에서 이슈 키 추출. JIRA 류 ABC-123 / numeric #123 / GH-123 등.
// 가장 흔한 ABC-123 패턴부터 잡고, 없으면 순수 숫자 #123 → 123 도 후보.
// false-positive 방지를 위해 너무 짧은 (2자 미만 prefix) / 너무 긴 (10자 초과) 케이스는 제외.
export function extractIssueKey(branchName: string): string | null {
  if (!branchName) return null;

  // 1) JIRA 류: [A-Z]{2,10}-[0-9]+
  const jiraMatch = branchName.match(/\b([A-Z][A-Z0-9]{1,9}-\d+)\b/);
  if (jiraMatch) return jiraMatch[1];

  // 2) GitHub issue 류: #123 / gh-123 / issue-123 / issue/123
  const ghMatch = branchName.match(/(?:^|[/\-_])(?:#|gh-|issue[/\-_])(\d{1,6})\b/i);
  if (ghMatch) return `#${ghMatch[1]}`;

  return null;
}
