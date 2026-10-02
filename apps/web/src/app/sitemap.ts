import type { MetadataRoute } from "next";

import { localizeHref, routing } from "@/i18n/routing";
import { listCatalogForSitemap, type SitemapModule } from "@/lib/catalog/public";
import { listBlogForSitemap, listHelpForSitemap, type SitemapContent } from "@/lib/public-content";
import { absoluteUrl, everyLanguage, languageAlternates, sectionTranslations, type Translations } from "@/lib/seo";

/**
 * Indexed public pages, by internal (Portuguese) path. Each enters once per
 * language, with its hreflang alternates (docs/SEO.md); the authenticated app
 * never enters.
 *
 * Declared in src/i18n/routing.ts but deliberately absent (noindex):
 * /espera/confirmar (a one-time confirmation link), /verificar/[ref] (a
 * checksum lookup) and /fundadores (a campaign offer). The module pages
 * (/catalogo/[slug]) enter below, each in the languages its text exists in.
 */
const INDEXED_PAGES = [
  "/",
  "/como-funciona",
  "/catalogo",
  "/planos",
  "/sobre",
  "/contato",
  "/ajuda",
  "/blog",
  "/espera",
  "/legal/termos",
  "/legal/privacidade",
  "/legal/cookies",
];

/**
 * Rebuilt at most hourly. Without it the sitemap is prerendered once at build
 * time, and a help article or blog post published afterwards in the admin
 * consoles would never reach it until the next deploy.
 */
export const revalidate = 3600;

const absoluteAlternates = (paths: Translations) =>
  Object.fromEntries(
    Object.entries(languageAlternates(paths)).map(([language, address]) => [language, absoluteUrl(address)]),
  );

function contentEntries(section: string, rows: SitemapContent[]): MetadataRoute.Sitemap {
  return rows.map((row) => ({
    url: absoluteUrl(localizeHref(`${section}/${row.slug}`, row.locale)),
    lastModified: row.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
    alternates: { languages: absoluteAlternates(sectionTranslations(section, row.translations)) },
  }));
}

/** A published module, once per language its name is written in (lib/catalog/public.ts). */
function moduleEntries(rows: SitemapModule[]): MetadataRoute.Sitemap {
  return rows.flatMap((row) => {
    const path = `/catalogo/${row.slug}`;
    const paths = Object.fromEntries(row.languages.map((language) => [language, path]));
    return row.languages.map((language) => ({
      url: absoluteUrl(localizeHref(path, language)),
      lastModified: row.updatedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      alternates: { languages: absoluteAlternates(paths) },
    }));
  });
}

/**
 * Static pages in every language plus the DB-managed help articles, blog
 * posts and catalog modules, each in the languages it was written in (no
 * fallback: an address in a language serves that language). Degrades to the
 * static list without Supabase env.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = INDEXED_PAGES.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(localizeHref(path, locale)),
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.7,
      alternates: { languages: absoluteAlternates(everyLanguage(path)) },
    })),
  );

  const [help, blog, modules] = await Promise.all([
    listHelpForSitemap(),
    listBlogForSitemap(),
    listCatalogForSitemap(),
  ]);

  return [
    ...staticEntries,
    ...moduleEntries(modules),
    ...contentEntries("/ajuda", help),
    ...contentEntries("/blog", blog),
  ];
}
