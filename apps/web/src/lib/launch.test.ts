// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { navCtaFor, primaryCtaFor } from "@/lib/launch";

describe("the site's buttons in each launch stage", () => {
  it("before the opening, every button leads to the waitlist, the header's included", () => {
    expect(primaryCtaFor("waitlist")).toEqual({ labelKey: "cta-waitlist", href: "/espera" });
    expect(navCtaFor("waitlist")).toEqual({ labelKey: "cta-waitlist", href: "/espera" });
  });

  it("once open, a purchase button signs up, and the header's button takes the visitor to the plans", () => {
    expect(primaryCtaFor("open")).toEqual({ labelKey: "cta-primary", href: "/auth/sign-up" });
    expect(navCtaFor("open")).toEqual({ labelKey: "cta-nav", href: "/planos" });
  });
});
