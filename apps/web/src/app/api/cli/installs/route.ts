import { z } from "zod";

import { cliLinks, type CliOutcome, runCliRequest } from "@/lib/cli/gates";
import { DEVICE_ID_PATTERN } from "@/lib/oauth/server";
import { AI_TOOLS } from "@flyee/catalog/manifest";
import { isSemver } from "@flyee/catalog/semver";

/**
 * POST /api/cli/installs: the CLI reports the machine it runs on, after a
 * login and after every update (docs/CLI-CONTRACT.md). Creates the device on
 * first sight (the `cli.installed` event), refreshes it afterwards, and
 * enforces the plan's device ceiling: `register_member_device` (migration
 * 0011) refuses a machine past `limits.devices` and writes nothing.
 *
 * A login that named no machine is bound to the one it first reports, so the
 * chain can never be used from a second machine afterwards.
 */

const semver = z.string().refine(isSemver, { message: "must be a version like 1.2.3" });

const installSchema = z
  .object({
    device_id: z.string().regex(DEVICE_ID_PATTERN),
    name: z.string().trim().max(80).optional(),
    os: z.enum(["windows", "macos", "linux", "other"]).optional(),
    os_version: z.string().trim().max(40).optional(),
    ai_tool: z.enum(AI_TOOLS).optional(),
    cli_version: semver.optional(),
    core_version: semver.optional(),
    installed_modules: z
      .array(z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/), version: semver }).strict())
      .max(500)
      .optional(),
    project_kind: z.enum(["own", "client"]).optional(),
    /** True right after `npx flyee update` ran: stamps the machine's last update. */
    updated: z.boolean().optional(),
  })
  .strict();

type RegisterResult = {
  ok?: boolean;
  code?: string;
  device?: Record<string, unknown>;
  limit?: number;
  live_devices?: number;
  suspended?: boolean;
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  return runCliRequest(
    request,
    { endpoint: "installs", scope: "profile:read", device: "optional", allowRevokedDevice: true },
    async ({ service, auth, deviceHeader }): Promise<CliOutcome> => {
      const parsed = installSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          ok: false,
          status: 400,
          code: "invalid_request",
          extra: { issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) },
        };
      }
      const body = parsed.data;
      if ((deviceHeader && deviceHeader !== body.device_id) || (auth.deviceId && auth.deviceId !== body.device_id)) {
        return { ok: false, status: 403, code: "device_mismatch" };
      }

      // Bind an unbound chain to the machine it first reports.
      if (!auth.deviceId) {
        await service
          .from("oauth_tokens")
          .update({ device_id: body.device_id })
          .eq("family_id", auth.familyId)
          .is("device_id", null);
      }

      const { data, error } = await service.rpc("register_member_device", {
        target_user: auth.userId,
        target_org: auth.orgId,
        target_device_id: body.device_id,
        target_token_family: auth.familyId,
        target_name: body.name ?? null,
        target_os: body.os ?? null,
        target_os_version: body.os_version ?? null,
        target_ai_tool: body.ai_tool ?? null,
        target_cli_version: body.cli_version ?? null,
        target_core_version: body.core_version ?? null,
        target_installed_modules: body.installed_modules ?? null,
        target_project_kind: body.project_kind ?? null,
        target_updated: body.updated ?? false,
      });
      if (error) throw new Error("device_registration_failed");
      const result = (data ?? {}) as RegisterResult;

      if (result.ok) {
        return {
          ok: true,
          status: result.code === "created" ? 201 : 200,
          body: {
            status: result.code,
            device: result.device,
            limit: result.limit,
            live_devices: result.live_devices,
          },
        };
      }
      switch (result.code) {
        case "device_limit_reached":
          return {
            ok: false,
            status: 409,
            code: "device_limit_reached",
            values: { limit: result.limit ?? 0 },
            actionUrl: cliLinks.devices(),
            extra: { limit: result.limit, live_devices: result.live_devices },
          };
        case "device_revoked":
          return { ok: false, status: 403, code: "device_revoked" };
        case "not_entitled":
          return result.suspended
            ? { ok: false, status: 403, code: "suspended", actionUrl: cliLinks.support() }
            : { ok: false, status: 403, code: "not_entitled", actionUrl: cliLinks.billing() };
        case "invalid_device":
          return { ok: false, status: 400, code: "invalid_request" };
        default:
          throw new Error(`device_registration_refused:${result.code ?? "unknown"}`);
      }
    },
  );
}
