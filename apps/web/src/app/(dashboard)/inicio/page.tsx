"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Breadcrumbs, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import OnboardingChecklistCard from "@/components/product/onboarding-checklist-card";
import { useProfile } from "@/hooks/use-profile";
import NiCatalog from "@/icons/nexture/ni-catalog";

/**
 * The member's home, interim version (phase 1 of docs/PLANO-IMPLEMENTACAO.md).
 *
 * Who: a member who just signed in. Job: know what to do next. Success: one
 * honest next step — the activation checklist (profile, access, install,
 * first run) plus the single action available today, choosing a plan. The
 * full home (token status, install block, news, upsell) arrives in phase 5.
 */
export default function Inicio() {
  const t = useTranslations("product");
  const profile = useProfile();
  const firstName = profile.displayName.trim().split(/\s+/)[0] ?? "";

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        {profile.loading ? (
          <Skeleton variant="text" width={260} height={48} />
        ) : (
          <Typography variant="h1" component="h1" className="mb-0">
            {firstName ? t("home-greeting", { name: firstName }) : t("home-greeting-generic")}
          </Typography>
        )}
        <Breadcrumbs>
          <Link color="inherit" href="/inicio">
            {t("home-breadcrumb")}
          </Link>
        </Breadcrumbs>
      </Grid>

      <Grid size={12}>
        <OnboardingChecklistCard title={t("home-checklist-title")} />
      </Grid>

      <Grid size={12}>
        <EmptyState
          icon={<NiCatalog size="large" />}
          title={t("home-empty-title")}
          description={t("home-empty-body")}
          action={{ label: t("home-empty-cta"), href: "/settings/billing" }}
        />
      </Grid>
    </Grid>
  );
}
