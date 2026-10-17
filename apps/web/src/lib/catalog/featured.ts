/**
 * The featured app of the home's store (docs/HOME-COPY.md, "App em destaque",
 * "trocado a cada lançamento"). The home's copy names it, because the copy
 * carries the example of that app answering a request (the featured
 * showcase); the owner swaps the two together at a launch. When the named app
 * is not in the catalog of the language being read (not published yet, no
 * text in that language, renamed), the slot goes to the app updated last, from
 * the real release dates, and shows what that app does instead of an example.
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
