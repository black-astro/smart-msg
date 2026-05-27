// Semantic split — staged diff 내부에 "사실은 별개 작업" 이 섞여있는지 로컬에서 휴리스틱으로 감지.
//
// 기존 `sm split` 은 diff 전체를 LLM 에 던지고 텍스트 제안만 받았다 (LLM 의존, 가독성도 가변).
// 이 모듈은 LLM 없이 파일/hunk 의 표면적 특성으로 카테고리를 빠르게 분류해 어떤 묶음으로 나눠볼지
// 결정 가능한 정량 제안을 만든다. LLM 제안과는 독립적으로 동작 — `sm split` 이 양쪽 다 보여줄 수 있다.
//
// 카테고리 결정 우선순위 (위에서 아래로 매칭, 첫 매치 채택):
//   formatting  — 라인의 trim() 결과가 변경 전/후 동일 (whitespace-only diff)
//   docs        — *.md, README, docs/, CHANGELOG
//   tests       — test/, spec/, __tests__/, *.test.*, *.spec.*
//   deps        — package.json, *-lock.*, Cargo.lock, poetry.lock, Gemfile.lock, composer.lock
//   ci          — .github/workflows/, .gitlab-ci.yml, Jenkinsfile, .circleci/
//   config      — .env*, config/, *.config.*
//   typesOnly   — *.d.ts 만 변경
//   feature     — 그 외 (기본)
//
// 그룹 산출:
//   - 같은 카테고리 + 인접 디렉토리 (앞 2 path segment 공유) 묶기.
//   - 단일 카테고리만 있으면 split 제안 안 함 (이미 atomic 한 commit).
//
// 출력:
//   SplitProposal { groups: Group[] }
//   각 Group 은 카테고리 / 파일 목록 / 제안 commit message subject / 권장 git 명령 시퀀스.
import type { ParsedFileDiff } from "./revertDetector.js";

export type ChunkKind =
  | "formatting"
  | "docs"
  | "tests"
  | "deps"
  | "ci"
  | "config"
  | "typesOnly"
  | "feature";

export interface ClassifiedFile {
  file: string;
  kind: ChunkKind;
  // 추가/제거 라인 수 — 사용자에게 그룹 크기 시각화하는 용도.
  insertions: number;
  deletions: number;
}

export interface SplitGroup {
  kind: ChunkKind;
  files: string[];
  // CC type 추천 — 메시지 생성 시 가이드.
  suggestedType: string;
  // 사람-읽기 가능한 짧은 라벨.
  label: string;
  insertions: number;
  deletions: number;
}

export interface SplitProposal {
  // 분류된 파일들 (디버그/노출).
  files: ClassifiedFile[];
  // 권장 분할.
  groups: SplitGroup[];
  // 분할 권장 여부. groups.length <= 1 이면 false (이미 단일 의미 unit).
  shouldSplit: boolean;
}

// staged diff 의 파일별 항목을 받아 각 파일을 분류.
export function classifyFiles(staged: ParsedFileDiff[]): ClassifiedFile[] {
  return staged.map((f) => ({
    file: f.file,
    kind: classifyOne(f),
    insertions: f.addedLines.length,
    deletions: f.removedLines.length,
  }));
}

function classifyOne(f: ParsedFileDiff): ChunkKind {
  const file = f.file;

  // 경로 기반 분류 우선.
  if (/(^|\/)docs\//i.test(file) || /\.(md|mdx|rst|adoc)$/i.test(file) || /(^|\/)CHANGELOG(\.|$)/.test(file) || /(^|\/)README/i.test(file)) {
    return "docs";
  }
  if (/(^|\/)(test|tests|spec|__tests__)\//.test(file) || /\.(test|spec)\.[a-z]+$/i.test(file)) {
    return "tests";
  }
  if (/(^|\/)\.github\/workflows\/|\.gitlab-ci\.ya?ml$|^Jenkinsfile$|(^|\/)\.circleci\//.test(file)) {
    return "ci";
  }
  if (
    /(^|\/)(package|composer)\.json$/i.test(file) ||
    /(package-lock\.json|yarn\.lock|pnpm-lock\.ya?ml|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/i.test(file)
  ) {
    return "deps";
  }
  if (/(^|\/)\.env|(^|\/)config\/|\.(config|conf)\./i.test(file)) {
    return "config";
  }
  if (/\.d\.ts$/.test(file)) {
    return "typesOnly";
  }

  // 내용 기반 — whitespace-only 인지.
  if (isWhitespaceOnly(f.addedLines, f.removedLines)) {
    return "formatting";
  }

  return "feature";
}

// added/removed 라인이 짝지어진 whitespace-only 변경인지.
// 단순 휴리스틱: removed 라인의 trim 집합 = added 라인의 trim 집합.
// 양쪽 multiset 일치 비교는 비싸므로 길이가 다르면 false, 같으면 정렬 비교.
export function isWhitespaceOnly(added: string[], removed: string[]): boolean {
  if (added.length === 0 && removed.length === 0) return false;
  if (added.length !== removed.length) return false;
  const a = added.map((l) => l.trim()).sort();
  const r = removed.map((l) => l.trim()).sort();
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== r[i]) return false;
  }
  return true;
}

