// Privacy tokenizer.
//
// 목적: diff 를 외부 LLM 에 보내기 전, 식별 가능한 PII / 신원 정보를 *의미를 보존한 채*
// 자리표시자 토큰으로 치환한다. 단순 [REDACTED] 마스킹과의 차이는 다음 두 가지:
//
//   1) 토큰이 "어떤 종류" 인지 명시한다 (<EMAIL_1>, <UUID_3>, <IP_2> ...). 모델이 의미를
//      유지한 채 메시지를 작성할 수 있다.
//   2) 같은 값은 항상 같은 토큰. 단일 diff 안에서 user A 가 두 번 등장하면 둘 다 <EMAIL_1>.
//      diff 의 관계성/구조가 보존된다.
//
// secret 마스킹 (diffUtils.maskSecrets) 과 함께 사용:
//   prepareDiff → maskSecrets → tokenizePII → condense
//
// 모드:
//   off       — 토큰화 안 함.
//   standard  — 보편적 식별자 (email/URL with auth/JWT/IP/UUID/CC/phone). 기본.
//   strict    — standard + 일반 URL (도메인 분리) + bearer auth header value.
import { createHash } from "node:crypto";

export type PrivacyMode = "off" | "standard" | "strict";

export interface TokenizationResult {
  text: string;
  // 카테고리별 치환 횟수.
  counts: Record<string, number>;
  // 치환된 unique 값의 총 개수.
  unique: number;
}

// 분류별 정규식. 우선순위 순서대로 매치. 같은 위치를 두 카테고리가 다투지 않도록
// 더 구체적인 패턴이 먼저 와야 한다 (예: URL with auth 가 일반 URL 보다 먼저).
interface Rule {
  kind: string;
  pattern: RegExp;
  // strict 모드에만 적용할 규칙.
  strictOnly?: boolean;
}

const RULES: Rule[] = [
  // URL with embedded credentials — https://user:pass@host/path.
  // 항상 위험. standard 부터 적용.
  { kind: "URL_AUTH", pattern: /\bhttps?:\/\/[^\s/@]+:[^\s/@]+@[^\s)"'<>]+/g },
  // JWT. eyJ... base64url 3-part. 길이 cap (저-FP).
  { kind: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // Bearer auth — Authorization: Bearer <token>. strict 에서만 (false positive 가능성).
  { kind: "BEARER", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g, strictOnly: true },
  // Email.
  { kind: "EMAIL", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // UUID v4-ish (relaxed — 8-4-4-4-12 hex).
  { kind: "UUID", pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g },
  // IPv4 — 옥텟 0-255 검증은 너무 무겁고 FP 적기 위해 단순 패턴 + 후 검증.
  { kind: "IP", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // IPv6 — 단순 패턴 (8 그룹 hex).
  { kind: "IP", pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
  // 신용카드 13~19 자리 숫자 (공백/대시 허용). Luhn 검증으로 FP 줄임.
  { kind: "CC", pattern: /\b(?:\d[ -]?){12,18}\d\b/g },
  // 전화번호 — 국가코드/지역코드 변형 다양. 보수적 패턴 (FP 많아짐 방지).
  // \b 가 `+` 앞에서는 매치 안 되므로 lookbehind 로 좌측 비-숫자/문자만 허용.
  { kind: "PHONE", pattern: /(?<![\w\d])\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}(?![\w\d])/g },
  // 일반 URL. strict 에서만 — standard 는 도메인 노출은 허용.
  { kind: "URL", pattern: /\bhttps?:\/\/[^\s)"'<>]+/g, strictOnly: true },
];

// IPv4 검증 — 옥텟 0~255.
function isValidIPv4(s: string): boolean {
  const parts = s.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
    if (p.length > 1 && p.startsWith("0")) return false;
  }
  return true;
}

// Luhn — 신용카드 후 검증.
function isValidLuhn(s: string): boolean {
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// 안정 카운터 — 같은 입력 + 같은 카테고리 + 같은 원본값 → 같은 번호.
// Map 하나로 충분. 캐시 키: `${kind}|${original}`.
export function tokenizePII(input: string, mode: PrivacyMode = "standard"): TokenizationResult {
  if (mode === "off") {
    return { text: input, counts: {}, unique: 0 };
  }
  const counts: Record<string, number> = {};
  const cache = new Map<string, string>();

  let out = input;
  for (const rule of RULES) {
    if (rule.strictOnly && mode !== "strict") continue;
    out = out.replace(rule.pattern, (match) => {
      // 카테고리별 post-validation.
      if (rule.kind === "IP" && match.includes(".") && !isValidIPv4(match)) return match;
      if (rule.kind === "CC" && !isValidLuhn(match)) return match;
      const key = `${rule.kind}|${match}`;
      const existing = cache.get(key);
      if (existing) return existing;
      const idx = (Object.entries(cache).filter(([k]) => k.startsWith(`${rule.kind}|`)).length + 1);
      // counter 는 cache 안의 같은 kind 항목 수 + 1 로 안정 부여.
      let same = 0;
      for (const k of cache.keys()) {
        if (k.startsWith(`${rule.kind}|`)) same++;
      }
      const token = `<${rule.kind}_${same + 1}>`;
      cache.set(key, token);
      counts[rule.kind] = (counts[rule.kind] ?? 0) + 1;
      return token;
    });
  }
  return { text: out, counts, unique: cache.size };
}

// diff 의 시각 fingerprint — 같은 diff 면 같은 hash, 다른 카테고리 분포면 다른 hash.
// 사용자에게 "이번에 무엇이 토큰화 되었는지" 노출할 때 unique tag 로.
export function summaryDigest(counts: Record<string, number>): string {
  const ordered = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  if (ordered.length === 0) return "none";
  return ordered.map(([k, v]) => `${k}:${v}`).join(",");
}

// 모드 라벨 (UI 출력용).
export function describeMode(mode: PrivacyMode): string {
  switch (mode) {
    case "off": return "off";
    case "standard": return "standard (email/JWT/UUID/IP/CC/phone/auth-url)";
    case "strict": return "strict (standard + all URLs + bearer tokens)";
  }
}

// 변경 미감지 — UI 에서 "이번 commit 에 토큰화 발생 안 함" 한 줄 단정에 사용.
export function isPIIClean(input: string): boolean {
  // 빠른 휴리스틱 — @ 또는 http:// 가 없으면 거의 확실히 clean. 그 외엔 full tokenize.
  if (!input.includes("@") && !input.includes("http")) return true;
  const r = tokenizePII(input, "standard");
  return r.unique === 0;
}
