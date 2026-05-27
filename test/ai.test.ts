import { describe, it, expect } from "vitest";
import { normalizeIntent } from "../src/ai.js";

describe("normalizeIntent", () => {
  it("returns undefined for undefined / empty / whitespace-only", () => {
    expect(normalizeIntent(undefined)).toBeUndefined();
    expect(normalizeIntent("")).toBeUndefined();
    expect(normalizeIntent("   ")).toBeUndefined();
    expect(normalizeIntent("\t\n")).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeIntent("  hello  ")).toBe("hello");
    expect(normalizeIntent("\nfix login loop\n")).toBe("fix login loop");
  });

  it("preserves inner whitespace", () => {
    expect(normalizeIntent("  fix  login  loop  ")).toBe("fix  login  loop");
  });

  it("caps length at 200 chars to keep prompt size bounded", () => {
    const long = "a".repeat(500);
    const out = normalizeIntent(long);
    expect(out).toBeDefined();
    expect(out!.length).toBe(200);
  });

  it("does not cap when within the limit", () => {
    const exact = "a".repeat(200);
    expect(normalizeIntent(exact)).toBe(exact);
    const short = "a".repeat(199);
    expect(normalizeIntent(short)).toBe(short);
  });
});
