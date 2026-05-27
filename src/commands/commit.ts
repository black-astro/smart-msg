// `sm c` 본체. staged diff → (선택) 사용자 의도 입력 → AI 메시지 생성 → y/r/e/n 선택 → commit.
//
// 의도(intent) 단계:
//   - --intent <text>  : 인자 그대로 사용 (prompt 안 함)
//   - --no-intent      : 절대 묻지 않음 (config 가 always 라도)
//   - SM_INTENT env    : non-TTY 환경에서도 사용 가능
//   - 그 외는 config.captureIntent (ask/always/never) 와 TTY 여부에 따름.
//
// 선택지:
//   y (기본): 그대로 commit
//   r       : 다시 생성 (사용자가 결과가 마음에 안 들 때)
//   e       : 에디터로 열어서 수정 후 commit
//   n       : 취소
import { getStagedDiff, commit } from "../git.js";
import { generateCommitMessage } from "../ai.js";
import { loadConfig } from "../config.js";
import { askChoice, askText, askYesNo } from "../cliPrompt.js";
import { editText } from "../editorEdit.js";
import { t } from "../i18n.js";
import { assessRisk, collectRiskFactors, formatRiskBar } from "../riskScore.js";

export interface CommitOptions {
  dryRun?: boolean;
  // 사용자가 --intent "..." 로 명시 입력한 경우. undefined 면 미지정.
  // 빈 문자열 ("") 은 "명시 스킵" 의미로는 사용하지 않는다 (그 용도는 noIntent).
  intent?: string;
  // --no-intent 플래그. true 면 prompt 단계를 강제로 건너뛴다 (captureIntent=always 도 무시).
  noIntent?: boolean;
  // --skip-risk 플래그. true 면 위험도 평가 자체를 건너뛴다 (config.riskCheck=off 와 동등).
  skipRisk?: boolean;
}

export async function runCommit(opts: CommitOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  const diff = await getStagedDiff();
  if (!diff.trim()) {
    console.log(m.noStagedChanges);
    process.exit(1);
  }

  // 의도(intent) 결정. 한 번만 계산하고 재생성 루프에서도 동일한 의도를 재사용한다.
  const intent = await resolveIntent(opts, cfg?.captureIntent ?? "ask", lang);
  if (intent === null) {
    // 사용자 Ctrl+C 등으로 취소
    console.log(m.cancelled);
    return;
  }

  // 사용자가 'r' 로 재생성을 원할 수 있어 루프.
  let message = "";
  for (let i = 0; i < 5; i++) {
    try {
      message = await generateCommitMessage(diff, { intent: intent || undefined });
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }

    console.log(`\n${m.generatedMessageHeader}`);
    console.log(message);
    console.log("");

    if (opts.dryRun) {
      console.log(m.dryRunFinished);
      return;
    }

    const choice = await askChoice(
      m.commitChoicePrompt,
      [
        { key: "y", label: m.commitChoiceYes },
        { key: "r", label: m.commitChoiceRegen },
        { key: "e", label: m.commitChoiceEdit },
        { key: "n", label: m.commitChoiceNo },
      ],
      "y",
      lang,
    );

    if (choice === null || choice === "n") {
      console.log(m.cancelled);
      return;
    }

    if (choice === "y") {
      if (!(await passesRiskGate(opts, cfg?.riskCheck ?? "warn", lang))) {
        return;
      }
      await commit(message);
      return;
    }

    if (choice === "e") {
      const edited = await editText(message, ".gitcommit");
      if (!edited) {
        console.log(m.cancelled);
        return;
      }
      if (!(await passesRiskGate(opts, cfg?.riskCheck ?? "warn", lang))) {
        return;
      }
      await commit(edited);
      return;
    }

    // 'r' — 다시 생성. 루프 계속.
    console.log(m.regenerating);
  }

  console.log(m.regenLimitReached);
}

