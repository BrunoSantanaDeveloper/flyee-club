import { PERSONA_SEGMENTS } from "@/lib/site-segment";

/**
 * The apps to start with, per persona of the site, for the home brief's
 * "Para quem é" block (migration 0032): the published apps the operator marked
 * for that persona, in the catalog's own order, at most three. A persona no
 * app is marked for gets none, so the block shows its text without chips
 * rather than an app nobody published. Pure.
 */

export const STARTERS_PER_PERSONA = 3;

type Persona = (typeof PERSONA_SEGMENTS)[number];

export function startersFor<T extends { personas: string[] }>(
  apps: T[],
  persona: Persona,
  limit = STARTERS_PER_PERSONA,
): T[] {
  return apps.filter((app) => app.personas.includes(persona)).slice(0, Math.max(0, limit));
}

/** Every persona with its starters, in the site's order. */
export function startersByPersona<T extends { personas: string[] }>(apps: T[]): { persona: Persona; apps: T[] }[] {
  return PERSONA_SEGMENTS.map((persona) => ({ persona, apps: startersFor(apps, persona) }));
}
