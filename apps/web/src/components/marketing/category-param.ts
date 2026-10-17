/**
 * The store's category in the address (docs/HOME-COPY.md, "Barra de
 * categorias": the filter updates `?cat=` without scrolling, and a page that
 * opens with `?cat=` comes filtered). Shared by the row of the home
 * (`AppCarousel`) and the grid of /catalogo (`StoreGrid`). Pure, no "use
 * client": the components call it in the browser and tests import it.
 */

export const CATEGORY_PARAM = "cat";

/** The category an address names, when it is one the store shows; anything else is no filter. */
export function categoryFromSearch(search: string, slugs: readonly string[]): string | null {
  const value = new URLSearchParams(search).get(CATEGORY_PARAM);
  return value && slugs.includes(value) ? value : null;
}

/** The same address with `?cat=` set to the chosen category, or without it for "Todos"; the rest stays. */
export function addressWithCategory(href: string, slug: string | null): string {
  const url = new URL(href);
  if (slug) url.searchParams.set(CATEGORY_PARAM, slug);
  else url.searchParams.delete(CATEGORY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
