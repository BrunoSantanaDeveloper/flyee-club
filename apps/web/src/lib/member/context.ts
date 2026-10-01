import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { COOKIE_KEYS } from "@/constants";
import { resolveCurrency } from "@/lib/billing-currency";
import type { CatalogLocale } from "@/lib/catalog/links";
import { type Entitlements, type RpcEntitlements, toEntitlements } from "@/lib/entitlements";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";
import type { BillingCurrency } from "@flyee/billing/currency";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who is looking at a member screen, read once per request on the server:
 * the session client (every read under row-level security), the workspace,
 * the language the screen renders in, the currency prices show in, and
 * `org_entitlements`, the one answer to "what may this workspace use".
 *
 * Null when there is no session (the middleware normally redirects first) or
 * no Supabase: every member screen renders its "unavailable" state then.
 */
export type MemberProfile = {
  displayName: string;
  segment: string | null;
  aiTool: string | null;
  locale: CatalogLocale;
  timezone: string | null;
};

export type MemberContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  orgId: string | null;
  locale: CatalogLocale;
  currency: BillingCurrency;
  profile: MemberProfile;
  entitlements: Entitlements;
};

export async function getMemberContext(): Promise<MemberContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: membership }, { data: profile }, uiLocale, cookieStore] = await Promise.all([
    supabase.from("memberships").select("org_id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, segment, ai_tool, locale, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    getLocale(),
    cookies(),
  ]);
  const orgId = (membership?.org_id as string | undefined) ?? null;
  const { data: raw } = orgId ? await supabase.rpc("org_entitlements", { target_org: orgId }) : { data: null };
  const locale: CatalogLocale = uiLocale === "en" ? "en" : "pt-BR";

  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    orgId,
    locale,
    currency: resolveCurrency({ cookie: cookieStore.get(COOKIE_KEYS.currency)?.value, locale }),
    profile: {
      displayName: (profile?.display_name as string | null) ?? user.email?.split("@")[0] ?? "",
      segment: (profile?.segment as string | null) ?? null,
      aiTool: (profile?.ai_tool as string | null) ?? null,
      locale: profile?.locale === "en" ? "en" : "pt-BR",
      timezone: (profile?.timezone as string | null) ?? null,
    },
    entitlements: toEntitlements((raw ?? {}) as RpcEntitlements),
  };
}
