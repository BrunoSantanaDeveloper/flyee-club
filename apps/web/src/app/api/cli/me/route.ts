import { cliLinks, runCliRequest } from "@/lib/cli/gates";
import { readCliSettings } from "@/lib/cli/settings";
import { revalidationUrl } from "@/lib/oauth/server";

/**
 * GET /api/cli/me: who is signed in, what the workspace may use, and when
 * this machine must revalidate (docs/CLI-CONTRACT.md). Answers an inactive
 * workspace too, so the CLI can say why nothing installs.
 */
export async function GET(request: Request) {
  return runCliRequest(
    request,
    { endpoint: "me", scope: "profile:read", device: "optional", requireActive: false },
    async ({ service, auth, entitlements, device, deviceHeader }) => {
      const [{ data: profile }, { data: workspace }, settings] = await Promise.all([
        service
          .from("profiles")
          .select("id, display_name, segment, ai_tool, locale")
          .eq("id", auth.userId)
          .maybeSingle(),
        service.from("organizations").select("id, name").eq("id", auth.orgId).maybeSingle(),
        readCliSettings(service),
      ]);
      const deviceId = deviceHeader ?? auth.deviceId;
      const daysUntilRevalidation = auth.refreshExpiresAt
        ? Math.max(0, Math.ceil((Date.parse(auth.refreshExpiresAt) - Date.now()) / 86_400_000))
        : null;

      return {
        ok: true,
        body: {
          member: {
            id: auth.userId,
            name: (profile?.display_name as string | null) ?? null,
            segment: (profile?.segment as string | null) ?? null,
            ai_tool: (profile?.ai_tool as string | null) ?? null,
            locale: profile?.locale === "en" ? "en" : "pt-BR",
          },
          workspace: { id: auth.orgId, name: (workspace?.name as string | null) ?? null },
          access: {
            active: entitlements.active,
            suspended: entitlements.suspended,
            tier: entitlements.tier,
            limits: entitlements.limits,
          },
          token: {
            family_id: auth.familyId,
            refresh_expires_at: auth.refreshExpiresAt,
            days_until_revalidation: daysUntilRevalidation,
          },
          device: device
            ? {
                device_id: device.deviceId,
                name: device.name,
                registered: true,
                last_update_at: device.lastUpdateAt,
              }
            : deviceId
              ? { device_id: deviceId, name: null, registered: false, last_update_at: null }
              : null,
          cli: settings,
          revalidate_url: revalidationUrl(deviceId),
          links: { billing: cliLinks.billing(), devices: cliLinks.devices() },
        },
      };
    },
  );
}
