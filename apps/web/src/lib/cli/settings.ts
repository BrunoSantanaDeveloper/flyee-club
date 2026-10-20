import "server-only";

import { BRAND } from "@/brand";
import { localizeHref } from "@/i18n/routing";
import type { CliLocale } from "@/lib/cli/messages";
import { type PackageHost, packageHostOf, servesPackages } from "@/lib/cli/package-host";
import { cloudAllowedHosts } from "@/lib/install-links";
import { createServiceClient } from "@flyee/auth/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The delivery settings the CLI needs to know about (`platform_settings` key
 * `cli`, migration 0018; edited by the superadmin): the oldest CLI still
 * served, the newest core, and deprecation notices to print.
 */
export type CliSettings = {
  min_cli_version: string;
  latest_core_version: string | null;
  deprecations: unknown[];
};

/** What every CLI is served when the settings cannot be read: nothing refused, nothing announced. */
export const DEFAULT_CLI_SETTINGS: CliSettings = {
  min_cli_version: "0.1.0",
  latest_core_version: null,
  deprecations: [],
};

/** GET /api/cli/version (docs/CLI-CONTRACT.md 4.9), also the `cli` of GET /api/cli/me. */
export type CliVersionBody = CliSettings & { links: { module_page: string; module_page_en: string } };

/**
 * The address of an app's public page as a template: `{slug}` for the CLI to
 * fill, and `origem=cli` so the visit and a sign-up that follows count for the
 * installer's door. It is what a person who runs `npx flyee add <slug>`
 * without a connection is shown, so the CLI never builds an address of the
 * platform. Concatenated rather than built with `URL`, which would encode the
 * braces.
 */
export function modulePageTemplate(locale: CliLocale): string {
  return `${BRAND.siteUrl}${localizeHref("/catalogo/{slug}?origem=cli", locale)}`;
}

export function cliVersionBody(settings: CliSettings): CliVersionBody {
  return {
    ...settings,
    links: { module_page: modulePageTemplate("pt-BR"), module_page_en: modulePageTemplate("en") },
  };
}

export async function readCliSettings(service: SupabaseClient): Promise<CliSettings> {
  const { data } = await service.from("platform_settings").select("value").eq("key", "cli").maybeSingle();
  const value = (data?.value ?? {}) as Partial<CliSettings>;
  return {
    min_cli_version:
      typeof value.min_cli_version === "string" ? value.min_cli_version : DEFAULT_CLI_SETTINGS.min_cli_version,
    latest_core_version: typeof value.latest_core_version === "string" ? value.latest_core_version : null,
    deprecations: Array.isArray(value.deprecations) ? value.deprecations : [],
  };
}

/**
 * Where packages leave from (`platform_settings.cli.package_host`,
 * lib/cli/package-host.ts). Kept out of CliSettings, which is the public body
 * of GET /api/cli/version: the CLI never needs to know, it downloads the URL
 * it is given. Unreadable, the storage, as before.
 */
export async function readPackageHost(client: SupabaseClient): Promise<PackageHost> {
  const { data } = await client.from("platform_settings").select("value").eq("key", "cli").maybeSingle();
  return packageHostOf((data?.value as { package_host?: unknown } | null)?.package_host);
}

/**
 * The hosts a Claude Code session in the cloud allows for flyee on this
 * deployment, as the switch stands: what /instalar.md and the member area's
 * cloud block name. Read with the service client, since the `cli` setting is
 * the operator's; unreadable, the storage host is named too, which is never
 * wrong, only one address more.
 */
export async function cloudHostsNow(): Promise<string[]> {
  let host: PackageHost = "storage";
  try {
    host = await readPackageHost(createServiceClient());
  } catch {
    // No service role here (a clone, a preview without it): the safe list.
  }
  return cloudAllowedHosts(servesPackages(host));
}

/** `?locale=` when it names a site language, otherwise the member's own. */
export function requestedLocale(request: Request, fallback: CliLocale): CliLocale {
  const value = new URL(request.url).searchParams.get("locale");
  return value === "en" || value === "pt-BR" ? value : fallback;
}
