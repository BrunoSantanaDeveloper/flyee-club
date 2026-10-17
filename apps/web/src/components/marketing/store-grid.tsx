"use client";

import { addressWithCategory, categoryFromSearch } from "./category-param";
import { useEffect, useState } from "react";

import { TONE, type Tone } from "@/components/marketing/tone";
import { trackSiteEvent } from "@/lib/site-events";
import { cn } from "@/lib/utils";

export type StoreCategory = {
  slug: string;
  label: string;
  tone: Tone;
  /** One line shown under the chips while this category is selected. */
  description?: string | null;
};

export type StoreGridItem = {
  key: string;
  /** The category the card belongs to; null shows under every filter (the request card). */
  category: string | null;
  /** Usually a <RuledCard> rendered on the server. */
  card: React.ReactNode;
};

/**
 * The app store grid with its category filter (docs/HOME-COPY.md: "As
 * categorias filtram a grade"). Every card is rendered on the server and stays
 * in the HTML, so crawlers and readers without JavaScript get the whole store;
 * the chips only hide the cards of the other categories. The chips are real
 * buttons with `aria-pressed`, and the selected one is the inverted chip.
 *
 * Closest library pieces: the chip row of the waitlist bento and the cards of
 * <RuledGrid>. Nothing existing filtered, and a store with a few apps per
 * category laid out as one section per category left most of the page empty.
 */
export default function StoreGrid({
  label,
  allLabel,
  categories,
  items,
  columns = 4,
}: {
  /** What the chip group filters, for assistive technology. */
  label: string;
  allLabel: string;
  categories: StoreCategory[];
  items: StoreGridItem[];
  columns?: 3 | 4;
}) {
  const [active, setActive] = useState<string | null>(null);
  const current = categories.find((category) => category.slug === active) ?? null;

  // An address with `?cat=` opens the grid filtered (category-param.ts); no event, nobody chose yet.
  const slugs = categories.map((category) => category.slug).join(",");
  useEffect(() => {
    const named = categoryFromSearch(window.location.search, slugs.split(","));
    if (named) setActive(named);
  }, [slugs]);

  // A category chosen (or cleared) is a site event and goes to the address, without scrolling the
  // page; re-pressing the active chip clears it.
  const choose = (slug: string | null) => {
    setActive(slug);
    trackSiteEvent("store_filter", { category: slug ?? "all" });
    window.history.replaceState(null, "", addressWithCategory(window.location.href, slug));
  };

  const chip = (selected: boolean, tone?: Tone) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
      selected
        ? "bg-text-primary text-background-paper"
        : cn("text-text-primary hover:underline", tone && TONE[tone].softBg),
    );

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={label} className="flex flex-row flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={active === null}
          onClick={() => choose(null)}
          className={chip(active === null)}
        >
          {allLabel}
        </button>
        {categories.map((category) => (
          <button
            key={category.slug}
            type="button"
            aria-pressed={active === category.slug}
            onClick={() => choose(active === category.slug ? null : category.slug)}
            className={chip(active === category.slug, category.tone)}
          >
            {category.label}
          </button>
        ))}
      </div>
      {current?.description ? (
        <p className="text-text-secondary m-0 text-base leading-6" aria-live="polite">
          {current.description}
        </p>
      ) : null}
      <ul
        className={cn(
          "m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2",
          columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {items.map((item) => {
          const shown = active === null || item.category === null || item.category === active;
          return (
            <li key={item.key} className={shown ? "flex" : "hidden"}>
              {item.card}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
