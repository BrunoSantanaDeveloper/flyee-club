import { readShowcase, type Showcase } from "@/lib/catalog/showcase";
import { breaksOf } from "@/lib/i18n/copy-rules";
import { AI_TOOLS, MODULE_TYPES } from "@flyee/catalog/manifest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The product's index (`dist/index.json`, written by its `npm run index`) into
 * the catalog (docs/CLI-CONTRACT.md, section 10). Each app of the index
 * creates or updates its module as the product describes it; nothing here
 * publishes, and nothing the console decides is touched.
 *
 * Who decides what:
 *  - the product (the manifest, through the index): the name, the summary,
 *    the stage (`trail`), the type, the AIs it was tested on, the keys the
 *    member provides and the example of the app answering a request
 *    (`showcase`, lib/catalog/showcase.ts). They follow the product on every
 *    import, language by language: a language the index does not carry keeps
 *    what the catalog has;
 *  - the console: the store category, the personas, the icon, the order, the
 *    access key, the state and every version's state and entry mark. The
 *    import never writes them;
 *  - the description: the README fills it once, when the module has none in
 *    Portuguese. After that it is the operator's text, because the README is
 *    written for whoever installs the app and the store page is not.
 *
 * Every text the store would show passes the copy rules first: a name that
 * breaks one refuses the app, a summary, a description or an example that
 * breaks one is left out with a warning.
 */

export const MAX_INDEX_BYTES = 2 * 1024 * 1024;
export const MAX_INDEX_APPS = 200;
export const MAX_DESCRIPTION_CHARS = 20_000;

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const TRAIL = /^[a-z][a-z0-9-]{1,29}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

export type Localized = { "pt-BR"?: string; en?: string };
export type Credential = { name: string; env: string; url?: string; required: boolean; purpose: Localized };

/** One app of the index, checked and shaped as the catalog records it. */
export type IndexedModule = {
  slug: string;
  trail: string;
  type: string;
  name: Localized;
  summary: Localized;
  /** The README in Portuguese without its title; null when it cannot be the store's text. */
  description: string | null;
  compatibleAis: string[];
  externalCredentials: Credential[];
  /** The example per language, each checked; a broken language is left out with a warning. */
  showcase: Showcase;
  warnings: string[];
};

export type RefusedApp = { slug: string; errors: string[] };

