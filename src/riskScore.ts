// 변경의 위험도(blast radius) 를 휴리스틱으로 1~5 점으로 평가한다.
// 목적: 사용자에게 commit 직전 "지금 이거 정말 들어가도 돼?" 를 알려주는 정량적 신호.
//
// 점수 의미 (가이드):
//   1 — 안전. docs/test only.
//   2 — 보통. 일반 코드 변경.
//   3 — 주의. lockfile / 다수 파일 / 큰 diff.
//   4 — 경고. CI 설정 / 다수 위험 요소 누적.
//   5 — 위험. DB migration / prod config / .env 변경.
//
// 시간대 평가:
//   금요일 18시 이후 / 주말 / 야간 22:00-06:00 → "위험 시간대" 로 분류.
//   점수가 같아도 위험 시간대면 사용자에게 좀 더 강한 경고를 띄울 수 있게 분리 전달.
//
// 본 모듈은 부수효과(현재 시각 / git 호출) 를 격리 가능한 형태로 설계한다:
//   - assessRisk / evaluateTimeWindow 는 인자만 받는 순수 함수 → 단위 테스트 용이.
//   - collectRiskFactors 는 git 을 호출 → 통합 영역 (테스트는 호출자 측).
import { getStagedNumstat } from "./git.js";

export interface RiskFactors {
  changedFiles: string[];
  insertions: number;
  deletions: number;
}

export type RiskScore = 1 | 2 | 3 | 4 | 5;

export interface RiskAssessment {
  score: RiskScore;
  // 이 점수에 기여한 사람-읽기 가능한 사유들. 사용자에게 "왜 위험한지" 노출용.
  reasons: string[];
  // 위험 시간대 사유. 빈 배열이면 시간대는 안전.
  timeWarnings: string[];
  // 위험 시간대 여부 요약. timeWarnings.length > 0 와 동치이나 호출자 가독성을 위해 별도 필드.
  isDangerousTime: boolean;
}

// 시간대 위험도. 부수효과 없는 순수 함수 — 호출자가 now 를 주입해 테스트 가능.
export function evaluateTimeWindow(now: Date = new Date()): {
  warnings: string[];
  dangerous: boolean;
} {
  const warnings: string[] = [];
  const day = now.getDay(); // 0=일요일, 6=토요일
  const hour = now.getHours();

  // 금요일 18시 이후 — "주말 직전 막판 commit" 패턴은 사고 회수율이 떨어진다.
  if (day === 5 && hour >= 18) warnings.push("Friday 18:00+");
  // 주말 — 리뷰어/oncall 부재 가능성.
  if (day === 0 || day === 6) warnings.push("weekend");
  // 야간 — 피로 누적, 후속 대응 어려움.
  if (hour >= 22 || hour < 6) warnings.push("night hours (22:00-06:00)");

  return { warnings, dangerous: warnings.length > 0 };
}

// 위험도 평가. 순수 함수.
//
// 휴리스틱 규칙(가산):
//   * DB migration (.sql / migrations/) — +3
//   * .github/workflows/, .gitlab-ci.yml, Jenkinsfile — +2
//   * .env*, config/prod*, secrets — +2
//   * lockfile (package-lock / yarn.lock / pnpm-lock / Cargo.lock) — +1
//   * 변경 파일 수 > 10 — +1
//   * 총 변경 라인 > 500 — +1
//
// 캡(상한):
//   * docs/test 만 변경된 경우 (.md / docs/ / __tests__/ / *.test.*) — 최대 2점.
//
// 점수는 1~5 로 clamp.
export function assessRisk(
  factors: RiskFactors,
  now: Date = new Date(),
): RiskAssessment {
  let score = 1;
  const reasons: string[] = [];

  const files = factors.changedFiles;
  const allTestOrDocs =
    files.length > 0 &&
    files.every((f) =>
      /(\.md$|^docs\/|^test\/|\.test\.|^__tests__\/|^spec\/|\.spec\.)/i.test(f),
    );

  // 위험 요소들 — 각 카테고리 한 번씩만 가산 (같은 카테고리 여러 파일이 점수 폭증시키지 않게).
  if (files.some((f) => /(\.sql$|migrations?\/|prisma\/migrations\/)/i.test(f))) {
    score += 3;
    reasons.push("DB migration");
  }

  if (files.some((f) => /(^\.github\/workflows\/|\.gitlab-ci\.ya?ml$|^Jenkinsfile$|\.circleci\/)/i.test(f))) {
    score += 2;
    reasons.push("CI/CD config");
  }

  // prod env / config. .env* 는 secret 위험까지 동반.
  if (files.some((f) => /(^\.env|(^|\/)config\/prod|(^|\/)secrets?\/|deployment\.ya?ml$)/i.test(f))) {
    score += 2;
    reasons.push("prod config / env");
  }

  if (files.some((f) => /(package-lock\.json|yarn\.lock|pnpm-lock\.ya?ml|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/i.test(f))) {
    score += 1;
    reasons.push("lockfile change");
  }

  if (files.length > 10) {
    score += 1;
    reasons.push(`many files changed (${files.length})`);
  }

  const totalLines = factors.insertions + factors.deletions;
  if (totalLines > 500) {
    score += 1;
    reasons.push(`large diff (${totalLines} lines)`);
  }

  // docs/test only → 최대 2점으로 제한 (위 가산이 어떻게 누적되었든).
  // 사유는 항상 명시 추가 — "왜 캡이 걸렸는지" 사용자에게 전달.
  if (allTestOrDocs) {
    reasons.push("docs / tests only");
    score = Math.min(score, 2);
  }

  // 1~5 clamp.
  if (score > 5) score = 5;
  if (score < 1) score = 1;

  const time = evaluateTimeWindow(now);
  return {
    score: score as RiskScore,
    reasons,
    timeWarnings: time.warnings,
    isDangerousTime: time.dangerous,
  };
}

// staged diff 의 위험도 입력 수집. git 을 호출하므로 통합 영역.
export async function collectRiskFactors(): Promise<RiskFactors> {
  const entries = await getStagedNumstat();
  let insertions = 0;
  let deletions = 0;
  const changedFiles: string[] = [];
  for (const e of entries) {
    insertions += e.insertions;
    deletions += e.deletions;
    changedFiles.push(e.file);
  }
  return { changedFiles, insertions, deletions };
}

// 사용자에게 노출할 점수 시각화. "★★★☆☆ (3/5)" 같은 형태.
export function formatRiskBar(score: RiskScore): string {
  const filled = "★".repeat(score);
  const empty = "☆".repeat(5 - score);
  return `${filled}${empty} (${score}/5)`;
}
