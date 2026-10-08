import type { ProAvailability } from "@/lib/upgrade";
import type { ServiceOffer, UpsellOffer, UpsellReason } from "@/lib/upsell";

/**
 * The words of an offer card, as `product` i18n keys (listed literally so the
 * message pruner sees them): what the rung is called, what it adds over the
 * one below, and why it is being shown. Shared by the home and the CLI
 * revalidation screen, so the same offer never reads two ways. A line of
 * FlyeeClub Pro names the area it depends on, so it says "Em breve" while
 * that area has nothing published (docs/PRODUCT.md, 2026-10-08).
 */
type OfferLine = { key: string; area?: keyof ProAvailability };

export const OFFER_COPY: Record<UpsellOffer, { title: string; features: OfferLine[]; tone: "accent-2" | "primary" }> = {
  kit: {
    title: "home-offer-kit-title",
    features: [
      { key: "home-offer-kit-feature-1" },
      { key: "home-offer-kit-feature-2" },
      { key: "home-offer-kit-feature-3" },
    ],
    tone: "accent-2",
  },
  club: {
    title: "home-offer-club-title",
    features: [
      { key: "home-offer-club-feature-1", area: "advancedGuides" },
      { key: "home-offer-club-feature-2", area: "recipes" },
      { key: "home-offer-club-feature-3", area: "meetings" },
      { key: "home-offer-club-feature-4" },
    ],
    tone: "primary",
  },
};

/** An offer's lines, translated and marked: `available` null when it could not be read (nothing is marked). */
export function offerLines(
  offer: UpsellOffer,
  t: (key: string) => string,
  available: ProAvailability | null,
): { label: string; soon: boolean }[] {
  return OFFER_COPY[offer].features.map((line) => ({
    label: t(line.key),
    soon: Boolean(line.area && available && !available[line.area]),
  }));
}

export const REASON_COPY: Record<UpsellReason, string> = {
  no_access: "home-offer-reason-no-access",
  beyond_apps: "home-offer-reason-beyond-apps",
  broad_use: "home-offer-reason-broad",
  member: "home-offer-reason-member",
};

/**
 * A service sold on demand: not a plan, so no price and no feature list. The
 * card leads to the contact form with its subject (`?assunto=`), which the
 * form opens pre-filled.
 */
export const SERVICE_COPY: Record<
  ServiceOffer,
  { title: string; body: string; subject: string; tone: "accent-1" | "accent-3" | "accent-4" }
> = {
  custom_app: {
    title: "home-service-app-title",
    body: "home-service-app-body",
    subject: "app",
    tone: "accent-1",
  },
  mentoring: {
    title: "home-service-mentoring-title",
    body: "home-service-mentoring-body",
    subject: "mentoria",
    tone: "accent-3",
  },
  consulting: {
    title: "home-service-consulting-title",
    body: "home-service-consulting-body",
    subject: "consultoria",
    tone: "accent-4",
  },
};
