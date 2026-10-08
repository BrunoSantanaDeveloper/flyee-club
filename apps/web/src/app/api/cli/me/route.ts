import { cliLinks, runCliRequest } from "@/lib/cli/gates";
import { meBody } from "@/lib/cli/me";
import { readCliSettings } from "@/lib/cli/settings";
import { revalidationUrl } from "@/lib/oauth/server";

/**
 * GET /api/cli/me: who is signed in, what the workspace may use, and when
 * this machine must revalidate (docs/CLI-CONTRACT.md). Answers an inactive
 * workspace too, so the CLI can say why nothing installs. The body is
 * `lib/cli/me.ts`.
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

      return {
        ok: true,
        body: meBody({
          auth,
          profile,
          workspaceName: (workspace?.name as string | null) ?? null,
          entitlements,
          device,
          deviceId,
          settings,
          revalidateUrl: revalidationUrl(deviceId),
          links: { billing: cliLinks.billing(), devices: cliLinks.devices() },
          now: Date.now(),
        }),
      };
    },
  );
}
