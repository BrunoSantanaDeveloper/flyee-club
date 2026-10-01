import { detectLocale, isCrawler, localeFromAcceptLanguage, localeFromCountry } from "./locale-detection";
import { describe, expect, it } from "vitest";

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("localeFromAcceptLanguage", () => {
  it("matches an exact tag we ship", () => {
    expect(localeFromAcceptLanguage("en,pt;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
  });

  it("falls back to the primary subtag", () => {
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
    expect(localeFromAcceptLanguage("pt-PT")).toBe("pt-BR");
  });

  it("honours quality values over header order", () => {
    expect(localeFromAcceptLanguage("pt-BR;q=0.2,en-US;q=0.9")).toBe("en");
  });

  it("keeps the more specific tag when two map to the same language", () => {
    expect(localeFromAcceptLanguage("pt-BR,pt;q=0.9")).toBe("pt-BR");
  });

  it("skips languages we do not ship", () => {
    expect(localeFromAcceptLanguage("ja,ko;q=0.9,en;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("ja,ko;q=0.9")).toBeNull();
  });

  it("ignores q=0 and the wildcard", () => {
    expect(localeFromAcceptLanguage("en;q=0,*")).toBeNull();
  });

  it("returns null for nothing at all", () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
  });
});

describe("localeFromCountry", () => {
  it("maps the Portuguese-speaking countries to pt-BR", () => {
    expect(localeFromCountry("BR")).toBe("pt-BR");
    expect(localeFromCountry("pt")).toBe("pt-BR");
  });

  it("maps every other country to English", () => {
    expect(localeFromCountry("US")).toBe("en");
    expect(localeFromCountry("JP")).toBe("en");
  });

  it("returns null without a usable country code", () => {
    expect(localeFromCountry(null)).toBeNull();
    expect(localeFromCountry("")).toBeNull();
    expect(localeFromCountry("XYZ")).toBeNull();
  });
});

describe("isCrawler", () => {
  it("recognizes the crawlers that matter here", () => {
    expect(isCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isCrawler("WhatsApp/2.23")).toBe(true);
  });

  it("treats a missing user agent as a script", () => {
    expect(isCrawler(null)).toBe(true);
  });

  it("lets a real browser through", () => {
    expect(isCrawler(BROWSER)).toBe(false);
  });
});

describe("detectLocale", () => {
  it("switches an English-reading visitor", () => {
    expect(detectLocale({ acceptLanguage: "en-US,en;q=0.9", userAgent: BROWSER })).toBe("en");
  });

  it("returns null when the visitor already reads the default language", () => {
    // Nothing to persist and, above all, nothing to announce.
    expect(detectLocale({ acceptLanguage: "pt-BR", country: "BR", userAgent: BROWSER })).toBeNull();
  });

  it("never switches a crawler", () => {
    expect(
      detectLocale({
        acceptLanguage: "en",
        country: "US",
        userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      }),
    ).toBeNull();
  });

  it("lets the header beat the country", () => {
    // A Brazilian travelling abroad keeps Portuguese.
    expect(detectLocale({ acceptLanguage: "pt-BR,pt;q=0.9", country: "US", userAgent: BROWSER })).toBeNull();
  });

  it("uses the country only when the header says nothing we ship", () => {
    expect(detectLocale({ acceptLanguage: "ja", country: "JP", userAgent: BROWSER })).toBe("en");
    expect(detectLocale({ acceptLanguage: null, country: "DE", userAgent: BROWSER })).toBe("en");
    expect(detectLocale({ acceptLanguage: "es", country: "PT", userAgent: BROWSER })).toBeNull();
  });

  it("leaves the default alone when there is no signal", () => {
    expect(detectLocale({ userAgent: BROWSER })).toBeNull();
  });
});
