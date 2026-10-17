import { cache } from "react";

import type { CatalogLocale } from "@/lib/catalog/links";
import { loadCatalog, loadModule } from "@/lib/catalog/read";
import { DEFAULT_NEW_BADGE_DAYS } from "@/lib/catalog/store-badges";
import { type StoreLook, storeLook } from "@/lib/catalog/store-look";
import { createAnonClient } from "@/lib/public-content";

/**
 * The catalog as anybody reads it on the public site: /catalogo, the module
 * pages, the numbers of the home and the sitemap. Published rows only, through
 * the anonymous client and row-level security (migration 0008), with the same
 * reader as the CLI API and the member screens (lib/catalog/read.ts).
 *
 * That reader falls back to Portuguese when a text has no English version,
 * which is right for a member and wrong for a public address: an address in a
 * language serves that language (docs/SEO.md). So a module or recipe whose
 * NAME has no English text stays out of the English pages and out of the
 * English half of the sitemap, and its English address leads to the catalog.
 *
 * The store categories (migration 0029) ride beside the shared reader: each
 * module gets its `storeCategory` and the catalog its `storeCategories`, so
 * the store filters by kind of work while the CLI API, which uses the same
 * reader, keeps answering by stage.
 *
 * "unavailable" (no Supabase, an error) is never rendered as an empty catalog.
 */

type Localized = Record<string, string> | null | undefined;

const hasText = (value: Localized, locale: CatalogLocale) =>
  typeof value?.[locale] === "string" && value[locale].trim() !== "";

export type CatalogStats = {
  /** Modules readable in the language. */
  modules: number;
  /** Published versions of those modules (yanked ones excluded). */
  versions: number;
  /** When the newest of those versions was published. */
  lastReleaseAt: string | null;
};

type SharedCatalog = Awaited<ReturnType<typeof loadCatalog>>;

/** A kind of work the store filters by, named in the language of the address (Portuguese when it has no translation). */
export type PublicStoreCategory = { slug: string; name: string };

export type PublicCatalog = Omit<SharedCatalog, "modules"> & {
  modules: (SharedCatalog["modules"][number] & {
    storeCategory: string | null;
    /** The site personas the operator marked this app a good start for (migration 0032). */
    personas: string[];
    /** When the app was first published (the "Novo" badge, migration 0034). */
    firstPublishedAt: string | null;
  })[];
  storeCategories: PublicStoreCategory[];
  /** How many days after its first publication an app is "Novo" (platform_settings.catalog). */
  newBadgeDays: number;
  stats: CatalogStats;
};

export type PublicCatalogResult = { kind: "ready"; catalog: PublicCatalog } | { kind: "unavailable" };

export type CatalogRows = {
  modules: {
    id: string;
    slug: string;
    name: Localized;
    store_category?: string | null;
    personas?: string[] | null;
    published_at?: string | null;
  }[];
  /** platform_settings.catalog.new_badge_days, when it could be read. */
  newBadgeDays?: number | null;
  storeCategories: { slug: string; name: Localized; sort: number }[];
  versions: { module_id: string; published_at: string | null }[];
  recipes: { slug: string; name: Localized }[];
};

/**
 * The part of the catalog readable in `locale` and its numbers. Pure: the
 * rows carry the raw texts that the shared reader already collapsed with its
 * Portuguese fallback.
 */
