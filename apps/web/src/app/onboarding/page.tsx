import OnboardingWizard from "./onboarding-wizard";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEFAULTS } from "@/config";
import { COOKIE_KEYS } from "@/constants";
import { cloudHostsNow } from "@/lib/cli/settings";
import { getMemberContext } from "@/lib/member/context";
import { normalizeSegment } from "@/lib/site-segment";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /onboarding: where a new member lands after sign-up (lib/onboarding.ts,
 * `resolvePostAuthDestination`) until they have said what they build and
 * which AI they use. It opens on the first unanswered step.
 */
export default async function OnboardingPage() {
  const context = await getMemberContext();
  // No session means the middleware already redirected; no Supabase means there is nothing to set up.
  if (!context) redirect(DEFAULTS.appRoot);

  // The segment declared on the site before the account existed pre-fills the
  // first step (a sign-up through a provider carries no metadata); the member
  // still confirms it.
  const declared = normalizeSegment((await cookies()).get(COOKIE_KEYS.segment)?.value);

  return (
    <OnboardingWizard
      firstName={context.profile.displayName.trim().split(/\s+/)[0] ?? ""}
      initial={{
        segment: context.profile.segment ?? declared ?? "",
        aiTool: context.profile.aiTool ?? "",
        locale: context.profile.locale,
      }}
      hasAccess={Boolean(context.entitlements.tier)}
      cloudHosts={await cloudHostsNow()}
    />
  );
}
