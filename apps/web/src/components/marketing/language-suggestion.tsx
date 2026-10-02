"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button, IconButton } from "@mui/material";

import Container from "@/components/marketing/container";
import {
  alternateAddress,
  equivalentAddress,
  otherLocale,
  rememberLanguageAnswer,
} from "@/components/marketing/language-switch";
import NiCross from "@/icons/nexture/ni-cross";
import { LANGUAGE_OFFER_ATTRIBUTE } from "@/lib/language-offer";

/**
 * "This page is also in English": the public site's answer to a browser that
 * reads the other language. An OFFER, never a redirect: the address is the
 * language (docs/SEO.md), and a crawler or a shared link must get the page
 * the URL names.
 *
 * Its three strings are written in the language it offers, the only one its
 * reader is assumed to read, so each catalog holds them in the OTHER language
 * (the pt-BR catalog in English, the English one in Portuguese).
 *
 * Decided in the browser (navigator.languages), so the server render is
 * identical for everyone and nothing here varies the cache, but decided
 * BEFORE the first paint: the bar is always rendered, hidden, and the script
 * of lib/language-offer.ts (in <head>) marks <html> when it applies. The bar
 * sits above the header; revealing it after hydration pushed the whole page
 * down under a visitor who was already reading it. Shown once: following it,
 * closing it or using the switch answers it for good.
 */
export default function LanguageSuggestion() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pathname = usePathname();
  const target = otherLocale(locale);

  const answer = () => {
    rememberLanguageAnswer();
    document.documentElement.removeAttribute(LANGUAGE_OFFER_ATTRIBUTE);
  };

  return (
    <div
      lang={target}
      className="bg-background-paper border-grey-100 hidden w-full border-b [[data-language-offer]_&]:block"
    >
      <Container className="flex flex-row items-center justify-between gap-3 py-2">
        <p className="text-text-primary text-sm leading-5">{t("language-suggest-message")}</p>
        <div className="flex flex-none flex-row items-center gap-1">
          <Button
            size="small"
            variant="pastel"
            color="primary"
            href={equivalentAddress(pathname, target)}
            onClick={(event) => {
              event.preventDefault();
              answer();
              window.location.assign(alternateAddress(pathname, target));
            }}
          >
            {t("language-suggest-action")}
          </Button>
          <IconButton size="small" aria-label={t("language-suggest-dismiss")} onClick={answer}>
            <NiCross size="small" />
          </IconButton>
        </div>
      </Container>
    </div>
  );
}