export function readableCatalog(catalog: SharedCatalog, rows: CatalogRows, locale: CatalogLocale): PublicCatalog {
  const readable = rows.modules.filter((row) => hasText(row.name, locale));
  const readableIds = new Set(readable.map((row) => row.id));
  const readableSlugs = new Set(readable.map((row) => row.slug));
  const readableRecipes = new Set(rows.recipes.filter((row) => hasText(row.name, locale)).map((row) => row.slug));
  const released = rows.versions.filter((row) => readableIds.has(row.module_id));
  const lastReleaseAt = released
    .map((row) => row.published_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const categoryOf = new Map(rows.modules.map((row) => [row.slug, row.store_category ?? null]));
  const personasOf = new Map(rows.modules.map((row) => [row.slug, row.personas ?? []]));
  const publishedOf = new Map(rows.modules.map((row) => [row.slug, row.published_at ?? null]));
  const storeCategories = [...rows.storeCategories]
    .sort((a, b) => a.sort - b.sort)
    .map((row) => ({
      slug: row.slug,
      name: row.name?.[locale]?.trim() || row.name?.["pt-BR"]?.trim() || row.slug,
    }));

  return {
    ...catalog,
    modules: catalog.modules
      .filter((module) => readableSlugs.has(module.slug))
      .map((module) => ({
        ...module,
        storeCategory: categoryOf.get(module.slug) ?? null,
        personas: personasOf.get(module.slug) ?? [],
        firstPublishedAt: publishedOf.get(module.slug) ?? null,
      })),
    storeCategories,
    newBadgeDays:
      Number.isFinite(rows.newBadgeDays) && (rows.newBadgeDays ?? 0) > 0
        ? Math.floor(rows.newBadgeDays as number)
        : DEFAULT_NEW_BADGE_DAYS,
    recipes: catalog.recipes
      .filter((recipe) => readableRecipes.has(recipe.slug))
      .map((recipe) => ({ ...recipe, modules: recipe.modules.filter((slug) => readableSlugs.has(slug)) })),
    stats: { modules: readableSlugs.size, versions: released.length, lastReleaseAt: lastReleaseAt ?? null },
  };
}

async function readPublicCatalog(locale: CatalogLocale): Promise<PublicCatalogResult> {
  const client = createAnonClient();
  if (!client) return { kind: "unavailable" };
  try {
    const [catalog, modules, versions, recipes, categories, settings] = await Promise.all([
      loadCatalog(client, { locale, stableOnly: false, limits: {} }),
      client
        .from("catalog_modules")
        .select("id, slug, name, store_category, personas, published_at")
        .eq("status", "published"),
      client.from("catalog_module_versions").select("module_id, published_at").eq("status", "published"),
      client.from("catalog_recipes").select("slug, name").eq("status", "published"),
      client.from("catalog_store_categories").select("slug, name, sort").order("sort"),
      client.from("platform_settings").select("value").eq("key", "catalog").maybeSingle(),
    ]);
    if (modules.error || versions.error || recipes.error || categories.error) return { kind: "unavailable" };
    const rows = {
      modules: (modules.data ?? []) as CatalogRows["modules"],
      storeCategories: (categories.data ?? []) as CatalogRows["storeCategories"],
      // An unreadable setting falls back to the default; it never hides the catalog.
      newBadgeDays: Number((settings.data?.value as { new_badge_days?: unknown } | null)?.new_badge_days),
      versions: (versions.data ?? []) as CatalogRows["versions"],
      recipes: (recipes.data ?? []) as CatalogRows["recipes"],
    };
    return { kind: "ready", catalog: readableCatalog(catalog, rows, locale) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Read once per request, however many components of the page ask. */
export const loadPublicCatalog = cache(readPublicCatalog);

export type PublicModule = NonNullable<Awaited<ReturnType<typeof loadModule>>> & {
  trailName: string | null;
  /** How the store shows the app: its category's name and hue, else its stage's (lib/catalog/store-look.ts). */
  look: StoreLook;
  /** Which written guides the newest released version carries (migration 0030), by language. */
  guides: Partial<Record<CatalogLocale, ("usar" | "abrir_o_capo")[]>>;
  /** The languages this module can be read in, for hreflang. */
  languages: CatalogLocale[];
};

export type PublicModuleResult =
  | { kind: "ready"; module: PublicModule }
  /** Not published (or never existed). */
  | { kind: "missing" }
  /** Published, but with no text in the language of the address. */
  | { kind: "untranslated" }
  | { kind: "unavailable" };

async function readPublicModule(slug: string, locale: CatalogLocale): Promise<PublicModuleResult> {
  const client = createAnonClient();
  if (!client) return { kind: "unavailable" };
  try {
    const [module, names, trails, categories] = await Promise.all([
      loadModule(client, { slug, locale, limits: {} }),
      client
        .from("catalog_modules")
        .select("name, store_category")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle(),
      client.from("catalog_trails").select("slug, name").order("sort"),
      client.from("catalog_store_categories").select("slug, name").order("sort"),
    ]);
    if (names.error || trails.error) return { kind: "unavailable" };
    if (!module || !names.data) return { kind: "missing" };
    const name = names.data.name as Localized;
    if (!hasText(name, locale)) return { kind: "untranslated" };

    // Which guides the newest released version carries: public metadata, never the text.
    const { data: guidesRow } = module.latest
      ? await client
          .from("catalog_module_versions")
          .select("guides")
          .eq("module_id", module.id)
          .eq("version", module.latest.version)
          .maybeSingle()
      : { data: null };

    const named = (value: Localized) => value?.[locale]?.trim() || value?.["pt-BR"]?.trim() || null;
    const trail = (trails.data ?? []).find((row) => row.slug === module.trail);
    const trailNames = (trail?.name ?? null) as Localized;
    // The app's place in the store, as the cards show it: its category's name and hue, else its
    // stage's. A category list that could not be read leaves the stage, never the page.
    const look = storeLook({
      trails: (trails.data ?? []).map((row) => ({ slug: row.slug as string, name: named(row.name as Localized) })),
      storeCategories: categories.error
        ? []
        : (categories.data ?? []).map((row) => ({
            slug: row.slug as string,
            name: named(row.name as Localized) ?? (row.slug as string),
          })),
    }).lookOf({ trail: module.trail, storeCategory: (names.data.store_category as string | null) ?? null });
    return {
      kind: "ready",
      module: {
        ...module,
        look,
        guides: (guidesRow?.guides ?? {}) as PublicModule["guides"],
        trailName: trailNames?.[locale]?.trim() || trailNames?.["pt-BR"]?.trim() || null,
        languages: (["pt-BR", "en"] as const).filter((language) => hasText(name, language)),
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Read once per request: the page and its metadata both ask for the module. */
export const loadPublicModule = cache(readPublicModule);

export type SitemapModule = { slug: string; languages: CatalogLocale[]; updatedAt: string | null };

/** Every published module with the languages its page exists in. Empty without Supabase. */
export async function listCatalogForSitemap(): Promise<SitemapModule[]> {
  const client = createAnonClient();
  if (!client) return [];
  const { data, error } = await client
    .from("catalog_modules")
    .select("slug, name, updated_at")
    .eq("status", "published")
    .order("sort");
  if (error || !data) return [];
  return data.map((row) => ({
    slug: row.slug as string,
    languages: (["pt-BR", "en"] as const).filter((language) => hasText(row.name as Localized, language)),
    updatedAt: (row.updated_at as string | null) ?? null,
  }));
}
