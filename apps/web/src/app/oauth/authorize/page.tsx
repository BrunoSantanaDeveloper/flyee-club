import { approveAuthorization, denyAuthorization } from "./actions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, Box, Button, Divider, List, ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";

import { ConsentError, ConsentShell } from "@/components/cli/consent-shell";
import UpsellCard from "@/components/product/upsell-card";
import { COOKIE_KEYS } from "@/constants";
import NiBook from "@/icons/nexture/ni-book";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiDownloadCloud from "@/icons/nexture/ni-download-cloud";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiTerminal from "@/icons/nexture/ni-terminal";
import NiUser from "@/icons/nexture/ni-user";
import { resolveCurrency } from "@/lib/billing-currency";
import { type DeviceStatus, readDeviceStatus } from "@/lib/cli/device-status";
import { OFFER_COPY, offerLines, REASON_COPY } from "@/lib/member/offer-copy";
import { loadOfferPlans, type OfferPlan } from "@/lib/member/offers";
import { loadProAvailability } from "@/lib/member/pro-availability";
import { loadUpsellFacts } from "@/lib/member/upsell-facts";
import {
  authorizeParamsFromSearch,
  authorizeQuery,
  errorRedirectUrl,
  validateAuthorizeRequest,
} from "@/lib/oauth/authorize-request";
import { type OauthScope, SCOPE_LABEL_KEYS } from "@/lib/oauth/scopes";
import type { ProAvailability } from "@/lib/upgrade";
import { decideOffers, type UpsellOffer, type UpsellReason } from "@/lib/upsell";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";
import { formatPrice } from "@flyee/billing/currency";
import { isTier } from "@flyee/billing/entitlements";

/**
 * The CLI connection screen (docs/CLI-CONTRACT.md). The member arrives here
 * from `npx flyee login` with one decision to make: let this machine install
 * and update the club's tools, or not. Either way the browser goes back to the
 * terminal.
 *
 * When the machine was connected before, this is the REVALIDATION screen: 30
 * days without an update lapsed its connection, so it says how long it has
 * been and how many installed tools have a newer version waiting.
 *
 * Failures that cannot be safely redirected (unknown client, unregistered
 * return address) render here: a member is never sent to an unverified URL.
 */

