import HomeView, { type HomeState } from "./home-view";

import { getMemberContext } from "@/lib/member/context";
import { loadDevices } from "@/lib/member/devices";
import { loadNews } from "@/lib/member/news";
import { loadOfferPlans } from "@/lib/member/offers";
import { loadUpsellFacts } from "@/lib/member/upsell-facts";
import { decideUpsell } from "@/lib/upsell";
import { enabledFeatures, limitOf } from "@flyee/billing/entitlements";

/**
 * /inicio: the member's home. Everything is read on the server, each part on
 * its own, so one failing source shows its own error instead of blanking the
 * page.
 */
export default async function HomePage() {
  const context = await getMemberContext();
  if (!context) return <HomeView state={{ kind: "unavailable" }} />;

  const { entitlements, orgId } = context;
  const limits = entitlements.active ? entitlements.limits : {};
  const [devices, news, offerPlans, upsellFacts] = await Promise.all([
    orgId
      ? loadDevices(context.supabase, { orgId, limit: limitOf(limits, "devices") }).catch(() => null)
      : Promise.resolve(null),
    loadNews(context.supabase, { locale: context.locale, limit: 3, releasesOnly: true }).catch(() => null),
    loadOfferPlans(context.currency).catch((): Awaited<ReturnType<typeof loadOfferPlans>> => ({})),
    orgId
      ? loadUpsellFacts(context.supabase, { orgId, tier: entitlements.tier }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const upsell = upsellFacts
    ? decideUpsell(upsellFacts)
    : entitlements.tier
      ? null
      : decideUpsell({ tier: null, trailsUsed30d: 0 });

  const state: HomeState = {
    kind: "ready",
    firstName: context.profile.displayName.trim().split(/\s+/)[0] ?? "",
    locale: context.locale,
    tier: entitlements.tier,
    suspended: entitlements.suspended,
    features: entitlements.active ? enabledFeatures(limits) : [],
    devices,
    news,
    upsell: upsell ? { ...upsell, plan: offerPlans[upsell.offer] ?? null } : null,
  };
  return <HomeView state={state} />;
}
