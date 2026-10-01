import type { Metadata } from "next";

import { BRAND } from "@/brand";
import { isPublicLocale, localizeHref, type PublicLocale, routing } from "@/i18n/routing";

/** Open Graph wants `pt_BR`, not `pt-BR`. */
const OG_LOCALE: Record<PublicLocale, string> = { "pt-BR": "pt_BR", en: "en_US" };

/** Internal (Portuguese) path of a page in each language it exists in. */
export type Translations = Partial<Record<PublicLocale, string>>;

/** A page that exists in every language under the same internal path. */
export const everyLanguage = (path: string): Translations =>
  Object.fromEntries(routing.locales.map((language) => [language, path]));

/** Slugs by language (`{ en: "first-steps" }`) → internal paths of a content section. */
export const sectionTranslations = (section: string, slugs: Translations): Translations =>
  Object.fromEntries(Object.entries(slugs).map(([language, slug]) => [language, `${section}/${slug}`]));

/**
 * hreflang of a page: the address in each language it exists in, plus
 * `x-default` on the Portuguese address (the default language), or on the only
 * language the content exists in. A language missing from `paths` gets no
 * entry, because no address returns that content in that language.
 * Addresses are site-relative.
 */
export function languageAlternates(paths: Translations): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const language of routing.locales) {
    const path = paths[language];
    if (path) languages[language] = localizeHref(path, language);
  }
  const fallback = languages[routing.defaultLocale] ?? Object.values(languages)[0];
  if (fallback) languages["x-default"] = fallback;
  return languages;
}

/** `/en/pricing` → `https://flyee.club/en/pricing`; `/` → the bare host. */
export const absoluteUrl = (address: string) => `${BRAND.siteUrl}${address === "/" ? "" : address}`;

/**
 * Canonical, hreflang and Open Graph address of a public page (docs/SEO.md).
 *
 * `path` is the internal (Portuguese) path of the page. Pages whose content
 * exists per language under different slugs (help articles, blog posts) pass
 * `translations`, the internal path of each language the content exists in.
 */
export function publicPageMetadata({
  path,
  locale,
  translations,
  type = "website",
}: {
  path: string;
  locale: string;
  translations?: Translations;
  type?: "website" | "article";
}): Pick<Metadata, "alternates" | "openGraph"> {
  const current: PublicLocale = isPublicLocale(locale) ? locale : routing.defaultLocale;
  const paths = translations ?? everyLanguage(path);
  const canonical = localizeHref(paths[current] ?? path, current);

  return {
    alternates: { canonical, languages: languageAlternates(paths) },
    openGraph: {
      siteName: BRAND.name,
      type,
      url: canonical,
      locale: OG_LOCALE[current],
      alternateLocale: routing.locales
        .filter((language) => language !== current && paths[language])
        .map((language) => OG_LOCALE[language]),
    },
  };
}
