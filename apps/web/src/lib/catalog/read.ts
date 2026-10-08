import "server-only";

import { type CatalogLocale, verifyUrl } from "@/lib/catalog/links";
import { channelOf, resolveChannel, versionAllowed } from "@flyee/catalog/channels";
import { compareSemver } from "@flyee/catalog/semver";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reading the catalog (migration 0008): published modules, published (or, for
 * history, yanked) versions, lessons without their video ids, recipes. Shared
 * by the CLI delivery API (service role) and the member screens (the member's
 * session, under row-level security): every column read here is one the
 * `authenticated` role may select.
 *
 * Texts are stored per language (`{"pt-BR": ..., "en": ...}`) and answered in
 * the requested one, falling back to Portuguese, which every row must have.
 *
 * Which versions an account may download follows its channel
 * (`@flyee/catalog/channels`, migration 0040): `latest` is the newest one it
 * may download, `newest` the newest for everyone, and every version of an
 * app's history says whether it is `entitled`.
 */

type Localized = Record<string, string> | null | undefined;

export function localize(value: Localized, locale: CatalogLocale): string | null {
  if (!value) return null;
  return value[locale]?.trim() || value["pt-BR"]?.trim() || null;
}

/** Do these limits grant the module's key (catalog_access, for most)? The entry version needs none. */
export function grantsModuleKey(module: { entitlement_key: string }, limits: Record<string, unknown>): boolean {
  const value = Number(limits[module.entitlement_key]);
  return Number.isFinite(value) && value > 0;
}

type ModuleRow = {
  id: string;
  slug: string;
  trail: string;
  type: string;
  icon: string | null;
  name: Localized;
  summary: Localized;
  description_md?: Localized;
  compatible_ais: string[] | null;
  external_credentials: unknown[] | null;
  entitlement_key: string;
  sort: number;
};

type VersionRow = {
  id: string;
  module_id: string;
  version: string;
  status: string;
  is_stable: boolean;
  is_entry: boolean;
  sha256: string;
  size_bytes: number;
  published_at: string | null;
  yanked_at: string | null;
  yank_reason: string | null;
  changelog: Localized;
  min_core_version: string | null;
  compatible_ais: string[] | null;
  permissions: unknown[] | null;
};

type LessonRow = {
  module_id: string;
  depth: string;
  locale: string;
  title: string;
  duration_seconds: number | null;
  is_advanced: boolean;
  sort: number;
};

const MODULE_COLUMNS =
  "id, slug, trail, type, icon, name, summary, compatible_ais, external_credentials, entitlement_key, sort";
const VERSION_COLUMNS =
  "id, module_id, version, status, is_stable, is_entry, sha256, size_bytes, published_at, yanked_at, yank_reason, changelog, min_core_version, compatible_ais, permissions";

function versionSummary(version: VersionRow) {
  return {
    version: version.version,
    is_stable: version.is_stable,
    sha256: version.sha256,
    size_bytes: Number(version.size_bytes),
    published_at: version.published_at,
    min_core_version: version.min_core_version,
    permissions: version.permissions ?? [],
  };
}

function lessonSummary(lesson: LessonRow) {
  return {
    depth: lesson.depth,
    locale: lesson.locale,
    title: lesson.title,
    duration_seconds: lesson.duration_seconds,
    is_advanced: lesson.is_advanced,
  };
}

