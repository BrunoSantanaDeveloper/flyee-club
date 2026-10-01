"use client";
import "@/style/global.css";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { LicenseInfo } from "@mui/x-license";

import Loading from "@/app/loading";
import AnnouncementBanner from "@/components/layout/announcements/announcement-banner";
import ContentWrapper from "@/components/layout/containers/content-wrapper";
import Header from "@/components/layout/containers/header";
import Main from "@/components/layout/containers/main";
import ImpersonationBanner from "@/components/layout/impersonation/impersonation-banner";
import LocaleAutoNotice from "@/components/layout/locale/locale-auto-notice";
import LeftMenu from "@/components/layout/menu/left-menu";
import MenuBackdrop from "@/components/layout/menu/menu-backdrop";
import SupportWidget from "@/components/support/support-widget";

LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY || "");

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = useTranslations("product");
  return (
    <>
      <a
        href="#main-content"
        className="bg-primary text-text-contrast fixed top-3 left-3 z-[2000] -translate-y-20 rounded-lg px-4 py-3 transition-transform focus:translate-y-0"
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
          <Suspense fallback={<Loading />}>{children}</Suspense>
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
        The analytics posture of the dashboard is decided in phase 7 of
        docs/PLANO-IMPLEMENTACAO.md (docs/TRACKING.md): until then no browser
        tracker mounts here; funnel events stay server-side.
      */}
    </>
  );
}
