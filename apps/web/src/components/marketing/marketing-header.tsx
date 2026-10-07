"use client";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import Logo from "@/components/logo/logo";
import Container from "@/components/marketing/container";
import LanguageSwitch from "@/components/marketing/language-switch";
import Link from "@/components/marketing/locale-link";
import SiteButton, { SiteIconButton } from "@/components/site/button";
import NiCross from "@/icons/nexture/ni-cross";
import NiMenu from "@/icons/nexture/ni-menu";

// The menu of docs/HOME-COPY.md: the app store, how it works and pricing (help
// and the blog live in the footer). The hrefs are the internal (Portuguese)
// paths; LocaleLink writes the address of the language being read.
const NAV_LINKS = [
  { key: "nav-catalog", href: "/catalogo" },
  { key: "nav-how-it-works", href: "/como-funciona" },
  { key: "nav-pricing", href: "/planos" },
] as const;

/** The home's pricing section, where the header's button scrolls instead of leaving the page. */
const HOME_PRICING_ANCHOR = "#acesso";

/**
 * Public site top navigation: logo, page links, sign-in + primary CTA,
 * collapsing into a drawer on mobile. Reuses the single <Logo> component.
 *
 * The primary CTA comes from the layout, which knows the launch stage
 * (lib/launch.ts): the waitlist until the site opens, sign-up after.
 *
 * The mobile menu is a native `<dialog>` opened as a modal: the browser keeps
 * the focus inside it, closes it on Esc and returns the focus to the button
 * that opened it, with no library and no state here.
 */
export default function MarketingHeader({ navCta }: { navCta: { label: string; href: string } }) {
  // On the home, "the plans" is a section of the page: scroll to it.
  const pathname = usePathname();
  const onHome = pathname === "/" || pathname === "/en";
  const primaryCta = { ...navCta, href: onHome && navCta.href === "/planos" ? HOME_PRICING_ANCHOR : navCta.href };
  const t = useTranslations("marketing");
  const menu = useRef<HTMLDialogElement>(null);
  const close = () => menu.current?.close();

  return (
    <header className="bg-background/85 border-grey-100/80 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <Container className="flex h-16 flex-row items-center justify-between md:h-20">
        <Link href="/" aria-label={t("nav-home")} className="flex items-center">
          <Logo classNameFull="hidden md:block" classNameMobile="md:hidden" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-row items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <SiteButton key={link.key} variant="text" tone="text-primary" href={link.href}>
              {t(link.key)}
            </SiteButton>
          ))}
        </nav>

        <div className="hidden flex-row items-center gap-2 md:flex">
          <LanguageSwitch />
          <SiteButton variant="text" tone="text-primary" href="/auth/sign-in">
            {t("nav-sign-in")}
          </SiteButton>
          <SiteButton variant="contained" href={primaryCta.href} data-track="cta_click" data-track-cta-id="nav">
            {primaryCta.label}
          </SiteButton>
        </div>

        {/* Mobile menu button */}
        <SiteIconButton
          aria-label={t("nav-open-menu")}
          aria-haspopup="dialog"
          className="md:hidden"
          onClick={() => menu.current?.showModal()}
        >
          <NiMenu size="large" />
        </SiteIconButton>
      </Container>

      {/* Mobile drawer. A click on the dimmed page (the dialog's own backdrop) closes it. */}
      <dialog
        ref={menu}
        aria-label={t("nav-menu")}
        className="site-drawer md:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="flex min-h-full w-72 max-w-[85vw] flex-col gap-2 p-4">
          <div className="flex flex-row items-center justify-between">
            <Link href="/" aria-label={t("nav-home")} onClick={close}>
              <Logo classNameFull="block" classNameMobile="hidden" />
            </Link>
            <SiteIconButton aria-label={t("nav-close-menu")} onClick={close}>
              <NiCross size="large" />
            </SiteIconButton>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 px-0 py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.key}>
                <SiteButton
                  fullWidth
                  variant="text"
                  tone="text-primary"
                  className="justify-start"
                  href={link.href}
                  onClick={close}
                >
                  {t(link.key)}
                </SiteButton>
              </li>
            ))}
            <li>
              <SiteButton
                fullWidth
                variant="text"
                tone="text-primary"
                className="justify-start"
                href="/auth/sign-in"
                onClick={close}
              >
                {t("nav-sign-in")}
              </SiteButton>
            </li>
            <li>
              <LanguageSwitch fullWidth className="justify-start" />
            </li>
          </ul>
          <SiteButton variant="contained" href={primaryCta.href} data-track="cta_click" data-track-cta-id="nav">
            {primaryCta.label}
          </SiteButton>
        </div>
      </dialog>
    </header>
  );
}
