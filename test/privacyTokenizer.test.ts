import { describe, it, expect } from "vitest";
import {
  describeMode,
  isPIIClean,
  summaryDigest,
  tokenizePII,
} from "../src/privacyTokenizer.js";

describe("tokenizePII — off mode", () => {
  it("returns input unchanged", () => {
    const inp = "contact me at user@example.com or http://acme.test";
    const r = tokenizePII(inp, "off");
    expect(r.text).toBe(inp);
    expect(r.unique).toBe(0);
  });
});

describe("tokenizePII — standard mode", () => {
  it("tokenizes emails", () => {
    const r = tokenizePII("send to alice@example.com please", "standard");
    expect(r.text).toContain("<EMAIL_1>");
    expect(r.text).not.toContain("alice@example.com");
  });

  it("uses stable tokens — same value gets same number", () => {
    const r = tokenizePII("a@x.com and a@x.com again, then b@y.org", "standard");
    expect(r.text).toContain("<EMAIL_1>");
    expect(r.text).toContain("<EMAIL_2>");
    const matches = r.text.match(/<EMAIL_\d+>/g) ?? [];
    // 3 occurrences (a, a, b), but only 2 unique tokens
    expect(matches).toHaveLength(3);
    expect(new Set(matches).size).toBe(2);
  });

  it("tokenizes URL with embedded auth", () => {
    const r = tokenizePII("https://user:pwd@prod.internal/api works", "standard");
    expect(r.text).toContain("<URL_AUTH_1>");
    expect(r.text).not.toContain("user:pwd@prod.internal");
  });

  it("does NOT tokenize plain URLs in standard mode", () => {
    const r = tokenizePII("see https://example.com/path", "standard");
    expect(r.text).toContain("https://example.com/path");
  });

  it("tokenizes JWT", () => {
    const jwt = "eyJabcdef12.eyJpayload12.signature12345";
    const r = tokenizePII(`token: ${jwt}`, "standard");
    expect(r.text).toContain("<JWT_1>");
    expect(r.text).not.toContain("eyJabcdef12");
  });

  it("tokenizes UUIDs", () => {
    const r = tokenizePII("id=550e8400-e29b-41d4-a716-446655440000 ok", "standard");
    expect(r.text).toContain("<UUID_1>");
  });

  it("validates IPv4 — rejects 999.999.999.999", () => {
    const r = tokenizePII("server 999.999.999.999 is fake", "standard");
    expect(r.text).toContain("999.999.999.999");
    expect(r.counts.IP ?? 0).toBe(0);
  });

  it("tokenizes valid IPv4", () => {
    const r = tokenizePII("server 192.168.1.1 ok", "standard");
    expect(r.text).toContain("<IP_1>");
  });

  it("validates credit cards — rejects non-Luhn", () => {
    // Random 16-digit not matching Luhn.
    const r = tokenizePII("card 1234567890123456 no", "standard");
    expect(r.counts.CC ?? 0).toBe(0);
  });

  it("tokenizes Luhn-valid credit card", () => {
    // 4532015112830366 is Luhn-valid (test card).
    const r = tokenizePII("card 4532015112830366 ok", "standard");
    expect(r.text).toContain("<CC_1>");
  });

  it("tokenizes phone-like numbers", () => {
    const r = tokenizePII("call me at +82 10 1234 5678", "standard");
    expect(r.text).toContain("<PHONE_1>");
  });

  it("does NOT tokenize Bearer in standard mode", () => {
    const r = tokenizePII("Bearer abc123xyz789verylongtoken", "standard");
    expect(r.text).toContain("Bearer abc123xyz789verylongtoken");
  });
});

describe("tokenizePII — strict mode", () => {
  it("tokenizes plain URLs", () => {
    const r = tokenizePII("see https://example.com/path", "strict");
    expect(r.text).toContain("<URL_1>");
  });

  it("tokenizes Bearer tokens", () => {
    const r = tokenizePII("Authorization: Bearer abc123xyz789verylongtoken", "strict");
    expect(r.text).toContain("<BEARER_1>");
  });
});

describe("counts and digest", () => {
  it("counts per category", () => {
    const r = tokenizePII("a@x.com, b@y.com, 4532015112830366", "standard");
    expect(r.counts.EMAIL).toBe(2);
    expect(r.counts.CC).toBe(1);
  });

  it("summaryDigest renders ordered key:value", () => {
    expect(summaryDigest({ EMAIL: 2, IP: 1 })).toBe("EMAIL:2,IP:1");
    expect(summaryDigest({})).toBe("none");
  });
});

describe("isPIIClean", () => {
  it("returns true for plain code", () => {
    expect(isPIIClean("const x = 42;")).toBe(true);
  });

  it("returns false when email present", () => {
    expect(isPIIClean("contact a@x.com")).toBe(false);
  });

  it("returns false when auth-URL present", () => {
    expect(isPIIClean("https://u:p@host/")).toBe(false);
  });
});

describe("describeMode", () => {
  it("describes all three modes", () => {
    expect(describeMode("off")).toMatch(/off/);
    expect(describeMode("standard")).toMatch(/standard/);
    expect(describeMode("strict")).toMatch(/strict/);
  });
});
