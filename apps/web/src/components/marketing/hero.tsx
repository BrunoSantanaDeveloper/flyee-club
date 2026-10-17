import Eyebrow from "@/components/marketing/eyebrow";
import LocaleLink from "@/components/marketing/locale-link";
import Section from "@/components/marketing/section";
import SiteButton from "@/components/site/button";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";

export type HeroCta = { label: string; href: string; icon?: React.ReactNode };

/** The pill above the title that leads to one thing (the featured app, docs/HOME-COPY.md, "Selo"). */
export type HeroBadge = {
  /** The short word in the yellow chip ("Novo", "Em destaque"). */
  tag: string;
  label: string;
  /** Internal Portuguese path. */
  href: string;
  /** The site event of the click (`trackAttributes`, lib/site-events.ts). */
  track?: Record<string, string>;
};

/** The badge: a bordered pill, the tag as a yellow chip with the charcoal label, the arrow in the ink. */
function Badge({ badge }: { badge: HeroBadge }) {
  return (
    <LocaleLink
      href={badge.href}
      className="group border-grey-100 bg-background-paper hover:border-grey-200 focus-visible:outline-primary-ink inline-flex max-w-full items-center gap-2.5 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      {...badge.track}
    >
      <span className="bg-primary text-primary-contrast flex-none rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase">
        {badge.tag}
      </span>
      <span className="text-text-primary truncate font-semibold">{badge.label}</span>
      <NiArrowRight
        size="small"
        className="text-primary-ink flex-none transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </LocaleLink>
  );
}

/**
 * Funnel stage: attention + value proposition. Above the fold it must answer
 * what the product is, for whom, and the outcome — before any scrolling.
 * `media` is the product-as-proof slot (usually <ProductFrame> with a real
 * screenshot); the primary CTA label is THE conversion action of the page.
 *
 * Entrance is the page's ONE orchestrated motion moment (committed direction):
 * copy staggers in, then the media rises — a load sequence, not a scroll
 * reveal. It is CSS (style/layout/marketing-motion.css, keyed on `data-hero`),
 * so it starts with the first paint instead of after hydration, and this
 * component needs no script. Reduced motion renders everything static and
 * visible.
 */
