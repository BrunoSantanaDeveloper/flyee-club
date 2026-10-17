import LocaleLink from "@/components/marketing/locale-link";
import { TONE, type Tone } from "@/components/marketing/tone";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import { cn } from "@/lib/utils";

/**
 * One app in the store carousel of the home (decided 2026-10-17: one row,
 * less on each card). What a card says: the app's icon, its name, two lines
 * of what it does, its category and, while it is new, the "Novo" badge. The
 * rest (versions, the AIs it was tested on, the accounts it uses, the
 * changelog) is on the app's page, which the whole card opens.
 *
 * The art band above takes the category's hue at a light tint, with the dot
 * matrix of the hero, and the icon (a white tile, the glyph in the hue)
 * overlaps its lower edge, so a row of cards reads as one shelf in a few calm
 * colours (the owner's references and choice, 2026-10-17).
 */
export default function AppCard({
  href,
  icon,
  name,
  summary,
  category,
  tone,
  badge,
  track,
}: {
  /** The app's page (internal Portuguese path). */
  href: string;
  /** Its <AppIcon>, size "lg". */
  icon: React.ReactNode;
  name: string;
  summary: string;
  category: string;
  tone: Tone;
  /** "Novo" while the app is new (migration 0034); none afterwards. */
  badge?: string;
  /** The site event of the click (`trackAttributes`, lib/site-events.ts). */
  track?: Record<string, string>;
}) {
  const hue = TONE[tone];
  return (
    <LocaleLink
      href={href}
      className="group border-grey-100 bg-background-paper hover:border-grey-200 focus-visible:outline-primary-ink flex h-full w-full flex-col overflow-hidden rounded-3xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      {...track}
    >
      {/* A flat light tint of the hue on a light page (the yellow, a fill, at the /20 the palette asks
          of it); on a dark page a tint turns olive, so the band is the neutral there. */}
      <div
        className="dark:bg-grey-25 relative h-24 flex-none bg-[var(--app-band)]"
        style={{ "--app-band": `hsl(var(${hue.cssVar}) / ${tone === "primary" ? 0.2 : 0.12})` } as React.CSSProperties}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--text-primary) / 0.12) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        {badge ? (
          <span className="bg-background-paper text-text-primary absolute top-3.5 right-3.5 rounded-full px-2.5 py-0.5 text-xs font-bold">
            {badge}
          </span>
        ) : null}
        <span className="absolute bottom-0 left-5 translate-y-1/2 transition-transform duration-200 group-hover:-translate-y-1/3 motion-reduce:transition-none">
          {icon}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-5 pt-11 pb-5">
        <h3 className="font-display text-text-primary m-0 text-xl leading-6 font-normal">{name}</h3>
        <p className="text-text-secondary m-0 line-clamp-2 text-sm leading-5">{summary}</p>
        <div className="mt-auto flex flex-row items-center justify-between gap-3 pt-3">
          <span className="text-text-secondary flex min-w-0 flex-row items-center gap-2 text-xs font-semibold">
            <span
              aria-hidden
              className="size-2 flex-none rounded-full"
              style={{ backgroundColor: `hsl(var(${hue.cssVar}))` }}
            />
            <span className="truncate">{category}</span>
          </span>
          {/* The hue on the arrow, the words in a text colour (no palette hue passes as small text). */}
          <NiArrowRight
            size="small"
            className={cn(
              "flex-none transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none",
              hue.text,
            )}
          />
        </div>
      </div>
    </LocaleLink>
  );
}
