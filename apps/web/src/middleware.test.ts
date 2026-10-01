// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE_KEYS } from "@/constants";

/**
 * The session refresh is the one piece that cannot run here (no Supabase):
 * this stand-in does what @supabase/ssr does on a refresh, rewriting the
 * request cookies and setting the new ones on a fresh NextResponse.next.
 */
const session = vi.hoisted(() => ({ user: null as { id: string } | null, refreshes: false }));

vi.mock("@flyee/auth/middleware", () => ({
  updateSession: async (request: NextRequest) => {
    let response = NextResponse.next({ request });
    if (session.refreshes) {
      request.cookies.set("sb-test-auth-token", "fresh");
      response = NextResponse.next({ request });
      response.cookies.set("sb-test-auth-token", "fresh", { path: "/", httpOnly: true });
    }
    return { response, user: session.user, needsMfa: false, impersonating: false };
  },
}));

const { middleware } = await import("./middleware");

const DOCUMENT = { accept: "text/html,application/xhtml+xml" };

const request = (path: string, headers: Record<string, string> = DOCUMENT) =>
  new NextRequest(new URL(path, "http://localhost"), { headers }) as never;

const pathOf = (header: string | null) => (header ? new URL(header, "http://localhost").pathname : null);

beforeEach(() => {
  session.user = null;
  session.refreshes = false;
});

describe("middleware: locale routing of the public site", () => {
  it("serves a Portuguese address from the internal route", async () => {
    const response = await middleware(request("/planos"));
    expect(pathOf(response.headers.get("x-middleware-rewrite"))).toBe("/pt-BR/planos");
    expect(response.headers.get("location")).toBeNull();
  });

  it("serves an English address from the internal Portuguese route", async () => {
    const response = await middleware(request("/en/pricing"));
    expect(pathOf(response.headers.get("x-middleware-rewrite"))).toBe("/en/planos");
  });

  it("redirects every non-canonical address to the canonical one", async () => {
    for (const [from, to] of [
      ["/pt-BR/planos", "/planos"],
      ["/en/planos", "/en/pricing"],
      ["/pricing", "/en/pricing"],
      ["/legal/terms", "/en/legal/terms"],
    ]) {
      const response = await middleware(request(from));
      expect(pathOf(response.headers.get("location")), from).toBe(to);
    }
  });

  it("keeps the query string through the redirect", async () => {
    const response = await middleware(request("/pricing?cupom=FUNDADOR"));
    expect(response.headers.get("location")).toMatch(/\/en\/pricing\?cupom=FUNDADOR$/);
  });

  it("lets an anonymous visitor read the public site but not the app", async () => {
    expect((await middleware(request("/en/help/first-steps"))).headers.get("location")).toBeNull();
    const app = await middleware(request("/inicio"));
    expect(app.headers.get("location")).toMatch(/\/auth\/sign-in\?next=%2Finicio$/);
    // A locale prefix does not make an app route public.
    const prefixed = await middleware(request("/en/inicio"));
    expect(pathOf(prefixed.headers.get("location"))).toBe("/auth/sign-in");
  });

  it("carries the refreshed session into the rewritten request and the response", async () => {
    session.refreshes = true;
    const response = await middleware(request("/en/pricing", { ...DOCUMENT, cookie: "sb-test-auth-token=stale" }));
    expect(pathOf(response.headers.get("x-middleware-rewrite"))).toBe("/en/planos");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("fresh");
    // What the server components of the page will read.
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-test-auth-token=fresh");
  });

  it("persists the language of the address and drops an automatic-switch flag", async () => {
    const response = await middleware(
      request("/en/pricing", {
        ...DOCUMENT,
        cookie: `${COOKIE_KEYS.locale}=pt-BR; ${COOKIE_KEYS.localeAuto}=en`,
      }),
    );
    expect(response.cookies.get(COOKIE_KEYS.locale)?.value).toBe("en");
    expect(response.cookies.get(COOKIE_KEYS.localeAuto)?.value).toBe("");
  });

  it("leaves the language cookie alone on a client-side fetch", async () => {
    const response = await middleware(request("/en/pricing", { accept: "*/*", rsc: "1" }));
    expect(response.cookies.get(COOKIE_KEYS.locale)).toBeUndefined();
  });

  it("still detects a first visit to the app, flagged as automatic", async () => {
    session.user = { id: "member" };
    const response = await middleware(
      request("/inicio", { ...DOCUMENT, "accept-language": "en-US,en;q=0.9", "user-agent": "Mozilla/5.0" }),
    );
    expect(response.cookies.get(COOKIE_KEYS.locale)?.value).toBe("en");
    expect(response.cookies.get(COOKIE_KEYS.localeAuto)?.value).toBe("en");
  });
});
