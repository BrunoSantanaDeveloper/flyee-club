import "server-only";

import { type ProductEventName, trackServerEvent } from "@/lib/product-events-server";
import { createServiceClient } from "@flyee/auth/service";
import { limitOf } from "@flyee/billing/entitlements";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * What happens to a workspace around a billing transition, shared by the
 * provider webhook and the cron jobs (docs/BILLING.md). Service role only:
 * there is no member session behind a provider callback.
 */

/** The member a workspace's events are attributed to: its owner (one person per account). */
export async function workspaceOwner(service: ServiceClient, orgId: string): Promise<string | null> {
  const { data } = await service
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/**
 * A usage event about a workspace, attributed to its owner so segment,
 * language and AI tool are stamped from that profile. Never throws.
 */
export async function trackWorkspaceEvent(
  service: ServiceClient,
  orgId: string,
  event: ProductEventName,
  properties: Record<string, string> = {},
  occurredAt?: Date,
): Promise<void> {
  try {
    const actorId = await workspaceOwner(service, orgId);
    await trackServerEvent({ actorId, orgId, event, properties, occurredAt });
  } catch {
    // Telemetry never decides a billing outcome.
  }
}

/**
 * Whether the workspace still has catalog access after a transition. Read
 * from `org_entitlements`, the one answer every gate shares: a member who owns
 * the kit keeps access when a subscription ends; one who only subscribed does
 * not.
 */
export async function hasCatalogAccess(service: ServiceClient, orgId: string): Promise<boolean> {
  const { data, error } = await service.rpc("org_entitlements", { target_org: orgId });
  if (error) throw new Error("entitlements_read_failed");
  const value = (data ?? {}) as { active?: boolean; limits?: Record<string, unknown> };
  return Boolean(value.active) && limitOf(value.limits, "catalog_access") > 0;
}

/**
 * Revokes the CLI tokens of a workspace whose catalog access just ended
 * (docs/PRODUCT.md: tools already installed keep working, only updates stop).
 * Nothing happens while any source still grants access.
 *
 * Returns whether tokens were revoked. Throws only when the access could not
 * be read, so the caller can retry instead of leaving tokens alive by mistake.
 */
export async function revokeTokensIfAccessEnded(
  service: ServiceClient,
  orgId: string,
  reason: "canceled" | "suspended" | "admin",
): Promise<boolean> {
  if (await hasCatalogAccess(service, orgId)) return false;
  const { error } = await service.rpc("revoke_member_tokens", { target_org: orgId, target_reason: reason });
  if (error) throw new Error("token_revocation_failed");
  return true;
}
