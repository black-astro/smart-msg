// fetch 기반 provider 가 공유하는 transient 에러 재시도 + 타임아웃 헬퍼.
// AI provider 들의 503/429/500/502/504 같은 일시적 에러로 hook 이 빈 메시지를 반환해
// git commit 이 abort 되는 사고를 줄이고, 무한 대기로부터 사용자를 보호한다.
//
// 정책:
//   - 단일 시도 타임아웃: 30초 (대부분의 LLM 응답은 5초 이내, 30초는 충분한 여유).
//   - 재시도 횟수: 총 2회 (1회 실패 시 1번 더 시도). worst case 60초 + 백오프 0.6초.
//   - 재시도 대상 status: 429/500/502/503/504. 그 외 (401, 400 등) 는 즉시 실패.
//   - AbortSignal.timeout 사용 — Node 18+ 에서 표준. clean up 누수 없음.

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 2;
const BACKOFF_BASE_MS = 600;
const TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 호출자는 fetch 호출을 람다로 넘기되, 받은 signal 을 fetch options 에 그대로 전달해야 한다.
// 이렇게 분리한 이유: provider 마다 fetch 의 url/headers/body 가 다르므로 헬퍼가 통째로 만들지 못한다.
export async function fetchWithRetry(
  call: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await call(signal);
    } catch (e) {
      lastError = e;
      // AbortError(타임아웃) 와 일반 네트워크 에러 모두 재시도 대상으로 본다.
      // 마지막 시도면 그대로 throw — 호출자가 사용자 친화적 메시지로 가공한다.
      if (attempt === MAX_ATTEMPTS) {
        throw normalizeError(e);
      }
      await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
      continue;
    }

    if (res.ok) return res;
    if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) {
      return res;
    }
    await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
  }
  throw normalizeError(lastError);
}

// AbortError 인 경우 사용자에게 보여줄 메시지가 더 명확하도록 가공한다.
function normalizeError(e: unknown): Error {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return new Error(`요청이 ${TIMEOUT_MS / 1000}초 내에 완료되지 않아 중단되었습니다.`);
    }
    return e;
  }
  return new Error(String(e));
}
