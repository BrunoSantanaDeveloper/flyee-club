import { LANGUAGE_OFFER_ATTRIBUTE, languageOfferScript } from "./language-offer";
import { localeFromAcceptLanguage } from "./locale-detection";
import { describe, expect, it } from "vitest";

import { LOCAL_STORAGE_KEYS } from "@/constants";

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Runs the inline script against a browser made of the three things it reads. */
function offered({
  pageLang,
  languages,
  userAgent = BROWSER,
  answered = false,
  storageBlocked = false,
}: {
  pageLang: string;
  languages: string[];
  userAgent?: string;
  answered?: boolean;
  storageBlocked?: boolean;
}): boolean {
  const attributes = new Map<string, string>();
  const document = {
    documentElement: {
      lang: pageLang,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
  };
  const navigator = { userAgent, languages, language: languages[0] ?? "" };
  const localStorage = {
    getItem: (key: string) => {
      if (storageBlocked) throw new Error("storage is blocked");
      return answered && key === LOCAL_STORAGE_KEYS.languageSuggestion ? "answered" : null;
    },
  };
  new Function("document", "navigator", "localStorage", languageOfferScript())(document, navigator, localStorage);
  return attributes.has(LANGUAGE_OFFER_ATTRIBUTE);
}

describe("the language offer decided before the first paint", () => {
  it("offers the other language to a browser that reads it", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["en-US", "en"] })).toBe(true);
    expect(offered({ pageLang: "en", languages: ["pt-BR", "pt", "en"] })).toBe(true);
    // A regional variant reads the language we ship.
    expect(offered({ pageLang: "en", languages: ["pt-PT"] })).toBe(true);
    expect(offered({ pageLang: "pt-BR", languages: ["en-GB"] })).toBe(true);
  });

  it("stays out of the way when the page is already in the reader's language", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["pt-BR", "en"] })).toBe(false);
    expect(offered({ pageLang: "en", languages: ["en-US", "pt-BR"] })).toBe(false);
  });

  it("offers nothing to a browser that lists neither language", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["es-ES", "fr"] })).toBe(false);
    expect(offered({ pageLang: "en", languages: [] })).toBe(false);
  });

  it("skips languages we do not ship until it finds one we do", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["es", "en"] })).toBe(true);
    expect(offered({ pageLang: "en", languages: ["es", "en", "pt"] })).toBe(false);
  });

  it("never asks again once answered", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["en"], answered: true })).toBe(false);
  });

  it("never offers to a crawler", () => {
    expect(
      offered({
        pageLang: "pt-BR",
        languages: ["en"],
        userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      }),
    ).toBe(false);
  });

  it("does not ask when the answer could not be kept", () => {
    expect(offered({ pageLang: "pt-BR", languages: ["en"], storageBlocked: true })).toBe(false);
  });

  it("agrees with the server's reading of the same languages", () => {
    for (const languages of [["en-US", "en"], ["pt-PT", "en"], ["es", "en"], ["fr", "pt-BR"], ["de"]]) {
      const reads = localeFromAcceptLanguage(languages.join(","));
      for (const pageLang of ["pt-BR", "en"]) {
        expect(offered({ pageLang, languages }), `${languages.join(",")} on ${pageLang}`).toBe(
          reads !== null && reads !== pageLang,
        );
      }
    }
  });
});
