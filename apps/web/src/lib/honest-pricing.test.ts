// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { getDisplayPlans } from "@/app/[locale]/(marketing)/plans";
import type { PublicPlan } from "@flyee/billing/public";

/**
 * "Preço e vagas" (docs/PRODUCT.md, decided 2026-10-07), from the home brief's
 * honesty rule: no price is struck through and no "from/to" pair is shown, on
 * the public site, in the checkout or in the member area. A coupon is named
 * beside the price it gives. The seats left and the deadline of the founders
 * offer appear only on /fundadores, the page of the offer, read from the
 * database (founders_offer()).
 */

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("next-intl/server", () => ({
  // Each key comes back with its values, so the test reads what was asked for.
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  getLocale: async () => "pt-BR",
}));
vi.mock("@flyee/billing/public", () => ({ listPublicPlans: async () => rows.value }));
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
  limits: { catalog_access: 1, devices: 1 },
  sort: 1,
  accessMonths: 12,
};

// Intl separates the symbol with a no-break space; compare words, not bytes.
const read = (text: string) => text.replace(/\s/g, " ");

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPERATOR_ONLY = [
  /[\\/]app[\\/]\(dashboard\)[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]admin[\\/]/,
  /[\\/]lib[\\/]admin[\\/]/,
  /[\\/]icons[\\/]/,
];

/** Every source file a visitor or a member can be shown, the operator console aside. */
function* shippedFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* shippedFiles(full);
    } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      if (!OPERATOR_ONLY.some((pattern) => pattern.test(full))) yield full;
    }
  }
}

const relative = (file: string) => path.relative(WEB_SRC, file).replaceAll("\\", "/");

describe("honest pricing: no struck price, and the seats only on the founders page", () => {
  it("names the coupon beside the price it gives, and never strikes the list price through", async () => {
    rows.value = [KIT];
    const { plans } = await getDisplayPlans({
      coupon: { id: "c1", code: "LANCAMENTO", discountType: "percent", discountValue: 20 },
      currency: "BRL",
      stage: "open",
    });
    const [kit] = plans;
    // Cents always with two digits: never "R$ 77,6".
    expect(read(kit.price)).toBe("R$ 77,60");
    expect(kit.priceCondition).toBe('pricing-price-coupon {"code":"LANCAMENTO"}');
    expect(Object.keys(kit)).not.toContain("originalPrice");
    // The structured data keeps the list price: the offer open to everyone.
    expect(kit.priceAmount).toBe(97);
  });

  it("names nothing when no coupon applies to the card", async () => {
    rows.value = [KIT];
    const plain = await getDisplayPlans({ coupon: null, currency: "BRL", stage: "open" });
    expect(read(plain.plans[0].price)).toBe("R$ 97");
    expect(plain.plans[0].priceCondition).toBeUndefined();

    // A fixed amount belongs to one currency; in another it gives nothing.
    const otherCurrency = await getDisplayPlans({
      coupon: { id: "c2", code: "DOLAR", discountType: "fixed", discountValue: 1000, currency: "USD" },
      currency: "BRL",
      stage: "open",
    });
    expect(read(otherCurrency.plans[0].price)).toBe("R$ 97");
    expect(otherCurrency.plans[0].priceCondition).toBeUndefined();
  });

  it("strikes no price through on any screen a visitor or a member sees", () => {
    // A finished onboarding step is struck through on purpose; it is not a price.
    const allowed = new Set(["components/product/onboarding-checklist.tsx"]);
    const found = [...shippedFiles(WEB_SRC)]
      .filter((file) => !allowed.has(relative(file)))
      .filter((file) => /line-through|<s>|<s\s|<del[\s>]|<strike/.test(fs.readFileSync(file, "utf8")))
      .map(relative);
    expect(found).toEqual([]);
  });

  it("formats prices through formatPrice: never cut cents (R$ 77,6) or a rounded figure", () => {
    const found = [...shippedFiles(WEB_SRC)]
      .filter((file) => /style:\s*"currency"[^}]*FractionDigits:\s*0/.test(fs.readFileSync(file, "utf8")))
      .map(relative);
    expect(found).toEqual([]);
  });

  it("reads the seats left and the deadline of the offer only on the founders page", () => {
    const found = ["app", "components"]
      .flatMap((dir) => [...shippedFiles(path.join(WEB_SRC, dir))])
      .filter((file) =>
        /\bseats(?:Left|Total|Taken)\b|\b(?:offer|open|founders)\??\.deadline\b/.test(fs.readFileSync(file, "utf8")),
      )
      .map(relative);
    expect(found).toEqual(["app/[locale]/(funil)/fundadores/page.tsx"]);
  });
});
