"use client";

import { useCallback, useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { type EntitlementKey, hasEntitlement, isTier, type Tier } from "@flyee/billing/entitlements";

/**
 * What the member's workspace is entitled to, as `org_entitlements(org)`
 * (migration 0004) answers it: the SINGLE source for "what does this
 * workspace unlock". The database merges the free floor, every live grant
 * (the kit, a courtesy), the live subscription and its add-ons. Screens never
 * re-derive it from `subscriptions` or `entitlement_grants`: a second opinion
 * about the same workspace is how two screens end up disagreeing.
 *
 * Screens branch on `tier` and on keys (`has("advanced_lessons")`), never on
 * plan names or slugs.
 */
export type EntitlementSource = {
  /** `grant` (kit, courtesy), `subscription`, `free` or `provisional` (a PIX being confirmed). */
  type: string;
  planId: string | null;
  tier: Tier | null;
};

export type Entitlements = {
  active: boolean;
  suspended: boolean;
  /** The subscription's status, when there is one. */
  status: string | null;
  /** Still unlocked while a failed renewal is retried. */
  pastDueGrace: boolean;
  graceEndsAt: string | null;
  /** The highest rung any live source grants; null = nothing bought. */
  tier: Tier | null;
  sources: EntitlementSource[];
  limits: Record<string, unknown>;
  /** Whether a right is on; always false while the workspace is inactive. */
  has: (key: EntitlementKey) => boolean;
};

type RpcEntitlements = {
  active?: boolean;
  suspended?: boolean;
  status?: string | null;
  past_due_grace?: boolean;
  grace_ends_at?: string | null;
  tier?: string | null;
  sources?: { type?: string; plan_id?: string | null; tier?: string | null }[] | null;
  limits?: Record<string, unknown> | null;
};

export function toEntitlements(raw: RpcEntitlements): Entitlements {
  const active = Boolean(raw.active);
  const limits = raw.limits ?? {};
  return {
    active,
    suspended: Boolean(raw.suspended),
    status: raw.status ?? null,
    pastDueGrace: Boolean(raw.past_due_grace),
    graceEndsAt: raw.grace_ends_at ?? null,
    tier: isTier(raw.tier) ? raw.tier : null,
    sources: (raw.sources ?? []).map((source) => ({
      type: source.type ?? "unknown",
      planId: source.plan_id ?? null,
      tier: isTier(source.tier) ? source.tier : null,
    })),
    limits,
    has: (key) => active && hasEntitlement(limits, key),
  };
}

export function useEntitlements(orgId: string | null) {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !isSupabaseConfigured) {
      setEntitlements(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("org_entitlements", { target_org: orgId });
      if (rpcError) throw rpcError;
      setEntitlements(toEntitlements((data ?? {}) as RpcEntitlements));
    } catch {
      setEntitlements(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { entitlements, loading, error, reload: load };
}
