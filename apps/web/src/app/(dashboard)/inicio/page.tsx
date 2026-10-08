import HomeView, { type HomeState } from "./home-view";

import { localizeHref } from "@/i18n/routing";
import { getMemberContext } from "@/lib/member/context";
import { loadDevices } from "@/lib/member/devices";
import { loadNews } from "@/lib/member/news";
import { SERVICE_COPY } from "@/lib/member/offer-copy";
import { loadOfferPlans } from "@/lib/member/offers";
import { loadProAvailability } from "@/lib/member/pro-availability";
import { loadUpsellFacts } from "@/lib/member/upsell-facts";
import { decideOffers, decideServiceOffers } from "@/lib/upsell";
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
  // Below FlyeeClub Pro, its card may show: what each of its areas has
  // published decides which lines say "Em breve".
  const belowPro = entitlements.tier !== "club" && entitlements.tier !== "pro";
  const [devices, news, offerPlans, upsellFacts, available] = await Promise.all([
    orgId
      ? loadDevices(context.supabase, { orgId, limit: limitOf(limits, "devices") }).catch(() => null)
      : Promise.resolve(null),
    loadNews(context.supabase, { locale: context.locale, limit: 3, releasesOnly: true }).catch(() => null),
    loadOfferPlans(context.currency).catch((): Awaited<ReturnType<typeof loadOfferPlans>> => ({})),
    orgId
      ? loadUpsellFacts(context.supabase, { orgId, tier: entitlements.tier }).catch(() => null)
      : Promise.resolve(null),
    belowPro ? loadProAvailability(context.supabase).catch(() => null) : Promise.resolve(null),
  ]);
  const offers = upsellFacts
    ? decideOffers(upsellFacts, "home")
    : entitlements.tier
      ? []
      : decideOffers({ tier: null, trailsUsed30d: 0 }, "home");

  const state: HomeState = {
    kind: "ready",
    firstName: context.profile.displayName.trim().split(/\s+/)[0] ?? "",
    locale: context.locale,
    tier: entitlements.tier,
    suspended: entitlements.suspended,
    features: entitlements.active ? enabledFeatures(limits) : [],
    devices,
    news,
    offers: offers.map((item) => ({ ...item, plan: offerPlans[item.offer] ?? null })),
    available,
    // The contact form in the member's language, opened on the service asked for.
    services: decideServiceOffers(entitlements.tier).map((offer) => ({
      offer,
      href: localizeHref(`/contato?assunto=${SERVICE_COPY[offer].subject}`, context.locale),
    })),
  };
  return <HomeView state={state} />;
}
