// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CHECKOUT_AFTER_SIGN_UP, navCtaFor, primaryCtaFor } from "@/lib/launch";
import { sanitizeInternalNext } from "@/lib/safe-next";

describe("the site's buttons in each launch stage", () => {
  it("before the opening, every button leads to the waitlist, the header's included", () => {
    expect(primaryCtaFor("waitlist")).toEqual({ labelKey: "cta-waitlist", href: "/espera" });
    expect(navCtaFor("waitlist")).toEqual({ labelKey: "cta-waitlist", href: "/espera" });
  });

  it("once open, a purchase button signs up, and the header's button takes the visitor to the plans", () => {
    expect(primaryCtaFor("open")).toEqual({ labelKey: "cta-primary", href: CHECKOUT_AFTER_SIGN_UP });
    expect(navCtaFor("open")).toEqual({ labelKey: "cta-nav", href: "/planos" });
  });

  it("and the sign-up hands the new account straight to the checkout, not to the onboarding", () => {
    // What the sign-up page and the auth callback read and follow (docs/PRODUCT.md, 2026-10-08).
    const url = new URL(primaryCtaFor("open").href, "https://flyee.club");
    expect(url.pathname).toBe("/auth/sign-up");
    expect(sanitizeInternalNext(url.searchParams.get("next"))).toBe("/assinatura");
  });
});
