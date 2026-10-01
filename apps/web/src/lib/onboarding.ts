import { DEFAULTS } from "@/config";
import { computeProgress, type FlowKey, getOnboardingState, type OnboardingStep } from "@flyee/onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * flyee.club activation (docs/PRODUCT.md, "Métricas e trackers"): a member is
 * activated when they installed the harness and ran a first tool. The steps
 * before that are the honest path there: tell us who you are, get access,
 * install.
 *
 * Steps use LIVE facts read from the database (`member_activation_facts()`,
 * migration 0011 of the baseline), never click-tracking: the checklist must
 * reflect reality even when the work happened in the terminal.
 */
export const ONBOARDING_FLOW = "activation";

/**
 * Where a member who still has steps to do lands after auth. The dedicated
 * onboarding wizard arrives in phase 5 of docs/PLANO-IMPLEMENTACAO.md; until
 * then the app home carries the checklist.
 */
export const ONBOARDING_ROUTE = DEFAULTS.appRoot;

/** One member per workspace, so activation is the user's, not the org's. */
export const ONBOARDING_ORG_SCOPED = false;

export interface ActivationFacts {
  /** Segment and AI tool answered (profile). */
  hasProfileSegment: boolean;
  /** Catalog access: the kit, a subscription or a grant. */
  hasAccess: boolean;
  /** At least one device registered by the CLI. */
  hasDevice: boolean;
  /** At least one tool executed (event sent by the CLI). */
  hasFirstExecution: boolean;
}

const NO_FACTS: ActivationFacts = {
  hasProfileSegment: false,
  hasAccess: false,
  hasDevice: false,
  hasFirstExecution: false,
};

type RpcFacts = {
  has_profile_segment?: boolean;
  has_access?: boolean;
  has_device?: boolean;
  has_first_execution?: boolean;
};

/**
 * Reads the real state the checklist is derived from. One definer RPC answers
 * it because part of the truth (the first execution) lives in tables a member
 * cannot read directly. Any failure reads as "nothing done yet", which only
 * ever shows a step that may already be complete — never hides one.
 */
export async function getActivationFacts(supabase: SupabaseClient): Promise<ActivationFacts> {
  try {
    const { data, error } = await supabase.rpc("member_activation_facts");
    if (error || !data) return NO_FACTS;
    const facts = data as RpcFacts;
    return {
      hasProfileSegment: Boolean(facts.has_profile_segment),
      hasAccess: Boolean(facts.has_access),
      hasDevice: Boolean(facts.has_device),
      hasFirstExecution: Boolean(facts.has_first_execution),
    };
  } catch {
    return NO_FACTS;
  }
}

export function isActivated(facts: ActivationFacts): boolean {
  return facts.hasDevice && facts.hasFirstExecution;
}

/**
 * The steps rendered by the checklist (titles/descriptions are `product`
 * i18n keys). With no facts the steps still render as pending.
 */
export function buildOnboardingSteps(facts?: ActivationFacts): OnboardingStep[] {
  return [
    {
      key: "profile",
      title: "onboarding-step-profile",
      description: "onboarding-step-profile-description",
      href: "/settings",
      done: facts?.hasProfileSegment,
    },
    {
      key: "access",
      title: "onboarding-step-access",
      description: "onboarding-step-access-description",
      href: "/settings/billing?plan=kit",
      done: facts?.hasAccess,
    },
    {
      key: "install",
      title: "onboarding-step-install",
      description: "onboarding-step-install-description",
      href: "/inicio#instalar",
      done: facts?.hasDevice,
    },
    {
      key: "first-run",
      title: "onboarding-step-first-run",
      description: "onboarding-step-first-run-description",
      done: facts?.hasFirstExecution,
    },
  ];
}

/** Step definitions without live state — used where only the shape matters. */
export const ONBOARDING_STEPS: OnboardingStep[] = buildOnboardingSteps();

export const isOnboardingEnabled = ONBOARDING_STEPS.length > 0;

/** The user's active organization (first membership) — for org-scoped flows. */
async function getActiveOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

/**
 * The flow key shared by the resolver and the checklist card, so they all
 * read/write the SAME onboarding_state row. Use this instead of hand-building
 * the key.
 */
export async function getOnboardingFlowKey(supabase: SupabaseClient, userId: string): Promise<FlowKey> {
  const orgId = ONBOARDING_ORG_SCOPED ? await getActiveOrgId(supabase, userId) : null;
  return { userId, orgId, flow: ONBOARDING_FLOW };
}

/**
 * Where a user goes right after signing up / signing in. Called from the auth
 * entry points (never the middleware, which runs on every request and must
 * stay query-free). Falls back to the app root on any failure: auth must never
 * dead-end.
 */
export async function resolvePostAuthDestination(supabase: SupabaseClient, userId: string): Promise<string> {
  if (!isOnboardingEnabled) return DEFAULTS.appRoot;
  try {
    const key = await getOnboardingFlowKey(supabase, userId);
    const state = await getOnboardingState(supabase, key);
    if (state.completedAt) return DEFAULTS.appRoot;
    const facts = await getActivationFacts(supabase);
    const progress = computeProgress(buildOnboardingSteps(facts), state);
    return progress.complete ? DEFAULTS.appRoot : ONBOARDING_ROUTE;
  } catch {
    return DEFAULTS.appRoot;
  }
}
