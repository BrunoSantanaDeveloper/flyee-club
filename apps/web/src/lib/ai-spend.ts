import type { ChatUsage } from "@flyee/ai";
import { createServiceClient } from "@flyee/auth/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Records what one AI call cost, in the ledger of migration 0017_ai_spend.
 *
 * The club never spends AI credit on a member's behalf; the platform's only
 * model calls are the operator's own /admin/insights questions, and each one
 * goes through here. The price is applied in the database
 * (`record_ai_spend`), never here, so two call sites can never disagree about
 * what a token costs.
 *
 * **This never throws and never awaits anything the caller depends on.**
 * Metering is bookkeeping; an answer does not fail because a ledger row did
 * not land. Missing service key, missing session, RPC error — all of it ends
 * as a warning in the log and nothing else.
 */

/** What the money bought — mirrors the `feature` check in 0017. */
export type AiSpendFeature = "insights" | "other";

export type AiSpendInput = {
  /** NULL for the platform's own spend (admin insights, shared library). */
  orgId: string | null;
  feature: AiSpendFeature;
  provider: string;
  model: string;
  /** What the provider reported. Absent = the call is recorded unpriced. */
  usage?: ChatUsage | null;
  /** What the call belongs to, when there is such a row. */
  refId?: string | null;
  /**
   * The client to write with. Defaults to the service role, which is what
   * jobs have; a request-scoped caller may pass its own (the RPC accepts a
   * member writing for her own workspace).
   */
  client?: SupabaseClient;
};

function resolveClient(client?: SupabaseClient): SupabaseClient | null {
  if (client) return client;
  try {
    return createServiceClient();
  } catch {
    // No service key configured (local dev, preview): nothing to meter with.
    return null;
  }
}

export async function recordAiSpend(input: AiSpendInput): Promise<void> {
  const client = resolveClient(input.client);
  if (!client) return;

  try {
    const { error } = await client.rpc("record_ai_spend", {
      target_org: input.orgId,
      target_feature: input.feature,
      target_provider: input.provider,
      // The model that served the call wins over the one we asked for: a
      // fallback chain (transcription) can answer on a different, differently
      // priced model.
      target_model: input.usage?.model || input.model,
      target_tokens_in: input.usage?.tokensIn ?? 0,
      target_tokens_out: input.usage?.tokensOut ?? 0,
      target_ref: input.refId ?? null,
    });
    if (error) {
      console.warn("[ai-spend] not recorded:", error.message);
    }
  } catch (error) {
    console.warn("[ai-spend] not recorded:", error instanceof Error ? error.message : error);
  }
}

/**
 * The usage sink to hand a provider call, plus the promise the caller may
 * await when it wants the row to land before it returns.
 *
 * Used where the provider reports usage through a callback rather than a
 * return value (every `streamChat`, and `generateStructured`): the sink fires
 * during the call, the write starts immediately, and the caller decides
 * whether to wait for it.
 *
 *     const meter = aiSpendMeter({ orgId, feature: "hypotheses", provider, model });
 *     const raw = await provider.generateStructured(config, messages, output, meter.sink);
 *     await meter.settled();
 */
export function aiSpendMeter(input: Omit<AiSpendInput, "usage"> | null | undefined) {
  let write: Promise<void> | null = null;

  return {
    // No context means the caller has nothing to bill (a script, a test, a
    // preview with no service key). The provider still gets a sink so the
    // call sites read the same either way.
    sink: (usage: ChatUsage) => {
      if (!input) return;
      write = recordAiSpend({ ...input, usage });
    },
    /** Resolves once the row has been written, or immediately if none was. */
    settled: async () => {
      if (write) await write;
    },
  };
}

/**
 * Where a clinical AI call should be billed. Passed down from the route,
 * which is the layer that knows the workspace; the lib functions themselves
 * stay ignorant of tenancy.
 */
export type AiSpendContext = {
  orgId: string | null;
  refId?: string | null;
  client?: SupabaseClient;
};
