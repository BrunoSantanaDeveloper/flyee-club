import { cache } from "react";

import { createAnonClient } from "@/lib/public-content";

/**
 * What the public site offers (platform_settings `launch`, migration 0019,
 * flipped by the superadmin at /admin/support).
 *
 * - `waitlist`: nothing is on sale yet, so every primary call to action leads
 *   to the waitlist. Sign-in and sign-up stay reachable, only unadvertised.
 * - `open`: the same buttons lead to sign-up and checkout.
 *
 * Anything unreadable (no Supabase, an error, a malformed value) reads as
 * `waitlist`: sending a visitor to a checkout that may not exist is the worse
 * mistake of the two.
 */
export type LaunchStage = "waitlist" | "open";

export const getLaunchStage = cache(async (): Promise<LaunchStage> => {
  const supabase = createAnonClient();
  if (!supabase) return "waitlist";
  const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "launch").maybeSingle();
  if (error) return "waitlist";
  return (data?.value as { stage?: unknown } | null)?.stage === "open" ? "open" : "waitlist";
});

/** The page's primary action in a stage: the label key (marketing namespace) and where it leads. */
export type PrimaryCta = { labelKey: "cta-primary" | "cta-waitlist"; href: string };

/**
 * Where a purchase button sends someone once the store is open: the sign-up,
 * and from it straight to the checkout of FlyeeClub, never to the onboarding
 * or the member area first (decided 2026-10-08, docs/PRODUCT.md). Without a
 * plan, `/assinatura` sells the one-time access in the visitor's currency; a
 * visitor already signed in skips the sign-up (the middleware follows `next`).
 */
export const CHECKOUT_AFTER_SIGN_UP = `/auth/sign-up?next=${encodeURIComponent("/assinatura")}`;

export const primaryCtaFor = (stage: LaunchStage): PrimaryCta =>
  stage === "open"
    ? { labelKey: "cta-primary", href: CHECKOUT_AFTER_SIGN_UP }
    : { labelKey: "cta-waitlist", href: "/espera" };

/**
 * The header's button in a stage (decided 2026-10-06, docs/PRODUCT.md). Once
 * the store is open it is deliberately not a purchase: "Quero montar meu
 * sistema" takes the visitor to the plans, where every purchase button names
 * its plan. Before that it is the waitlist button, like every other one.
 */
export type NavCta = { labelKey: "cta-nav" | "cta-waitlist"; href: string };

export const navCtaFor = (stage: LaunchStage): NavCta =>
  stage === "open" ? { labelKey: "cta-nav", href: "/planos" } : { labelKey: "cta-waitlist", href: "/espera" };
