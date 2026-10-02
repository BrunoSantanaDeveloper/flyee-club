"use server";

import { revalidatePath } from "next/cache";

import type { Localized } from "@/lib/admin/catalog";
import { fromLocalInput } from "@/lib/admin/format";
import { MEETING_PROVIDERS, MEETING_STATES, type MeetingState } from "@/lib/admin/meetings";
import { requireSuperadmin } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit";
import { isMeetingEmailKind, meetingEmailWindow } from "@/lib/meeting-email-kinds";
import { requestMeetingEmails } from "@/lib/meeting-jobs";
import { isEmailConfigured } from "@flyee/email";

/**
 * What the meetings console writes (migrations 0014 and 0023). The database owns the
 * lifecycle rules (a slug freezes once the meeting is published or somebody
 * registered; only an ended meeting is archived; only a draft that was never
 * published and has no registrations is deleted) and `duplicate_meeting` /
 * `delete_meeting` audit themselves.
 */

export type MeetingActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const HTTPS = /^https:\/\/\S{4,}$/;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function localized(value: Localized | undefined, max: number): Localized {
  const pt = clean(value?.["pt-BR"], max);
  const en = clean(value?.en, max);
  return { ...(pt ? { "pt-BR": pt } : {}), ...(en ? { en } : {}) };
}

function dbMessage(raw: string, code?: string): string {
  if (raw.includes("meeting_slug_frozen")) {
    return "O endereço não muda depois que o encontro foi publicado ou recebeu inscrições: ele já está em e-mails e calendários.";
  }
  if (raw.includes("meeting_archive_requires_end")) return "Encerre o encontro antes de arquivar.";
  if (code === "23505") return "Já existe um encontro com esse endereço (slug). Escolha outro.";
  if (code === "23514") return "O banco recusou um dos valores. Confira os campos e tente de novo.";
  if (code === "42501") return "Só quem tem o papel de superadmin muda os encontros.";
  return raw;
}

const refresh = (id?: string) => {
  revalidatePath("/admin/encontros");
  if (id) revalidatePath(`/admin/encontros/${id}`);
  revalidatePath("/encontros");
};

export type MeetingInput = {
  id?: string | null;
  slug: string;
  title: Localized;
  description: Localized;
  /** `datetime-local`, read on the Brasília clock. Empty = no date yet. */
  startsAtLocal: string;
  durationMinutes: number | null;
  provider: string;
  joinUrl: string;
  recordingUrl: string;
};

export async function saveMeeting(input: MeetingInput): Promise<MeetingActionResult<{ id: string }>> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };

  const slug = clean(input.slug, 60).toLowerCase();
  if (!SLUG.test(slug)) return { ok: false, error: "O slug usa só letras minúsculas, números e hífens (2 a 60)." };
  const title = localized(input.title, 120);
  if (!title["pt-BR"]) return { ok: false, error: "Dê um título em português." };
  if (!(MEETING_PROVIDERS as readonly string[]).includes(input.provider))
    return { ok: false, error: "Escolha a ferramenta." };
  const startsAt = input.startsAtLocal ? fromLocalInput(input.startsAtLocal) : null;
  if (input.startsAtLocal && !startsAt) return { ok: false, error: "Data e hora inválidas." };
  const duration = input.durationMinutes;
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 600)) {
    return { ok: false, error: "A duração vai de 5 a 600 minutos." };
  }
  const joinUrl = clean(input.joinUrl, 500);
  const recordingUrl = clean(input.recordingUrl, 500);
  if ((joinUrl && !HTTPS.test(joinUrl)) || (recordingUrl && !HTTPS.test(recordingUrl))) {
    return { ok: false, error: "Os links começam com https://." };
  }

  const row = {
    slug,
    title,
    description: localized(input.description, 4000),
    starts_at: startsAt,
    duration_minutes: duration,
    provider: input.provider,
  };

  let meetingId = input.id ?? null;
  if (meetingId) {
    if (!UUID.test(meetingId)) return { ok: false, error: "Encontro inválido." };
    const { error } = await session.supabase.from("meetings").update(row).eq("id", meetingId);
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  } else {
    const { data, error } = await session.supabase.from("meetings").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: dbMessage(error?.message ?? "", error?.code) };
    meetingId = data.id as string;
  }

  // The private half: never readable by a member, whatever the state.
  const { error: linkError } = await session.supabase
    .from("meeting_links")
    .upsert({ meeting_id: meetingId, join_url: joinUrl || null, recording_url: recordingUrl || null });
  if (linkError) return { ok: false, error: dbMessage(linkError.message, linkError.code) };

  await recordAudit(session.supabase, input.id ? "admin.meeting.updated" : "admin.meeting.created", {
    entityType: "meeting",
    entityId: meetingId,
    metadata: { slug, hasJoinUrl: Boolean(joinUrl), hasRecording: Boolean(recordingUrl) },
  });
  refresh(meetingId);
  return { ok: true, data: { id: meetingId } };
}

