"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requestMeetingEmails } from "@/lib/meeting-jobs";
import { createClient } from "@flyee/auth/server";

/**
 * What the member area writes, each through the database function that owns
 * the rule (entitlement, support-session fence, product event). The session
 * is the member's own; nothing here trusts an id beyond what the function
 * re-checks.
 *
 * Every action answers `{ ok, code? }` with the function's own code
 * (`not_entitled`, `closed`, `support_session`, `too_early`, …), so the
 * screen can say why in words.
 */

export type MemberActionResult = { ok: true; url?: string } | { ok: false; code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function call(fn: string, args: Record<string, unknown>): Promise<MemberActionResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, code: error.code === "42501" ? "not_authenticated" : "failed" };
    const result = (data ?? {}) as { ok?: boolean; code?: string; url?: string };
    if (result.ok === false) return { ok: false, code: result.code ?? "failed" };
    return { ok: true, ...(result.url ? { url: result.url } : {}) };
  } catch {
    return { ok: false, code: "failed" };
  }
}

/** A lesson started (on play) or finished: `lesson.started` / `lesson.completed`. */
export async function recordLessonProgress(lessonId: string, completed: boolean): Promise<MemberActionResult> {
  if (!UUID.test(lessonId)) return { ok: false, code: "invalid" };
  return call("record_lesson_progress", { target_lesson: lessonId, target_completed: completed });
}

/**
 * Registers the member and asks for the confirmation e-mail. The e-mail goes
 * out after the answer (the page does not wait on a mail provider), once per
 * registration: cancelling and registering again is a new registration, and
 * registering twice is not.
 */
export async function registerForMeeting(meetingId: string): Promise<MemberActionResult> {
  if (!UUID.test(meetingId)) return { ok: false, code: "invalid" };
  const result = await call("register_for_meeting", { target_meeting: meetingId });
  if (result.ok) {
    revalidatePath("/encontros");
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (user) {
      const userId = user.id;
      after(() => requestMeetingEmails({ meetingId, kind: "confirmation", userId }));
    }
  }
  return result;
}

export async function cancelMeetingRegistration(meetingId: string): Promise<MemberActionResult> {
  if (!UUID.test(meetingId)) return { ok: false, code: "invalid" };
  const result = await call("cancel_meeting_registration", { target_meeting: meetingId });
  if (result.ok) revalidatePath("/encontros");
  return result;
}

/** The external room's link, handed over from 15 minutes before the start (`meeting.attended`). */
export async function joinMeeting(meetingId: string): Promise<MemberActionResult> {
  if (!UUID.test(meetingId)) return { ok: false, code: "invalid" };
  return call("meeting_join", { target_meeting: meetingId });
}

export async function meetingRecording(meetingId: string): Promise<MemberActionResult> {
  if (!UUID.test(meetingId)) return { ok: false, code: "invalid" };
  return call("meeting_recording", { target_meeting: meetingId });
}

export async function castRoadmapVote(itemId: string): Promise<MemberActionResult> {
  if (!UUID.test(itemId)) return { ok: false, code: "invalid" };
  const result = await call("cast_roadmap_vote", { target_item: itemId });
  if (result.ok) revalidatePath("/roadmap");
  return result;
}

export async function withdrawRoadmapVote(itemId: string): Promise<MemberActionResult> {
  if (!UUID.test(itemId)) return { ok: false, code: "invalid" };
  const result = await call("withdraw_roadmap_vote", { target_item: itemId });
  if (result.ok) revalidatePath("/roadmap");
  return result;
}

export type ProposeResult = { ok: true; id: string } | { ok: false; code: string; max?: number };

/**
 * A proposal into the moderated queue (`propose_roadmap_item`, migration
 * 0026). The function re-checks the right, the trail and the ceiling of
 * proposals under review; the answer carries that ceiling so the screen can
 * say it in words.
 */
export async function proposeRoadmapItem(input: {
  title: string;
  description: string;
  trail: string | null;
  locale: string;
}): Promise<ProposeResult> {
  const title = input.title.trim().slice(0, 120);
  const description = input.description.trim().slice(0, 1000);
  if (title.length < 4) return { ok: false, code: "invalid_title" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("propose_roadmap_item", {
      target_title: title,
      target_description: description || null,
      target_trail: input.trail || null,
      target_locale: input.locale === "en" ? "en" : "pt-BR",
    });
    if (error) return { ok: false, code: error.code === "42501" ? "not_authenticated" : "failed" };
    const result = (data ?? {}) as { ok?: boolean; code?: string; id?: string; max?: number };
    if (result.ok === false || !result.id) return { ok: false, code: result.code ?? "failed", max: result.max };
    revalidatePath("/roadmap");
    return { ok: true, id: result.id };
  } catch {
    return { ok: false, code: "failed" };
  }
}

/** Disconnects one machine and every token of its chain (`device.revoked`). */
export async function revokeDevice(deviceRowId: string): Promise<MemberActionResult> {
  if (!UUID.test(deviceRowId)) return { ok: false, code: "invalid" };
  const result = await call("revoke_member_device", { target_device: deviceRowId, target_reason: "member" });
  if (result.ok) revalidatePath("/settings/devices");
  return result;
}

const SEGMENTS = ["negocio", "agencia", "produto", "dev", "outro"] as const;
const AI_TOOLS = ["claude_code", "codex", "gemini_cli", "cursor", "other"] as const;

export type ProfileUpdate = {
  displayName?: string;
  segment?: (typeof SEGMENTS)[number];
  aiTool?: (typeof AI_TOOLS)[number];
  locale?: "pt-BR" | "en";
  timezone?: string;
};

/** Who the member says they are: name, segment, AI tool, language, timezone (`profile.completed`). */
export async function updateProfile(update: ProfileUpdate): Promise<MemberActionResult> {
  if (update.segment && !(SEGMENTS as readonly string[]).includes(update.segment))
    return { ok: false, code: "invalid" };
  if (update.aiTool && !(AI_TOOLS as readonly string[]).includes(update.aiTool)) return { ok: false, code: "invalid" };
  if (update.locale && update.locale !== "pt-BR" && update.locale !== "en") return { ok: false, code: "invalid" };
  const result = await call("update_member_profile", {
    p_display_name: update.displayName ?? null,
    p_segment: update.segment ?? null,
    p_ai_tool: update.aiTool ?? null,
    p_locale: update.locale ?? null,
    p_timezone: update.timezone ?? null,
  });
  if (result.ok) {
    revalidatePath("/inicio");
    revalidatePath("/settings");
  }
  return result;
}
