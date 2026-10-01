"use client";

import { useCallback, useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * What the member's workspace is entitled to, as `org_entitlements(org)`
 * answers it: the SINGLE source for "is this plan active and what does it
 * unlock" (`plans.limits` merged with add-ons). Screens never re-derive it
 * from `subscriptions` — a second opinion about the same workspace is how two
 * screens end up disagreeing.
 *
 * Phase 4 of docs/PLANO-IMPLEMENTACAO.md extends the RPC with one-time grants
 * (the kit) and a `tier`; this hook is where screens read them.
 */
export type Entitlements = {
  active: boolean;
  suspended: boolean;
  status: string | null;
  planId: string | null;
  planName: string | null;
  isFree: boolean;
  limits: Record<string, unknown>;
};

type RpcEntitlements = {
  active?: boolean;
  suspended?: boolean;
  status?: string | null;
  plan_id?: string | null;
  limits?: Record<string, unknown> | null;
};

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
      const raw = (data ?? {}) as RpcEntitlements;
      let planName: string | null = null;
      let isFree = true;
      if (raw.plan_id) {
        const { data: plan } = await supabase.from("plans").select("name, is_free").eq("id", raw.plan_id).maybeSingle();
        planName = (plan?.name as string | undefined) ?? null;
        isFree = Boolean(plan?.is_free);
      }
      setEntitlements({
        active: Boolean(raw.active),
        suspended: Boolean(raw.suspended),
        status: raw.status ?? null,
        planId: raw.plan_id ?? null,
        planName,
        isFree,
        limits: raw.limits ?? {},
      });
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
