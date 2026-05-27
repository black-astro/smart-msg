// 여러 명령에서 공유하는 인터랙티브 prompt 헬퍼.
// 별도 모듈로 분리하여 login → installHook → ... 의 의존 사이클 위험을 차단한다.
import prompts from "prompts";
import { t } from "./i18n.js";
import type { Language } from "./config.js";

// y/Y/n/N/빈입력만 허용하는 엄격한 yes-no 프롬프트.
// prompts 의 'confirm' 타입은 첫 글자를 누르는 즉시 응답이 확정되어 사용자가 의도치 않게
// 키를 잘못 누르면 그대로 진행되는 문제가 있다. 이 헬퍼는:
//   - 입력 종료를 항상 'Enter' 키로 강제 (text 타입 사용)
//   - 빈 입력 (그냥 Enter) → defaultYes 값
//   - y / Y → true,  n / N → false
//   - 그 외 입력 → 안내 후 동일 질문 재출제 (다음 단계로 넘어가지 않음)
//   - Ctrl+C 등으로 취소 (응답 자체가 undefined) → null 반환
export async function askYesNo(
  message: string,
  defaultYes: boolean,
  lang: Language = "en",
): Promise<boolean | null> {
  const m = t(lang);
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  while (true) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `${message} ${hint}`,
    });

    if (answer === undefined) return null;

    const normalized = String(answer).trim();

    if (normalized === "") return defaultYes;
    if (normalized === "y" || normalized === "Y") return true;
    if (normalized === "n" || normalized === "N") return false;

    console.log(m.askYesNoInvalid);
  }
}

// 한 글자 키 + Enter 로 다중 선택을 받는다.
// 예: askChoice("진행", [{key:"y",label:"commit"},{key:"r",label:"재생성"},...], "y")
//   - 빈 입력 → defaultKey (있으면)
//   - 등록된 key 와 일치 (case-insensitive) → 그 key 반환
//   - 그 외 → 안내 후 재질문
//   - Ctrl+C → null
export interface Choice {
  key: string;
  label: string;
}

export async function askChoice(
  message: string,
  choices: Choice[],
  defaultKey: string | undefined,
  lang: Language = "en",
): Promise<string | null> {
  const m = t(lang);
  const keys = choices.map((c) => c.key.toLowerCase());
  const hint = choices
    .map((c) =>
      defaultKey && c.key.toLowerCase() === defaultKey.toLowerCase()
        ? c.key.toUpperCase()
        : c.key.toLowerCase(),
    )
    .join("/");
  const labels = choices.map((c) => `  ${c.key}: ${c.label}`).join("\n");

  while (true) {
    console.log(labels);
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `${message} [${hint}]`,
    });

    if (answer === undefined) return null;
    const normalized = String(answer).trim().toLowerCase();

    if (normalized === "" && defaultKey) return defaultKey.toLowerCase();
    if (keys.includes(normalized)) return normalized;

    console.log(m.askChoiceInvalid(keys.join("/")));
  }
}

// 자유형 텍스트 한 줄을 받는다.
//   - 빈 입력 + allowEmpty=true → 빈 문자열 반환 (스킵 의도)
//   - 빈 입력 + allowEmpty=false → 안내 후 다시 묻기
//   - Ctrl+C → null
// 의도(intent) 입력같이 "비어도 OK" 인 경우 / "필수" 인 경우 양쪽을 한 헬퍼로 처리한다.
export async function askText(
  message: string,
  opts: { allowEmpty?: boolean; placeholder?: string; emptyRetryMessage?: string } = {},
): Promise<string | null> {
  const allowEmpty = opts.allowEmpty !== false;
  while (true) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message,
      ...(opts.placeholder ? { initial: "", hint: opts.placeholder } : {}),
    });

    if (answer === undefined) return null;
    const trimmed = String(answer).trim();
    if (trimmed === "") {
      if (allowEmpty) return "";
      if (opts.emptyRetryMessage) console.log(opts.emptyRetryMessage);
      continue;
    }
    return trimmed;
  }
}
