"use client";

import { COOKIE_KEYS } from "@/constants";
import { track } from "@/lib/analytics";
import { normalizeSiteSegment, SEGMENT_COOKIE_MAX_AGE } from "@/lib/site-segment";

/**
 * The events of the public site (docs/TRACKING.md, "Site events"): the
 * vocabulary of the home brief, sent as custom events to the trackers the
 * platform already runs (GA4 and the Pixel, opt-out), never to a third one.
 * Every event is stamped with the language being read and the segment the
 * visitor declared; the campaign (`utm_*`, `origem`) is GA4's own session
 * attribution, taken from the landing URL, so it is not repeated here.
 *
 * Most clicks are DECLARED, not coded: an element carries
 * `data-track="<event>"` plus `data-track-<prop>` attributes, and one
 * listener in `MarketingAnalytics` reports it. A server component can
 * declare an event that way without becoming a client component.
 */

export type SiteEventName =
  | "section_view"
  | "cta_click"
  | "segment_click"
  | "quiz_click"
  | "store_filter"
  | "app_install_click"
  | "app_command_copy"
  | "app_card_click"
  | "locked_click"
  | "see_all_apps_click"
  | "compat_click"
  | "faq_open"
  | "contact_click";

const SITE_EVENTS = new Set<string>([
  "section_view",
  "cta_click",
  "segment_click",
  "quiz_click",
  "store_filter",
  "app_install_click",
  "app_command_copy",
  "app_card_click",
  "locked_click",
  "see_all_apps_click",
  "compat_click",
  "faq_open",
  "contact_click",
]);

export const isSiteEventName = (value: string | null | undefined): value is SiteEventName =>
  typeof value === "string" && SITE_EVENTS.has(value);

export type SiteEventProps = Record<string, string | number | null | undefined>;

/** `trackCtaId` → `cta_id`: the props an element declares as `data-track-*` attributes. */
export function datasetToEventProps(dataset: Record<string, string | undefined>): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(dataset)) {
    if (!key.startsWith("track") || key.length <= 5 || value === undefined) continue;
    const name = key
      .slice(5)
      .replace(/^[A-Z]/, (first) => first.toLowerCase())
      .replace(/[A-Z]/g, (upper) => `_${upper.toLowerCase()}`);
    props[name] = value;
  }
  return props;
}

/** The attributes that declare an event on an element (`trackAttributes({ event: "cta_click", cta_id: "hero" })`). */
export function trackAttributes(track: { event: SiteEventName } & Record<string, string>): Record<string, string> {
  const attributes: Record<string, string> = { "data-track": track.event };
  for (const [key, value] of Object.entries(track)) {
    if (key === "event") continue;
    attributes[`data-track-${key.replace(/_/g, "-")}`] = value;
  }
  return attributes;
}

/** The segment the visitor declared, from the cookie the middleware or `rememberSegment` wrote. */
export function readSegmentCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${COOKIE_KEYS.segment}=`;
  const entry = document.cookie.split("; ").find((candidate) => candidate.startsWith(prefix));
  return entry ? normalizeSiteSegment(decodeURIComponent(entry.slice(prefix.length))) : null;
}

/** A segment chosen on the page (a card, a link, the waitlist's select): the newest choice wins. */
export function rememberSegment(value: string): void {
  const segment = normalizeSiteSegment(value);
  if (!segment || typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEYS.segment}=${segment}; path=/; max-age=${SEGMENT_COOKIE_MAX_AGE}; samesite=lax`;
}

/** Fire a site event, stamped with the language and the declared segment. No-op if opted out (`track`). */
export function trackSiteEvent(name: SiteEventName, props: SiteEventProps = {}): void {
  if (typeof document === "undefined") return;
  const stamped: SiteEventProps = { ...props, locale: document.documentElement.lang || undefined };
  const segment = readSegmentCookie();
  if (segment) stamped.segment = segment;
  track(name, stamped);
}
