"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Alert, Box, Button, Dialog, DialogActions, DialogContent, Divider, Skeleton, Typography } from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import StatusChip from "@/components/product/status-chip";
import NiCheck from "@/icons/nexture/ni-check";
import { loadUpgradeOffer, type UpgradeOffer, type UpgradePlan } from "@/lib/member/upgrade";
import { trackOffer } from "@/lib/product-events";
import { FEATURE_ORIGIN, proAdditions, type ProFeature } from "@/lib/upgrade";
import { formatPrice } from "@flyee/billing/currency";

/** What each feature is called in the prompt's title, listed literally so the message pruner sees every key. */
const FEATURE_LABEL: Record<ProFeature, string> = {
  roadmap_propose: "upgrade-feature-roadmap_propose",
  roadmap_vote: "upgrade-feature-roadmap_vote",
  recipe_install: "upgrade-feature-recipe_install",
  recipe_workflow: "upgrade-feature-recipe_workflow",
  meeting_register: "upgrade-feature-meeting_register",
  advanced_guide: "upgrade-feature-advanced_guide",
  more_devices: "upgrade-feature-more_devices",
};

const UpgradePromptContext = createContext<((feature: ProFeature) => void) | null>(null);

/**
 * Opens the upgrade prompt from any screen of the member area, with the
 * feature that was clicked. Outside the provider (a preview, a test) it does
 * nothing, so a screen never breaks for lack of it.
 */
export function useUpgradePrompt(): (feature: ProFeature) => void {
  return useContext(UpgradePromptContext) ?? noop;
}

const noop = () => undefined;

/** Mounted once, around the member area (components/layout/dashboard-chrome.tsx). */
export function UpgradePromptProvider({ children }: { children: React.ReactNode }) {
  const [feature, setFeature] = useState<ProFeature | null>(null);
  const open = useCallback((next: ProFeature) => setFeature(next), []);
  return (
    <UpgradePromptContext.Provider value={open}>
      {children}
      {feature ? <UpgradePrompt key={feature} feature={feature} onClose={() => setFeature(null)} /> : null}
    </UpgradePromptContext.Provider>
  );
}

type PromptState = { kind: "loading" } | { kind: "ready"; offer: UpgradeOffer } | { kind: "error" };

/**
 * FlyeeClub Pro, offered where one of its features was clicked (docs/PRODUCT.md,
 * decided 2026-10-08): the site never advertises it, so this is where a member
 * learns what it adds. The prompt names the feature, lists what Pro adds to
 * what the account already has, in the words of the plans grid, with "Em breve"
 * on an area that has nothing published yet, shows the real prices from
 * `plans` and leads to the checkout. An account that bought nothing also sees
 * FlyeeClub, the smaller step, said plainly not to include the feature.
 *
 * The controls of Pro stay enabled and open this instead of greying out: the
 * server still refuses the action itself (row-level security and the database
 * functions); the prompt is only the screen. It records `upsell.viewed` once
 * and `upsell.clicked` on a purchase button, with the feature and its screen.
 *
 * Closest template section: the product dialogs (DialogHeader over dividers),
 * holding the list and the price of UpsellCard; nothing in the catalog offered
 * a plan in answer to a click.
 */
export default function UpgradePrompt({ feature, onClose }: { feature: ProFeature; onClose: () => void }) {
  const t = useTranslations("product");
  const locale = useLocale();
  const origin = FEATURE_ORIGIN[feature];
  const [state, setState] = useState<PromptState>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    loadUpgradeOffer().then(
      (result) => setState(result.ok ? { kind: "ready", offer: result.offer } : { kind: "error" }),
      () => setState({ kind: "error" }),
    );
  }, []);
  useEffect(load, [load]);

  const viewed = useRef(false);
  useEffect(() => {
    if (state.kind !== "ready" || viewed.current) return;
    viewed.current = true;
    if (state.offer.pro) trackOffer("upsell.viewed", origin, "club", feature);
    if (state.offer.kit) trackOffer("upsell.viewed", origin, "kit", feature);
  }, [state, origin, feature]);

  const money = (plan: UpgradePlan) => formatPrice(plan.priceCents, plan.currency, locale);
  const offer = state.kind === "ready" ? state.offer : null;
  const pro = offer?.pro ?? null;
  // No plan of FlyeeClub Pro on sale (the operator turned them off): the prompt says so and sells nothing.
  const proHref = pro?.monthly
    ? `/assinatura?plan=${pro.monthly.slug}`
    : pro?.yearly
      ? `/assinatura?plan=${pro.yearly.slug}`
      : null;
  const price =
    pro?.monthly && pro.yearly
      ? t("upgrade-price", { monthly: money(pro.monthly), yearly: money(pro.yearly) })
      : pro?.monthly
        ? t("upgrade-price-monthly", { monthly: money(pro.monthly) })
        : pro?.yearly
          ? t("upgrade-price-yearly", { yearly: money(pro.yearly) })
          : null;
  const additions = offer && pro ? proAdditions(offer.limits, pro.limits, offer.available) : [];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="upgrade-prompt-title">
      <DialogHeader
        id="upgrade-prompt-title"
        title={t("upgrade-title", { feature: t(FEATURE_LABEL[feature]) })}
        onClose={onClose}
        closeLabel={t("close")}
      />
      <DialogContent dividers className="flex flex-col gap-4">
        {state.kind === "loading" ? (
          <Box className="flex flex-col gap-2" aria-busy>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        ) : state.kind === "error" ? (
          <Alert
            severity="info"
            className="neutral bg-background-paper/60!"
            action={
              <Button color="inherit" size="small" onClick={load}>
                {t("retry")}
              </Button>
            }
          >
            {t("upgrade-error")}
          </Alert>
        ) : (
          <>
            {pro ? (
              <>
                <Typography variant="body1">{t(offer?.tier ? "upgrade-adds" : "upgrade-adds-everything")}</Typography>
                <Box component="ul" className="m-0 flex list-none flex-col gap-2 p-0">
                  {additions.map((line) => (
                    <Box component="li" key={line.key} className="flex flex-row flex-wrap items-center gap-2">
                      <NiCheck size="small" className="text-primary-ink flex-none" aria-hidden />
                      <Typography variant="body2">{t(line.labelKey, line.values)}</Typography>
                      {line.soon ? <StatusChip label={t("soon")} tone="attention" /> : null}
                    </Box>
                  ))}
                </Box>
                {price ? (
                  <Typography variant="h6" component="p" className="mb-0">
                    {price}
                  </Typography>
                ) : null}
              </>
            ) : (
              <Typography variant="body1">{t("upgrade-no-plan")}</Typography>
            )}
            {offer?.kit ? (
              <>
                <Divider />
                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2" component="h3" className="mb-0">
                    {t("upgrade-kit-title")}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {t("upgrade-kit-body", { price: money(offer.kit) })}
                  </Typography>
                  <Box>
                    <Button
                      variant="outlined"
                      size="small"
                      component={Link}
                      href={`/assinatura?plan=${offer.kit.slug}`}
                      onClick={() => trackOffer("upsell.clicked", origin, "kit", feature)}
                    >
                      {t("upgrade-kit-cta")}
                    </Button>
                  </Box>
                </Box>
              </>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="grey" onClick={onClose}>
          {t("close")}
        </Button>
        {state.kind !== "ready" || proHref ? (
          <Button
            variant="contained"
            component={Link}
            href={proHref ?? "/settings/billing"}
            disabled={state.kind !== "ready"}
            onClick={() => trackOffer("upsell.clicked", origin, "club", feature)}
          >
            {t("upgrade-cta")}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
