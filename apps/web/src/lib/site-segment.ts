/**
 * The audience a visitor said they belong to, before any account exists
 * (docs/TRACKING.md, "Segment capture"). Two vocabularies meet here:
 *
 *  - the public personas of the home brief, the ids a segment link or card
 *    carries (`?segment=agencia`): `negocio`, `agencia`, `produto`, `dev`;
 *  - the profile's `member_segment` enum, what the metrics are cut by.
 *
 * The value is kept as given in a cookie the middleware writes from the URL
 * and the browser writes on a click; the sign-up and the onboarding read it
 * and PRE-FILL the profile segment where the two vocabularies agree. Where
 * they do not (`negocio` has no honest counterpart yet), nothing is guessed:
 * the member answers the question. Pure, shared by the middleware, the
 * browser and the server pages.
 */

export const SEGMENT_PARAM = "segment";

/** The brief's public personas. */
export const SITE_SEGMENTS = ["negocio", "agencia", "produto", "dev"] as const;
export type SiteSegment = (typeof SITE_SEGMENTS)[number];

/** `profiles.segment` (migration 0000). */
export const PROFILE_SEGMENTS = ["produto_proprio", "freelancer_agencia", "profissional_ia", "dev", "outro"] as const;
export type ProfileSegment = (typeof PROFILE_SEGMENTS)[number];

/** Ninety days: the window of the first-touch attribution cookie. */
export const SEGMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** A value one of the two vocabularies knows, lower-cased, else null. */
export function normalizeSiteSegment(value: string | null | undefined): SiteSegment | ProfileSegment | null {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  if ((SITE_SEGMENTS as readonly string[]).includes(candidate)) return candidate as SiteSegment;
  if ((PROFILE_SEGMENTS as readonly string[]).includes(candidate)) return candidate as ProfileSegment;
  return null;
}

/** The persona → profile segment pairs that mean the same thing. */
const PERSONA_TO_PROFILE: Partial<Record<SiteSegment, ProfileSegment>> = {
  agencia: "freelancer_agencia",
  produto: "produto_proprio",
  dev: "dev",
};

/**
 * The profile segment a captured value pre-fills, or null when the value is
 * unknown or has no honest counterpart (the member chooses).
 */
export function profileSegmentFor(value: string | null | undefined): ProfileSegment | null {
  const known = normalizeSiteSegment(value);
  if (!known) return null;
  if ((PROFILE_SEGMENTS as readonly string[]).includes(known)) return known as ProfileSegment;
  return PERSONA_TO_PROFILE[known as SiteSegment] ?? null;
}
