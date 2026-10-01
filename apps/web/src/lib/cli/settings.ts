import "server-only";

import type { CliLocale } from "@/lib/cli/messages";
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

const DEFAULTS: CliSettings = { min_cli_version: "0.1.0", latest_core_version: null, deprecations: [] };

export async function readCliSettings(service: SupabaseClient): Promise<CliSettings> {
  const { data } = await service.from("platform_settings").select("value").eq("key", "cli").maybeSingle();
  const value = (data?.value ?? {}) as Partial<CliSettings>;
  return {
    min_cli_version: typeof value.min_cli_version === "string" ? value.min_cli_version : DEFAULTS.min_cli_version,
    latest_core_version: typeof value.latest_core_version === "string" ? value.latest_core_version : null,
    deprecations: Array.isArray(value.deprecations) ? value.deprecations : [],
  };
}

/** `?locale=` when it names a site language, otherwise the member's own. */
export function requestedLocale(request: Request, fallback: CliLocale): CliLocale {
  const value = new URL(request.url).searchParams.get("locale");
  return value === "en" || value === "pt-BR" ? value : fallback;
}
