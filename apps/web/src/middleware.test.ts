// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const response = await middleware(request("/pricing?cupom=LANCAMENTO"));
    expect(response.headers.get("location")).toMatch(/\/en\/pricing\?cupom=LANCAMENTO$/);
  });

  it("lets an anonymous visitor read the public site but not the app", async () => {
    expect((await middleware(request("/en/help/first-steps"))).headers.get("location")).toBeNull();
    const app = await middleware(request("/inicio"));
    expect(app.headers.get("location")).toMatch(/\/auth\/sign-in\?next=%2Finicio$/);
    // A locale prefix does not make an app route public.
    const prefixed = await middleware(request("/en/inicio"));
    expect(pathOf(prefixed.headers.get("location"))).toBe("/auth/sign-in");
  });

  it("lets the product's CI reach the catalog service routes without a session", async () => {
    // Each route checks the service token itself (lib/catalog/service-token.ts).
    for (const path of [
      "/api/service/catalog/import",
      "/api/service/catalog/uploads",
      "/api/service/catalog/versions",
    ]) {
      expect(
        (await middleware(request(path, { accept: "application/json" }))).headers.get("location"),
        path,
      ).toBeNull();
    }
    // The prefix is the folder, not any address that starts with the word.
    const lookalike = await middleware(request("/api/services-status", { accept: "application/json" }));
    expect(lookalike.headers.get("location")).not.toBeNull();
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

  it("moves the waitlist confirmation token out of the address", async () => {
    for (const [from, to] of [
      ["/espera/confirmar?t=TOKEN_1234567890_abcdefghij", "/espera/confirmar"],
      ["/en/waitlist/confirm?t=TOKEN_1234567890_abcdefghij", "/en/waitlist/confirm"],
    ]) {
      const response = await middleware(request(from));
      const location = new URL(response.headers.get("location") ?? "", "http://localhost");
      expect(location.pathname, from).toBe(to);
      expect(location.search, from).toBe("");
      const cookie = response.cookies.get(COOKIE_KEYS.leadConfirm);
      expect(cookie?.value, from).toBe("TOKEN_1234567890_abcdefghij");
      expect(cookie?.httpOnly, from).toBe(true);
    }
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

describe("middleware: what a person reaches from an e-mail", () => {
  const LINK = "/api/public/email/unsubscribe?k=m&t=0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b";

  it("lets the unsubscribe address through without a session, as a link and as a one-click post", async () => {
    const followed = await middleware(request(LINK));
    expect(followed.headers.get("location")).toBeNull();
    const posted = await middleware(
      new NextRequest(new URL(LINK, "http://localhost"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }) as never,
    );
    expect(posted.headers.get("location")).toBeNull();
  });

  it("serves the page the link lands on in both languages", async () => {
    const portuguese = await middleware(request("/descadastro"));
    expect(pathOf(portuguese.headers.get("x-middleware-rewrite"))).toBe("/pt-BR/descadastro");
    const english = await middleware(request("/en/unsubscribe"));
    expect(pathOf(english.headers.get("x-middleware-rewrite"))).toBe("/en/descadastro");
    // The English address typed without its prefix still reads English.
    expect(pathOf((await middleware(request("/unsubscribe"))).headers.get("location"))).toBe("/en/unsubscribe");
  });

  it("opens nothing else under /api to a visitor without a session", async () => {
    for (const closed of ["/api/admin/insights", "/api/billing/providers", "/api/publicity"]) {
      const response = await middleware(request(closed));
      expect(pathOf(response.headers.get("location")), closed).toBe("/auth/sign-in");
    }
  });
});

describe("middleware: visits of the entry doors table", () => {
  const BROWSER = { ...DOCUMENT, "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0" };
  const views: { path: string; origem: string | null; locale: string }[] = [];
  const pending: Promise<unknown>[] = [];
  const event = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) } as never;

  beforeEach(() => {
    views.length = 0;
    pending.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe("https://project.supabase.co/rest/v1/rpc/count_site_view");
        const body = JSON.parse(String(init.body));
        views.push({ path: body.target_path, origem: body.target_origem, locale: body.target_locale });
        return new Response(null, { status: 204 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const visit = async (path: string, headers: Record<string, string> = BROWSER) => {
    await middleware(request(path, headers), event);
    await Promise.all(pending);
    return views;
  };

  it("counts a page load under its internal path, language and door", async () => {
    expect(await visit("/en/pricing?origem=youtube")).toEqual([{ path: "/planos", origem: "youtube", locale: "en" }]);
  });

  it("falls back to the door of the first visit, then to none", async () => {
    const firstTouch = `${COOKIE_KEYS.attribution}=${encodeURIComponent(JSON.stringify({ origem: "parceiro" }))}`;
    expect(await visit("/planos", { ...BROWSER, cookie: firstTouch })).toEqual([
      { path: "/planos", origem: "parceiro", locale: "pt-BR" },
    ]);
    views.length = 0;
    expect(await visit("/")).toEqual([{ path: "/", origem: null, locale: "pt-BR" }]);
  });

  it("does not count crawlers, prefetches, redirects, client fetches or signed-in members", async () => {
    await visit("/planos", { ...DOCUMENT, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    await visit("/planos", { ...BROWSER, "sec-purpose": "prefetch" });
    await visit("/pt-BR/planos");
    await visit("/planos", { accept: "*/*", rsc: "1", "user-agent": BROWSER["user-agent"] });
    session.user = { id: "member" };
    await visit("/planos");
    expect(views).toEqual([]);
  });

  it("does not count /instalar.md: an AI reads it on the way to an install", async () => {
    // Some AIs ask for a page the way a browser would, and a person may open the link too.
    await visit("/instalar.md", { accept: "text/markdown, text/html, */*", "user-agent": "Claude-User/1.0" });
    await visit("/en/install.md");
    expect(views).toEqual([]);
  });
});

describe("middleware: the page a member's AI reads to install flyee", () => {
  const AI = { accept: "text/markdown, text/html, */*", "user-agent": "Claude-User/1.0" };

  it("serves it without a session, in both languages", async () => {
    const portuguese = await middleware(request("/instalar.md", AI));
    expect(pathOf(portuguese.headers.get("x-middleware-rewrite"))).toBe("/pt-BR/instalar.md");
    expect(portuguese.headers.get("location")).toBeNull();
    const english = await middleware(request("/en/install.md", { accept: "*/*" }));
    expect(pathOf(english.headers.get("x-middleware-rewrite"))).toBe("/en/instalar.md");
    expect(english.headers.get("location")).toBeNull();
  });

  it("sends the English address typed without its prefix to the canonical one", async () => {
    expect(pathOf((await middleware(request("/install.md", AI))).headers.get("location"))).toBe("/en/install.md");
    expect(pathOf((await middleware(request("/en/instalar.md", AI))).headers.get("location"))).toBe("/en/install.md");
  });
});
