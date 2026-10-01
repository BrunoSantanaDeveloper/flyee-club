import { localizeHref, matchPublicPath } from "./routing";
import { describe, expect, it } from "vitest";

describe("matchPublicPath", () => {
  it("reads Portuguese addresses at the root", () => {
    expect(matchPublicPath("/")).toEqual({ locale: "pt-BR", internal: "/", prefixed: false });
    expect(matchPublicPath("/planos")).toEqual({ locale: "pt-BR", internal: "/planos", prefixed: false });
    expect(matchPublicPath("/blog/primeiro-post")).toEqual({
      locale: "pt-BR",
      internal: "/blog/primeiro-post",
      prefixed: false,
    });
  });

  it("reads English addresses under /en and maps them to the internal path", () => {
    expect(matchPublicPath("/en")).toEqual({ locale: "en", internal: "/", prefixed: true });
    expect(matchPublicPath("/en/pricing")).toEqual({ locale: "en", internal: "/planos", prefixed: true });
    expect(matchPublicPath("/en/help/first-steps")).toEqual({
      locale: "en",
      internal: "/ajuda/first-steps",
      prefixed: true,
    });
    expect(matchPublicPath("/en/legal/terms")).toEqual({ locale: "en", internal: "/legal/termos", prefixed: true });
  });

  it("keeps the prefix language when the address belongs to the other one", () => {
    // next-intl redirects these to the address of the prefix language.
    expect(matchPublicPath("/en/planos")).toEqual({ locale: "en", internal: "/planos", prefixed: true });
    expect(matchPublicPath("/pt-BR/pricing")).toEqual({ locale: "pt-BR", internal: "/planos", prefixed: true });
  });

  it("sends an unprefixed English-only address to English", () => {
    expect(matchPublicPath("/pricing")).toEqual({ locale: "en", internal: "/planos", prefixed: false });
  });

  it("ignores everything that is not a public page", () => {
    expect(matchPublicPath("/inicio")).toBeNull();
    expect(matchPublicPath("/auth/sign-in")).toBeNull();
    expect(matchPublicPath("/en/inicio")).toBeNull();
    expect(matchPublicPath("/encontros")).toBeNull();
    expect(matchPublicPath("/english")).toBeNull();
    expect(matchPublicPath("/blog/a/b")).toBeNull();
    expect(matchPublicPath("/api/cli/me")).toBeNull();
  });
});

describe("localizeHref", () => {
  it("writes the address of the language", () => {
    expect(localizeHref("/", "en")).toBe("/en");
    expect(localizeHref("/", "pt-BR")).toBe("/");
    expect(localizeHref("/planos", "en")).toBe("/en/pricing");
    expect(localizeHref("/planos", "pt-BR")).toBe("/planos");
    expect(localizeHref("/ajuda/primeiros-passos", "en")).toBe("/en/help/primeiros-passos");
    expect(localizeHref("/legal/privacidade", "en")).toBe("/en/legal/privacy");
  });

  it("keeps the query string and the fragment", () => {
    expect(localizeHref("/planos?cupom=X#faq", "en")).toBe("/en/pricing?cupom=X#faq");
    expect(localizeHref("/#planos", "en")).toBe("/en#planos");
    expect(localizeHref("/?porta=ads", "pt-BR")).toBe("/?porta=ads");
  });

  it("leaves everything else alone", () => {
    expect(localizeHref("/auth/sign-up", "en")).toBe("/auth/sign-up");
    expect(localizeHref("/en/pricing", "pt-BR")).toBe("/en/pricing");
    expect(localizeHref("https://example.com/planos", "en")).toBe("https://example.com/planos");
    expect(localizeHref("//example.com/planos", "en")).toBe("//example.com/planos");
    expect(localizeHref("mailto:oi@flyee.club", "en")).toBe("mailto:oi@flyee.club");
  });

  it("falls back to Portuguese for an unknown locale", () => {
    expect(localizeHref("/planos", "fr")).toBe("/planos");
  });

  it("round-trips with matchPublicPath", () => {
    for (const path of ["/", "/planos", "/blog/x", "/verificar/flyee-core@1.2.0", "/espera/confirmar"]) {
      for (const locale of ["pt-BR", "en"] as const) {
        const address = localizeHref(path, locale);
        expect(matchPublicPath(address)).toMatchObject({ locale, internal: path });
      }
    }
  });
});
