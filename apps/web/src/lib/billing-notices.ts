import "server-only";

import { dateLabel, memberUrl, moneyLabel } from "@/lib/messages/format";
import { workspaceManagers, workspaceMemberIds } from "@/lib/messages/recipients";
import { notifyLocalized } from "@/lib/notifications";
import { limitOf } from "@flyee/billing/entitlements";
import {
  type CancelCause,
  sendAccessEndedEmail,
  sendKitReceiptEmail,
  sendSubscriptionActiveEmail,
  sendSubscriptionCanceledEmail,
  sendTermEndingEmail,
} from "@flyee/email";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What a workspace is told about its billing, by the bell and by e-mail, each
 * person in the language they read: a plan went live, the one-time access was
 * granted, a payment failed or recovered, a subscription ended, a paid period
 * or an access term is about to end, an access term ran out.
 *
 * Called by the provider webhook and by the billing jobs, with the service
 * role: there is no member session behind either. Every function here is
 * best-effort by construction and never throws. By the time it runs the
 * database already holds the truth (the plan is active, the grant is given),
 * and a webhook that failed because a bell could not be written would be
 * replayed by the provider and reconcile the whole event again.
 *
 * A plan is always called by the name it has in the data (`plans.name`).
 * The bell reaches every member of the workspace; the e-mail goes to who
 * manages it (owner and admins).
 */

const HOME = "/inicio";
const BILLING = "/settings/billing";

