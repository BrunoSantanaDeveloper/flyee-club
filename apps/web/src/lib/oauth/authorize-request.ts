import "server-only";

import { redirectUriMatches } from "@/lib/oauth/redirect";
import { type OauthScope, resolveRequestedScopes } from "@/lib/oauth/scopes";
import { getOauthClient, isDeviceId, type OauthClientRow } from "@/lib/oauth/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared parse + validation for the /oauth/authorize screen and its server
 * actions. The action NEVER trusts the form's hidden fields on their own:
 * everything is re-validated against the client registration, so a tampered
 * form cannot smuggle a foreign redirect target past the approval.
 */

export type AuthorizeParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopeParam: string;
  /** The CLI's id for this machine (our extension); carried into the token family. */
  deviceId: string;
};

const first = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export function authorizeParamsFromSearch(source: Record<string, string | string[] | undefined>): AuthorizeParams {
  return {
    responseType: first(source.response_type),
    clientId: first(source.client_id),
    redirectUri: first(source.redirect_uri),
    state: first(source.state),
    codeChallenge: first(source.code_challenge),
    codeChallengeMethod: first(source.code_challenge_method),
    scopeParam: first(source.scope),
    deviceId: first(source.device_id),
  };
}

export function authorizeParamsFromForm(form: FormData): AuthorizeParams {
  const read = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    responseType: read("response_type"),
    clientId: read("client_id"),
    redirectUri: read("redirect_uri"),
    state: read("state"),
    codeChallenge: read("code_challenge"),
    codeChallengeMethod: read("code_challenge_method"),
    scopeParam: read("scope"),
    deviceId: read("device_id"),
  };
}

/** The query string that reproduces a request, for the sign-in round trip. */
export function authorizeQuery(params: AuthorizeParams): string {
  const query = new URLSearchParams({
    response_type: params.responseType,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    scope: params.scopeParam,
  });
  if (params.deviceId) query.set("device_id", params.deviceId);
  return query.toString();
}

export type AuthorizeValidation =
  /** Request is sound: show the consent screen / issue the code. */
  | { ok: true; client: OauthClientRow; scopes: OauthScope[]; deviceId: string | null }
  /**
   * The client or its redirect target could not be trusted: the ONLY safe
   * answer is rendering an error, never redirecting a user to an unverified URL.
   */
  | { ok: false; kind: "render"; error: "invalid_client" | "invalid_redirect" }
  /** Redirect target is verified; the protocol error goes back to the client. */
  | { ok: false; kind: "redirect"; error: "invalid_request"; description: string };

export async function validateAuthorizeRequest(
  service: SupabaseClient,
  params: AuthorizeParams,
): Promise<AuthorizeValidation> {
  const client = await getOauthClient(service, params.clientId);
  if (!client) return { ok: false, kind: "render", error: "invalid_client" };
  if (!redirectUriMatches(client.redirect_uris, params.redirectUri, client.loopback_any_port)) {
    return { ok: false, kind: "render", error: "invalid_redirect" };
  }
  if (params.responseType !== "code") {
    return { ok: false, kind: "redirect", error: "invalid_request", description: "response_type must be 'code'." };
  }
  if (!params.codeChallenge || params.codeChallengeMethod !== "S256") {
    return { ok: false, kind: "redirect", error: "invalid_request", description: "PKCE with S256 is required." };
  }
  if (params.deviceId && !isDeviceId(params.deviceId)) {
    return {
      ok: false,
      kind: "redirect",
      error: "invalid_request",
      description: "device_id must be 8 to 64 letters, digits, - or _.",
    };
  }
  return {
    ok: true,
    client,
    scopes: resolveRequestedScopes(params.scopeParam),
    deviceId: params.deviceId || null,
  };
}

/** Compose the error redirect back to a VERIFIED redirect_uri. */
export function errorRedirectUrl(redirectUri: string, error: string, description: string, state: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}
