/**
 * The two badges of a store card (migration 0034), both from data, never
 * hand-written:
 *
 *  - "Novo": the app was first published at most `days` days ago
 *    (catalog_modules.published_at keeps the first publication; the number of
 *    days is platform_settings.catalog.new_badge_days);
 *  - "Usa sua conta X": the names of the app's REQUIRED external credentials,
 *    the services the member must have an account with. An optional one is
 *    not a requirement and gets no badge.
 *
 * Pure, shared by the home's store and /catalogo.
 */

const DAY_MS = 86_400_000;

/** The default when the setting cannot be read: a month. */
export const DEFAULT_NEW_BADGE_DAYS = 30;

export function isNewApp(firstPublishedAt: string | null | undefined, days: number, now: number = Date.now()): boolean {
  if (!firstPublishedAt || !Number.isFinite(days) || days <= 0) return false;
  const published = Date.parse(firstPublishedAt);
  if (!Number.isFinite(published) || published > now) return false;
  return now - published <= days * DAY_MS;
}

/** The services the member needs an account with, in the app's order, each once. */
export function accountServices(credentials: unknown): string[] {
  if (!Array.isArray(credentials)) return [];
  const names: string[] = [];
  for (const credential of credentials as { name?: unknown; required?: unknown }[]) {
    if (credential?.required !== true || typeof credential.name !== "string") continue;
    const name = credential.name.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** "HeyGen", "HeyGen e Apify", "HeyGen, Apify e Make": the services in one phrase, in the page's language. */
export function servicesPhrase(services: string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(services);
}
