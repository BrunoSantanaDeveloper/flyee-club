import ContactForm from "./contact-form";
import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return {
    title: t("contact-meta-title"),
    description: t("contact-meta-description"),
    ...publicPageMetadata({ path: "/contato", locale }),
  };
}

/**
 * Message the form opens with, per known `?assunto=`.
 *
 * An ALLOWLIST, never the raw parameter: the query string is written by whoever
 * sends the link, and echoing it into the body of an e-mail the operation reads
 * would let a stranger compose that e-mail. Unknown values are ignored.
 *
 * The first entry comes from the closed state of `/fundadores`, which says
 * "fale com a gente" to someone who arrived after the seats ran out: landing
 * them on an empty form made them explain from scratch what they were
 * answering. The others are the services sold on demand (a custom app,
 * mentoring, consulting), offered in the member's home and on the roadmap.
 * Each value is a `marketing` key, so the message opens in the language
 * being read.
 */
/**
 * What the visitor must read before writing about a subject, per known
 * `?assunto=`: a commissioned app is public by default (terms of use,
 * version 4), so whoever asks for one reads it here, before any price.
 */
const SUBJECT_NOTE: Record<string, string> = {
  app: "contact-note-app",
};

const SUBJECT_PREFILL: Record<string, string> = {
  fundadores: "contact-prefill-fundadores",
  app: "contact-prefill-app",
  mentoria: "contact-prefill-mentoria",
  consultoria: "contact-prefill-consultoria",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("marketing");
  const params = await searchParams;
  const subject = typeof params.assunto === "string" ? params.assunto : "";

  return (
    <Section spacing="compact">
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("nav-contact"), path: "/contato" }]} />
      <SectionHeader title={t("contact-title")} subtitle={t("contact-subtitle")} as="h1" />
      {SUBJECT_NOTE[subject] ? (
        <p className="text-text-secondary mx-auto mb-8 max-w-2xl text-center text-base leading-7">
          {t(SUBJECT_NOTE[subject])}
        </p>
      ) : null}
      <Reveal>
        <ContactForm initialMessage={SUBJECT_PREFILL[subject] ? t(SUBJECT_PREFILL[subject]) : ""} />
      </Reveal>
    </Section>
  );
}
