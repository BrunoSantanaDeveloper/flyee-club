import "server-only";

import { createServiceClient } from "@flyee/auth/service";

/**
 * The product_events vocabulary (migration 0006_product_events). Adding a
 * name means changing `product_event_known()` in a migration first; the
 * database drops anything it does not know.
 */
export type ProductEventName =
  | "account.created"
  | "profile.completed"
  | "checkout.started"
  | "kit.purchased"
  | "subscription.started"
  | "upsell.purchased"
  | "cli.installed"
  | "cli.login"
  | "module.installed"
  | "module.activated"
  | "tool.executed"
  | "module.updated"
  | "update.denied_token_expired"
  | "update.denied_entitlement"
  | "token.revalidated"
  | "lesson.started"
  | "lesson.completed"
  | "recipe.installed"
  | "roadmap.voted"
  | "meeting.registered"
  | "meeting.attended"
  | "upsell.viewed"
  | "upsell.clicked"
  | "subscription.cancel_requested"
  | "subscription.canceled"
  | "waitlist.joined"
  | "device.revoked";

export type ServerEventInput = {
  /** The member the event is about; null for events without an account (a waitlist confirmation). */
  actorId: string | null;
  /** Defaults to the actor's workspace. */
  orgId?: string | null;
  event: ProductEventName;
  /**
   * Only the allowlisted keys and values survive (product_event_sanitize):
   * module, trail, version, os, ai_tool, reason, origin, offer and the rest.
   * Never content: no code, prompts, paths or free text.
   */
  properties?: Record<string, string>;
  /** When it happened, if it was not now (a CLI batch delivered late). */
  occurredAt?: Date;
  /** `cli` for events the CLI reported, `server` for everything else. */
  platform?: "cli" | "server";
};

/**
 * Records an event from the backend, with the service role. Segment, language
 * and AI tool are stamped from the actor's profile by the database.
 *
 * Never throws: telemetry must not break the request that produced it.
 * Resolves to false when the event was not recorded (no service key, unknown
 * event, the actor over the hourly ceiling, an RPC error).
 */
export async function trackServerEvent(input: ServerEventInput): Promise<boolean> {
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc("track_product_event_server", {
      target_actor: input.actorId,
      target_org: input.orgId ?? null,
      target_event: input.event,
      target_properties: input.properties ?? {},
      target_occurred_at: input.occurredAt ? input.occurredAt.toISOString() : null,
      target_platform: input.platform ?? "server",
    });
    if (error) {
      console.warn("[product-events] not recorded:", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.warn("[product-events] not recorded:", error instanceof Error ? error.message : error);
    return false;
  }
}
