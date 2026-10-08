"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { DEFAULTS } from "@/config";
import { recordAudit } from "@/lib/audit";
import { authorizeParamsFromForm, errorRedirectUrl, validateAuthorizeRequest } from "@/lib/oauth/authorize-request";
import { scopesToParam } from "@/lib/oauth/scopes";
import { issueAuthorizationCode } from "@/lib/oauth/server";
import { acceptTerms } from "@flyee/audit";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

/**
 * The approve/deny halves of /oauth/authorize. Everything the form carries is
 * re-validated against the client registration, and the workspace comes from
 * the SESSION's membership — never from the form — so a tampered submission
 * cannot authorize someone else's workspace or leak the code to a foreign URL.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  return { supabase, user: user! };
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const params = authorizeParamsFromForm(formData);

  let service;
  try {
    service = createServiceClient();
  } catch {
    redirect(DEFAULTS.appRoot);
  }

  const validation = await validateAuthorizeRequest(service!, params);
  if (!validation.ok) {
    if (validation.kind === "redirect") {
      redirect(errorRedirectUrl(params.redirectUri, validation.error, validation.description, params.state));
    }
    redirect(DEFAULTS.appRoot);
  }
  const { client, scopes, deviceId } = validation;

  // The workspace is the session's own (MVP: one per professional).
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = (membership?.org_id as string | undefined) ?? null;
  if (!orgId) redirect(DEFAULTS.appRoot);

  // Same gate the page showed: an active workspace (an account with no purchase
  // included: it installs the entry version of each app). What each module
  // needs is checked per call by the delivery API.
  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: orgId });
  if (!entitlements?.active) {
    redirect(DEFAULTS.appRoot);
  }

  const scope = scopesToParam(scopes);

  // The member accepts the versioned connection term, recorded like every
  // other consent on the platform (accept_terms, migration 0001).
  const locale = (await getLocale()) === "en" ? "en" : "pt-BR";
  const accepted = await acceptTerms(supabase, {
    slugs: ["cli-connection"],
    locale,
    context: { source: "oauth", client_id: client.client_id },
  });
  if (!accepted.ok) {
    redirect(errorRedirectUrl(params.redirectUri, "access_denied", "consent_not_recorded", params.state));
  }

  const issued = await issueAuthorizationCode(service!, {
    clientRowId: client.id,
    orgId: orgId!,
    userId: user.id,
    codeChallenge: params.codeChallenge,
    redirectUri: params.redirectUri,
    scope,
    deviceId,
  });
  if (!issued.ok) {
    redirect(errorRedirectUrl(params.redirectUri, "server_error", issued.description, params.state));
  }

  await recordAudit(supabase, "cli.connection_authorized", {
    orgId: orgId!,
    entityType: "oauth_client",
    entityId: client.id,
    metadata: { client_name: client.client_name, scope, device_id: deviceId },
  });

  const target = new URL(params.redirectUri);
  target.searchParams.set("code", (issued as { ok: true; code: string }).code);
  if (params.state) target.searchParams.set("state", params.state);
  redirect(target.toString());
}

export async function denyAuthorization(formData: FormData): Promise<void> {
  await requireUser();
  const params = authorizeParamsFromForm(formData);

  let service;
  try {
    service = createServiceClient();
  } catch {
    redirect(DEFAULTS.appRoot);
  }

  const validation = await validateAuthorizeRequest(service!, params);
  if (!validation.ok) redirect(DEFAULTS.appRoot);

  redirect(errorRedirectUrl(params.redirectUri, "access_denied", "The user denied the request.", params.state));
}
