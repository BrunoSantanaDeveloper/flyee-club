import { cliLinks, type CliOutcome, runCliRequest } from "@/lib/cli/gates";
import { parseInstallReport, registerDeviceArgs } from "@/lib/cli/installs";

/**
 * POST /api/cli/installs: the CLI reports the machine it runs on, after a
 * login and after every update (docs/CLI-CONTRACT.md). Creates the device on
 * first sight (the `cli.installed` event), refreshes it afterwards, and
 * enforces the plan's device ceiling: `register_member_device` (migrations
 * 0011 and 0036) refuses a machine past `limits.devices` and writes nothing.
 * What the report may carry, and what never refuses it, is
 * `lib/cli/installs.ts`.
 *
 * A login that named no machine is bound to the one it first reports, so the
 * chain can never be used from a second machine afterwards.
 */

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
      const parsed = parseInstallReport(payload);
      if (!parsed.ok) return { ok: false, status: 400, code: "invalid_request", extra: { issues: parsed.issues } };
      const body = parsed.report;
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

      const { data, error } = await service.rpc("register_member_device", registerDeviceArgs(auth, body));
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
