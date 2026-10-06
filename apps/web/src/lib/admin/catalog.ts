import { compareSemver } from "@flyee/catalog/semver";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the catalog console reads (migration 0008, usage from 0021). The
 * operator's session reads every row, drafts included, through the superadmin
 * policies; the package location and the manifest stay out of reach of any
 * session (column grants), which is why a version's declared files and entry
 * come from `admin_catalog_stats()`.
 */

export type Localized = { "pt-BR"?: string; en?: string };

export type Credential = { name: string; env: string; url?: string; required: boolean; purpose: Localized };

export type AdminTrail = { slug: string; name: Localized; description: Localized; icon: string | null; sort: number };

/** A kind of work the public store filters by (migration 0029). */
export type AdminStoreCategory = { slug: string; name: Localized; sort: number };

export type ModuleUsage = {
  downloads: number;
  downloads30d: number;
  installs: number;
  executions30d: number;
  activeAccounts30d: number;
  lessonsStarted: number;
  lessonsCompleted: number;
};

export type AdminVersion = {
  id: string;
  moduleId: string;
  version: string;
  isStable: boolean;
  status: "draft" | "published" | "yanked";
  sha256: string;
  sizeBytes: number;
  changelog: Localized;
  minCoreVersion: string | null;
  compatibleAis: string[];
  permissions: { kind: string; scope: string; reason: Localized | string }[];
  publishedAt: string | null;
  yankedAt: string | null;
  yankReason: string | null;
  createdAt: string;
  downloads: number;
  downloads30d: number;
  /** What the package declares, read by `admin_catalog_stats`. */
  files: number | null;
  entry: string | null;
  license: string | null;
};

export type AdminModule = {
  id: string;
  slug: string;
  trail: string;
  /** The store category, null when the app shows only under "Todos". */
  storeCategory: string | null;
  type: string;
  icon: string | null;
  name: Localized;
  summary: Localized;
  descriptionMd: Localized;
  compatibleAis: string[];
  externalCredentials: Credential[];
  status: "draft" | "published" | "archived";
  isFreeSample: boolean;
  entitlementKey: string;
  sort: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  usage: ModuleUsage;
  /** Newest first. */
  versions: AdminVersion[];
};

export type AdminLesson = {
  id: string;
  moduleId: string;
  depth: "usar" | "abrir_o_capo";
  locale: "pt-BR" | "en";
  title: string;
  durationSeconds: number | null;
  isAdvanced: boolean;
  sort: number;
  youtubeId: string | null;
};

export type AdminRecipe = {
  id: string;
  slug: string;
  name: Localized;
  summary: Localized;
  icon: string | null;
  status: "draft" | "published" | "archived";
  sort: number;
  publishedAt: string | null;
  /** In the order the recipe chains them. */
  moduleIds: string[];
  workflow: Localized;
};

export type DeliverySettings = {
  perMinute: number;
  perHour: number;
  downloadsPerDay: number;
  eventsPerHour: number;
  minCliVersion: string;
  latestCoreVersion: string | null;
  deprecations: string[];
};

export const DEFAULT_DELIVERY: DeliverySettings = {
  perMinute: 60,
  perHour: 600,
  downloadsPerDay: 200,
  eventsPerHour: 600,
  minCliVersion: "0.1.0",
  latestCoreVersion: null,
  deprecations: [],
};

const EMPTY_USAGE: ModuleUsage = {
  downloads: 0,
  downloads30d: 0,
  installs: 0,
  executions30d: 0,
  activeAccounts30d: 0,
  lessonsStarted: 0,
  lessonsCompleted: 0,
};

/** Portuguese first, then English, then the fallback: the console reads Portuguese. */
export const textOf = (value: Localized | null | undefined, fallback = ""): string =>
  value?.["pt-BR"]?.trim() || value?.en?.trim() || fallback;

/** The newest version members can download: the highest semver among the published ones. */
export function latestPublished(versions: AdminVersion[]): AdminVersion | null {
  return (
    versions
      .filter((version) => version.status === "published")
      .sort((a, b) => compareSemver(b.version, a.version))[0] ?? null
  );
}

const asInt = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

