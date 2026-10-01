import OnboardingWizard from "./onboarding-wizard";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DEFAULTS } from "@/config";
import { getMemberContext } from "@/lib/member/context";

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

  return (
    <OnboardingWizard
      firstName={context.profile.displayName.trim().split(/\s+/)[0] ?? ""}
      initial={{
        segment: context.profile.segment ?? "",
        aiTool: context.profile.aiTool ?? "",
        locale: context.profile.locale,
      }}
      hasAccess={Boolean(context.entitlements.tier)}
    />
  );
}
