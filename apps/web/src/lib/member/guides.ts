import "server-only";

import type { CatalogLocale } from "@/lib/catalog/links";
import { GUIDE_DEPTHS, type GuideDepth, type GuideLocale } from "@flyee/catalog/guides";
import { compareSemver, isSemver } from "@flyee/catalog/semver";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The written guide a member reads on an app's page (migration 0030). Every
 * version carries its own guide, so the page shows the guide of the version
 * the member has INSTALLED (the newest one across their connected machines),
 * and says when a newer version, with a newer guide, is out. Without an
 * installed version, it shows the newest released one.
 *
 * Which guides a version carries is public metadata; the text comes through
 * `catalog_guides`, which only returns what `can_read_guide` allows. So a
 * guide the version carries but the query did not return IS the lock: the
 * page never decides access on its own.
 */

export type GuideAvailability = Partial<Record<GuideLocale, GuideDepth[]>>;

export type GuideVersionRow = {
  id: string;
  version: string;
  status: "published" | "yanked";
  guides: GuideAvailability;
};

const carriesGuides = (row: GuideVersionRow) =>
  Object.values(row.guides ?? {}).some((depths) => Array.isArray(depths) && depths.length > 0);

const newestFirst = (rows: GuideVersionRow[]) => [...rows].sort((a, b) => compareSemver(b.version, a.version));

/** The newest version of `slug` among the machines' reports, or null. Pure. */
export function installedVersionOf(devices: { installed_modules: unknown }[], slug: string): string | null {
  let newest: string | null = null;
  for (const device of devices) {
    if (!Array.isArray(device.installed_modules)) continue;
    for (const entry of device.installed_modules as { slug?: unknown; version?: unknown }[]) {
      if (entry?.slug !== slug || typeof entry.version !== "string" || !isSemver(entry.version)) continue;
      if (!newest || compareSemver(entry.version, newest) > 0) newest = entry.version;
    }
  }
  return newest;
}

/**
 * The version whose guide the page shows. Pure.
 *  - the installed version, when it carries a guide;
 *  - otherwise the newest version that carries one (an installed version
 *    from before guides existed reads the newest guide, and says so);
 *  - null when no version carries a guide.
 * `newer` is the newest released version when it is past the one shown.
 */
export function pickGuideVersion(
  versions: GuideVersionRow[],
  installed: string | null,
): { version: GuideVersionRow; installed: boolean; newer: string | null } | null {
  const ordered = newestFirst(versions);
  const withGuides = ordered.filter(carriesGuides);
  if (withGuides.length === 0) return null;

  const exact = installed ? withGuides.find((row) => row.version === installed) : undefined;
  const chosen = exact ?? withGuides.find((row) => row.status === "published") ?? withGuides[0];
  const latestReleased = ordered.find((row) => row.status === "published");
  const newer =
    latestReleased && compareSemver(latestReleased.version, chosen.version) > 0 ? latestReleased.version : null;
  return { version: chosen, installed: Boolean(exact), newer };
}

/** The language a depth's guide is read in: the member's, else Portuguese, else English. Pure. */
export function guideLocaleFor(
  availability: GuideAvailability,
  depth: GuideDepth,
  locale: CatalogLocale,
): GuideLocale | null {
  const has = (candidate: GuideLocale) => availability[candidate]?.includes(depth) ?? false;
  if (has(locale)) return locale;
  if (has("pt-BR")) return "pt-BR";
  if (has("en")) return "en";
  return null;
}

export type MemberGuideDepth = {
  depth: GuideDepth;
  /** The language the text is in; differs from the member's when the guide has no translation yet. */
  locale: GuideLocale;
  /** The guide's Markdown, or null when this member may not read this depth. */
  markdown: string | null;
};

export type MemberGuide =
  | { kind: "none" }
  | {
      kind: "ready";
      version: string;
      /** True when `version` is the one installed on the member's machines. */
      installed: boolean;
      /** A newer released version, with its own guide, when there is one. */
      newer: string | null;
      depths: MemberGuideDepth[];
    };

export async function loadGuide(
  supabase: SupabaseClient,
  input: { moduleId: string; slug: string; orgId: string | null; locale: CatalogLocale },
): Promise<MemberGuide> {
  const [{ data: versions, error }, { data: devices }] = await Promise.all([
    supabase
      .from("catalog_module_versions")
      .select("id, version, status, guides")
      .eq("module_id", input.moduleId)
      .in("status", ["published", "yanked"]),
    input.orgId
      ? supabase.from("member_devices").select("installed_modules").eq("org_id", input.orgId).is("revoked_at", null)
      : Promise.resolve({ data: [] as { installed_modules: unknown }[] }),
  ]);
  if (error) throw new Error("guide_read_failed");

  const picked = pickGuideVersion(
    (versions ?? []) as GuideVersionRow[],
    installedVersionOf((devices ?? []) as { installed_modules: unknown }[], input.slug),
  );
  if (!picked) return { kind: "none" };

  const wanted = GUIDE_DEPTHS.flatMap((depth) => {
    const locale = guideLocaleFor(picked.version.guides, depth, input.locale);
    return locale ? [{ depth, locale }] : [];
  });
  const { data: rows, error: guidesError } = await supabase
    .from("catalog_guides")
    .select("depth, locale, body_md")
    .eq("version_id", picked.version.id);
  if (guidesError) throw new Error("guide_read_failed");
  const text = new Map(
    ((rows ?? []) as { depth: string; locale: string; body_md: string }[]).map((row) => [
      `${row.depth}/${row.locale}`,
      row.body_md,
    ]),
  );

  return {
    kind: "ready",
    version: picked.version.version,
    installed: picked.installed,
    newer: picked.newer,
    depths: wanted.map(({ depth, locale }) => ({ depth, locale, markdown: text.get(`${depth}/${locale}`) ?? null })),
  };
}
