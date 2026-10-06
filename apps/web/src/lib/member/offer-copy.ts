import type { ServiceOffer, UpsellOffer, UpsellReason } from "@/lib/upsell";

/**
 * The words of an offer card, as `product` i18n keys (listed literally so the
 * message pruner sees them): what the rung is called, what it adds over the
 * one below, and why it is being shown. Shared by the home and the CLI
 * revalidation screen, so the same offer never reads two ways.
 */
export const OFFER_COPY: Record<UpsellOffer, { title: string; features: string[]; tone: "accent-2" | "primary" }> = {
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
};

export const REASON_COPY: Record<UpsellReason, string> = {
  no_access: "home-offer-reason-no-access",
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
  { title: string; body: string; subject: string; tone: "accent-3" | "accent-4" }
> = {
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
