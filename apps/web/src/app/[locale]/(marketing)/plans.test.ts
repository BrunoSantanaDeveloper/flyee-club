// @vitest-environment node
import { getDisplayPlans } from "./plans";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicPlan } from "@flyee/billing/public";

/**
 * The cards of the public site (docs/PRODUCT.md, 2026-10-08): the site lists
 * only the plans marked for it, FlyeeClub alone today; the one-time access
 * reads in the labelled rows of the home brief, each row only when the plan
 * grants it; and the only plan on the page is its highlighted offer.
 */

const listed = vi.hoisted(() => ({ rows: [] as unknown[] | null, calls: [] as unknown[] }));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  getLocale: async () => "pt-BR",
}));
vi.mock("@flyee/billing/public", () => ({
  listPublicPlans: async (options: unknown) => {
    listed.calls.push(options);
    return listed.rows;
  },
}));
vi.mock("@/lib/billing-settings", () => ({ getMaxInstallments: async () => 12 }));

const KIT: PublicPlan = {
  slug: "kit",
  name: "FlyeeClub",
  description: null,
  kind: "access",
  family: "kit",
  tier: "kit",
  period: null,
  priceCents: 9700,
  currency: "BRL",
  trialDays: 0,
  isFree: false,
  limits: { catalog_access: 1, devices: 1, commercial_license: 1 },
  sort: 10,
  accessMonths: 12,
};

const PRO_MONTHLY: PublicPlan = {
  ...KIT,
  slug: "club-mensal",
  name: "FlyeeClub Pro",
  kind: "recurring",
  family: "club",
  tier: "club",
  period: "monthly",
  priceCents: 6700,
  limits: { catalog_access: 1, devices: 3, recipes: 1 },
  sort: 20,
  accessMonths: null,
};

beforeEach(() => {
  listed.rows = [];
  listed.calls = [];
});

describe("the pricing cards of the public site", () => {
  it("ask for the plans the site lists, in the page's currency", async () => {
    listed.rows = [KIT];
    await getDisplayPlans({ currency: "BRL", stage: "open" });
    expect(listed.calls).toEqual([{ surface: "site", currency: "BRL" }]);
  });

  it("show the one-time access in the brief's rows, each one only when the plan grants it", async () => {
    listed.rows = [KIT];
    const [card] = (await getDisplayPlans({ currency: "BRL", stage: "open" })).plans;
    expect(card.priceLabel).toBe("pricing-row-price");
    expect(card.rows?.map((row) => row.label)).toEqual([
      "pricing-row-apps",
      "pricing-row-updates",
      "pricing-row-guides",
      "pricing-row-projects",
      "pricing-row-devices",
    ]);
    expect(card.rows?.at(-1)?.value).toBe('pricing-row-devices-value {"count":1}');

    listed.rows = [{ ...KIT, limits: { catalog_access: 1, devices: 2 } }];
    const [noClients] = (await getDisplayPlans({ currency: "BRL", stage: "open" })).plans;
    expect(noClients.rows?.map((row) => row.label)).not.toContain("pricing-row-projects");
    expect(noClients.rows?.at(-1)?.value).toBe('pricing-row-devices-value {"count":2}');
  });

  it("make the only plan the highlighted offer, whose button leads to the sign-up and on to its checkout", async () => {
    listed.rows = [KIT];
    const { plans, periodToggle } = await getDisplayPlans({ currency: "BRL", stage: "open" });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      highlighted: true,
      ctaLabel: "pricing-cta-kit",
      ctaId: "plan_access",
      href: `/auth/sign-up?next=${encodeURIComponent("/assinatura?plan=kit")}`,
    });
    expect(periodToggle).toBeUndefined();
  });

  it("name a subscription the operator chose to list by its own name, in its feature list", async () => {
    listed.rows = [KIT, PRO_MONTHLY];
    const { plans } = await getDisplayPlans({ currency: "BRL", stage: "open" });
    const pro = plans.find((plan) => plan.slug === "club-mensal");
    expect(pro).toMatchObject({ ctaLabel: 'pricing-cta-plan {"plan":"FlyeeClub Pro"}', highlighted: true });
    expect(pro?.rows).toBeUndefined();
    expect(pro?.features.length).toBeGreaterThan(0);
    expect(plans.find((plan) => plan.slug === "kit")?.highlighted).toBe(false);
  });

  it("show one placeholder plan when there is no database, the site's single offer", async () => {
    listed.rows = null;
    const { plans } = await getDisplayPlans({ currency: "BRL", stage: "waitlist" });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ slug: "plan-1", highlighted: true, ctaId: "plan_access" });
  });
});
