"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Box } from "@mui/material";

import OnboardingChecklist from "@/components/product/onboarding-checklist";
import {
  type ActivationFacts,
  buildOnboardingSteps,
  getActivationFacts,
  getOnboardingFlowKey,
  isActivated,
  isOnboardingEnabled,
} from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { dismissFlow, type FlowKey, getOnboardingState, type OnboardingStateRow } from "@flyee/onboarding";

/**
 * Drop-in activation card for the app home: reads the member's onboarding
 * state AND the live facts the steps are derived from (profile answered?
 * access? a device installed? a first tool run?), so the checklist reflects
 * reality rather than clicks. Renders nothing when onboarding is not declared,
 * Supabase is unconfigured, the member is activated, or they dismissed it —
 * safe to mount unconditionally.
 */
export default function OnboardingChecklistCard({
  title,
  className,
  fallback = null,
}: {
  title?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const t = useTranslations("product");
  const [flowKey, setFlowKey] = useState<FlowKey | null>(null);
  const [state, setState] = useState<OnboardingStateRow | null>(null);
  const [facts, setFacts] = useState<ActivationFacts | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured || !isOnboardingEnabled) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const key = await getOnboardingFlowKey(supabase, user.id);
      setFlowKey(key);
      const [onboardingState, activationFacts] = await Promise.all([
        getOnboardingState(supabase, key),
        getActivationFacts(supabase),
      ]);
      setState(onboardingState);
      setFacts(activationFacts);
    };
    load();
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!flowKey) return;
    setState((current) => (current ? { ...current, dismissed: true } : current));
    await dismissFlow(createClient(), flowKey);
  }, [flowKey]);

  if (!state || !facts) return null;

  if (state.dismissed || state.completedAt || isActivated(facts)) return fallback;

  // Step titles/descriptions are declared as i18n keys (lib/onboarding.ts).
  const steps = buildOnboardingSteps(facts).map((step) => ({
    ...step,
    title: t(step.title),
    description: step.description ? t(step.description) : undefined,
  }));

  return (
    <Box className="flex flex-col gap-2">
      <OnboardingChecklist title={title} steps={steps} state={state} onDismiss={handleDismiss} className={className} />
    </Box>
  );
}
