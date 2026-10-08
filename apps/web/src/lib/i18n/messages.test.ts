import { createTranslator, IntlErrorCode } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "@flyee/content/messages/en.json";
import ptBR from "@flyee/content/messages/pt-BR.json";

/**
 * The two catalogs must hold the SAME keys.
 *
 * There is no `getMessageFallback` configured, so a key present in pt-BR and
 * missing in English does not fail the build or the page: it prints the key
 * path on screen, to someone who is already stuck.
 */

const CATALOGS: Record<string, Record<string, Record<string, string>>> = {
  "pt-BR": ptBR,
  en,
};

const NAMESPACES = ["product", "auth", "dashboard", "marketing"];

describe("message catalogs", () => {
  const reference = CATALOGS["pt-BR"];

  it.each(NAMESPACES)("%s has the same keys in every locale", (namespace) => {
    const expected = Object.keys(reference[namespace] ?? {}).sort();

    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      if (locale === "pt-BR") continue;
      const actual = Object.keys(catalog[namespace] ?? {}).sort();
      const missing = expected.filter((key) => !actual.includes(key));
      const extra = actual.filter((key) => !expected.includes(key));

      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it("never ships an empty string as a translation", () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const namespace of NAMESPACES) {
        const blank = Object.entries(catalog[namespace] ?? {})
          .filter(([, value]) => typeof value === "string" && value.trim() === "")
          .map(([key]) => key);
        expect({ locale, namespace, blank }).toEqual({ locale, namespace, blank: [] });
      }
    }
  });

  it("holds only messages that parse", () => {
    // A message that does not parse prints its key path on the page. The case
    // that shipped: a command with `<app>` in it reads as a rich-text tag that
    // never closes, and /como-funciona showed "marketing.how-step-3-value"
    // where the command should be. Values are not given here on purpose: a
    // missing value is another error, raised only after the message parsed.
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const broken: string[] = [];
      const translate = createTranslator({
        locale,
        messages: catalog,
        onError: (error) => {
          if (error.code === IntlErrorCode.INVALID_MESSAGE) broken.push(error.originalMessage ?? error.message);
        },
        getMessageFallback: ({ namespace, key }) => `${namespace}.${key}`,
      });
      for (const namespace of NAMESPACES) {
        for (const key of Object.keys(catalog[namespace] ?? {})) translate(`${namespace}.${key}` as never);
      }
      expect({ locale, broken }).toEqual({ locale, broken: [] });
    }
  });

  it("knows a message that does not parse when it sees one", () => {
    const codes: string[] = [];
    const translate = createTranslator({
      locale: "pt-BR",
      messages: { marketing: { command: "npx flyee add <app>", count: "{count} apps", rich: "Um <em>app</em>" } },
      onError: (error) => codes.push(error.code),
      getMessageFallback: ({ key }) => key,
    });
    for (const key of ["command", "count", "rich"]) translate(`marketing.${key}` as never);
    expect(codes.filter((code) => code === IntlErrorCode.INVALID_MESSAGE)).toHaveLength(1);
  });

  it("keeps the same ICU placeholders in every locale", () => {
    // A dropped {count} is invisible until the sentence renders without the
    // number that made it a sentence.
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)].map((match) => match[1]).sort();

    for (const namespace of NAMESPACES) {
      for (const [key, value] of Object.entries(reference[namespace] ?? {})) {
        if (typeof value !== "string") continue;
        const expected = [...new Set(placeholders(value))];
        if (expected.length === 0) continue;

        for (const [locale, catalog] of Object.entries(CATALOGS)) {
          if (locale === "pt-BR") continue;
          const translated = catalog[namespace]?.[key];
          if (typeof translated !== "string") continue;
          expect({ locale, key, names: [...new Set(placeholders(translated))] }).toEqual({
            locale,
            key,
            names: expected,
          });
        }
      }
    }
  });
});
