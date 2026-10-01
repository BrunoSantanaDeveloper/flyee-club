"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { recordAudit } from "@/lib/audit";
import { formatUserCode, normalizeUserCode } from "@/lib/oauth/device-code";
import { answerDeviceCode, findPendingDeviceCode } from "@/lib/oauth/server";
import { acceptTerms } from "@flyee/audit";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

/**
 * The member's answer to a device code (RFC 8628) at /ativar. The workspace
 * comes from the SESSION, never from the form; the code is re-read from the
 * database, so an expired or already answered code changes nothing.
 */

async function context(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const code = normalizeUserCode(String(formData.get("user_code") ?? ""));
  if (!user)
    redirect(`/auth/sign-in?next=${encodeURIComponent(code ? `/ativar?code=${formatUserCode(code)}` : "/ativar")}`);
  if (!code) redirect("/ativar?error=invalid");

  let service;
  try {
    service = createServiceClient();
  } catch {
    redirect("/ativar?error=unavailable");
  }
  return { supabase, user: user!, code: code!, service: service! };
}

async function workspaceOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (membership?.org_id as string | undefined) ?? null;
}

export async function approveDevice(formData: FormData): Promise<void> {
  const { supabase, user, code, service } = await context(formData);
  const retry = `/ativar?code=${formatUserCode(code)}`;

  const pending = await findPendingDeviceCode(service, code);
  if (!pending) redirect(`${retry}&error=expired`);

  const orgId = await workspaceOf(supabase);
  if (!orgId) redirect("/ativar?error=workspace");
  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: orgId });
  if (!entitlements?.active) redirect("/ativar?error=plan");

  const locale = (await getLocale()) === "en" ? "en" : "pt-BR";
  const accepted = await acceptTerms(supabase, {
    slugs: ["cli-connection"],
    locale,
    context: { source: "device", client_id: pending!.client.client_id },
  });
  if (!accepted.ok) redirect(`${retry}&error=consent`);

  const answered = await answerDeviceCode(service, { userCode: code, approve: true, userId: user.id, orgId: orgId! });
  if (!answered) redirect(`${retry}&error=expired`);

  await recordAudit(supabase, "cli.device_authorized", {
    orgId: orgId!,
    entityType: "oauth_client",
    entityId: pending!.client.id,
    metadata: { client_name: pending!.client.client_name, device_id: pending!.deviceId },
  });
  redirect("/ativar?status=approved");
}

export async function denyDevice(formData: FormData): Promise<void> {
  const { supabase, user, code, service } = await context(formData);
  const orgId = (await workspaceOf(supabase)) ?? "";
  await answerDeviceCode(service, { userCode: code, approve: false, userId: user.id, orgId });
  redirect("/ativar?status=denied");
}
