import { settleDueBillingCancellations } from "@/lib/billing-cancellation";
import { expireStaleBillingLeases, retireAbandonedCheckouts } from "@/lib/billing-maintenance";
import { sendTermEndNotices } from "@/lib/billing-notices";
import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";

export const settleBillingCancellationsFunction = inngest.createFunction(
  { id: "flyee-settle-billing-cancellations" },
  { cron: "*/15 * * * *" },
  async () => settleDueBillingCancellations(),
);

/**
 * Nightly sweep of the two things that leak when a request dies mid-flight:
 * leases nobody released, and checkouts nobody finished (which on Asaas are
 * live recurring charges billing someone who never contracted them). Both are
 * idempotent, so a retried run costs nothing.
 */
export const billingMaintenanceFunction = inngest.createFunction(
  { id: "flyee-billing-maintenance" },
  { cron: "20 4 * * *" },
  async () => {
    const leases = await expireStaleBillingLeases();
    const checkouts = await retireAbandonedCheckouts();
    return { leases, checkouts };
  },
);

/**
 * Once a day, at 10:15 in Brasília (13:15 UTC): a paid period that does not
 * renew and ends within two weeks is announced to its member, once
 * (`sendTermEndNotices`, lib/billing-notices.ts).
 */
export const termEndNoticeFunction = inngest.createFunction(
  { id: "flyee-term-end-notices", retries: 1, concurrency: { limit: 1 } },
  { cron: "15 13 * * *" },
  async ({ step }) => step.run("send-term-end-notices", async () => sendTermEndNotices(createServiceClient())),
);

export const billingFunctions = [settleBillingCancellationsFunction, billingMaintenanceFunction, termEndNoticeFunction];
