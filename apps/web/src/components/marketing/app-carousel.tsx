"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { StoreCategory } from "@/components/marketing/store-grid";
import { TONE, type Tone } from "@/components/marketing/tone";
import { SiteIconButton } from "@/components/site/button";
import NiChevronLeft from "@/icons/nexture/ni-chevron-left";
import NiChevronRight from "@/icons/nexture/ni-chevron-right";
import { trackSiteEvent } from "@/lib/site-events";
import { cn } from "@/lib/utils";

export type AppCarouselItem = {
  key: string;
  /** The store category the app is in; null shows only under "Todos". */
  category: string | null;
  /** Usually an <AppCard>, rendered on the server. */
  card: React.ReactNode;
};

/**
 * The store of the home in one row (decided 2026-10-17, from the owner's
 * references): the category chips, then the apps side by side in a strip
 * that scrolls sideways, with a button on each side. Four cards show on a
 * computer, two on a tablet, and on a phone one and the edge of the next,
 * which says there is more before anyone reads a word.
 *
 * Every card is rendered on the server and stays in the HTML (crawlers and
 * readers without JavaScript get the whole store); the chips only hide the
 * cards of the other categories, as in <StoreGrid>, and bring the strip back
 * to its start. The strip is a native scroller: a finger, a trackpad, the
 * keyboard (it takes focus) and the buttons all move it, and it snaps to a
 * card. The buttons scroll one card and switch off at the ends.
 */
export default function AppCarousel({
  label,
  chipsLabel,
  allLabel,
  previousLabel,
  nextLabel,
  categories,
  items,
}: {
  /** What the strip lists, for assistive technology. */
  label: string;
  /** What the chip group filters. */
  chipsLabel: string;
  allLabel: string;
  previousLabel: string;
  nextLabel: string;
  categories: StoreCategory[];
  items: AppCarouselItem[];
}) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const node = track.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft <= 4,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    node.addEventListener("scroll", schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(node);
    return () => {
      node.removeEventListener("scroll", schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [measure]);

  // A category chosen (or cleared) is a site event; re-pressing the active chip clears it.
  const choose = (slug: string | null) => {
    setActive(slug);
    trackSiteEvent("store_filter", { category: slug ?? "all" });
    track.current?.scrollTo({ left: 0 });
    requestAnimationFrame(measure);
  };

  const scroll = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("li[data-shown]");
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    const step = card ? card.offsetWidth + gap : node.clientWidth;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({ left: direction * step, behavior: smooth ? "smooth" : "auto" });
  };

  const chip = (selected: boolean, tone?: Tone) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
      selected
        ? "bg-text-primary text-background-paper"
        : cn("text-text-primary hover:underline", tone && TONE[tone].softBg),
    );

  const arrow =
    "border-grey-200 bg-background-paper size-11 rounded-full border disabled:cursor-default disabled:opacity-40";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-center justify-between gap-4">
        {categories.length > 0 ? (
          <div role="group" aria-label={chipsLabel} className="flex flex-row flex-wrap gap-2">
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
        ) : (
          <span />
        )}
        <div className="hidden flex-row gap-2 sm:flex">
          <SiteIconButton
            aria-label={previousLabel}
            className={arrow}
            disabled={edges.start}
            onClick={() => scroll(-1)}
          >
            <NiChevronLeft size="medium" />
          </SiteIconButton>
          <SiteIconButton aria-label={nextLabel} className={arrow} disabled={edges.end} onClick={() => scroll(1)}>
            <NiChevronRight size="medium" />
          </SiteIconButton>
        </div>
      </div>

      {/* On a phone the strip reaches the screen's edges, so the next card shows past the margin. */}
      <ul
        ref={track}
        aria-label={label}
        tabIndex={0}
        className="focus-visible:outline-primary-ink -mx-[var(--container-px)] my-0 flex snap-x snap-mandatory scroll-px-[var(--container-px)] list-none gap-5 overflow-x-auto px-[var(--container-px)] pt-1 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {items.map((item) => {
          const shown = active === null || item.category === active;
          return (
            <li
              key={item.key}
              data-shown={shown ? "" : undefined}
              className={cn(
                "w-4/5 flex-none snap-start sm:w-[calc((100%_-_var(--spacing)*5)/2)] lg:w-[calc((100%_-_var(--spacing)*15)/4)]",
                shown ? "flex" : "hidden",
              )}
            >
              {item.card}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
