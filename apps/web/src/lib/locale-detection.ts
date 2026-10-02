import { DEFAULTS } from "@/config";
import { type LocaleOption, LOCALES } from "@/constants";

/**
 * First-visit language detection.
 *
 * The platform ships two languages: Brazilian Portuguese (the default and home
 * market) and English (decision 2026-09-30, docs/PRODUCT.md). A visitor who has
 * never been here has no language cookie, so this picks one for that first
 * request; the visitor's own choice, once made, is the cookie and is never
 * touched again.
 *
 * Three rules hold this together:
 *
 * 1. `Accept-Language` beats the IP country. A header is what the visitor's
 *    own device says she reads; an IP says where she is standing (or where her
 *    VPN exits). A Brazilian travelling abroad keeps Portuguese.
 * 2. Crawlers are never switched. Serving a crawler another language on the
 *    same URL would put content in the index that no URL can return, and a
 *    link preview must keep showing the language the sharer saw.
 * 3. Detection is a SUGGESTION: the caller must also mark it as automatic
 *    (COOKIE_KEYS.localeAuto) so the page can offer the way back.
 *
 * With only two catalogs, English is the useful answer for every reader who
 * does not read Portuguese: someone whose browser asks for Spanish or Japanese
 * understands English far more often than Portuguese.
 */

/**
 * A language choice must outlive the browser session: a session cookie means
 * the visitor picks Portuguese, closes the browser, comes back and is detected
 * into English again — the switch she already refused. One year.
 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Countries whose official language is Portuguese. Everything else maps to English. */
const LUSOPHONE_COUNTRIES = new Set(["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"]);

/** Exported for the one place that has to test it outside this module: the inline script of lib/language-offer.ts. */
export const CRAWLER_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|baidu|yandex|sogou|bytespider|petalbot|duckduck|facebookexternalhit|whatsapp|telegram|twitter|linkedinbot|discord|embedly|quora|pinterest|applebot|headlesschrome|lighthouse|chrome-lighthouse|ahrefs|semrush|mj12|dotbot|screaming frog|curl|wget|python-requests|axios|go-http-client|node-fetch|monitoring|uptime|pingdom|gtmetrix|vercel-screenshot|prerender/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // No UA at all is a script, not a browser.
  return CRAWLER_PATTERN.test(userAgent);
}

/** The best locale we ship for an `Accept-Language` header, or null. */
export function localeFromAcceptLanguage(header: string | null | undefined): LocaleOption | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        tag: tag.trim().toLowerCase(),
        // Order is the tie-breaker: "pt-BR,pt;q=0.9,en;q=0.8" must keep pt-BR
        // ahead of pt even though both map to the same locale.
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of ranked) {
    // An exact tag we ship wins (pt-br, en).
    const exact = (LOCALES as readonly string[]).find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact as LocaleOption;

    // Otherwise the primary subtag: pt-PT -> pt-BR, en-GB -> en.
    const primary = tag.split("-")[0];
    if (primary === "pt") return "pt-BR";
    if (primary === "en") return "en";
  }

  return null;
}

/** The locale we ship for an ISO country code (Vercel's IP geolocation), or null. */
export function localeFromCountry(country: string | null | undefined): LocaleOption | null {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return LUSOPHONE_COUNTRIES.has(code) ? "pt-BR" : "en";
}

/**
 * The locale to apply to a first visit, or null to leave the default alone.
 *
 * Returns null — not the default — when the visitor already reads the default
 * language, so no cookie is written and no "we switched the language" notice
 * is ever shown to someone who was not switched.
 */
export function detectLocale({
  acceptLanguage,
  country,
  userAgent,
}: {
  acceptLanguage?: string | null;
  country?: string | null;
  userAgent?: string | null;
}): LocaleOption | null {
  if (isCrawler(userAgent)) return null;

  const detected = localeFromAcceptLanguage(acceptLanguage) ?? localeFromCountry(country);
  if (!detected || detected === DEFAULTS.locale) return null;
  return detected;
}
