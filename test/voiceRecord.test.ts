import { describe, it, expect } from "vitest";
import { buildFfmpegArgs, detectPlatform } from "../src/voiceRecord.js";

describe("detectPlatform", () => {
  it("returns one of the supported values", () => {
    const p = detectPlatform();
    expect(["darwin", "linux", "win32", "other"]).toContain(p);
  });
});

describe("buildFfmpegArgs", () => {
  it("produces avfoundation args on macOS", () => {
    const args = buildFfmpegArgs("darwin", 10, "/tmp/out.wav");
    expect(args).toContain("avfoundation");
    expect(args).toContain(":0");
    expect(args.at(-1)).toBe("/tmp/out.wav");
  });

  it("produces alsa args on Linux", () => {
    const args = buildFfmpegArgs("linux", 5, "/tmp/out.wav");
    expect(args).toContain("alsa");
    expect(args).toContain("default");
  });

  it("produces dshow args on Windows", () => {
    const args = buildFfmpegArgs("win32", 7, "C:\\out.wav");
    expect(args).toContain("dshow");
    expect(args.some((a) => a.startsWith("audio="))).toBe(true);
  });

  it("clamps duration to [1, 60]", () => {
    const tooSmall = buildFfmpegArgs("linux", 0.4, "/tmp/x.wav");
    const tooBig = buildFfmpegArgs("linux", 999, "/tmp/x.wav");
    const idxT1 = tooSmall.indexOf("-t");
    const idxT2 = tooBig.indexOf("-t");
    expect(tooSmall[idxT1 + 1]).toBe("1");
    expect(tooBig[idxT2 + 1]).toBe("60");
  });

  it("includes WAV codec params (16k mono s16)", () => {
    const args = buildFfmpegArgs("linux", 5, "/tmp/x.wav");
    expect(args).toContain("-ac");
    expect(args[args.indexOf("-ac") + 1]).toBe("1");
    expect(args).toContain("-ar");
    expect(args[args.indexOf("-ar") + 1]).toBe("16000");
    expect(args).toContain("-sample_fmt");
    expect(args[args.indexOf("-sample_fmt") + 1]).toBe("s16");
  });

  it("throws on unsupported platform", () => {
    expect(() => buildFfmpegArgs("other", 10, "/tmp/x.wav")).toThrow();
  });
});
