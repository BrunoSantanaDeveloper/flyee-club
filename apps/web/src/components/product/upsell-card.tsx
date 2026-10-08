"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import StatusChip from "@/components/product/status-chip";
import { TILE_TONE, type TileTone } from "@/components/product/tile-tone";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCheck from "@/icons/nexture/ni-check";
import NiStar from "@/icons/nexture/ni-star";
import { type OfferKind, type OfferOrigin, trackOffer } from "@/lib/product-events";
import { cn } from "@/lib/utils";

/**
 * The next rung of the ladder, offered because the member's own use earned it
 * (`decideOffers`, lib/upsell.ts). Honest by construction: it says why it is
 * here, lists what the rung adds, marks "Em breve" on a line whose area has
 * nothing published yet, shows the real price from `plans`, and carries no
 * countdown.
 *
 * Closest template section: the quick-action card (tinted icon column, title,
 * body) widened into a feature card; nothing in the catalog presented one
 * offer with its reason and its price. Records `upsell.viewed` once per mount
 * and `upsell.clicked` on the call to action, with the screen it sits on.
 */
export default function UpsellCard({
  offer,
  origin,
  tone = "secondary",
  title,
  reason,
  features,
  soonLabel,
  priceLabel,
  ctaLabel,
  href,
}: {
  offer: OfferKind;
  origin: OfferOrigin;
  tone?: TileTone;
  title: string;
  /** Why this shows now, in one sentence. */
  reason: string;
  /** What the rung adds over the current one; `soon` when its area has nothing yet. */
  features: { label: string; soon?: boolean }[];
  /** The words of the "Em breve" badge, required when a line is `soon`. */
  soonLabel?: string;
  /** "R$ 67/mês", formatted by the caller from the plan's own currency. */
  priceLabel: string | null;
  ctaLabel: string;
  href: string;
}) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackOffer("upsell.viewed", origin, offer);
  }, [offer, origin]);

  const style = TILE_TONE[tone];
  return (
    <Card className="flex h-full flex-col p-1 sm:flex-row">
      <Box
        aria-hidden
        className={cn(
          "flex h-16 flex-none items-center justify-center rounded-2xl sm:h-auto sm:w-16",
          style.bg,
          style.text,
        )}
      >
        <NiStar size="large" />
      </Box>
      <CardContent className="flex flex-1 flex-col gap-3">
        <Box className="flex flex-col gap-1">
          <Typography variant="subtitle1" component="h2" className="mb-0">
            {title}
          </Typography>
          <Typography variant="body1" className="text-text-secondary leading-6">
            {reason}
          </Typography>
        </Box>
        <Box component="ul" className="m-0 flex list-none flex-col gap-1.5 p-0">
          {features.map((feature) => (
            <Box component="li" key={feature.label} className="flex flex-row flex-wrap items-start gap-2">
              <NiCheck size="small" className={cn("mt-0.5 flex-none", style.text)} aria-hidden />
              <Typography variant="body2" className="leading-5">
                {feature.label}
              </Typography>
              {feature.soon && soonLabel ? <StatusChip label={soonLabel} tone="attention" /> : null}
            </Box>
          ))}
        </Box>
        <Box className="flex flex-row flex-wrap items-center gap-3">
          <Button
            variant="contained"
            component={Link}
            href={href}
            endIcon={<NiArrowRight size="small" />}
            onClick={() => trackOffer("upsell.clicked", origin, offer)}
          >
            {ctaLabel}
          </Button>
          {priceLabel ? (
            <Typography variant="body2" className="text-text-secondary">
              {priceLabel}
            </Typography>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}
