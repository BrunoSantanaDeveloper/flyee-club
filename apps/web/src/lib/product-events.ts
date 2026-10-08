"use client";

import type { ProFeature } from "@/lib/upgrade";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * What a signed-in browser may report on its own word (migration
 * 0006_product_events): only the offers it showed and the offers that were
 * clicked. Purchases, installs, executions and everything else that counts
 * toward a metric are written by the server (`lib/product-events-server.ts`),
 * so no client can inflate them.
 */
export type BrowserEventName = "upsell.viewed" | "upsell.clicked";

/** Where the offer was shown. Mirrors the `origin` allowlist of product_event_sanitize (migration 0039). */
export type OfferOrigin =
  | "home"
  | "revalidation"
  | "catalog"
  | "module"
  | "billing"
  | "menu"
  | "checkout"
  | "roadmap"
  | "recipes"
  | "meetings"
  | "devices";

/**
 * Which rung the offer was for. Mirrors the `offer` allowlist, which also keeps
 * `founders` for the events recorded before 2026-10-08.
 */
export type OfferKind = "kit" | "club" | "pro" | "mentoring" | "consulting" | "custom_app";

/**
 * An offer was shown or clicked. `offer` is omitted when the surface shows the
 * whole ladder; `feature` is the feature of FlyeeClub Pro whose click opened
 * the upgrade prompt (lib/upgrade.ts), so the operators can see what sells.
 */
export function trackOffer(
  event: BrowserEventName,
  origin: OfferOrigin,
  offer?: OfferKind,
  feature?: ProFeature,
): void {
  trackProductEvent(event, { origin, ...(offer ? { offer } : {}), ...(feature ? { feature } : {}) });
}

export function trackProductEvent(event: BrowserEventName, properties: Record<string, string> = {}): void {
  // Telemetry must never reach the user: creating the client throws when
  // Supabase is not configured, and an offer card calls this while rendering
  // its screen, so an unguarded call took the whole screen down with it.
  if (!isSupabaseConfigured) return;
  try {
    const supabase = createClient();
    // A PostgREST builder is a THENABLE: it only issues the request when it is
    // awaited or `.then()`-ed. Discarding it with `void` silently sends
    // nothing. Both handlers swallow. The database stamps segment, language
    // and AI tool from the profile and forces the platform to "web".
    void supabase
      .rpc("track_product_event", {
        target_event: event,
        target_properties: properties,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Nothing to report to: the screen goes on.
  }
}