// 카테고리별 라벨 / CC type 매핑.
const KIND_META: Record<ChunkKind, { label: string; suggestedType: string }> = {
  formatting: { label: "formatting / whitespace", suggestedType: "style" },
  docs: { label: "documentation", suggestedType: "docs" },
  tests: { label: "tests", suggestedType: "test" },
  deps: { label: "dependencies", suggestedType: "chore" },
  ci: { label: "CI/CD config", suggestedType: "ci" },
  config: { label: "configuration", suggestedType: "chore" },
  typesOnly: { label: "type declarations", suggestedType: "chore" },
  feature: { label: "feature / refactor", suggestedType: "feat" },
};

// 분류된 파일들 → 그룹 + split 권장 여부.
export function groupClassified(classified: ClassifiedFile[]): SplitProposal {
  if (classified.length === 0) {
    return { files: [], groups: [], shouldSplit: false };
  }

  // 카테고리별 묶기.
  const byKind = new Map<ChunkKind, ClassifiedFile[]>();
  for (const c of classified) {
    const arr = byKind.get(c.kind) ?? [];
    arr.push(c);
    byKind.set(c.kind, arr);
  }

  // 그룹 빌드.
  const groups: SplitGroup[] = [];
  for (const [kind, files] of byKind.entries()) {
    const meta = KIND_META[kind];
    groups.push({
      kind,
      files: files.map((f) => f.file).sort(),
      label: meta.label,
      suggestedType: meta.suggestedType,
      insertions: files.reduce((a, b) => a + b.insertions, 0),
      deletions: files.reduce((a, b) => a + b.deletions, 0),
    });
  }

  // 일관된 순서 — atomicity 기준 (작은 / 부수적인 것 먼저, 큰 feature 나중).
  // 그 commit 만 골라서 push 하기 좋게.
  const ORDER: ChunkKind[] = [
    "formatting",
    "typesOnly",
    "deps",
    "ci",
    "config",
    "docs",
    "tests",
    "feature",
  ];
  groups.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  // 단일 카테고리만 있으면 이미 atomic — 분할 불필요.
  const shouldSplit = groups.length >= 2;

  return { files: classified, groups, shouldSplit };
}

// 분할 제안을 사람-읽기 가능한 텍스트로 포맷.
// 각 그룹별 git 명령 시퀀스 동봉.
export function formatProposal(proposal: SplitProposal): string {
  if (!proposal.shouldSplit) {
    return "Single semantic group — no split needed.";
  }
  const lines: string[] = [];
  lines.push(`Suggested split: ${proposal.groups.length} groups`);
  lines.push("");
  proposal.groups.forEach((g, idx) => {
    const total = g.insertions + g.deletions;
    lines.push(`[${idx + 1}] ${g.suggestedType}: ${g.label}  (+${g.insertions}/-${g.deletions}, ${total} lines)`);
    for (const f of g.files) lines.push(`    - ${f}`);
    lines.push("");
  });
  lines.push("How to apply:");
  lines.push("  1) git reset HEAD                                 # unstage everything");
  proposal.groups.forEach((g, idx) => {
    const filesArg = g.files.map((f) => `"${f}"`).join(" ");
    lines.push(`  ${idx + 2}) git add ${filesArg}`);
    lines.push(`     sm c                                          # generate message for group ${idx + 1}`);
  });
  return lines.join("\n");
}

// 편의 함수: parsed staged → proposal 한 방에.
export function proposeFromStaged(staged: ParsedFileDiff[]): SplitProposal {
  return groupClassified(classifyFiles(staged));
}
