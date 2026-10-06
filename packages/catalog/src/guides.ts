/**
 * Where a module package carries its written guides (docs/CLI-CONTRACT.md §7,
 * migration 0030): one Markdown file per language and depth, at
 *
 *   guides/pt-BR/usar.md          guides/en/usar.md
 *   guides/pt-BR/abrir-o-capo.md  guides/en/abrir-o-capo.md
 *
 * A path convention, not a manifest key: the manifest's keys are fixed per
 * `manifest_version`, and the files are listed in `files` like any other.
 * Any other path under `guides/` is refused, so a typo never ships a guide
 * that nobody sees. Shared by the upload (which stores the text) and by the
 * product repo's checks.
 */

export const GUIDE_LOCALES = ["pt-BR", "en"] as const;
export const GUIDE_DEPTHS = ["usar", "abrir_o_capo"] as const;

export type GuideLocale = (typeof GUIDE_LOCALES)[number];
export type GuideDepth = (typeof GUIDE_DEPTHS)[number];

/** The folder every guide lives in. */
export const GUIDE_DIR = "guides/";

/** A guide is text: 200 KB is a long guide, and the database refuses more. */
export const MAX_GUIDE_BYTES = 200_000;

const GUIDE_PATH = /^guides\/(pt-BR|en)\/(usar|abrir-o-capo)\.md$/;

/** The language and depth a package path is the guide of, or null when it is not a guide path. */
export function guideOf(path: string): { locale: GuideLocale; depth: GuideDepth } | null {
  const match = GUIDE_PATH.exec(path);
  if (!match) return null;
  return { locale: match[1] as GuideLocale, depth: match[2] === "usar" ? "usar" : "abrir_o_capo" };
}

/** The file a guide is read from. */
export function guidePath(locale: GuideLocale, depth: GuideDepth): string {
  return `${GUIDE_DIR}${locale}/${depth === "usar" ? "usar" : "abrir-o-capo"}.md`;
}

/** Which guides a package carries, as the catalog records it: `{ "pt-BR": ["usar"], "en": [...] }`. */
export function guideAvailability(guides: { locale: GuideLocale; depth: GuideDepth }[]): Partial<Record<GuideLocale, GuideDepth[]>> {
  const availability: Partial<Record<GuideLocale, GuideDepth[]>> = {};
  for (const locale of GUIDE_LOCALES) {
    const depths = GUIDE_DEPTHS.filter((depth) => guides.some((guide) => guide.locale === locale && guide.depth === depth));
    if (depths.length > 0) availability[locale] = depths;
  }
  return availability;
}
