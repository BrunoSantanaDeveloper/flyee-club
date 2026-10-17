import LocaleLink from "@/components/marketing/locale-link";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone } from "@/components/marketing/tone";
import NiCross from "@/icons/nexture/ni-cross";
import { cn } from "@/lib/utils";

export type PersonaStarter = {
  slug: string;
  name: string;
  /** The app's <AppIcon size="xs">. */
  icon: React.ReactNode;
  href: string;
  track?: Record<string, string>;
};

export type Persona = {
  /** The segment (`negocio`, `agencia`, `produto`, `dev`); the card's anchor is `<id>-<segment>`. */
  segment: string;
  name: string;
  text: string;
  /** A meaningful concept icon (@/icons/nexture/ni-*), in the persona's hue. */
  icon: React.ReactNode;
  tone: Tone;
  /** The apps marked a good start for this persona (lib/catalog/starters.ts); none hides the row. */
  starters: PersonaStarter[];
  /** The persona a `?segment=` link arrived with: its card shows ringed. */
  chosen?: boolean;
};

/**
 * The home brief's "Para quem é" (docs/HOME-COPY.md, section 7.8 of the
 * brief): one card per persona of the site, each with what that reader does
 * and, when the operator marked any, the published apps to start with (at most
 * three, migration 0032); then what the club is not for.
 *
 * Measurement is the point of the block (the brief's second objective, which
 * segment buys): a click anywhere on a card is `segment_click` with
 * `location: "who_for"`, and the one listener of MarketingAnalytics keeps the
 * segment for the waitlist and the sign-up. Each card is an anchor
 * (`#<id>-<segment>`): the segment links of the hero lead to it and the card
 * shows ringed while it is the target, as does the card of a `?segment=` link.
 * Server-rendered, no script of its own.
 */
export default function PersonaGrid({
  id,
  track,
  eyebrow,
  title,
  appsLabel,
  personas,
  notForYou,
}: {
  id: string;
  /** The section's key in the measurement (`section_view`). */
  track?: string;
  eyebrow?: string;
  title: string;
  /** The label over each card's apps ("Apps para começar"). */
  appsLabel: string;
  personas: Persona[];
  notForYou?: { title: string; items: string[] };
}) {
  return (
    <Section id={id} track={track}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <Reveal stagger={0.08} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {personas.map((persona) => {
          const tone = TONE[persona.tone];
          return (
            <article
              key={persona.segment}
              id={`${id}-${persona.segment}`}
              data-track="segment_click"
              data-track-segment={persona.segment}
              data-track-location="who_for"
              className={cn(
                "border-grey-100 bg-background-paper flex scroll-mt-28 flex-col rounded-3xl border p-7 md:p-8",
                "target:ring-primary-ink target:ring-2",
                persona.chosen && "ring-primary-ink ring-2",
              )}
            >
              <div className="flex flex-row items-center gap-4">
                <span
                  aria-hidden
                  className={cn(
                    "inline-grid h-12 w-12 flex-none place-items-center rounded-2xl",
                    tone.softBg,
                    tone.text,
                  )}
                >
                  {persona.icon}
                </span>
                <h3 className="font-display text-text-primary m-0 text-xl leading-6 font-normal">{persona.name}</h3>
              </div>
              <p className="text-text-secondary m-0 mt-4 text-base leading-7">{persona.text}</p>
              {persona.starters.length > 0 ? (
                <div className="mt-auto pt-6">
                  <p className="text-text-secondary m-0 text-xs font-semibold tracking-wide uppercase">{appsLabel}</p>
                  <ul className="m-0 mt-3 flex list-none flex-row flex-wrap gap-2 p-0">
                    {persona.starters.map((app) => (
                      <li key={app.slug}>
                        <LocaleLink
                          href={app.href}
                          className="border-grey-100 hover:border-grey-200 text-text-primary focus-visible:outline-primary-ink inline-flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                          {...app.track}
                        >
                          {app.icon}
                          {app.name}
                        </LocaleLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </Reveal>
      {notForYou && notForYou.items.length > 0 ? (
        <div className="border-grey-200 mt-8 rounded-3xl border border-dashed p-7 md:p-8">
          <h3 className="font-display text-text-primary m-0 text-xl leading-6 font-normal">{notForYou.title}</h3>
          <ul className="m-0 mt-5 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3 md:gap-6">
            {notForYou.items.map((item) => (
              <li key={item} className="text-text-secondary flex flex-row items-start gap-2.5 text-base leading-6">
                <NiCross size="small" className="text-text-secondary mt-1 flex-none" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
