// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkServiceToken, SERVICE_TOKEN_MIN_LENGTH } = await import("@/lib/catalog/service-token");

const TOKEN = "t".repeat(SERVICE_TOKEN_MIN_LENGTH) + "-catalog";

describe("the service token the product's CI sends apps with", () => {
  it("lets in the configured token, as a bearer", () => {
    expect(checkServiceToken(`Bearer ${TOKEN}`, TOKEN)).toEqual({ ok: true });
    expect(checkServiceToken(`bearer ${TOKEN}`, TOKEN)).toEqual({ ok: true });
  });

  it("refuses a missing, malformed or different token", () => {
    expect(checkServiceToken(null, TOKEN)).toEqual({ ok: false, status: 401, error: "missing_service_token" });
    expect(checkServiceToken(TOKEN, TOKEN)).toEqual({ ok: false, status: 401, error: "missing_service_token" });
    expect(checkServiceToken(`Bearer ${TOKEN}x`, TOKEN)).toEqual({
      ok: false,
      status: 401,
      error: "invalid_service_token",
    });
    expect(checkServiceToken(`Bearer ${TOKEN.slice(1)}`, TOKEN).ok).toBe(false);
  });

  it("stays closed while the platform has no token, or a short one", () => {
    expect(checkServiceToken(`Bearer ${TOKEN}`, undefined)).toEqual({
      ok: false,
      status: 503,
      error: "service_token_not_configured",
    });
    const short = "s".repeat(SERVICE_TOKEN_MIN_LENGTH - 1);
    expect(checkServiceToken(`Bearer ${short}`, short).ok).toBe(false);
    // Spaces around the configured value are not part of the secret.
    expect(checkServiceToken(`Bearer ${TOKEN}`, `  ${TOKEN}\n`)).toEqual({ ok: true });
  });
});
