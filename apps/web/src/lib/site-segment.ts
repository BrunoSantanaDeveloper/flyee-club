/**
 * The audience a member belongs to (docs/TRACKING.md, "Segment capture").
 * Since migration 0028 there is one vocabulary: the personas the public site
 * offers (`negocio`, `agencia`, `produto`, `dev`) ARE the profile's
 * `member_segment`, plus `outro`, an answer the site never offers as a
 * persona and the focus rule leaves out.
 *
 * Before any account exists, a segment link (`?segment=agencia`) or a click
 * on the page keeps the value in a cookie (the middleware, `rememberSegment`
 * in lib/site-events.ts); the waitlist, the sign-up and the onboarding read
 * it and pre-fill the segment, which the member can still change. Pure,
 * shared by the middleware, the browser and the server pages.
 */

export const SEGMENT_PARAM = "segment";

/** `profiles.segment` (migrations 0000 and 0028), in the order the site lists them. */
export const SEGMENTS = ["negocio", "agencia", "produto", "dev", "outro"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** The four the site offers as personas, and the four the focus rule compares. */
export const PERSONA_SEGMENTS = ["negocio", "agencia", "produto", "dev"] as const;

/** Ninety days: the window of the first-touch attribution cookie. */
export const SEGMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** A known segment, lower-cased, else null: an unknown value is never stored or pre-filled. */
export function normalizeSegment(value: string | null | undefined): Segment | null {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (SEGMENTS as readonly string[]).includes(candidate) ? (candidate as Segment) : null;
}
