import { storeCategoryTone, type Tone, trailTone } from "@/components/marketing/tone";

/**
 * How an app shows in the public store, the home and /catalogo: its store
 * category's name and hue when it has one (migration 0029), its stage's
 * otherwise, so a card is never blank. The chips are the store categories
 * that hold at least one of the apps shown, in their order. Pure.
 */

export type StoreLook = { name: string; tone: Tone };

type Trail = { slug: string; name: string | null };
type Category = { slug: string; name: string };
type StoreApp = { trail: string; storeCategory: string | null };

export function storeLook(catalog: { trails: Trail[]; storeCategories: Category[] }) {
  const trails = new Map(
    catalog.trails.map((trail, index) => [
      trail.slug,
      { name: trail.name ?? trail.slug, tone: trailTone(trail.slug, index) },
    ]),
  );
  const categories = new Map(
    catalog.storeCategories.map((category, index) => [
      category.slug,
      { name: category.name, tone: storeCategoryTone(category.slug, index) },
    ]),
  );

  const lookOf = (app: StoreApp): StoreLook =>
    (app.storeCategory ? categories.get(app.storeCategory) : undefined) ??
    trails.get(app.trail) ?? { name: app.trail, tone: "accent-1" };

  const chipsFor = (apps: StoreApp[]) =>
    catalog.storeCategories
      .filter((category) => apps.some((app) => app.storeCategory === category.slug))
      .map((category) => ({
        slug: category.slug,
        label: category.name,
        tone: categories.get(category.slug)?.tone ?? ("accent-1" as Tone),
      }));

  /** The categories no app is in yet, to name them instead of padding the grid. */
  const emptyFor = (apps: StoreApp[]) =>
    catalog.storeCategories.filter((category) => !apps.some((app) => app.storeCategory === category.slug));

  /** Store order: by category order (uncategorized last), then by stage order. */
  const categoryRank = new Map(catalog.storeCategories.map((category, index) => [category.slug, index]));
  const trailRank = new Map(catalog.trails.map((trail, index) => [trail.slug, index]));
  const sort = <T extends StoreApp>(apps: T[]): T[] =>
    [...apps].sort(
      (a, b) =>
        (categoryRank.get(a.storeCategory ?? "") ?? 99) - (categoryRank.get(b.storeCategory ?? "") ?? 99) ||
        (trailRank.get(a.trail) ?? 99) - (trailRank.get(b.trail) ?? 99),
    );

  return { lookOf, chipsFor, emptyFor, sort };
}
