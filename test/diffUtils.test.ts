import { describe, it, expect } from "vitest";
import { maskSecrets, condenseDiff, prepareDiff } from "../src/diffUtils.js";

describe("maskSecrets", () => {
  it("masks .env-style KEY=VALUE for secret-like keys", () => {
    const input = "+OPENAI_API_KEY=sk-proj-abc123abc123abc123abc123\n+OTHER_VAR=plain";
    const out = maskSecrets(input);
    expect(out).toContain("OPENAI_API_KEY=[REDACTED]");
    expect(out).toContain("OTHER_VAR=plain");
  });

  it("masks AWS access key IDs", () => {
    const out = maskSecrets("AWS key AKIAIOSFODNN7EXAMPLE found");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("masks GitHub PATs", () => {
    const out = maskSecrets("token: ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("ghp_abcdef");
  });

  it("masks PEM private keys", () => {
    const input = "-----BEGIN RSA PRIVATE KEY-----\nMIIabcd\n-----END RSA PRIVATE KEY-----";
    const out = maskSecrets(input);
    expect(out).toBe("[REDACTED]");
  });

  it("does not mask normal code", () => {
    const input = "const x = 1;\nfunction foo() { return 2; }";
    expect(maskSecrets(input)).toBe(input);
  });
});

describe("condenseDiff", () => {
  it("returns input unchanged if within limit", () => {
    const small = "diff --git a/x b/x\n+hello\n";
    expect(condenseDiff(small, 1000)).toBe(small);
  });

  it("truncates large input and adds notice", () => {
    const big = "diff --git a/x b/x\n" + "+x".repeat(5000) + "\n" +
                "diff --git a/y b/y\n" + "+y".repeat(5000);
    const out = condenseDiff(big, 1000);
    expect(out.length).toBeLessThan(big.length);
    expect(out).toContain("[smart-msg]");
  });
});

describe("prepareDiff", () => {
  it("flags masked and truncated correctly", () => {
    const diff = "diff --git a/.env b/.env\n+API_KEY=sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";
    const out = prepareDiff(diff, 10_000);
    expect(out.masked).toBe(true);
    expect(out.truncated).toBe(false);
    expect(out.text).toContain("[REDACTED]");
  });
});
