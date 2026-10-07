"use client";

import NextLink from "next/link";
import { useLocale } from "next-intl";
import { type ComponentProps, forwardRef } from "react";

import { leavesPublicSite, localizeHref } from "@/i18n/routing";

/**
 * next/link for the public site. `href` is the internal (Portuguese) path and
 * the link points at the address of the language being read: `/planos` is
 * `/en/pricing` on an English page (src/i18n/routing.ts). Anything that is not
 * a public page (`/auth/sign-up`, an external URL, an address that already
 * carries a language) passes through unchanged, so every link of a public
 * surface goes through it.
 *
 * A link that leaves the public site (sign-in, the member area, the checkout)
 * is never prefetched. Those screens run on another shell, with MUI behind
 * them; prefetching the "Entrar" of the header made every public page download
 * that shell for a click most visitors never make.
 */
const LocaleLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function LocaleLink(
  { href, prefetch, ...props },
  ref,
) {
  const locale = useLocale();
  if (typeof href !== "string") return <NextLink ref={ref} href={href} prefetch={prefetch} {...props} />;
  return (
    <NextLink
      ref={ref}
      href={localizeHref(href, locale)}
      prefetch={leavesPublicSite(href) ? false : prefetch}
      {...props}
    />
  );
});

export default LocaleLink;
