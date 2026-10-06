"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Box, Button, Drawer, IconButton, List, ListItem } from "@mui/material";

import Logo from "@/components/logo/logo";
import Container from "@/components/marketing/container";
import LanguageSwitch from "@/components/marketing/language-switch";
import Link from "@/components/marketing/locale-link";
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

/**
 * Public site top navigation: logo, page links, sign-in + primary CTA,
 * collapsing into a drawer on mobile. Reuses the single <Logo> component.
 *
 * The primary CTA comes from the layout, which knows the launch stage
 * (lib/launch.ts): the waitlist until the site opens, sign-up after.
 */
export default function MarketingHeader({ primaryCta }: { primaryCta: { label: string; href: string } }) {
  const t = useTranslations("marketing");
  const [open, setOpen] = useState(false);

  return (
    <Box
      component="header"
      className="bg-background/85 border-grey-100/80 sticky top-0 z-30 w-full border-b backdrop-blur-md"
    >
      <Container className="flex h-16 flex-row items-center justify-between md:h-20">
        <Link href="/" aria-label={t("nav-home")} className="flex items-center">
          <Logo classNameFull="hidden md:block" classNameMobile="md:hidden" />
        </Link>

        {/* Desktop nav */}
        <Box component="nav" className="hidden flex-row items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.key} variant="text" color="text-primary" href={link.href} LinkComponent={Link}>
              {t(link.key)}
            </Button>
          ))}
        </Box>

        <Box className="hidden flex-row items-center gap-2 md:flex">
          <LanguageSwitch />
          <Button variant="text" color="text-primary" href="/auth/sign-in" LinkComponent={Link}>
            {t("nav-sign-in")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            href={primaryCta.href}
            LinkComponent={Link}
            data-track="cta_click"
            data-track-cta-id="nav"
          >
            {primaryCta.label}
          </Button>
        </Box>

        {/* Mobile menu button */}
        <IconButton aria-label={t("nav-open-menu")} className="md:hidden" onClick={() => setOpen(true)}>
          <NiMenu size="large" />
        </IconButton>
      </Container>

      {/* Mobile drawer */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} className="md:hidden">
        <Box className="flex w-72 max-w-[85vw] flex-col gap-2 p-4">
          <Box className="flex flex-row items-center justify-between">
            <Link href="/" aria-label={t("nav-home")} onClick={() => setOpen(false)}>
              <Logo classNameMobile="block" />
            </Link>
            <IconButton aria-label={t("nav-close-menu")} onClick={() => setOpen(false)}>
              <NiCross size="large" />
            </IconButton>
          </Box>
          <List className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <ListItem key={link.key} disablePadding>
                <Button
                  fullWidth
                  variant="text"
                  color="text-primary"
                  className="justify-start"
                  href={link.href}
                  LinkComponent={Link}
                  onClick={() => setOpen(false)}
                >
                  {t(link.key)}
                </Button>
              </ListItem>
            ))}
            <ListItem disablePadding>
              <Button
                fullWidth
                variant="text"
                color="text-primary"
                className="justify-start"
                href="/auth/sign-in"
                LinkComponent={Link}
                onClick={() => setOpen(false)}
              >
                {t("nav-sign-in")}
              </Button>
            </ListItem>
            <ListItem disablePadding>
              <LanguageSwitch fullWidth className="justify-start" />
            </ListItem>
          </List>
          <Button
            variant="contained"
            color="primary"
            href={primaryCta.href}
            LinkComponent={Link}
            data-track="cta_click"
            data-track-cta-id="nav"
          >
            {primaryCta.label}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
