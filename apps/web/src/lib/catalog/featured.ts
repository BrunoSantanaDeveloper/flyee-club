/**
 * The featured app of the home's store (docs/HOME-COPY.md, "App em destaque",
 * "trocado a cada lançamento"). The home's copy names it and the owner swaps
 * it at a launch; its example of answering a request is data of the app
 * (catalog_modules.showcase, migration 0043), sent by the product. When the
 * named app is not in the catalog of the language being read (not published
 * yet, no text in that language, renamed), the slot goes to the app updated
 * last, from the real release dates. /catalogo picks among the apps that have
 * an example the same way.
 * Pure.
 */
type Listed = { slug: string; latest?: { published_at?: string | null } | null };

export function pickFeatured<App extends Listed>(apps: App[], named?: string | null): App | null {
  const chosen = named ? apps.find((app) => app.slug === named) : undefined;
  if (chosen) return chosen;
  return (
    [...apps]
      .filter((app) => app.latest?.published_at)
      .sort((a, b) => Date.parse(b.latest?.published_at ?? "") - Date.parse(a.latest?.published_at ?? ""))[0] ?? null
  );
}
