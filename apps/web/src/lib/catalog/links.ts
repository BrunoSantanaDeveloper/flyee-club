import { BRAND } from "@/brand";

/** The two site languages, as the catalog stores texts. */
export type CatalogLocale = "pt-BR" | "en";

/**
 * The public verification page of a released version, in a language
 * (`/verificar/<slug>@<version>` or `/en/verify/…`). Shared by the CLI API,
 * the member screens and the emails, so the address is written once.
 */
export function verifyPath(slug: string, version: string, locale: CatalogLocale = "pt-BR"): string {
  return `${locale === "en" ? "/en/verify" : "/verificar"}/${encodeURIComponent(`${slug}@${version}`)}`;
}

export function verifyUrl(slug: string, version: string, locale: CatalogLocale = "pt-BR"): string {
  return new URL(verifyPath(slug, version, locale), BRAND.siteUrl).toString();
}
