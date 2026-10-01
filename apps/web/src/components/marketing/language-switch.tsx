"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@mui/material";

import { LOCAL_STORAGE_KEYS } from "@/constants";
import { localizeHref, matchPublicPath, routing } from "@/i18n/routing";
import NiWorld from "@/icons/nexture/ni-world";

/** The site has two languages, so switching is one link, never a menu. */
export const otherLocale = (locale: string) =>
  routing.locales.find((candidate) => candidate !== locale) ?? routing.defaultLocale;

/** The same page in another language, without the page's help (no JS, no hreflang). */
export const equivalentAddress = (pathname: string, locale: string) =>
  localizeHref(matchPublicPath(pathname)?.internal ?? "/", locale);

/**
 * The address of the page being read, in another language. The page's own
 * hreflang (lib/seo.ts) knows it exactly, including a help article or a blog
 * post whose slug differs per language; without one, the same internal path.
 * The host is dropped: hreflang is absolute on the canonical domain, and the
 * switch must stay on whichever host is serving the page.
 */
export function alternateAddress(pathname: string, locale: string): string {
  const declared = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`);
  if (declared?.href) {
    const url = new URL(declared.href);
    return `${url.pathname}${url.search}`;
  }
  return equivalentAddress(pathname, locale);
}

/** Whoever picked a language has answered: the suggestion is not repeated. */
export function rememberLanguageAnswer() {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEYS.languageSuggestion, "answered");
  } catch {
    // Storage blocked: the suggestion may come back, which is harmless.
  }
}

/**
 * The public site's language switch: the same page in the other language.
 *
 * A full page load on purpose. The root layout (`<html lang>`, the messages of
 * the client components above the language segment) renders once per
 * document, so only a new document is entirely in the new language; a
 * client-side navigation would keep parts of the old one.
 */
export default function LanguageSwitch({
  fullWidth,
  className,
  color = "text-primary",
}: {
  fullWidth?: boolean;
  className?: string;
  /** `inherit` on a dark band (the footer), where the text colour comes from the band. */
  color?: "text-primary" | "inherit";
}) {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pathname = usePathname();
  const target = otherLocale(locale);

  return (
    <Button
      variant="text"
      color={color}
      fullWidth={fullWidth}
      className={className}
      href={equivalentAddress(pathname, target)}
      aria-label={t("language-switch-label")}
      startIcon={<NiWorld size="small" />}
      onClick={(event) => {
        event.preventDefault();
        rememberLanguageAnswer();
        window.location.assign(alternateAddress(pathname, target));
      }}
    >
      <span lang={target}>{t("language-switch-name")}</span>
    </Button>
  );
}