export async function setMeetingState(id: string, state: string): Promise<MeetingActionResult> {
  if (!UUID.test(id) || !(MEETING_STATES as readonly string[]).includes(state))
    return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data, error } = await session.supabase
    .from("meetings")
    .update({ state: state as MeetingState })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  if (!data) return { ok: false, error: "Este encontro não existe mais. Recarregue a página." };
  await recordAudit(session.supabase, "admin.meeting.state_changed", {
    entityType: "meeting",
    entityId: id,
    metadata: { slug: data.slug, state },
  });
  refresh(id);
  return { ok: true, data: null };
}

/** A copy of the content and settings as a new draft: never the date, the links or the registrations. */
export async function duplicateMeeting(id: string): Promise<MeetingActionResult<{ id: string }>> {
  if (!UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data, error } = await session.supabase.rpc("duplicate_meeting", { target_meeting: id });
  if (error || !data)
    return { ok: false, error: dbMessage(error?.message ?? "Não foi possível duplicar.", error?.code) };
  refresh();
  return { ok: true, data: { id: data as string } };
}

const EMAIL_WINDOW_REFUSAL: Record<string, string> = {
  state: "Esta mensagem não se aplica ao estado atual do encontro.",
  "no-date": "Defina a data do encontro primeiro.",
  "too-early": "Ainda é cedo para este lembrete: ele diz quanto falta para o início.",
  "too-late": "A janela deste lembrete já passou.",
  "no-recording": "Cole o link da gravação primeiro.",
};

/**
 * Sends one of the meeting's messages now, to whoever has not received it
 * (lib/meeting-email.ts). The system sends each one by itself; this is for the
 * operator who does not want to wait for the next run, or whose environment
 * has no job queue. The same claim guards both paths, so pressing it twice, or
 * while the scheduled run is working, never writes to someone twice.
 */
export async function sendMeetingEmails(
  id: string,
  kind: string,
): Promise<MeetingActionResult<{ queued: boolean; emailed: number }>> {
  if (!UUID.test(id) || !isMeetingEmailKind(kind)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  if (!isEmailConfigured) {
    return { ok: false, error: "O envio de e-mails não está configurado neste ambiente (RESEND_API_KEY)." };
  }

  const [meetingRead, linkRead] = await Promise.all([
    session.supabase.from("meetings").select("slug, state, starts_at").eq("id", id).maybeSingle(),
    session.supabase.from("meeting_links").select("recording_url").eq("meeting_id", id).maybeSingle(),
  ]);
  if (meetingRead.error || linkRead.error) return { ok: false, error: "Não foi possível ler o encontro agora." };
  const meeting = meetingRead.data;
  if (!meeting) return { ok: false, error: "Este encontro não existe mais. Recarregue a página." };

  // Each reminder says how far the start is, so it only goes out inside its window.
  const sendWindow = meetingEmailWindow(kind, {
    state: meeting.state as string,
    startsAt: (meeting.starts_at as string | null) ?? null,
    hasRecording: Boolean(linkRead.data?.recording_url),
  });
  if (!sendWindow.open) return { ok: false, error: EMAIL_WINDOW_REFUSAL[sendWindow.why] };

  const result = await requestMeetingEmails({ meetingId: id, kind });
  await recordAudit(session.supabase, "admin.meeting.emails_requested", {
    entityType: "meeting",
    entityId: id,
    metadata: {
      slug: meeting.slug,
      kind,
      queued: result.queued,
      ...(result.queued ? {} : { claimed: result.claimed, emailed: result.emailed, released: result.released }),
    },
  });
  if (!result.queued && result.error) {
    return {
      ok: false,
      error: "O provedor de e-mail recusou o envio. Ninguém ficou marcado como avisado: tente de novo em instantes.",
    };
  }
  refresh(id);
  return { ok: true, data: { queued: result.queued, emailed: result.queued ? 0 : result.emailed } };
}

const DELETE_REFUSAL: Record<string, string> = {
  not_draft: "Só um rascunho é excluído. Encerre e arquive os outros.",
  was_published: "Este encontro já foi publicado: ele é arquivado, não excluído.",
  has_registrations: "Este encontro tem inscrições: ele é arquivado, não excluído.",
  not_found: "Este encontro não existe mais.",
};

export async function deleteMeeting(id: string, reason: string): Promise<MeetingActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data, error } = await session.supabase.rpc("delete_meeting", { target_meeting: id, target_reason: reason });
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  const result = (data ?? {}) as { ok?: boolean; code?: string };
  if (!result.ok) return { ok: false, error: DELETE_REFUSAL[result.code ?? ""] ?? "Não foi possível excluir." };
  refresh();
  return { ok: true, data: null };
}