const SCOPE_ICONS: Record<OauthScope, React.ReactNode> = {
  "profile:read": <NiUser size="medium" className="text-primary-ink" />,
  "catalog:read": <NiBook size="medium" className="text-primary-ink" />,
  "modules:download": <NiDownloadCloud size="medium" className="text-primary-ink" />,
  "telemetry:write": <NiChartLine size="medium" className="text-primary-ink" />,
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("product");
  const params = authorizeParamsFromSearch(await searchParams);
  const errorCard = (message: string) => (
    <ConsentError
      title={t("oauth-authorize-error-title")}
      message={message}
      backLabel={t("oauth-authorize-back-home")}
    />
  );

  if (!isSupabaseConfigured) return errorCard(t("oauth-error-not-configured"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // The middleware normally redirects first; this covers direct hits.
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/oauth/authorize?${authorizeQuery(params)}`)}`);
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return errorCard(t("oauth-error-not-configured"));
  }

  const validation = await validateAuthorizeRequest(service, params);
  if (!validation.ok) {
    if (validation.kind === "redirect") {
      redirect(errorRedirectUrl(params.redirectUri, validation.error, validation.description, params.state));
    }
    return errorCard(
      validation.error === "invalid_client" ? t("oauth-error-invalid-client") : t("oauth-error-invalid-redirect"),
    );
  }
  const { client, scopes, deviceId } = validation;

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = (membership?.org_id as string | undefined) ?? null;
  if (!orgId) return errorCard(t("oauth-error-no-workspace"));
  const orgRel = membership?.organizations as { name?: string } | { name?: string }[] | null;
  const orgName = (Array.isArray(orgRel) ? orgRel[0]?.name : orgRel?.name) ?? "";

  // An active workspace, an account with no purchase included: it installs the
  // entry version of each app (0040). What each tool needs is checked per download.
  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: orgId });
  if (!entitlements?.active) return errorCard(t("oauth-error-plan"));

  // A machine whose chain lapsed is revalidating.
  let device: DeviceStatus | null = null;
  if (client.first_party && deviceId) {
    device = await readDeviceStatus(service, { userId: user!.id, deviceId });
  }
  const revalidating = Boolean(device?.lapsed);
  const deviceName = device?.name || t("oauth-device-unnamed");

  // The revalidation is the one moment a member who has been away is looking:
  // the next rung is offered here (lib/upsell.ts), both rungs to an account
  // that bought nothing, with "Em breve" on the lines of an empty Pro area.
  let offers: { offer: UpsellOffer; reason: UpsellReason; plan: OfferPlan | null }[] = [];
  let available: ProAvailability | null = null;
  const locale = (await getLocale()) === "en" ? "en" : "pt-BR";
  if (revalidating) {
    try {
      const facts = await loadUpsellFacts(supabase, {
        orgId,
        tier: isTier(entitlements.tier) ? entitlements.tier : null,
      });
      const decided = decideOffers(facts, "revalidation");
      if (decided.length > 0) {
        const currency = resolveCurrency({ cookie: (await cookies()).get(COOKIE_KEYS.currency)?.value, locale });
        const [plans, areas] = await Promise.all([
          loadOfferPlans(currency),
          decided.some((item) => item.offer === "club")
            ? loadProAvailability(supabase).catch(() => null)
            : Promise.resolve(null),
        ]);
        offers = decided.map((item) => ({ ...item, plan: plans[item.offer] ?? null }));
        available = areas;
      }
    } catch {
      offers = [];
    }
  }
  const offerPrice = (plan: OfferPlan | null) => {
    if (!plan) return null;
    const price = formatPrice(plan.priceCents, plan.currency, locale);
    return plan.period === "monthly" ? t("home-offer-price-monthly", { price }) : t("home-offer-price-once", { price });
  };

  // The connection term in the member's language (EN, then pt-BR, as fallback).
  const { data: terms } = await service.rpc("current_consent_terms", { p_locale: locale });
  const term = ((terms ?? []) as { slug: string; title: string; body_md: string }[]).find(
    (row) => row.slug === "cli-connection",
  );

  const hiddenFields = (
    <>
      <input type="hidden" name="response_type" value={params.responseType} />
      <input type="hidden" name="client_id" value={params.clientId} />
      <input type="hidden" name="redirect_uri" value={params.redirectUri} />
      <input type="hidden" name="state" value={params.state} />
      <input type="hidden" name="code_challenge" value={params.codeChallenge} />
      <input type="hidden" name="code_challenge_method" value={params.codeChallengeMethod} />
      <input type="hidden" name="scope" value={params.scopeParam} />
      <input type="hidden" name="device_id" value={params.deviceId} />
    </>
  );

  return (
    <ConsentShell>
      <Box className="flex flex-col items-center gap-2 text-center">
        {revalidating ? (
          <NiRefresh size="large" className="text-primary-ink" />
        ) : (
          <NiTerminal size="large" className="text-primary-ink" />
        )}
        <Typography variant="h1" component="h1" className="mb-0">
          {revalidating ? t("oauth-revalidate-title") : t("oauth-authorize-title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          {revalidating && device
            ? t("oauth-revalidate-subtitle", { device: deviceName, days: device.daysSinceUpdate })
            : t("oauth-authorize-subtitle", { client: client.client_name })}
        </Typography>
        {orgName ? (
          <Typography variant="body2" className="text-text-secondary">
            {t("oauth-authorize-workspace")}: <span className="text-text-primary font-medium">{orgName}</span>
          </Typography>
        ) : null}
      </Box>

      {revalidating && device ? (
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {device.behind > 0
            ? t("oauth-revalidate-behind", { count: device.behind })
            : device.beyondChannel > 0
              ? t("oauth-revalidate-beyond", { count: device.beyondChannel })
              : t("oauth-revalidate-current")}
        </Alert>
      ) : null}

      {offers.map((offer) => (
        <UpsellCard
          key={offer.offer}
          offer={offer.offer}
          origin="revalidation"
          tone={OFFER_COPY[offer.offer].tone}
          title={t(OFFER_COPY[offer.offer].title)}
          reason={t(REASON_COPY[offer.reason])}
          features={offerLines(offer.offer, t, available)}
          soonLabel={t("soon")}
          priceLabel={offerPrice(offer.plan)}
          ctaLabel={t("home-offer-cta")}
          href={offer.plan ? `/assinatura?plan=${offer.plan.slug}` : "/settings/billing?source=revalidation"}
        />
      ))}

      <Divider />

      <Box className="flex flex-col gap-1">
        <Typography variant="h6" component="h2" className="mb-0">
          {t("oauth-authorize-permissions")}
        </Typography>
        <List dense disablePadding>
          {scopes.map((scope) => (
            <ListItem key={scope} disableGutters>
              <ListItemIcon>{SCOPE_ICONS[scope]}</ListItemIcon>
              <ListItemText primary={t(SCOPE_LABEL_KEYS[scope])} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Typography variant="body2" className="text-text-secondary">
        {t("oauth-authorize-revalidation-note")}
      </Typography>

      {term ? (
        <Box className="flex flex-col gap-1">
          <Typography variant="h6" component="h2" className="mb-0">
            {t("oauth-authorize-term-title")}
          </Typography>
          <Box className="border-grey-100 max-h-40 overflow-y-auto rounded-lg border p-3">
            <Typography variant="body2" className="text-text-secondary whitespace-pre-line">
              {term.body_md}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Box className="flex flex-col gap-2">
        <Box component="form" action={approveAuthorization}>
          {hiddenFields}
          <Button type="submit" variant="contained" fullWidth>
            {revalidating ? t("oauth-revalidate-approve") : t("oauth-authorize-approve")}
          </Button>
        </Box>
        <Box component="form" action={denyAuthorization}>
          {hiddenFields}
          <Button type="submit" color="grey" variant="text" fullWidth>
            {t("oauth-authorize-deny")}
          </Button>
        </Box>
      </Box>
    </ConsentShell>
  );
}
