// `sm v` 본체. 마이크 녹음 (또는 --file 입력) → Whisper 전사 → intent 로 결합 → `sm c` 흐름.
//
// 흐름:
//   1) --file <path> 가 있으면 해당 오디오를 그대로 transcribe.
//   2) 없으면 ffmpeg 로 마이크 녹음 (기본 10초, --seconds 로 조정).
//   3) 텍스트가 비어있으면 안내 후 종료.
//   4) runCommit 의 intent 로 전달.
//
// 비용/네트워크 안내:
//   - OpenAI Whisper API 사용. 짧은 클립 (10초) 은 매우 저렴 (≈ $0.0001 USD).
//   - openaiApiKey 가 등록되어 있어야 동작. 다른 provider 를 메인으로 쓰는 경우에도
//     openai 키만 등록되어 있으면 voice 는 정상 작동 (key 만 빌려쓰는 형태).
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";
import { loadConfig } from "../config.js";
import { t } from "../i18n.js";
import { hasFfmpeg, recordWithFfmpeg } from "../voiceRecord.js";
import { transcribeAudio } from "../voice.js";
import { runCommit } from "./commit.js";

export interface VoiceOptions {
  // 미리 녹음한 파일을 전달. 있으면 마이크 녹음 단계 생략.
  file?: string;
  // 마이크 녹음 시간 (초). 기본 10. 1~60 으로 clamp.
  seconds?: number;
  // 통과시킬 commit 옵션.
  dryRun?: boolean;
  skipRisk?: boolean;
  skipRevert?: boolean;
}

export async function runVoice(opts: VoiceOptions = {}): Promise<void> {
  const cfg = await loadConfig();
  const lang = cfg?.language ?? "en";
  const m = t(lang);

  if (!cfg?.openaiApiKey) {
    console.error(m.voiceNoOpenaiKey);
    process.exit(1);
  }

  // 1) 입력 결정 — --file 우선.
  let audioPath: string;
  let cleanup = false;
  if (opts.file) {
    if (!existsSync(opts.file)) {
      console.error(m.voiceFileNotFound(opts.file));
      process.exit(1);
    }
    audioPath = opts.file;
  } else {
    // 마이크 녹음.
    if (!(await hasFfmpeg())) {
      console.error(m.voiceNoFfmpeg);
      process.exit(1);
    }
    const seconds = clampSeconds(opts.seconds ?? 10);
    audioPath = join(tmpdir(), `smart-msg-voice-${Date.now()}.wav`);
    cleanup = true;
    console.log(m.voiceRecording(seconds));
    try {
      await recordWithFfmpeg(seconds, audioPath);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
    console.log(m.voiceRecordingDone);
  }

  // 2) 전사.
  let intent = "";
  try {
    const r = await transcribeAudio(audioPath, {
      apiKey: cfg.openaiApiKey,
      language: lang,
      verbose: cfg.verbose === true || process.env.SM_DEBUG === "1",
    });
    intent = r.text.trim();
  } catch (e) {
    console.error(m.voiceTranscribeFailed((e as Error).message));
    process.exit(1);
  } finally {
    if (cleanup) {
      try {
        rmSync(audioPath, { force: true });
      } catch {
        // 임시 파일 청소 실패는 silent — 사용자에게 노이즈 안 줌.
      }
    }
  }

  if (!intent) {
    console.log(m.voiceEmptyTranscript);
    return;
  }
  console.log(m.voiceTranscriptCaptured(intent));

  // 3) commit 흐름으로 위임 — 전사를 intent 로 전달.
  await runCommit({
    intent,
    dryRun: opts.dryRun === true,
    skipRisk: opts.skipRisk === true,
    skipRevert: opts.skipRevert === true,
  });
}

function clampSeconds(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(60, Math.floor(n)));
}