/** `platform_settings.cli` read the way `cli_rate_allowance` and the event writer read it. */
export function deliveryFrom(value: Record<string, unknown> | null | undefined): DeliverySettings {
  const rate = (value?.rate ?? {}) as Record<string, unknown>;
  return {
    perMinute: asInt(rate.per_minute, DEFAULT_DELIVERY.perMinute),
    perHour: asInt(rate.per_hour, DEFAULT_DELIVERY.perHour),
    downloadsPerDay: asInt(value?.downloads_per_day, DEFAULT_DELIVERY.downloadsPerDay),
    eventsPerHour: asInt(value?.events_per_hour, DEFAULT_DELIVERY.eventsPerHour),
    minCliVersion: typeof value?.min_cli_version === "string" ? value.min_cli_version : DEFAULT_DELIVERY.minCliVersion,
    latestCoreVersion: typeof value?.latest_core_version === "string" ? value.latest_core_version : null,
    deprecations: Array.isArray(value?.deprecations)
      ? value.deprecations.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

type VersionRow = {
  id: string;
  module_id: string;
  version: string;
  is_stable: boolean;
  status: AdminVersion["status"];
  sha256: string;
  size_bytes: number;
  changelog: Localized | null;
  min_core_version: string | null;
  compatible_ais: string[] | null;
  permissions: AdminVersion["permissions"] | null;
  published_at: string | null;
  yanked_at: string | null;
  yank_reason: string | null;
  created_at: string;
};

type Stats = {
  modules: ({ moduleId: string } & ModuleUsage)[];
  versions: {
    versionId: string;
    downloads: number;
    downloads30d: number;
    files: number | null;
    entry: string | null;
    license: string | null;
  }[];
};

const VERSION_COLUMNS =
  "id, module_id, version, is_stable, status, sha256, size_bytes, changelog, min_core_version, compatible_ais, permissions, published_at, yanked_at, yank_reason, created_at";

const MODULE_COLUMNS =
  "id, slug, trail, store_category, type, icon, name, summary, description_md, compatible_ais, external_credentials, status, is_free_sample, entitlement_key, sort, published_at, created_at, updated_at";

function toVersion(row: VersionRow, stats: Stats["versions"][number] | undefined): AdminVersion {
  return {
    id: row.id,
    moduleId: row.module_id,
    version: row.version,
    isStable: row.is_stable,
    status: row.status,
    sha256: row.sha256,
    sizeBytes: Number(row.size_bytes),
    changelog: row.changelog ?? {},
    minCoreVersion: row.min_core_version,
    compatibleAis: row.compatible_ais ?? [],
    permissions: row.permissions ?? [],
    publishedAt: row.published_at,
    yankedAt: row.yanked_at,
    yankReason: row.yank_reason,
    createdAt: row.created_at,
    downloads: Number(stats?.downloads ?? 0),
    downloads30d: Number(stats?.downloads30d ?? 0),
    files: stats?.files ?? null,
    entry: stats?.entry ?? null,
    license: stats?.license ?? null,
  };
}

function toModule(row: Record<string, unknown>, usage: ModuleUsage | undefined, versions: AdminVersion[]): AdminModule {
  return {
    id: row.id as string,
    slug: row.slug as string,
    trail: row.trail as string,
    storeCategory: (row.store_category as string | null) ?? null,
    type: row.type as string,
    icon: (row.icon as string | null) ?? null,
    name: (row.name as Localized) ?? {},
    summary: (row.summary as Localized) ?? {},
    descriptionMd: (row.description_md as Localized) ?? {},
    compatibleAis: (row.compatible_ais as string[]) ?? [],
    externalCredentials: (row.external_credentials as Credential[]) ?? [],
    status: row.status as AdminModule["status"],
    isFreeSample: Boolean(row.is_free_sample),
    entitlementKey: (row.entitlement_key as string) ?? "catalog_access",
    sort: Number(row.sort ?? 0),
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    usage: { ...EMPTY_USAGE, ...usage },
    versions: [...versions].sort((a, b) => compareSemver(b.version, a.version)),
  };
}

async function readStats(supabase: SupabaseClient): Promise<Stats> {
  const { data, error } = await supabase.rpc("admin_catalog_stats");
  if (error || !data) throw new Error("catalog_stats_failed");
  return data as Stats;
}

export async function loadTrails(supabase: SupabaseClient): Promise<AdminTrail[]> {
  const { data, error } = await supabase
    .from("catalog_trails")
    .select("slug, name, description, icon, sort")
    .order("sort");
  if (error) throw new Error("trails_failed");
  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name ?? {},
    description: row.description ?? {},
    icon: row.icon,
    sort: row.sort,
  }));
}

export async function loadStoreCategories(supabase: SupabaseClient): Promise<AdminStoreCategory[]> {
  const { data, error } = await supabase.from("catalog_store_categories").select("slug, name, sort").order("sort");
  if (error) throw new Error("store_categories_failed");
  return (data ?? []).map((row) => ({ slug: row.slug, name: row.name ?? {}, sort: row.sort }));
}

