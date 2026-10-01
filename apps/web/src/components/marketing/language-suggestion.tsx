"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button, IconButton } from "@mui/material";

import Container from "@/components/marketing/container";
import {
  alternateAddress,
  equivalentAddress,
  otherLocale,
  rememberLanguageAnswer,
} from "@/components/marketing/language-switch";
import { LOCAL_STORAGE_KEYS } from "@/constants";
import NiCross from "@/icons/nexture/ni-cross";
import { isCrawler, localeFromAcceptLanguage } from "@/lib/locale-detection";

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
 * Decided in the browser after mount (navigator.languages), so the server
 * render is identical for everyone and nothing here varies the cache. Shown
 * once: following it, closing it or using the switch answers it for good.
 */
export default function LanguageSuggestion() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const target = otherLocale(locale);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LOCAL_STORAGE_KEYS.languageSuggestion)) return;
    } catch {
      return; // Without storage the answer could not be kept: do not ask.
    }
    if (isCrawler(navigator.userAgent)) return;
    const reads = localeFromAcceptLanguage((navigator.languages ?? [navigator.language]).join(","));
    setVisible(reads === target);
  }, [target]);

  if (!visible) return null;

  return (
    <div lang={target} aria-live="polite" className="bg-background-paper border-grey-100 w-full border-b">
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
              rememberLanguageAnswer();
              window.location.assign(alternateAddress(pathname, target));
            }}
          >
            {t("language-suggest-action")}
          </Button>
          <IconButton
            size="small"
            aria-label={t("language-suggest-dismiss")}
            onClick={() => {
              rememberLanguageAnswer();
              setVisible(false);
            }}
          >
            <NiCross size="small" />
          </IconButton>
        </div>
      </Container>
    </div>
  );
}
