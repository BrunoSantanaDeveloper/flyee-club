import "server-only";

import type { UpsellFacts } from "@/lib/upsell";
import { createServiceClient } from "@flyee/auth/service";
import type { Tier } from "@flyee/billing/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The facts `decideUpsell` needs, for one workspace.
 *
 * Tool executions live in `product_events`, which only the platform operator
 * reads, so that one count goes through the service role, scoped to the
 * workspace the SESSION belongs to (the caller passes the org it read from
 * the session, never from the request). The rest is the member's own data.
 */
export async function loadUpsellFacts(
  supabase: SupabaseClient,
  input: { orgId: string; tier: Tier | null },
): Promise<UpsellFacts> {
  const facts: UpsellFacts = { tier: input.tier, trailsUsed30d: 0, hasClientProject: false };
  if (!input.tier) return facts;

  const { count } = await supabase
    .from("member_devices")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .eq("project_kind", "client")
    .is("revoked_at", null);
  facts.hasClientProject = (count ?? 0) > 0;

  try {
    const service = createServiceClient();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: events } = await service
      .from("product_events")
      .select("properties")
      .eq("org_id", input.orgId)
      .eq("event_name", "tool.executed")
      .gte("created_at", since)
      .limit(2000);
    const trails = new Set<string>();
    const modules = new Set<string>();
    for (const row of (events ?? []) as { properties: Record<string, string> | null }[]) {
      if (row.properties?.trail) trails.add(row.properties.trail);
      else if (row.properties?.module) modules.add(row.properties.module);
    }
    if (modules.size > 0) {
      const { data: rows } = await service
        .from("catalog_modules")
        .select("trail")
        .in("slug", [...modules]);
      for (const row of (rows ?? []) as { trail: string }[]) trails.add(row.trail);
    }
    facts.trailsUsed30d = trails.size;
  } catch {
    // Without the service role the broad-use offer simply never shows.
  }
  return facts;
}
