import { getTranslations } from "next-intl/server";

import { BRAND } from "@/brand";
import CookieConsent from "@/components/consent/cookie-consent";
import MarketingAnalytics from "@/components/consent/marketing-analytics";
import MarketingTrackers from "@/components/consent/marketing-trackers";
import Logo from "@/components/logo/logo";
import Container from "@/components/marketing/container";
import LocaleLink from "@/components/marketing/locale-link";
import SupportWidget from "@/components/support/support-widget";
import { getLegalEntity, getSupportChannels } from "@/lib/platform-settings";
import { formatCnpj } from "@flyee/fields";

const LEGAL_LINKS = [
  { key: "footer-terms", href: "/legal/termos" },
  { key: "footer-privacy", href: "/legal/privacidade" },
  { key: "footer-cookies", href: "/legal/cookies" },
] as const;

/**
 * Chrome for campaign and offer pages (`/fundadores`), a sibling of
 * `(marketing)` for one reason: a nested layout cannot REMOVE what its parent
 * mounts, and an offer page must not carry the site menu. An offer has one job,
 * and every menu item is an exit from it.
 *
 * Carried over on purpose: the Pixel and GA4 (the highest-intent page must not
 * be the one page without measurement), the cookie notice (same legal footing
 * as the rest of the site) and the support widget, the only exit by design:
 * someone with a question before paying should reach a person.
 *
 * The logo is not a link (the home is a page full of exits), and the footer is
 * the legal minimum a commercial offer owes: who sells and under which terms,
 * each document in a new tab so reading it never ends the visit. Pages here are
 * `noindex` and stay out of the sitemap (docs/SEO.md).
 */
export default async function FunnelLayout({ children }: { children: React.ReactNode }) {
  const [t, support, legalEntity] = await Promise.all([
    getTranslations("marketing"),
    getSupportChannels(),
    getLegalEntity(),
  ]);

  return (
    <div className="bg-background flex min-h-[100dvh] flex-col">
      <header className="border-grey-100/80 w-full border-b">
        <Container className="flex h-16 flex-row items-center md:h-20">
          <Logo classNameFull="hidden md:block" classNameMobile="md:hidden" />
        </Container>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="bg-background-deep text-text-contrast w-full">
        <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-text-contrast/60 m-0 text-sm">
              © {new Date().getFullYear()} {BRAND.name}. {t("footer-rights")}
            </p>
            {legalEntity ? (
              <p className="text-text-contrast/60 m-0 text-sm">
                {[
                  legalEntity.name,
                  legalEntity.document
                    ? t("footer-legal-document", { document: formatCnpj(legalEntity.document) })
                    : null,
                  legalEntity.city,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <nav aria-label={t("footer-company")} className="flex flex-row flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <LocaleLink
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="text-text-contrast/70 hover:text-text-contrast text-sm transition-colors"
              >
                {t(link.key)}
              </LocaleLink>
            ))}
          </nav>
        </Container>
      </footer>

      <SupportWidget support={support} />
      <CookieConsent />
      <MarketingTrackers />
      <MarketingAnalytics />
    </div>
  );
}
