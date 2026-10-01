import type { UpsellOffer, UpsellReason } from "@/lib/upsell";

/**
 * The words of an offer card, as `product` i18n keys (listed literally so the
 * message pruner sees them): what the rung is called, what it adds over the
 * one below, and why it is being shown. Shared by the home and the CLI
 * revalidation screen, so the same offer never reads two ways.
 */
export const OFFER_COPY: Record<
  UpsellOffer,
  { title: string; features: string[]; tone: "accent-2" | "primary" | "accent-4" }
> = {
  kit: {
    title: "home-offer-kit-title",
    features: ["home-offer-kit-feature-1", "home-offer-kit-feature-2", "home-offer-kit-feature-3"],
    tone: "accent-2",
  },
  club: {
    title: "home-offer-club-title",
    features: ["home-offer-club-feature-1", "home-offer-club-feature-2", "home-offer-club-feature-3"],
    tone: "primary",
  },
  pro: {
    title: "home-offer-pro-title",
    features: ["home-offer-pro-feature-1", "home-offer-pro-feature-2", "home-offer-pro-feature-3"],
    tone: "accent-4",
  },
};

export const REASON_COPY: Record<UpsellReason, string> = {
  no_access: "home-offer-reason-no-access",
  client_project: "home-offer-reason-client",
  broad_use: "home-offer-reason-broad",
};
