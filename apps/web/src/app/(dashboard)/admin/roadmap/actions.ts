"use server";

import { revalidatePath } from "next/cache";

import type { Localized } from "@/lib/admin/catalog";
import { ROADMAP_STATUSES, type RoadmapStatus } from "@/lib/admin/roadmap";
import { requireSuperadmin } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit";

/**
 * What the roadmap console writes (migration 0009). The vote counter is not
 * writable by anyone: only the trigger behind `cast_roadmap_vote` moves it.
 */

export type RoadmapActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function localized(value: Localized | undefined, max: number): Localized {
  const pt = clean(value?.["pt-BR"], max);
  const en = clean(value?.en, max);
  return { ...(pt ? { "pt-BR": pt } : {}), ...(en ? { en } : {}) };
}

const isStatus = (value: string): value is RoadmapStatus => (ROADMAP_STATUSES as readonly string[]).includes(value);

export type RoadmapItemInput = {
  id?: string | null;
  title: Localized;
  description: Localized;
  trail: string | null;
  status: string;
  shippedModuleId: string | null;
  sort: number;
  /** An idea from a paid request, public by default (migration 0033). */
  commissioned: boolean;
};

export async function saveRoadmapItem(input: RoadmapItemInput): Promise<RoadmapActionResult<{ id: string }>> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin muda o roadmap." };
  const title = localized(input.title, 120);
  if (!title["pt-BR"]) return { ok: false, error: "Dê um título em português." };
  if (!isStatus(input.status)) return { ok: false, error: "Escolha o estado." };
  const shipped =
    input.status === "shipped" && input.shippedModuleId && UUID.test(input.shippedModuleId)
      ? input.shippedModuleId
      : null;

  const row = {
    title,
    description: localized(input.description, 1000),
    trail: input.trail || null,
    status: input.status,
    shipped_module_id: shipped,
    sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
    commissioned: Boolean(input.commissioned),
  };

  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "Item inválido." };
    const { data, error } = await session.supabase
      .from("roadmap_items")
      .update(row)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Este item não existe mais. Recarregue a página." };
    await recordAudit(session.supabase, "admin.roadmap.item.updated", {
      entityType: "roadmap_item",
      entityId: data.id,
      metadata: { status: row.status },
    });
    revalidatePath("/admin/roadmap");
    revalidatePath("/roadmap");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await session.supabase
    .from("roadmap_items")
    .insert({ ...row, created_by: session.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível criar o item." };
  await recordAudit(session.supabase, "admin.roadmap.item.created", {
    entityType: "roadmap_item",
    entityId: data.id,
    metadata: { status: row.status },
  });
  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");
  return { ok: true, data: { id: data.id } };
}

/** Moves an item along; "shipped" keeps the module it became, any other state clears it. */
export async function setRoadmapStatus(id: string, status: string): Promise<RoadmapActionResult> {
  if (!UUID.test(id) || !isStatus(status)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin muda o roadmap." };
  const change: Record<string, unknown> = { status };
  if (status !== "shipped") change.shipped_module_id = null;
  const { data, error } = await session.supabase
    .from("roadmap_items")
    .update(change)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Este item não existe mais. Recarregue a página." };
  await recordAudit(session.supabase, "admin.roadmap.item.status_changed", {
    entityType: "roadmap_item",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");
  return { ok: true, data: null };
}

const MONTH_START = /^\d{4}-\d{2}-01$/;

/**
 * Plans the month's most voted idea and records the month it won (migration
 * 0033), which "Próximos na loja" shows as "Mais votado de {mês}". The month
 * comes from the leaders card, which read it from roadmap_month_leader.
 */
export async function planMonthLeader(id: string, monthStart: string): Promise<RoadmapActionResult> {
  if (!UUID.test(id) || !MONTH_START.test(monthStart)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin muda o roadmap." };
  const { data, error } = await session.supabase
    .from("roadmap_items")
    .update({ status: "planned", won_month: monthStart, shipped_module_id: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Este item não existe mais. Recarregue a página." };
  await recordAudit(session.supabase, "admin.roadmap.item.month_leader_planned", {
    entityType: "roadmap_item",
    entityId: id,
    metadata: { won_month: monthStart },
  });
  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");
  return { ok: true, data: null };
}

/**
 * Only an item nobody voted for is deleted: a vote is a member's word that
 * they want it, and erasing the item would erase that. A voted item that will
 * not be built is declined instead, which members see.
 */
export async function deleteRoadmapItem(id: string): Promise<RoadmapActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: "Só quem tem o papel de superadmin muda o roadmap." };
  const { data: item } = await session.supabase.from("roadmap_items").select("votes_count").eq("id", id).maybeSingle();
  if (!item) return { ok: false, error: "Este item não existe mais. Recarregue a página." };
  if (Number(item.votes_count) > 0) {
    return {
      ok: false,
      error: "Este item tem votos. Marque como recusado em vez de excluir: quem votou vê o desfecho.",
    };
  }
  const { error } = await session.supabase.from("roadmap_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await recordAudit(session.supabase, "admin.roadmap.item.deleted", { entityType: "roadmap_item", entityId: id });
  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");
  return { ok: true, data: null };
}
