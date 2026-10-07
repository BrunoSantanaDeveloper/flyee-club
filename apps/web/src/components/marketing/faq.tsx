import JsonLd from "@/components/marketing/json-ld";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import SiteButton from "@/components/site/button";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";

export type FaqItem = { question: string; answer: string; id?: string };

/**
 * Funnel stage: objection handling. Each question should be a REAL purchase
 * objection (price, migration, security, lock-in), answered plainly.
 *
 * Emits FAQPage structured data from the same `items`: an eligible rich
 * result and a strong AI-search signal, with nothing for the page to remember.
 *
 * `layout="split"`: sticky intro column (eyebrow, title, subtitle, CTA link)
 * beside the list, the home treatment; "stack" keeps the classic centered
 * list for quieter pages.
 *
 * Each question is a native `<details>`: it opens with the keyboard and with
 * no script, the answers are in the HTML a crawler reads, and the component
 * renders on the server. Opening one is the site event `faq_open`, declared
 * on the `<summary>` and reported by the one listener of MarketingAnalytics
 * (`data-when="opening"`: closing a question is not an event).
 */
export default function Faq({
  eyebrow,
  title,
  subtitle,
  items,
  id,
  track,
  layout = "stack",
  link,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: FaqItem[];
  id?: string;
  /** The section's key in the measurement (`section_view`). */
  track?: string;
  layout?: "stack" | "split";
  /** Split layout only: conversion link under the intro (repeats the page CTA). */
  link?: { label: string; href: string };
}) {
  const questions = (
    <Reveal className="flex w-full flex-col gap-2">
      {items.map((item, index) => (
        <details key={item.question} className="site-disclosure">
          <summary data-track="faq_open" data-track-question-id={item.id ?? String(index + 1)} data-when="opening">
            <h3 className="site-disclosure-title">{item.question}</h3>
            <span className="site-disclosure-icon" aria-hidden>
              <NiChevronDownSmall />
            </span>
          </summary>
          <p className="site-disclosure-body">{item.answer}</p>
        </details>
      ))}
    </Reveal>
  );

  const structuredData = (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );

  if (layout === "split") {
    return (
      <Section id={id} track={track}>
        {structuredData}
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[0.6fr_1fr] md:gap-16">
          <div className="md:sticky md:top-28">
            <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} align="start" className="mb-0 md:mb-0" />
            {link && (
              <SiteButton variant="pastel" href={link.href} className="mt-6">
                {link.label}
              </SiteButton>
            )}
          </div>
          {questions}
        </div>
      </Section>
    );
  }

  return (
    <Section id={id} track={track}>
      {structuredData}
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mx-auto w-full max-w-3xl">{questions}</div>
    </Section>
  );
}
