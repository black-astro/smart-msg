// git diff 를 AI 에 보내기 전에 (1) 민감정보 마스킹, (2) 너무 큰 경우 축약 처리한다.
//
// 분리 이유:
//   - prompt.ts 는 "어떤 지시문을 만들지" 에만 집중.
//   - 이 파일은 "diff 자체를 어떻게 다듬을지" 에 집중.
//   - 테스트가 쉽도록 순수 함수로만 구성.

// secret 으로 보이는 라인을 [REDACTED] 로 치환한다.
// 완전한 보호 수단은 아니지만 흔한 사고 (실수로 .env 를 stage) 의 1차 방어선이다.
// 매칭 대상:
//   - .env 류의 KEY=VALUE 라인 (대문자/언더스코어/숫자 + SECRET|TOKEN|KEY|PASSWORD|PASS|API 포함)
//   - AWS access key 패턴 (AKIA...)
//   - GitHub PAT 패턴 (ghp_/gho_/ghu_/ghs_/ghr_ + 36자)
//   - Slack 토큰 (xox[abp]-...)
//   - PEM 헤더 (-----BEGIN ... PRIVATE KEY-----)
//   - sk- / api- 로 시작하는 32+ 길이 토큰 (OpenAI/Anthropic 류)
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // .env 류: + 또는 공백 시작, KEY=VALUE 형태, KEY 안에 SECRET/TOKEN/KEY/PASSWORD/API 포함.
  { name: "env-line",   pattern: /^([+\- ]?\s*[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PASS|API|CREDENTIAL)[A-Z0-9_]*\s*[:=]\s*)\S.*$/gmi },
  { name: "aws-akid",   pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "gh-pat",     pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "slack",      pattern: /xox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: "pem",        pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g },
  // sk-... / sk_live_ 등 30자 이상.
  { name: "bearer-like", pattern: /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant|or)?[-_]?[A-Za-z0-9]{20,}\b/g },
];

const REDACTED = "[REDACTED]";

export function maskSecrets(diff: string): string {
  let out = diff;
  for (const { name, pattern } of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (name === "env-line") {
        // KEY= 부분은 유지하고 VALUE 만 마스킹. 그래야 AI 가 "어떤 키가 들어있다" 까지는 인지 가능.
        const m = match.match(/^([+\- ]?\s*[A-Z][A-Z0-9_]*\s*[:=]\s*)/);
        return m ? `${m[1]}${REDACTED}` : REDACTED;
      }
      return REDACTED;
    });
  }
  return out;
}

// 큰 diff 를 모델 토큰 한도에 맞춰 줄인다.
//   1) 원본이 limit 이하면 그대로 반환.
//   2) 그 외엔 파일별로 쪼개고 (`diff --git ...` 헤더 기준), 각 파일의 앞부분만 채택.
//   3) 잘린 파일 수와 잘린 라인 수를 안내 라인으로 추가하여 모델이 컨텍스트를 인지하도록.
//
// 의도적으로 git diff --stat 대신 본문을 자체적으로 자른다 — git 호출을 늘리지 않고 단일 입력만으로 처리.
export function condenseDiff(diff: string, limit: number): string {
  if (diff.length <= limit) return diff;

  const files = splitByFile(diff);
  if (files.length === 0) {
    // 헤더가 없는 비표준 입력 — 단순 절단으로 폴백.
    return `${diff.slice(0, limit)}\n\n[smart-msg] diff was truncated to ${limit} chars.`;
  }

  // 파일당 허용 길이. 헤더 안내 등 오버헤드를 감안해 90% 만 본문으로.
  const perFileLimit = Math.max(400, Math.floor((limit * 0.9) / files.length));
  const parts: string[] = [];
  let totalTruncated = 0;

  for (const f of files) {
    if (f.length <= perFileLimit) {
      parts.push(f);
    } else {
      const head = f.slice(0, perFileLimit);
      totalTruncated += f.length - perFileLimit;
      parts.push(`${head}\n... (이 파일의 나머지 ${f.length - perFileLimit} 자 생략)`);
    }
  }

  return `${parts.join("\n")}\n\n[smart-msg] diff 가 길어 파일별로 앞부분만 사용했습니다 (절단 합계: ${totalTruncated} 자).`;
}

// diff 본문을 파일 단위로 분리. `diff --git ...` 헤더가 새 파일의 시작.
function splitByFile(diff: string): string[] {
  const lines = diff.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (buf.length > 0) out.push(buf.join("\n"));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) out.push(buf.join("\n"));
  return out;
}

// 두 단계 적용: 먼저 secret 마스킹, 다음 길이 축약.
// 마스킹을 먼저 해야 [REDACTED] 가 잘려나가 secret 일부가 노출되는 사고가 없다.
export interface PreparedDiff {
  text: string;
  originalLength: number;
  truncated: boolean;
  masked: boolean;
}

export function prepareDiff(rawDiff: string, limit: number): PreparedDiff {
  const masked = maskSecrets(rawDiff);
  const wasMasked = masked !== rawDiff;
  const condensed = condenseDiff(masked, limit);
  return {
    text: condensed,
    originalLength: rawDiff.length,
    truncated: condensed.length < masked.length,
    masked: wasMasked,
  };
}
