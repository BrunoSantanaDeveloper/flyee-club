import { createAnonClient } from "@/lib/public-content";
import { routedProviderFor } from "@flyee/billing";
import { choosesPaymentHere, PROVIDER_MAX_INSTALLMENTS } from "@flyee/billing/currency";

/**
 * The most card installments the checkout offers in a currency
 * (`platform_settings.billing.max_installments`, migration 0004), clamped to
 * the providers' own ceiling. Only a provider that splits the card on our page
 * offers them (Asaas, in reais); with reais on Stripe this is 1 and every page
 * that reads it stops naming a split. 1 is also what an unreadable setting
 * yields: offering a split the server would refuse fails at the last step of
 * the purchase.
 */
export async function getMaxInstallments(currency: string): Promise<number> {
  if (!choosesPaymentHere(routedProviderFor(currency))) return 1;
  const supabase = createAnonClient();
  if (!supabase) return 1;
  const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "billing").maybeSingle();
  if (error) return 1;
  const configured = Math.floor(Number((data?.value as { max_installments?: unknown } | null)?.max_installments));
  if (!Number.isFinite(configured) || configured < 1) return 1;
  return Math.min(configured, PROVIDER_MAX_INSTALLMENTS);
}