function moduleSummary(
  module: ModuleRow,
  locale: CatalogLocale,
  limits: Record<string, unknown>,
  versions: VersionRow[],
  lessons: LessonRow[],
  stableOnly = false,
) {
  const { latest, newest, entitled } = resolveChannel(versions, {
    channel: channelOf(limits),
    hasKey: grantsModuleKey(module, limits),
    stableOnly,
  });
  return {
    slug: module.slug,
    type: module.type,
    trail: module.trail,
    icon: module.icon,
    name: localize(module.name, locale),
    summary: localize(module.summary, locale),
    compatible_ais: module.compatible_ais ?? [],
    external_credentials: module.external_credentials ?? [],
    // One rule since 0040, the entry version: always false, kept because the
    // CLI 1.x declares the field (docs/CLI-CONTRACT.md, 4.3).
    is_free_sample: false,
    entitlement_key: module.entitlement_key,
    entitled,
    latest: latest ? versionSummary(latest) : null,
    newest: newest ? versionSummary(newest) : null,
    lessons: lessons.sort((a, b) => a.sort - b.sort).map(lessonSummary),
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = groups.get(key(row));
    if (bucket) bucket.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

/** GET /api/cli/catalog: trails, modules with the versions this account gets and their lessons, recipes. */
export async function loadCatalog(
  service: SupabaseClient,
  input: { locale: CatalogLocale; stableOnly: boolean; limits: Record<string, unknown> },
) {
  const [
    { data: trails, error: trailsError },
    { data: modules, error: modulesError },
    { data: recipes, error: recipesError },
  ] = await Promise.all([
    service.from("catalog_trails").select("slug, name, description, icon, sort").order("sort"),
    service.from("catalog_modules").select(MODULE_COLUMNS).eq("status", "published").order("sort"),
    service
      .from("catalog_recipes")
      .select("id, slug, name, summary, icon, sort")
      .eq("status", "published")
      .order("sort"),
  ]);
  if (trailsError || modulesError || recipesError) throw new Error("catalog_read_failed");

  const moduleRows = (modules ?? []) as ModuleRow[];
  const moduleIds = moduleRows.map((module) => module.id);
  const recipeRows = (recipes ?? []) as {
    id: string;
    slug: string;
    name: Localized;
    summary: Localized;
    icon: string | null;
  }[];
  const recipeIds = recipeRows.map((recipe) => recipe.id);

  const [
    { data: versions, error: versionsError },
    { data: lessons, error: lessonsError },
    { data: recipeModules, error: linksError },
  ] = await Promise.all([
    moduleIds.length
      ? service
          .from("catalog_module_versions")
          .select(VERSION_COLUMNS)
          .eq("status", "published")
          .in("module_id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
    moduleIds.length
      ? service
          .from("catalog_lessons")
          .select("module_id, depth, locale, title, duration_seconds, is_advanced, sort")
          .in("module_id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
    recipeIds.length
      ? service.from("catalog_recipe_modules").select("recipe_id, module_id, sort").in("recipe_id", recipeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionsError || lessonsError || linksError) throw new Error("catalog_read_failed");

  const versionsByModule = groupBy((versions ?? []) as VersionRow[], (row) => row.module_id);
  const channel = channelOf(input.limits);
  const lessonsByModule = groupBy((lessons ?? []) as LessonRow[], (lesson) => lesson.module_id);
  const slugById = new Map(moduleRows.map((module) => [module.id, module.slug]));
  const linksByRecipe = groupBy(
    (recipeModules ?? []) as { recipe_id: string; module_id: string; sort: number }[],
    (link) => link.recipe_id,
  );

  return {
    locale: input.locale,
    // The account's channel; `stable=1` narrows latest to stable versions.
    channel: input.stableOnly && channel !== "free" ? "stable" : (channel ?? "latest"),
    trails: ((trails ?? []) as { slug: string; name: Localized; description: Localized; icon: string | null }[]).map(
      (trail) => ({
        slug: trail.slug,
        name: localize(trail.name, input.locale),
        description: localize(trail.description, input.locale),
        icon: trail.icon,
      }),
    ),
    modules: moduleRows.map((module) =>
      moduleSummary(
        module,
        input.locale,
        input.limits,
        versionsByModule.get(module.id) ?? [],
        lessonsByModule.get(module.id) ?? [],
        input.stableOnly,
      ),
    ),
    recipes: recipeRows.map((recipe) => ({
      slug: recipe.slug,
      name: localize(recipe.name, input.locale),
      summary: localize(recipe.summary, input.locale),
      icon: recipe.icon,
      modules: (linksByRecipe.get(recipe.id) ?? [])
        .sort((a, b) => a.sort - b.sort)
        .map((link) => slugById.get(link.module_id))
        .filter((slug): slug is string => Boolean(slug)),
    })),
  };
}

/** GET /api/cli/modules/{slug}: one module with its release history. Null when not published. */
export async function loadModule(
  service: SupabaseClient,
  input: { slug: string; locale: CatalogLocale; limits: Record<string, unknown> },
) {
  const { data: module, error } = await service
    .from("catalog_modules")
    .select(`${MODULE_COLUMNS}, description_md`)
    .eq("slug", input.slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("catalog_read_failed");
  if (!module) return null;
  const row = module as ModuleRow;

  const [{ data: versions, error: versionsError }, { data: lessons, error: lessonsError }] = await Promise.all([
    service
      .from("catalog_module_versions")
      .select(VERSION_COLUMNS)
      .eq("module_id", row.id)
      .in("status", ["published", "yanked"]),
    service
      .from("catalog_lessons")
      .select("module_id, depth, locale, title, duration_seconds, is_advanced, sort")
      .eq("module_id", row.id),
  ]);
  if (versionsError || lessonsError) throw new Error("catalog_read_failed");

  const versionRows = ((versions ?? []) as VersionRow[]).sort(
    (a, b) =>
      compareSemver(b.version, a.version) || Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? ""),
  );
  const channel = channelOf(input.limits);
  const hasKey = grantsModuleKey(row, input.limits);

  return {
    id: row.id,
    ...moduleSummary(row, input.locale, input.limits, versionRows, (lessons ?? []) as LessonRow[]),
    description: localize(row.description_md, input.locale),
    versions: versionRows.map((version) => ({
      ...versionSummary(version),
      status: version.status,
      yanked_at: version.yanked_at,
      yank_reason: version.yank_reason,
      changelog: localize(version.changelog, input.locale),
      compatible_ais: version.compatible_ais ?? [],
      // Whether this account may download it: a yanked version is nobody's.
      entitled: version.status === "published" && versionAllowed(version, channel, hasKey),
      verify_url: verifyUrl(row.slug, version.version, input.locale),
    })),
  };
}

/** GET /api/cli/recipes/{slug}: a recipe, its modules at their latest versions, and the workflow when entitled. */
export async function loadRecipe(
  service: SupabaseClient,
  input: { slug: string; locale: CatalogLocale; limits: Record<string, unknown> },
) {
  const { data: recipe, error } = await service
    .from("catalog_recipes")
    .select("id, slug, name, summary, icon")
    .eq("slug", input.slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("catalog_read_failed");
  if (!recipe) return null;

  const { data: links, error: linksError } = await service
    .from("catalog_recipe_modules")
    .select("module_id, sort")
    .eq("recipe_id", recipe.id);
  if (linksError) throw new Error("catalog_read_failed");
  const order = new Map(
    ((links ?? []) as { module_id: string; sort: number }[]).map((link) => [link.module_id, link.sort]),
  );
  const moduleIds = [...order.keys()];

  const [{ data: modules, error: modulesError }, { data: versions, error: versionsError }] = await Promise.all([
    moduleIds.length
      ? service.from("catalog_modules").select(MODULE_COLUMNS).eq("status", "published").in("id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
    moduleIds.length
      ? service
          .from("catalog_module_versions")
          .select(VERSION_COLUMNS)
          .eq("status", "published")
          .in("module_id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (modulesError || versionsError) throw new Error("catalog_read_failed");

  const versionsByModule = groupBy((versions ?? []) as VersionRow[], (row) => row.module_id);
  const entitledToWorkflow = Number(input.limits.recipes ?? 0) > 0;
  let workflow: string | null = null;
  if (entitledToWorkflow) {
    const { data: body } = await service
      .from("catalog_recipe_workflows")
      .select("body_md")
      .eq("recipe_id", recipe.id)
      .maybeSingle();
    workflow = localize((body?.body_md as Localized) ?? null, input.locale);
  }

  return {
    slug: recipe.slug as string,
    name: localize(recipe.name as Localized, input.locale),
    summary: localize(recipe.summary as Localized, input.locale),
    icon: (recipe.icon as string | null) ?? null,
    entitled: entitledToWorkflow,
    workflow,
    modules: ((modules ?? []) as ModuleRow[])
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((module) => moduleSummary(module, input.locale, input.limits, versionsByModule.get(module.id) ?? [], [])),
  };
}