// commit 직전 위험도 평가 + (필요 시) 사용자 confirm.
// 반환값: true 면 진행, false 면 사용자 취소.
async function passesRiskGate(
  opts: CommitOptions,
  mode: "warn" | "on" | "off",
  lang: "ko" | "en",
): Promise<boolean> {
  const m = t(lang);

  if (mode === "off" || opts.skipRisk) {
    if (opts.skipRisk) console.log(m.riskSkipped);
    return true;
  }

  // 점수 산정. git 호출이 실패해도 commit 자체는 막지 않는다 (network 없는 가벼운 fail-safe).
  let assessment;
  try {
    const factors = await collectRiskFactors();
    assessment = assessRisk(factors);
  } catch {
    return true;
  }

  const isHigh = assessment.score >= 4;
  const isTimeDanger = assessment.isDangerousTime;

  // mode=warn: 점수 4+ AND 위험 시간대일 때만 confirm. 그 외엔 안내만.
  // mode=on  : 점수 4+ 면 항상 confirm.
  const requiresConfirm =
    mode === "on" ? isHigh : isHigh && isTimeDanger;

  // 위험 요소가 있거나 시간대가 위험할 때만 출력 (스팸 방지).
  // 점수 1-3 이고 시간대도 안전하면 사용자에게 굳이 보이지 않는다.
  if (isHigh || isTimeDanger) {
    console.log(`\n${m.riskHeader}`);
    console.log(m.riskScoreLine(formatRiskBar(assessment.score)));
    for (const r of assessment.reasons) console.log(m.riskReasonLine(r));
    if (isTimeDanger) console.log(m.riskTimeWarning(assessment.timeWarnings.join(", ")));
    console.log("");
  }

  if (!requiresConfirm) return true;

  // non-TTY 면 prompt 불가 → mode=on 이라도 통과 (hook 등 자동화 경로 차단 방지).
  // 자동화 환경에서 강제 차단을 원하면 호출자가 환경에 맞게 --skip-risk 든 분기든 두면 됨.
  if (!process.stdin.isTTY) return true;

  const ok = await askYesNo(m.riskHighConfirm, false, lang);
  if (ok !== true) {
    console.log(m.riskBlocked);
    return false;
  }
  return true;
}

// 의도 입력 해결.
// 반환값:
//   string  — 의도 (빈 문자열 가능: 스킵을 의미)
//   null    — 사용자 취소 (Ctrl+C 등)
async function resolveIntent(
  opts: CommitOptions,
  mode: "ask" | "always" | "never",
  lang: "ko" | "en",
): Promise<string | null> {
  const m = t(lang);

  // 1) --intent "..." 가 명시되었으면 그대로 사용 (mode 와 무관).
  if (typeof opts.intent === "string") {
    const trimmed = opts.intent.trim();
    if (trimmed) console.log(m.intentAccepted(trimmed));
    return trimmed;
  }

  // 2) --no-intent 가 명시되었으면 무조건 스킵 (mode=always 도 우회).
  if (opts.noIntent) return "";

  // 3) 환경변수 SM_INTENT 가 있으면 그대로 사용 (non-TTY 환경, IDE plugin 시나리오).
  const envIntent = (process.env.SM_INTENT ?? "").trim();
  if (envIntent) {
    console.log(m.intentAccepted(envIntent));
    return envIntent;
  }

  // 4) mode=never → 절대 묻지 않음.
  if (mode === "never") return "";

  // 5) TTY 가 아니면 (hook, pipe, CI) prompt 불가 → 자동 스킵.
  if (!process.stdin.isTTY) return "";

  // 6) mode=ask 또는 always — 사용자에게 묻기.
  console.log(`\n${m.intentAskHint}`);
  const input = await askText(m.intentAskPrompt, {
    allowEmpty: mode === "ask",
    emptyRetryMessage: m.intentAlwaysEmptyRetry,
  });
  if (input === null) return null;

  if (input === "") {
    console.log(m.intentSkippedHint);
    return "";
  }

  console.log(m.intentAccepted(input));
  return input;
}
