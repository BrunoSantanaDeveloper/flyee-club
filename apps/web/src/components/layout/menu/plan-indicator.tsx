"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { Box, Typography } from "@mui/material";

import { useCurrentOrg } from "@/hooks/use-current-org";
import { useEntitlements } from "@/hooks/use-entitlements";
import NiBadge from "@/icons/nexture/ni-badge";
import { trackOffer } from "@/lib/product-events";
import { cn } from "@/lib/utils";
import { MenuType } from "@/types";

const BILLING_HREF = "/settings/billing?source=menu&feature=plans";

/**
 * The workspace's current plan, at the foot of the nav rail.
 *
 * Deliberately a STATE READOUT, not a promotion: it names the plan, and only
 * adds a "compare plans" line when there is in fact something to buy. The plan
 * comes from `org_entitlements` (hooks/use-entitlements.ts), the single answer
 * every gate shares. The menu lives in the persistent dashboard layout, so
 * this is one request per page load, not per navigation.
 */
export default function PlanIndicator({ menuType }: { menuType: MenuType }) {
  const t = useTranslations("dashboard");
  const { orgId } = useCurrentOrg();
  const { entitlements, loading } = useEntitlements(orgId);
  const viewTracked = useRef(false);

  // A paying workspace has nothing to buy here: counting it as an impression
  // would dilute the surface's conversion rate with people it never addressed.
  const sellable = Boolean(entitlements) && (!entitlements!.active || entitlements!.isFree);

  useEffect(() => {
    if (!sellable || viewTracked.current) return;
    viewTracked.current = true;
    trackOffer("upsell.viewed", "menu");
  }, [sellable]);

  if (loading || !entitlements) return null;

  const planLabel =
    entitlements.active && !entitlements.isFree
      ? (entitlements.planName ?? t("menu-plan-active"))
      : t("menu-plan-free");
  const title = t("menu-plan-current", { plan: planLabel });
  const minimal = menuType === MenuType.Minimal;

  return (
    <Box
      component={Link}
      href={BILLING_HREF}
      title={minimal ? title : undefined}
      aria-label={title}
      onClick={() => {
        if (sellable) trackOffer("upsell.clicked", "menu");
      }}
      className={cn(
        "hover:bg-grey-25 flex w-full flex-col items-center gap-0.5 rounded-2xl px-2 py-2 transition-colors",
        minimal && "px-0",
      )}
    >
      <Box className="text-text-secondary flex flex-row items-center gap-1.5">
        <NiBadge size="small" aria-hidden />
        {!minimal && (
          <Typography variant="body2" className="text-text-primary text-xs leading-4 font-semibold">
            {planLabel}
          </Typography>
        )}
      </Box>
      {!minimal && sellable && (
        <Typography
          variant="body2"
          className="text-primary dark:text-primary-light text-center text-[0.6875rem] leading-4"
        >
          {t("menu-cta-button")}
        </Typography>
      )}
    </Box>
  );
}
