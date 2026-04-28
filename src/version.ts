// 버전 관련 유틸. sm status / sm update 에서 공통으로 사용한다.
//
// 책임 분리:
//   - getCurrentVersion: 패키지 자체의 version (package.json 동기화). 동기 호출.
//   - fetchLatestVersion: npm registry 에서 latest 태그의 version 을 조회. 네트워크 가능성을 고려해 비동기 + 실패 시 null.
//   - compareSemver: 두 semver 문자열을 비교 (-1/0/1). dependency 없이 단순 구현.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 빌드 결과 dist/version.js → 패키지 루트의 package.json 을 ../package.json 으로 접근.
// CLI 실행 시 한 번만 읽도록 모듈 로드 시점에 캐시.
const PKG_VERSION = (() => {
  try {
    const raw = readFileSync(join(__dirname, "../package.json"), "utf-8");
    return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

export function getCurrentVersion(): string {
  return PKG_VERSION;
}

// npm registry 의 latest 태그 정보를 조회한다.
// 네트워크 오류, 404, JSON 파싱 실패 등 어떤 이유로 실패해도 호출자가 단순 분기할 수 있도록 null 반환.
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch("https://registry.npmjs.org/smart-msg/latest", {
      headers: { accept: "application/json" },
      // 사용자 셸 응답성이 중요 → 너무 길게 대기하지 않는다.
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

// semver 비교 함수. a < b → -1, a == b → 0, a > b → 1.
// pre-release 라벨(-rc.1 등) 은 무시하고 numeric 부분만 비교 — 본 도구가 pre-release 를 publish 하지 않으므로 충분.
export function compareSemver(a: string, b: string): number {
  const norm = (v: string) => v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const aa = norm(a);
  const bb = norm(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const x = aa[i] ?? 0;
    const y = bb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
