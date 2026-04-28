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
