"use server";

import { revalidatePath } from "next/cache";

import { loadLeads, resendCsv } from "@/lib/admin/leads";
import { requireSuperadmin } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit";

/**
 * What the leads console does to a contact (migration 0013): record an opt-out,
 * erase a contact (`purge_lead`, which removes the row AND its change history
 * and audits itself), and export the contacts the consent allows mailing.
 */

export type LeadActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stops every mailing to this address. Lifted only by the person confirming again from their inbox. */
export async function optOutLead(id: string): Promise<LeadActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Contato inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin muda os leads." };
  const { data, error } = await session.supabase
    .from("leads")
    .update({ opted_out_at: new Date().toISOString() })
    .eq("id", id)
    .is("opted_out_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Este contato já está descadastrado ou não existe mais." };
  // The id only: the address is personal data and the trail outlives an erasure.
  await recordAudit(session.supabase, "admin.leads.opted_out", { entityType: "lead", entityId: id });
  revalidatePath("/admin/leads");
  return { ok: true, data: null };
}

const PURGE_REFUSAL: Record<string, string> = {
  not_authorized: "Só quem tem o papel de superadmin apaga contatos, e nunca de dentro de uma sessão de suporte.",
  not_found: "Este contato não existe mais.",
};

/** Erases the contact and every version of it. Irreversible. */
export async function purgeLead(id: string, reason: string): Promise<LeadActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Contato inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: PURGE_REFUSAL.not_authorized };
  const { data, error } = await session.supabase.rpc("purge_lead", { target_lead: id, target_reason: reason.trim() });
  if (error) return { ok: false, error: error.message };
  const result = (data ?? {}) as { ok?: boolean; code?: string };
  if (!result.ok) return { ok: false, error: PURGE_REFUSAL[result.code ?? ""] ?? "Não foi possível apagar." };
  revalidatePath("/admin/leads");
  return { ok: true, data: null };
}

/**
 * The CSV of contacts that may be mailed, read fresh from the database and
 * audited with its size: an export of personal data leaves a trace of who took
 * it and when.
 */
export async function exportSubscribedLeads(): Promise<LeadActionResult<{ csv: string; count: number }>> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin exporta contatos." };
  let leads;
  try {
    leads = await loadLeads(session.supabase);
  } catch {
    return { ok: false, error: "Não foi possível ler os contatos agora." };
  }
  const exported = resendCsv(leads);
  await recordAudit(session.supabase, "admin.leads.exported", {
    entityType: "lead",
    metadata: { count: exported.count, format: "resend_csv" },
  });
  return { ok: true, data: exported };
}
