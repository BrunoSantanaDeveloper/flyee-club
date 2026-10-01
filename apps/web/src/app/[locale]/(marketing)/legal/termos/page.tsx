import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Prose from "@/components/marketing/prose";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return { title: t("terms-meta-title"), ...publicPageMetadata({ path: "/legal/termos", locale }) };
}

/**
 * Terms of use.
 *
 * Clause 1 identifies the contracting entity (marketing namespace,
 * `terms-1-body`) — an offer page that takes money has to say who is selling.
 *
 * Reviewed by counsel; this text is the approved wording. Any edit beyond a
 * typo is a new legal review, not a copy change. Still open on the engineering
 * side: versioned acceptance, which can be wired to the consent terms in
 * packages/audit.
 */
export default async function TermsPage() {
  const t = await getTranslations("marketing");

  return (
    <Section spacing="compact">
      <BreadcrumbJsonLd home={t("nav-home")} trail={[{ name: t("footer-terms"), path: "/legal/termos" }]} />
      <SectionHeader title={t("terms-title")} subtitle={t("legal-updated")} align="start" className="mx-0" as="h1" />
      <Prose className="mx-0">
        {[1, 2, 3, 4].map((index) => (
          <section key={index}>
            <h2>{t(`terms-${index}-title`)}</h2>
            <p>{t(`terms-${index}-body`)}</p>
          </section>
        ))}
      </Prose>
    </Section>
  );
}
