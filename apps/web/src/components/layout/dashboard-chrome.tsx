"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { LicenseInfo } from "@mui/x-license";

import CookieConsent from "@/components/consent/cookie-consent";
import DashboardTrackers from "@/components/consent/dashboard-trackers";
import AnnouncementBanner from "@/components/layout/announcements/announcement-banner";
import ContentWrapper from "@/components/layout/containers/content-wrapper";
import Header from "@/components/layout/containers/header";
import Loading from "@/components/layout/containers/loading-screen";
import Main from "@/components/layout/containers/main";
import ImpersonationBanner from "@/components/layout/impersonation/impersonation-banner";
import LocaleAutoNotice from "@/components/layout/locale/locale-auto-notice";
import LeftMenu from "@/components/layout/menu/left-menu";
import MenuBackdrop from "@/components/layout/menu/menu-backdrop";
import { UpgradePromptProvider } from "@/components/product/upgrade-prompt";
import SupportWidget from "@/components/support/support-widget";

LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY || "");

/**
 * The chrome of the member area and the admin consoles: header, menu, banners
 * and the content frame. A client component (the menu state and the MUI X
 * licence need the browser), so the segment's layout stays a server component
 * and wraps this in the shell that provides MUI and the messages
 * (components/layout/app-shell.tsx).
 */
export default function DashboardChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = useTranslations("product");
  return (
    <>
      <a
        href="#main-content"
        className="bg-primary text-primary-contrast fixed top-3 left-3 z-[2000] -translate-y-20 rounded-lg px-4 py-3 transition-transform focus:translate-y-0"
      >
        {t("skip-to-content")}
      </a>
      <Header />
      <LeftMenu />
      <Main>
        <ContentWrapper>
          {/*
            Above the announcements on purpose: if the member cannot read the
            app, that is the first thing to fix — every other message is
            unreadable too.
          */}
          <LocaleAutoNotice />
          <AnnouncementBanner />
          {/* FlyeeClub Pro is offered where one of its features is clicked (docs/PRODUCT.md, 2026-10-08). */}
          <UpgradePromptProvider>
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </UpgradePromptProvider>
        </ContentWrapper>
      </Main>
      <MenuBackdrop />
      <SupportWidget />
      {/*
        Renders only inside a support impersonation, and stays fixed: the
        operator scrolls, and forgetting whose account you are in is the
        failure mode worth designing against.
      */}
      <ImpersonationBanner />
      {/*
        The Pixel and GA4 run in the member area under the same opt-out as the
        public site, never on the admin consoles (docs/TRACKING.md). The notice
        is the same one, so a refusal here is a refusal everywhere.
      */}
      <CookieConsent />
      <DashboardTrackers />
    </>
  );
}