export default function Hero({
  eyebrow,
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  action,
  note,
  highlights,
  strip,
  media,
  layout = "center",
  decor = "glow",
  track,
}: {
  eyebrow?: string;
  /** Center layout: a pill link in place of the eyebrow (the featured app of the home). */
  badge?: HeroBadge;
  /** The section's key in the measurement (`section_view`). */
  track?: string;
  /** Accepts rich content (e.g. t.rich with <em> for the two-tone blueprint headline). */
  title: React.ReactNode;
  /** Text, or text with links in it (the segments of the home, each a link to its persona). */
  subtitle: React.ReactNode;
  /** The page's conversion action. Required unless `action` replaces the buttons. */
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  /**
   * Replaces the CTA buttons with the conversion itself when it fits in the
   * hero (the waitlist form). It joins the copy column, so it enters with the
   * load timeline like the buttons would.
   */
  action?: React.ReactNode;
  /** Risk-reducing microcopy under the CTAs (e.g. "No card required"). */
  note?: string;
  /**
   * Short reassurance chips under the copy ("Bilíngue", "Na IA que você já
   * usa"…). Split layout only; rendered as a hairline-topped row.
   */
  highlights?: string[];
  /**
   * Center layout only: a quiet "works with" line between the actions and the
   * media: a label, then each item as its mark in one colour (the AIs the apps
   * run on, components/marketing/ai-marks.tsx; docs/DESIGN.md, "Imagery"), or
   * as a muted wordmark when it has no mark. The mark carries the name for
   * assistive technology and as a tooltip.
   */
  strip?: { label: string; items: { name: string; mark?: React.ReactNode }[] };
  /** Product evidence. Required in practice — a hero without it fails the premium bar. */
  media?: React.ReactNode;
  /** "center": stacked, media below. "split": copy left, media right (data/product-heavy pages). */
  layout?: "center" | "split";
  decor?: "glow" | "grid" | "none";
}) {
  // How many lines the copy column renders, for the delay of the media.
  const extra = layout === "split" ? highlights?.length : strip?.items.length;
  const lines = [eyebrow ?? badge, title, subtitle, true, note, extra].filter(Boolean).length;
  const entrance = { "--hero-media-delay": `${((lines - 1) * 0.12 + 0.25).toFixed(2)}s` } as React.CSSProperties;

  const ctas = action ?? (
    <div className="flex flex-col items-center gap-2 sm:flex-row">
      {primaryCta && (
        <SiteButton
          size="large"
          variant="contained"
          href={primaryCta.href}
          data-track="cta_click"
          data-track-cta-id="hero"
        >
          {primaryCta.label}
        </SiteButton>
      )}
      {secondaryCta && (
        <SiteButton
          size="large"
          variant="pastel"
          href={secondaryCta.href}
          startIcon={secondaryCta.icon}
          data-track="quiz_click"
          data-track-location="hero"
        >
          {secondaryCta.label}
        </SiteButton>
      )}
    </div>
  );

  const noteLine = note ? <p className="text-text-secondary -mt-2 text-sm">{note}</p> : null;

  if (layout === "split") {
    return (
      <Section spacing="default" decor={decor} className="overflow-hidden" track={track}>
        {/* 0.84/1.16 = the blueprint's copy/visual ratio (attachment hero). */}
        <div
          data-hero
          style={entrance}
          className="grid grid-cols-1 items-center gap-10 md:grid-cols-[0.84fr_1.16fr] md:gap-10"
        >
          <div data-hero-copy className="flex flex-col items-start gap-6 text-left">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h1 className="font-display text-display-xl text-text-primary site-emphasis font-extrabold">{title}</h1>
            <p className="text-text-secondary text-lg leading-6 md:text-xl md:leading-7">{subtitle}</p>
            {ctas}
            {noteLine}
            {highlights && highlights.length > 0 && (
              <ul className="border-grey-100 flex w-full flex-wrap gap-x-5 gap-y-2 border-t pt-4">
                {highlights.map((item) => (
                  <li key={item} className="text-text-secondary flex items-center gap-1.5 text-sm font-semibold">
                    <span aria-hidden className="bg-accent-1 h-1.5 w-1.5 flex-none rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {media && (
            <div data-hero-media className="w-full">
              {media}
            </div>
          )}
        </div>
      </Section>
    );
  }

  return (
    <Section spacing="default" decor={decor} className="overflow-hidden" track={track}>
      <div data-hero style={entrance} className="flex flex-col items-center">
        <div data-hero-copy className="flex flex-col items-center gap-6 text-center">
          {badge ? <Badge badge={badge} /> : eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

          {/* display-xl over a wider measure: the title takes two lines and the
              product below it starts above the fold (docs/HOME-COPY.md). */}
          <h1 className="font-display text-display-xl text-text-primary site-emphasis max-w-5xl font-extrabold">
            {title}
          </h1>

          <p className="text-text-secondary max-w-2xl text-lg leading-6 md:text-xl md:leading-7">{subtitle}</p>

          {ctas}
          {noteLine}
          {strip && strip.items.length > 0 && (
            <div className="mt-2 flex flex-col items-center gap-3">
              <p className="text-text-secondary text-sm">{strip.label}</p>
              <ul
                aria-label={strip.label}
                className="m-0 flex list-none flex-row flex-wrap items-center justify-center gap-x-9 gap-y-3 p-0"
              >
                {strip.items.map((item) =>
                  item.mark ? (
                    // One standard for every mark: one colour, one height, the hover in the text colour.
                    <li
                      key={item.name}
                      className="text-text-secondary hover:text-text-primary flex size-7 items-center justify-center transition-colors"
                    >
                      {item.mark}
                    </li>
                  ) : (
                    <li key={item.name} className="text-text-secondary font-heading text-xl font-normal tracking-tight">
                      {item.name}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>

        {media && (
          <div data-hero-media className="mt-10 w-full max-w-4xl">
            {media}
          </div>
        )}
      </div>
    </Section>
  );
}
