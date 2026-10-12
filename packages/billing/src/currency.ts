/**
 * Money routing (docs/BILLING.md). Pure and import-free, so client components
 * can read it through `@flyee/billing/currency` without pulling a provider SDK
 * into the browser bundle.
 *
 * One rule decides which provider charges a purchase: the currency of the
 * plan. USD goes through Stripe. BRL goes through Asaas (PIX, card,
 * installments, the NFS-e Asaas issues), unless the deployment names Stripe
 * for it (`BILLING_BRL_PROVIDER=stripe`, decided 2026-10-12: Stripe charges
 * everything until Asaas is set up). A plan never changes provider because of
 * who buys it, and a currency whose provider is not configured is simply not
 * on sale in that deployment.
 */
import type { BillingProviderName } from "./types";

export type BillingCurrency = "BRL" | "USD";

export const BILLING_CURRENCIES: readonly BillingCurrency[] = ["BRL", "USD"];

export const isBillingCurrency = (value: unknown): value is BillingCurrency =>
  typeof value === "string" && (BILLING_CURRENCIES as readonly string[]).includes(value);

/** The routing table when the deployment says nothing. */
export const CURRENCY_PROVIDER: Record<BillingCurrency, BillingProviderName> = {
  BRL: "asaas",
  USD: "stripe",
};

/**
 * The provider that charges reais, from `BILLING_BRL_PROVIDER`: empty means
 * the default (Asaas). Any other value is null, and then nothing priced in
 * BRL is on sale: a typo must close the till, not pick a provider.
 */
export function parseBrlProvider(value: string | null | undefined): BillingProviderName | null {
  const name = (value ?? "").trim().toLowerCase();
  if (name === "") return CURRENCY_PROVIDER.BRL;
  return name === "asaas" || name === "stripe" ? name : null;
}

/** The provider a currency routes to, configured or not; null for a currency we do not sell in. */
export function providerNameForCurrency(
  currency: string | null | undefined,
  brlProvider: BillingProviderName | null = CURRENCY_PROVIDER.BRL,
): BillingProviderName | null {
  const code = (currency ?? "").trim().toUpperCase();
  if (!isBillingCurrency(code)) return null;
  return code === "BRL" ? brlProvider : CURRENCY_PROVIDER[code];
}

/**
 * Whether the payment method and the card installments are chosen on our own
 * checkout page. Only Asaas: it charges the PIX shown here and splits a card.
 * Stripe's hosted page picks the method itself (card, and PIX when its
 * dashboard has it on) and does not split a card in Brazil, so a purchase
 * through it carries neither.
 */
export function choosesPaymentHere(provider: BillingProviderName | null): boolean {
  return provider === "asaas";
}

/**
 * The currency a visitor sees prices in when nothing else decided it: the
 * language of the page. Portuguese reads BRL, English reads USD. A visitor
 * can override it (the `moeda` cookie, `?moeda=USD`), which the caller reads
 * first.
 */
export function currencyForLocale(locale: string | null | undefined): BillingCurrency {
  return locale === "en" ? "USD" : "BRL";
}

/**
 * The most installments a card purchase may ever be split into. The offer
 * itself is configuration (`platform_settings.billing.max_installments`) and
 * is clamped to this ceiling, which is the providers' own limit.
 */
export const PROVIDER_MAX_INSTALLMENTS = 12;

/**
 * A price as people write it: "R$ 97" when the amount is whole, "R$ 77,60"
 * when it has cents, never "R$ 77,6" (what Intl prints with 0 to 2 fraction
 * digits) and never a rounded figure that differs from what is charged. Every
 * price a visitor or a member reads goes through here.
 */
export function formatPrice(amountCents: number, currency: string, locale: string): string {
  const digits = Math.round(amountCents) % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountCents / 100);
}