export type ParsedIndex =
  | { ok: true; apps: IndexedModule[]; refused: RefusedApp[] }
  | { ok: false; error: string; errors?: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

/**
 * A `{pt-BR, en}` text from the index. A language that is missing, too long or
 * breaks a copy rule is dropped and reported; `required` refuses the app when
 * the Portuguese one cannot be kept.
 */
function localized(
  value: unknown,
  max: number,
  field: string,
  required: boolean,
  errors: string[],
  warnings: string[],
): Localized {
  const kept: Localized = {};
  if (!isRecord(value)) {
    if (required) errors.push(`${field}: must be an object with a "pt-BR" text`);
    return kept;
  }
  for (const locale of ["pt-BR", "en"] as const) {
    if (value[locale] === undefined) continue;
    const found = text(value[locale], max);
    if (!found) {
      (required && locale === "pt-BR" ? errors : warnings).push(
        `${field}.${locale}: must be a text of 1 to ${max} characters`,
      );
      continue;
    }
    const broken = breaksOf(found);
    if (broken.length > 0) {
      (required && locale === "pt-BR" ? errors : warnings).push(
        `${field}.${locale}: breaks the copy rules (${broken.join(", ")}), left out`,
      );
      continue;
    }
    kept[locale] = found;
  }
  if (required && !kept["pt-BR"] && !errors.some((error) => error.startsWith(`${field}.pt-BR`))) {
    errors.push(`${field}.pt-BR: is required`);
  }
  return kept;
}

/** The README as the store's description: without the leading `# Title`, which the page already shows as its h1. */
export function descriptionFromReadme(readme: string): string {
  // A byte order mark some editors write first is not part of the text.
  const body = readme.charCodeAt(0) === 0xfeff ? readme.slice(1) : readme;
  return body.replace(/^\s*#\s[^\n]*\n/u, "").trim();
}

function credentials(value: unknown, errors: string[]): Credential[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    errors.push("external_credentials: must be a list of at most 20 keys");
    return [];
  }
  const kept: Credential[] = [];
  value.forEach((entry, index) => {
    const where = `external_credentials[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    const name = text(entry.name, 80);
    const env = typeof entry.env === "string" && ENV_NAME.test(entry.env) ? entry.env : null;
    const url = entry.url === undefined ? undefined : text(entry.url, 500);
    const purposeErrors: string[] = [];
    const purpose = localized(entry.purpose, 280, `${where}.purpose`, true, purposeErrors, []);
    if (!name) errors.push(`${where}.name: must be a text of 1 to 80 characters`);
    if (!env) errors.push(`${where}.env: must be an environment variable name in capitals`);
    if (url === null || (url !== undefined && !url.startsWith("https://"))) {
      errors.push(`${where}.url: must be an https address`);
    }
    if (typeof entry.required !== "boolean") errors.push(`${where}.required: must be true or false`);
    errors.push(...purposeErrors);
    if (name && env && url !== null && typeof entry.required === "boolean" && purposeErrors.length === 0) {
      kept.push({ name, env, ...(url ? { url } : {}), required: entry.required, purpose });
    }
  });
  return kept;
}

/** Checks the whole index before anything is written: a malformed file changes nothing. */
export function parseCatalogIndex(input: unknown): ParsedIndex {
  if (!isRecord(input) || !Array.isArray(input.apps)) {
    return { ok: false, error: "invalid_index", errors: ['the index is an object with an "apps" list'] };
  }
  if (input.apps.length === 0 || input.apps.length > MAX_INDEX_APPS) {
    return { ok: false, error: "invalid_index", errors: [`"apps" holds 1 to ${MAX_INDEX_APPS} apps`] };
  }

  const apps: IndexedModule[] = [];
  const refused: RefusedApp[] = [];
  const seen = new Set<string>();

  input.apps.forEach((entry, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const app = isRecord(entry) ? entry : {};
    const slug = typeof app.slug === "string" && SLUG.test(app.slug) ? app.slug : null;
    if (!slug) errors.push("slug: lowercase letters, digits and hyphens, 2 to 60");
    else if (seen.has(slug)) errors.push("slug: appears twice in the index");
    if (slug) seen.add(slug);

    const trail = typeof app.trail === "string" && TRAIL.test(app.trail) ? app.trail : null;
    if (!trail) errors.push("trail: must be one of the catalog's stages");
    const type =
      typeof app.type === "string" && (MODULE_TYPES as readonly string[]).includes(app.type) ? app.type : null;
    if (!type) errors.push(`type: one of ${MODULE_TYPES.join(", ")}`);

    const name = localized(app.title, 80, "title", true, errors, warnings);
    const summary = localized(app.summary, 280, "summary", false, errors, warnings);

    const compatibleAis = Array.isArray(app.compatible_ais)
      ? [...new Set(app.compatible_ais)].filter(
          (tool): tool is string => typeof tool === "string" && (AI_TOOLS as readonly string[]).includes(tool),
        )
      : [];
    if (compatibleAis.length === 0) errors.push(`compatible_ais: at least one of ${AI_TOOLS.join(", ")}`);

    const externalCredentials = credentials(app.external_credentials, errors);

    let description: string | null = null;
    if (typeof app.description_md === "string" && app.description_md.trim()) {
      const candidate = descriptionFromReadme(app.description_md);
      const broken = breaksOf(candidate);
      if (candidate.length > MAX_DESCRIPTION_CHARS) {
        warnings.push(`description_md: longer than ${MAX_DESCRIPTION_CHARS} characters, left out`);
      } else if (broken.length > 0) {
        warnings.push(`description_md: breaks the copy rules (${broken.join(", ")}), left out`);
      } else if (candidate) {
        description = candidate;
      }
    }

    const { showcase, problems: showcaseProblems } = readShowcase(app.showcase);
    warnings.push(...showcaseProblems.map((problem) => `showcase: ${problem}, left out`));

    if (errors.length > 0 || !slug || !trail || !type) {
      refused.push({ slug: slug ?? `apps[${index}]`, errors });
      return;
    }
    apps.push({
      slug,
      trail,
      type,
      name,
      summary,
      description,
      compatibleAis,
      externalCredentials,
      showcase,
      warnings,
    });
  });

  return { ok: true, apps, refused };
}

/** A module as the catalog holds it, with the columns the import may change. */
export type ExistingModule = {
  id: string;
  slug: string;
  trail: string;
  type: string;
  name: Localized | null;
  summary: Localized | null;
  description_md: Localized | null;
  compatible_ais: string[] | null;
  external_credentials: unknown;
  showcase: Showcase | null;
};

type ModuleColumns = {
  trail: string;
  type: string;
  name: Localized;
  summary: Localized;
  description_md: Localized;
  compatible_ais: string[];
  external_credentials: Credential[];
  showcase: Showcase;
};

export type ImportOperation =
  | { kind: "create"; slug: string; row: ModuleColumns & { slug: string }; warnings: string[] }
  | { kind: "update"; slug: string; id: string; patch: Partial<ModuleColumns>; fields: string[]; warnings: string[] }
  | { kind: "unchanged"; slug: string; warnings: string[] };

/** Key order does not make two values different. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) =>
    isRecord(inner)
      ? Object.fromEntries(
          Object.keys(inner)
            .sort()
            .map((key) => [key, inner[key]]),
        )
      : inner,
  );

/**
 * What the import does to each app, decided from the catalog as it is: no
 * write happens here. A language the index does not carry keeps the text the
 * catalog has, so an English name typed in the console survives an index
 * that only has Portuguese.
 */
export function planImport(existing: ExistingModule[], apps: IndexedModule[]): ImportOperation[] {
  const bySlug = new Map(existing.map((module) => [module.slug, module]));
  return apps.map((app): ImportOperation => {
    const current = bySlug.get(app.slug);
    if (!current) {
      return {
        kind: "create",
        slug: app.slug,
        row: {
          slug: app.slug,
          trail: app.trail,
          type: app.type,
          name: app.name,
          summary: app.summary,
          description_md: app.description ? { "pt-BR": app.description } : {},
          compatible_ais: app.compatibleAis,
          external_credentials: app.externalCredentials,
          showcase: app.showcase,
        },
        warnings: app.warnings,
      };
    }

    const next: ModuleColumns = {
      trail: app.trail,
      type: app.type,
      name: { ...(current.name ?? {}), ...app.name },
      summary: { ...(current.summary ?? {}), ...app.summary },
      description_md:
        current.description_md?.["pt-BR"] || !app.description
          ? (current.description_md ?? {})
          : { ...(current.description_md ?? {}), "pt-BR": app.description },
      compatible_ais: app.compatibleAis,
      external_credentials: app.externalCredentials,
      showcase: { ...(current.showcase ?? {}), ...app.showcase },
    };
    const before: ModuleColumns = {
      trail: current.trail,
      type: current.type,
      name: current.name ?? {},
      summary: current.summary ?? {},
      description_md: current.description_md ?? {},
      compatible_ais: current.compatible_ais ?? [],
      external_credentials: (current.external_credentials as Credential[] | null) ?? [],
      showcase: current.showcase ?? {},
    };
    const patch: Partial<ModuleColumns> = {};
    const fields: string[] = [];
    for (const field of Object.keys(next) as (keyof ModuleColumns)[]) {
      const same =
        field === "compatible_ais"
          ? stable([...next.compatible_ais].sort()) === stable([...before.compatible_ais].sort())
          : stable(next[field]) === stable(before[field]);
      if (!same) {
        (patch as Record<string, unknown>)[field] = next[field];
        fields.push(field);
      }
    }
    return fields.length === 0
      ? { kind: "unchanged", slug: app.slug, warnings: app.warnings }
      : { kind: "update", slug: app.slug, id: current.id, patch, fields, warnings: app.warnings };
  });
}

export type ImportedApp = {
  slug: string;
  result: "created" | "updated" | "unchanged" | "refused";
  fields?: string[];
  warnings?: string[];
  errors?: string[];
};

type Audit = (
  action: string,
  options: { entityType?: string; entityId?: string; metadata?: Record<string, unknown> },
) => Promise<void>;

/** Applies a checked index: one write per app that changes, one audit event per write. */
export async function importCatalogIndex(
  service: SupabaseClient,
  parsed: { apps: IndexedModule[]; refused: RefusedApp[] },
  audit: Audit,
): Promise<ImportedApp[]> {
  const report: ImportedApp[] = parsed.refused.map((app) => ({
    slug: app.slug,
    result: "refused",
    errors: app.errors,
  }));
  if (parsed.apps.length === 0) return report;

  const [{ data: trails, error: trailsError }, { data: modules, error: modulesError }] = await Promise.all([
    service.from("catalog_trails").select("slug"),
    service
      .from("catalog_modules")
      .select("id, slug, trail, type, name, summary, description_md, compatible_ais, external_credentials, showcase")
      .in(
        "slug",
        parsed.apps.map((app) => app.slug),
      ),
  ]);
  if (trailsError || modulesError) throw new Error("catalog_read_failed");

  const knownTrails = new Set((trails ?? []).map((trail: { slug: string }) => trail.slug));
  const apps: IndexedModule[] = [];
  for (const app of parsed.apps) {
    if (knownTrails.has(app.trail)) apps.push(app);
    else report.push({ slug: app.slug, result: "refused", errors: [`trail: "${app.trail}" is not a catalog stage`] });
  }

  for (const operation of planImport((modules ?? []) as ExistingModule[], apps)) {
    const warnings = operation.warnings.length > 0 ? { warnings: operation.warnings } : {};
    if (operation.kind === "unchanged") {
      report.push({ slug: operation.slug, result: "unchanged", ...warnings });
      continue;
    }
    if (operation.kind === "create") {
      const { data, error } = await service
        .from("catalog_modules")
        .insert({ ...operation.row, created_by: null })
        .select("id")
        .single();
      if (error || !data) {
        report.push({ slug: operation.slug, result: "refused", errors: [error?.message ?? "insert_failed"] });
        continue;
      }
      await audit("catalog.module.imported", {
        entityType: "catalog_module",
        entityId: data.id as string,
        metadata: { slug: operation.slug, result: "created" },
      });
      report.push({ slug: operation.slug, result: "created", ...warnings });
      continue;
    }
    const { error } = await service.from("catalog_modules").update(operation.patch).eq("id", operation.id);
    if (error) {
      report.push({ slug: operation.slug, result: "refused", errors: [error.message] });
      continue;
    }
    await audit("catalog.module.imported", {
      entityType: "catalog_module",
      entityId: operation.id,
      metadata: { slug: operation.slug, result: "updated", fields: operation.fields },
    });
    report.push({ slug: operation.slug, result: "updated", fields: operation.fields, ...warnings });
  }
  return report;
}