/** Every module with its versions and usage, the recipes, the trails, the store categories and the delivery settings. */
export async function loadCatalogAdmin(supabase: SupabaseClient): Promise<{
  trails: AdminTrail[];
  storeCategories: AdminStoreCategory[];
  modules: AdminModule[];
  recipes: AdminRecipe[];
  delivery: DeliverySettings;
}> {
  const [
    trails,
    storeCategories,
    modulesRead,
    versionsRead,
    recipesRead,
    recipeModulesRead,
    workflowsRead,
    settingsRead,
    stats,
  ] = await Promise.all([
    loadTrails(supabase),
    loadStoreCategories(supabase),
    supabase.from("catalog_modules").select(MODULE_COLUMNS).order("sort").order("created_at"),
    supabase.from("catalog_module_versions").select(VERSION_COLUMNS),
    supabase.from("catalog_recipes").select("id, slug, name, summary, icon, status, sort, published_at").order("sort"),
    supabase.from("catalog_recipe_modules").select("recipe_id, module_id, sort"),
    supabase.from("catalog_recipe_workflows").select("recipe_id, body_md"),
    supabase.from("platform_settings").select("value").eq("key", "cli").maybeSingle(),
    readStats(supabase),
  ]);
  for (const read of [modulesRead, versionsRead, recipesRead, recipeModulesRead, workflowsRead, settingsRead]) {
    if (read.error) throw new Error("catalog_admin_failed");
  }

  const versionStats = new Map(stats.versions.map((entry) => [entry.versionId, entry]));
  const usage = new Map(stats.modules.map((entry) => [entry.moduleId, entry]));
  const versionsByModule = new Map<string, AdminVersion[]>();
  for (const row of (versionsRead.data ?? []) as VersionRow[]) {
    const list = versionsByModule.get(row.module_id) ?? [];
    list.push(toVersion(row, versionStats.get(row.id)));
    versionsByModule.set(row.module_id, list);
  }

  const modulesOf = new Map<string, { moduleId: string; sort: number }[]>();
  for (const row of recipeModulesRead.data ?? []) {
    const list = modulesOf.get(row.recipe_id) ?? [];
    list.push({ moduleId: row.module_id, sort: row.sort });
    modulesOf.set(row.recipe_id, list);
  }
  const workflows = new Map((workflowsRead.data ?? []).map((row) => [row.recipe_id, (row.body_md ?? {}) as Localized]));

  return {
    trails,
    storeCategories,
    modules: (modulesRead.data ?? []).map((row) =>
      toModule(
        row as Record<string, unknown>,
        usage.get(row.id as string),
        versionsByModule.get(row.id as string) ?? [],
      ),
    ),
    recipes: (recipesRead.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name ?? {},
      summary: row.summary ?? {},
      icon: row.icon,
      status: row.status,
      sort: row.sort,
      publishedAt: row.published_at,
      moduleIds: (modulesOf.get(row.id) ?? []).sort((a, b) => a.sort - b.sort).map((entry) => entry.moduleId),
      workflow: workflows.get(row.id) ?? {},
    })),
    delivery: deliveryFrom(settingsRead.data?.value as Record<string, unknown> | undefined),
  };
}

/** One module, its versions and its lessons (with the video id, which only a superadmin or an entitled member reads). */
export async function loadModuleAdmin(
  supabase: SupabaseClient,
  slug: string,
): Promise<{
  module: AdminModule;
  lessons: AdminLesson[];
  trails: AdminTrail[];
  storeCategories: AdminStoreCategory[];
} | null> {
  const { data: row, error } = await supabase
    .from("catalog_modules")
    .select(MODULE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("module_failed");
  if (!row) return null;
  const moduleId = row.id as string;

  const [trails, storeCategories, versionsRead, lessonsRead, stats] = await Promise.all([
    loadTrails(supabase),
    loadStoreCategories(supabase),
    supabase.from("catalog_module_versions").select(VERSION_COLUMNS).eq("module_id", moduleId),
    supabase
      .from("catalog_lessons")
      .select(
        "id, module_id, depth, locale, title, duration_seconds, is_advanced, sort, catalog_lesson_videos(youtube_id)",
      )
      .eq("module_id", moduleId)
      .order("sort"),
    readStats(supabase),
  ]);
  if (versionsRead.error || lessonsRead.error) throw new Error("module_failed");

  const versionStats = new Map(stats.versions.map((entry) => [entry.versionId, entry]));
  const versions = ((versionsRead.data ?? []) as VersionRow[]).map((version) =>
    toVersion(version, versionStats.get(version.id)),
  );
  const usage = stats.modules.find((entry) => entry.moduleId === moduleId);

  return {
    module: toModule(row as Record<string, unknown>, usage, versions),
    trails,
    storeCategories,
    lessons: (lessonsRead.data ?? []).map((lesson) => {
      const video = lesson.catalog_lesson_videos as { youtube_id: string } | { youtube_id: string }[] | null;
      const youtubeId = Array.isArray(video) ? (video[0]?.youtube_id ?? null) : (video?.youtube_id ?? null);
      return {
        id: lesson.id,
        moduleId: lesson.module_id,
        depth: lesson.depth,
        locale: lesson.locale,
        title: lesson.title,
        durationSeconds: lesson.duration_seconds,
        isAdvanced: lesson.is_advanced,
        sort: lesson.sort,
        youtubeId,
      };
    }),
  };
}