async function quietly(what: string, orgId: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error("billing_notice_failed", {
      what,
      orgId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function planFacts(
  service: SupabaseClient,
  planId: string,
): Promise<{ name: string; limits: Record<string, unknown> } | null> {
  const { data } = await service.from("plans").select("name, limits").eq("id", planId).maybeSingle();
  if (!data?.name) return null;
  return { name: data.name as string, limits: (data.limits as Record<string, unknown> | null) ?? {} };
}

/** A subscription went live: the bell, and the confirmation with what the plan unlocks. */
export async function notifyPlanActive(service: SupabaseClient, orgId: string, planId: string): Promise<void> {
  await quietly("plan_active", orgId, async () => {
    const plan = await planFacts(service, planId);
    if (!plan) return;
    await notifyLocalized(await workspaceMemberIds(service, orgId), (copy) => copy.planActive(plan.name), {
      type: "billing",
      href: HOME,
    });
    // And out of the app: with Pix the member is not here when this runs.
    for (const person of await workspaceManagers(service, orgId)) {
      await sendSubscriptionActiveEmail(person.email, {
        locale: person.locale,
        name: person.name,
        planName: plan.name,
        limits: plan.limits,
        appUrl: memberUrl(HOME),
      });
    }
  });
}

/**
 * The one-time access was granted: the bell, and the receipt. What the receipt
 * says about how long the access lasts is read from the grant itself.
 */
export async function notifyAccessGranted(
  service: SupabaseClient,
  orgId: string,
  purchase: { planId: string; grantId: string | null; amountCents: number; currency: string },
): Promise<void> {
  await quietly("access_granted", orgId, async () => {
    const plan = await planFacts(service, purchase.planId);
    if (!plan) return;
    let expiresAt: string | null = null;
    if (purchase.grantId) {
      const { data: grant } = await service
        .from("entitlement_grants")
        .select("expires_at")
        .eq("id", purchase.grantId)
        .maybeSingle();
      expiresAt = (grant?.expires_at as string | null) ?? null;
    }
    await notifyLocalized(
      await workspaceMemberIds(service, orgId),
      (copy, locale) => copy.accessGranted(plan.name, expiresAt ? dateLabel(expiresAt, locale) : null),
      { type: "billing", href: HOME },
    );
    for (const person of await workspaceManagers(service, orgId)) {
      await sendKitReceiptEmail(person.email, {
        locale: person.locale,
        name: person.name,
        planName: plan.name,
        amountLabel: moneyLabel(purchase.amountCents, purchase.currency, person.locale),
        untilLabel: expiresAt ? dateLabel(expiresAt, person.locale, person.timezone) : null,
        // A purchase in reais gets its tax invoice from Asaas, in a separate e-mail.
        fiscalNote: purchase.currency === "BRL",
        appUrl: memberUrl(HOME),
      });
    }
  });
}

/** A late payment went through and the subscription is back in good standing. Bell only. */
export async function notifyPaymentRecovered(service: SupabaseClient, orgId: string): Promise<void> {
  await quietly("payment_recovered", orgId, async () => {
    await notifyLocalized(await workspaceMemberIds(service, orgId), (copy) => copy.paymentRecovered(), {
      type: "billing",
      href: BILLING,
    });
  });
}

/**
 * A charge failed and the subscription entered its grace period. Bell only:
 * the provider already e-mails the payer about the failed charge.
 */
export async function notifyPaymentFailed(service: SupabaseClient, orgId: string, graceDays: number): Promise<void> {
  await quietly("payment_failed", orgId, async () => {
    await notifyLocalized(await workspaceMemberIds(service, orgId), (copy) => copy.paymentFailed(graceDays), {
      type: "billing",
      href: BILLING,
    });
  });
}

/**
 * What still unlocks the store for a workspace, after a subscription ended:
 * null when nothing does, otherwise the purchase that does, by its name when
 * the name is known. Read from `org_entitlements`, the answer every gate
 * shares, so the message can never promise an access the installer refuses.
 */
export async function keptAccess(service: SupabaseClient, orgId: string): Promise<{ by: string | null } | null> {
  const { data, error } = await service.rpc("org_entitlements", { target_org: orgId });
  if (error) throw new Error("entitlements_read_failed");
  const value = (data ?? {}) as {
    active?: boolean;
    limits?: Record<string, unknown>;
    sources?: { type?: string; plan_id?: string | null }[];
  };
  if (!value.active || limitOf(value.limits, "catalog_access") <= 0) return null;

  const planIds = (value.sources ?? [])
    .filter((source) => source.type !== "free" && typeof source.plan_id === "string")
    .map((source) => source.plan_id as string);
  if (planIds.length === 0) return { by: null };
  const { data: plans } = await service.from("plans").select("id, name, limits").in("id", planIds);
  const unlocking = (plans ?? []).find(
    (plan) => limitOf((plan.limits as Record<string, unknown> | null) ?? {}, "catalog_access") > 0,
  );
  return { by: (unlocking?.name as string | undefined) ?? null };
}

/**
 * A subscription ended: the bell, and the message that says what stays and
 * what stops arriving. Call it AFTER the row left its live state and the free
 * plan is back, so what it reads about access is what is left.
 */
export async function notifySubscriptionEnded(
  service: SupabaseClient,
  input: { orgId: string; planId: string; cause: CancelCause; endedAt?: string | Date | null },
): Promise<void> {
  await quietly("subscription_ended", input.orgId, async () => {
    const plan = await planFacts(service, input.planId);
    if (!plan) return;
    const kept = await keptAccess(service, input.orgId);
    const endedAt = input.endedAt ?? new Date();
    await notifyLocalized(
      await workspaceMemberIds(service, input.orgId),
      (copy) => copy.subscriptionEnded(plan.name, kept !== null),
      { type: "billing", href: BILLING },
    );
    for (const person of await workspaceManagers(service, input.orgId)) {
      await sendSubscriptionCanceledEmail(person.email, {
        locale: person.locale,
        planName: plan.name,
        cause: input.cause,
        endedLabel: dateLabel(endedAt, person.locale, person.timezone),
        keptAccess: kept,
        billingUrl: memberUrl(BILLING),
      });
    }
  });
}

type TermClaim = { subscription_id: string; org_id: string; plan_name: string; current_period_end: string };

export type TermNoticeOutcome = { claimed: number; notified: number; emailed: number };

type AccessClaim = { grant_id: string; org_id: string; plan_name: string; expires_at: string };

/** Whether the workspace still has catalog access, by the one answer every gate shares. */
async function hasCatalogAccess(service: SupabaseClient, orgId: string): Promise<boolean> {
  const { data, error } = await service.rpc("org_entitlements", { target_org: orgId });
  if (error) throw new Error("entitlements_read_failed");
  const value = (data ?? {}) as { active?: boolean; limits?: Record<string, unknown> };
  return Boolean(value.active) && limitOf(value.limits, "catalog_access") > 0;
}

/**
 * The notice that the term of a one-time access is about to end.
 *
 * The access does not renew by itself (docs/BILLING.md): about two weeks
 * before it ends, the member gets one bell notice and one e-mail, the same
 * words as a paid period that does not renew. `claim_access_end_notices`
 * (migration 0024) marks the grant in the statement that returns it, and
 * leaves out a grant that a renewal already follows.
 */
export async function sendAccessEndNotices(service: SupabaseClient): Promise<TermNoticeOutcome> {
  const { data, error } = await service.rpc("claim_access_end_notices");
  if (error) throw new Error(`claim_access_end_notices failed: ${error.message}`);
  const claims = (data ?? []) as AccessClaim[];
  const outcome: TermNoticeOutcome = { claimed: claims.length, notified: 0, emailed: 0 };

  for (const claim of claims) {
    await quietly("access_ending", claim.org_id, async () => {
      const bell = await notifyLocalized(
        await workspaceMemberIds(service, claim.org_id),
        (copy, locale) => copy.termEnding(claim.plan_name, dateLabel(claim.expires_at, locale)),
        {
          type: "billing",
          href: BILLING,
          sourceKey: `access-ending:${claim.grant_id}`,
        },
      );
      outcome.notified += bell.created ?? 0;
      for (const person of await workspaceManagers(service, claim.org_id)) {
        const sent = await sendTermEndingEmail(person.email, {
          locale: person.locale,
          planName: claim.plan_name,
          endsLabel: dateLabel(claim.expires_at, person.locale, person.timezone),
          billingUrl: memberUrl(BILLING),
        });
        if (sent.sent) outcome.emailed += 1;
      }
    });
  }
  return outcome;
}

export type AccessEndingOutcome = {
  claimed: number;
  /** Workspaces that lost the catalog: told, and their CLI tokens revoked. */
  ended: number;
  /** Workspaces a renewal or a subscription kept open: nothing to say. */
  kept: number;
  emailed: number;
};

/**
 * Settles the accesses whose term ran out: when nothing else keeps the store
 * open, the member is told (bell and e-mail) and the CLI tokens are revoked,
 * as when a subscription ends without the access (lib/billing-lifecycle.ts).
 * A renewal chained after the term, or a live subscription, keeps the access
 * and nothing is said. `claim_access_endings` (migration 0024) hands each
 * grant over once.
 */
export async function settleAccessEndings(service: SupabaseClient): Promise<AccessEndingOutcome> {
  const { data, error } = await service.rpc("claim_access_endings");
  if (error) throw new Error(`claim_access_endings failed: ${error.message}`);
  const claims = (data ?? []) as AccessClaim[];
  const outcome: AccessEndingOutcome = { claimed: claims.length, ended: 0, kept: 0, emailed: 0 };

  for (const claim of claims) {
    await quietly("access_ended", claim.org_id, async () => {
      if (await hasCatalogAccess(service, claim.org_id)) {
        outcome.kept += 1;
        return;
      }
      outcome.ended += 1;
      // Installed tools keep working; what stops is the update. The token
      // server is ours, so the tokens fall with the access.
      const { error: revokeError } = await service.rpc("revoke_member_tokens", {
        target_org: claim.org_id,
        target_reason: "canceled",
      });
      if (revokeError) throw new Error(`revoke_member_tokens failed: ${revokeError.message}`);
      await notifyLocalized(
        await workspaceMemberIds(service, claim.org_id),
        (copy, locale) => copy.accessEnded(claim.plan_name, dateLabel(claim.expires_at, locale)),
        { type: "billing", href: BILLING, sourceKey: `access-ended:${claim.grant_id}` },
      );
      for (const person of await workspaceManagers(service, claim.org_id)) {
        const sent = await sendAccessEndedEmail(person.email, {
          locale: person.locale,
          planName: claim.plan_name,
          endedLabel: dateLabel(claim.expires_at, person.locale, person.timezone),
          billingUrl: memberUrl(BILLING),
        });
        if (sent.sent) outcome.emailed += 1;
      }
    });
  }
  return outcome;
}

/**
 * The notice that a paid period which does not renew is about to end.
 *
 * A yearly plan paid in installments is ONE purchase (docs/BILLING.md), so no
 * renewal charge and no provider message tells the member before the day it
 * stops. About two weeks ahead they get one bell notice and one e-mail.
 * `claim_term_end_notices` (migration 0023) marks the subscription in the
 * statement that returns it: a second run finds nothing, and a new purchase
 * moves the period and clears the mark.
 */
export async function sendTermEndNotices(service: SupabaseClient): Promise<TermNoticeOutcome> {
  const { data, error } = await service.rpc("claim_term_end_notices");
  if (error) throw new Error(`claim_term_end_notices failed: ${error.message}`);
  const claims = (data ?? []) as TermClaim[];
  const outcome: TermNoticeOutcome = { claimed: claims.length, notified: 0, emailed: 0 };

  for (const claim of claims) {
    await quietly("term_ending", claim.org_id, async () => {
      const bell = await notifyLocalized(
        await workspaceMemberIds(service, claim.org_id),
        (copy, locale) => copy.termEnding(claim.plan_name, dateLabel(claim.current_period_end, locale)),
        {
          type: "billing",
          href: BILLING,
          sourceKey: `term-ending:${claim.subscription_id}:${claim.current_period_end.slice(0, 10)}`,
        },
      );
      outcome.notified += bell.created ?? 0;
      for (const person of await workspaceManagers(service, claim.org_id)) {
        const sent = await sendTermEndingEmail(person.email, {
          locale: person.locale,
          planName: claim.plan_name,
          endsLabel: dateLabel(claim.current_period_end, person.locale, person.timezone),
          billingUrl: memberUrl(BILLING),
        });
        if (sent.sent) outcome.emailed += 1;
      }
    });
  }
  return outcome;
}
