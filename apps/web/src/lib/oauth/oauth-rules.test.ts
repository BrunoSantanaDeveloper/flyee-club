import { describe, expect, it } from "vitest";

import {
  formatUserCode,
  generateUserCode,
  normalizeUserCode,
  pollDecision,
  USER_CODE_ALPHABET,
} from "@/lib/oauth/device-code";
import { isLoopbackUri, isValidRedirectUri, redirectUriMatches } from "@/lib/oauth/redirect";
import { chainLapsed, daysSinceBucket } from "@/lib/oauth/token-rules";

const CLI_REDIRECTS = ["http://127.0.0.1/callback", "http://localhost/callback"];

describe("redirect targets", () => {
  it("lets the CLI listen on any loopback port, with the registered host and path", () => {
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1:53682/callback", true)).toBe(true);
    expect(redirectUriMatches(CLI_REDIRECTS, "http://localhost:9000/callback", true)).toBe(true);
  });

  it("keeps everything else exact: path, host, scheme, query", () => {
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1:53682/other", true)).toBe(false);
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.2:53682/callback", true)).toBe(false);
    expect(redirectUriMatches(CLI_REDIRECTS, "https://127.0.0.1:53682/callback", true)).toBe(false);
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1:53682/callback?x=1", true)).toBe(false);
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1:53682/callback#frag", true)).toBe(false);
  });

  it("never gives a client without the allowance a different port", () => {
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1:53682/callback", false)).toBe(false);
    expect(redirectUriMatches(CLI_REDIRECTS, "http://127.0.0.1/callback", false)).toBe(true);
  });

  it("never extends the port rule to a web address", () => {
    expect(redirectUriMatches(["https://app.example.com/cb"], "https://app.example.com:8443/cb", true)).toBe(false);
  });

  it("recognizes loopback and valid registrations", () => {
    expect(isLoopbackUri("http://[::1]:4000/callback")).toBe(true);
    expect(isLoopbackUri("http://example.com/callback")).toBe(false);
    expect(isValidRedirectUri("https://app.example.com/cb")).toBe(true);
    expect(isValidRedirectUri("http://example.com/cb")).toBe(false);
    expect(isValidRedirectUri("https://*.example.com/cb")).toBe(false);
  });
});

describe("device codes", () => {
  it("generates codes the database accepts", () => {
    for (let round = 0; round < 50; round += 1) {
      const code = generateUserCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect([...code].every((character) => USER_CODE_ALPHABET.includes(character))).toBe(true);
    }
  });

  it("reads what a member types, hyphen, spaces and case included", () => {
    expect(normalizeUserCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeUserCode(" ABCD EFGH ")).toBe("ABCDEFGH");
    expect(formatUserCode("ABCDEFGH")).toBe("ABCD-EFGH");
    expect(normalizeUserCode("ABCD-EFG0")).toBeNull();
    expect(normalizeUserCode("ABC")).toBeNull();
    expect(normalizeUserCode(undefined)).toBeNull();
  });

  const now = Date.parse("2026-10-01T12:00:00Z");
  const row = (overrides: Partial<Parameters<typeof pollDecision>[0]> = {}) => ({
    status: "pending" as const,
    expires_at: "2026-10-01T12:10:00Z",
    interval_seconds: 5,
    last_polled_at: null,
    ...overrides,
  });

  it("tells a polling CLI to wait, to slow down, or that it is over", () => {
    expect(pollDecision(row(), now)).toEqual({ kind: "pending" });
    expect(pollDecision(row({ last_polled_at: "2026-10-01T11:59:58Z" }), now)).toEqual({
      kind: "slow_down",
      nextInterval: 10,
    });
    expect(pollDecision(row({ last_polled_at: "2026-10-01T11:59:50Z" }), now)).toEqual({ kind: "pending" });
    expect(pollDecision(row({ expires_at: "2026-10-01T11:59:59Z" }), now)).toEqual({ kind: "expired" });
    expect(pollDecision(row({ status: "denied" }), now)).toEqual({ kind: "denied" });
    expect(pollDecision(row({ status: "approved" }), now)).toEqual({ kind: "approved" });
    expect(pollDecision(row({ status: "consumed" }), now)).toEqual({ kind: "consumed" });
  });

  it("never lets an expired approval mint tokens", () => {
    expect(pollDecision(row({ status: "approved", expires_at: "2026-10-01T11:00:00Z" }), now)).toEqual({
      kind: "expired",
    });
  });
});

describe("token chains", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const live = { revoked_at: null, refresh_expires_at: "2026-10-20T00:00:00Z" };
  const expired = { revoked_at: null, refresh_expires_at: "2026-09-30T00:00:00Z" };
  const rotated = { revoked_at: "2026-09-01T00:00:00Z", refresh_expires_at: "2026-10-20T00:00:00Z" };

  it("calls a login on a machine with no live chain left a revalidation", () => {
    expect(chainLapsed([expired, rotated], now)).toBe(true);
  });

  it("calls a login a plain login on a new machine or while a chain is still live", () => {
    expect(chainLapsed([], now)).toBe(false);
    expect(chainLapsed([live, rotated], now)).toBe(false);
  });

  it("buckets days since the last update the way product_events stores them", () => {
    expect([0, 7, 8, 14, 15, 24, 25, 30, 31].map(daysSinceBucket)).toEqual([
      "0_7",
      "0_7",
      "8_14",
      "8_14",
      "15_24",
      "15_24",
      "25_30",
      "25_30",
      "31_plus",
    ]);
  });
});
