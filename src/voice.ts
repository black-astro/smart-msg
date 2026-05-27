// Voice → text 변환 래퍼. OpenAI Whisper API 호출.
//
// 의도: `sm v` 가 사용자의 음성 한 마디 (의도 / 큰 변경 요약 / refactor 동기 등) 를
// 받아 commit prompt 의 intent 로 그대로 사용한다.
//
// 본 모듈은 OpenAI 키를 요구한다. 사용자 provider 가 openai 가 아니더라도
// config.openaiApiKey 가 있으면 사용 가능 (Whisper 는 별도 endpoint 이므로 다른 provider 와 공존).
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import OpenAI from "openai";

export interface TranscribeOptions {
  apiKey: string;
  // Whisper 모델 — 미설정 시 'gpt-4o-mini-transcribe' (가장 저렴, 안정적). 'whisper-1' 도 가능.
  model?: string;
  // 출력 언어 hint — 정확도/속도 향상. 미설정 시 자동 감지.
  language?: "ko" | "en";
  // verbose 출력 여부.
  verbose?: boolean;
}

export interface TranscribeResult {
  text: string;
  // 응답에 포함된 추가 신호 (있을 때만).
  durationSec?: number;
}

const DEFAULT_MODEL = "gpt-4o-mini-transcribe";

// 50 MB — Whisper API 의 파일 크기 한도(25MB) 보다 보수적으로 설정.
// 큰 녹음을 의도와 직접 연결할 일이 거의 없고, 비용도 폭증.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function transcribeAudio(filePath: string, opts: TranscribeOptions): Promise<TranscribeResult> {
  if (!opts.apiKey) {
    throw new Error("OpenAI API 키가 필요합니다. `sm login` 으로 openai 키를 등록하시기 바랍니다.");
  }
  if (!existsSync(filePath)) {
    throw new Error(`오디오 파일을 찾을 수 없습니다: ${filePath}`);
  }
  const st = statSync(filePath);
  if (st.size === 0) {
    throw new Error("오디오 파일이 비어있습니다.");
  }
  if (st.size > MAX_FILE_BYTES) {
    throw new Error(`오디오 파일이 너무 큽니다 (${(st.size / 1024 / 1024).toFixed(1)} MB). 25 MB 이하 파일을 사용하시기 바랍니다.`);
  }

  const client = new OpenAI({ apiKey: opts.apiKey });
  if (opts.verbose) console.error(`[sm verbose] transcribing ${basename(filePath)} (${st.size} bytes, model=${opts.model ?? DEFAULT_MODEL})`);

  const resp = await client.audio.transcriptions.create({
    file: createReadStream(filePath),
    model: opts.model ?? DEFAULT_MODEL,
    ...(opts.language ? { language: opts.language } : {}),
  });

  const text = (resp.text ?? "").trim();
  if (opts.verbose) console.error(`[sm verbose] transcript: "${text}"`);
  return { text };
}
