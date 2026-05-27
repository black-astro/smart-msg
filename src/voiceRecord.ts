// ffmpeg 기반 cross-platform 마이크 녹음.
//
// ffmpeg 가 PATH 에 있으면 사용. 없으면 명령 자체를 거부하고 사용자에게
// 1) ffmpeg 설치 또는 2) --file <path> 옵션으로 미리 녹음한 파일 전달 안내.
//
// 플랫폼별 입력 디바이스:
//   macOS   : -f avfoundation -i ":0"  (기본 마이크)
//   Linux   : -f alsa -i default       (또는 pulse / -f pulse -i default)
//   Windows : -f dshow -i audio="<device-name>"
//             Windows 는 디바이스 이름이 다양해 자동 선정이 위험 → 별도 안내.
//
// 출력: 16-bit PCM WAV, 16kHz mono — Whisper 가 가장 잘 처리하는 형식.
import { execa } from "execa";
import { existsSync } from "node:fs";

export type Platform = "darwin" | "linux" | "win32" | "other";

// 현재 플랫폼 결정. process.platform 을 그대로 쓰지 않고 좁힌 union 으로 노출 → 테스트에서 주입 가능.
export function detectPlatform(): Platform {
  const p = process.platform;
  if (p === "darwin" || p === "linux" || p === "win32") return p;
  return "other";
}

// ffmpeg 가 PATH 에 있는지 검사.
export async function hasFfmpeg(): Promise<boolean> {
  try {
    await execa("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 녹음 명령의 argv 를 만든다. 플랫폼별 입력 옵션을 적용.
// 출력은 16kHz mono 16-bit PCM WAV (-ac 1 -ar 16000 -sample_fmt s16).
//
// duration: 초 단위 최대 녹음 시간. 안전 cap 60초.
// outPath : 결과 wav 파일 경로.
export function buildFfmpegArgs(platform: Platform, duration: number, outPath: string): string[] {
  const safeDuration = Math.max(1, Math.min(60, Math.floor(duration)));
  const common = ["-loglevel", "error", "-y", "-t", `${safeDuration}`];
  const codec = ["-ac", "1", "-ar", "16000", "-sample_fmt", "s16"];

  switch (platform) {
    case "darwin":
      // ":0" = 기본 입력 (마이크). ":1" 등은 사용자가 직접 ffmpeg 호출하면 됨.
      return ["-f", "avfoundation", "-i", ":0", ...common, ...codec, outPath];
    case "linux":
      // alsa default. PulseAudio 환경이라면 사용자가 ffmpeg 옵션 직접 조정.
      return ["-f", "alsa", "-i", "default", ...common, ...codec, outPath];
    case "win32":
      // Windows 는 디바이스 이름이 다양 — 일반 명을 시도. 실패는 명확한 메시지로 전파됨.
      return ["-f", "dshow", "-i", "audio=Microphone", ...common, ...codec, outPath];
    default:
      throw new Error("지원하지 않는 플랫폼입니다. --file <path> 로 미리 녹음한 파일을 전달하시기 바랍니다.");
  }
}

// 실제 녹음. ffmpeg child process 를 spawn 하여 duration 초 동안 녹음.
// Promise 는 ffmpeg 가 정상 종료한 후 (혹은 사용자가 Ctrl+C / Enter 입력 처리 외부) resolve.
//
// 현재 단순 구현: ffmpeg 의 -t 옵션 기반 정해진 초만큼 녹음. 향후 stdin 입력으로
// Enter 누르면 일찍 종료하는 기능을 추가할 수 있다.
export async function recordWithFfmpeg(duration: number, outPath: string): Promise<void> {
  const platform = detectPlatform();
  const args = buildFfmpegArgs(platform, duration, outPath);
  try {
    await execa("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const msg = (e as Error).message;
    throw new Error(`ffmpeg 녹음 실패: ${msg}`);
  }
  if (!existsSync(outPath)) {
    throw new Error("녹음 결과 파일이 생성되지 않았습니다.");
  }
}
