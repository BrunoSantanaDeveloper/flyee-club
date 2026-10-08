import type { CliDevice, CliEntitlements } from "@/lib/cli/gates";
import { type CliLocale, tierName } from "@/lib/cli/messages";
import { type CliSettings, cliVersionBody } from "@/lib/cli/settings";
import type { VerifiedAccess } from "@/lib/oauth/server";

/** What GET /api/cli/me has read when it answers. */
export type MeFacts = {
  auth: Pick<VerifiedAccess, "userId" | "orgId" | "familyId" | "refreshExpiresAt">;
  profile: { display_name?: unknown; segment?: unknown; ai_tool?: unknown; locale?: unknown } | null;
  workspaceName: string | null;
  entitlements: CliEntitlements;
  /** The registered machine named by the header or the login, when there is one. */
  device: CliDevice | null;
  /** The machine's id even when it is not registered yet. */
  deviceId: string | null;
  settings: CliSettings;
  revalidateUrl: string;
  links: { billing: string; devices: string };
  now: number;
};

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * The body of GET /api/cli/me (docs/CLI-CONTRACT.md 4.1): who is signed in,
 * what the workspace may use, when this machine must revalidate, and what the
 * CLI should print for each. Answers an inactive workspace too, so the CLI
 * can say why nothing installs.
 */
export function meBody(facts: MeFacts) {
  const { auth, profile, entitlements, device, deviceId } = facts;
  const locale: CliLocale = profile?.locale === "en" ? "en" : "pt-BR";
  const daysUntilRevalidation = auth.refreshExpiresAt
    ? Math.max(0, Math.ceil((Date.parse(auth.refreshExpiresAt) - facts.now) / 86_400_000))
    : null;

  return {
    member: {
      id: auth.userId,
      name: text(profile?.display_name),
      segment: text(profile?.segment),
      ai_tool: text(profile?.ai_tool),
      locale,
    },
    workspace: { id: auth.orgId, name: facts.workspaceName },
    access: {
      active: entitlements.active,
      suspended: entitlements.suspended,
      tier: entitlements.tier,
      tier_name: tierName(entitlements.tier, locale),
      limits: entitlements.limits,
    },
    token: {
      family_id: auth.familyId,
      refresh_expires_at: auth.refreshExpiresAt,
      days_until_revalidation: daysUntilRevalidation,
    },
    device: device
      ? { device_id: device.deviceId, name: device.name, registered: true, last_update_at: device.lastUpdateAt }
      : deviceId
        ? { device_id: deviceId, name: null, registered: false, last_update_at: null }
        : null,
    cli: cliVersionBody(facts.settings),
    revalidate_url: facts.revalidateUrl,
    links: facts.links,
  };
}
