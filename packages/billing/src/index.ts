import { parseBrlProvider, providerNameForCurrency } from "./currency";
import { AsaasProvider, asaasPixAvailable } from "./providers/asaas";
import { StripeProvider } from "./providers/stripe";
import type { BillingProviderName, PaymentProvider } from "./types";

export * from "./currency";
export * from "./entitlements";
export * from "./types";

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
export const isAsaasConfigured = Boolean(process.env.ASAAS_API_KEY);

/** Providers available in this deployment, in display order. */
export function configuredProviders(): BillingProviderName[] {
  const providers: BillingProviderName[] = [];
  if (isStripeConfigured) providers.push("stripe");
  if (isAsaasConfigured) providers.push("asaas");
  return providers;
}

/**
 * Who charges reais in this deployment (`BILLING_BRL_PROVIDER`; empty is
 * Asaas). Null when the value names no provider, and then nothing in BRL is on
 * sale (`npm run preflight` reports it).
 */
export const brlProvider = parseBrlProvider(process.env.BILLING_BRL_PROVIDER);

/**
 * The provider a currency routes to in this deployment, configured or not:
 * what the pages describe (installments, the payment step) before the store
 * has its keys.
 */
export function routedProviderFor(currency: string | null | undefined): BillingProviderName | null {
  return providerNameForCurrency(currency, brlProvider);
}

/**
 * The provider that charges a currency in THIS deployment: BRL through Asaas
 * (or Stripe, when `BILLING_BRL_PROVIDER` says so), USD through Stripe
 * (`./currency`). Null when that provider is not configured, and then the
 * plans in that currency are not on sale here. The money is never rerouted on
 * its own: a missing Asaas key does not send reais to Stripe, because the
 * buyer would lose the PIX on this page, the installments and the NFS-e the
 * pages describe. Only the deployment's explicit choice moves them, and the
 * pages follow it (`choosesPaymentHere`).
 */
export function providerForCurrency(currency: string | null | undefined): BillingProviderName | null {
  const name = routedProviderFor(currency);
  if (name === "asaas") return isAsaasConfigured ? "asaas" : null;
  if (name === "stripe") return isStripeConfigured ? "stripe" : null;
  return null;
}

/**
 * Whether the checkout should offer Pix.
 *
 * Decided by what the ACCOUNT can do, not by a switch someone has to remember
 * to flip. The first version of this was an env var defaulting to off, which
 * meant a production account with an active Pix key — verified — still only
 * offered card, and nobody could tell why from the screen.
 *
 * Offering a method the account cannot charge fails at the last step of the
 * funnel, so the account is asked. `BILLING_PIX_ENABLED=false` remains as a
 * kill switch for the day Pix has to come off in a hurry. Pix only exists for
 * BRL, and the Pix shown on this page is an Asaas charge. With reais on Stripe
 * the Pix is a method of Stripe's own page, switched on in its dashboard.
 */
export async function isPixAvailable(): Promise<boolean> {
  if ((process.env.BILLING_PIX_ENABLED ?? "").trim().toLowerCase() === "false") return false;
  if (providerForCurrency("BRL") !== "asaas") return false;
  return asaasPixAvailable();
}

export function getProvider(name: BillingProviderName): PaymentProvider {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "asaas":
      return new AsaasProvider();
  }
}
