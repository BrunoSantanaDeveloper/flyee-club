// Background work here is short (billing maintenance, digests, backups). The
// Vercel Hobby plan accepts at most 300; nothing on this route needs more than
// a minute.
export const maxDuration = 60;

import { adminFunctions } from "@/lib/admin-jobs";
import { billingFunctions } from "@/lib/billing-jobs";
import { backupFunctions } from "@flyee/backup/jobs";
import { inngest } from "@flyee/jobs";
import { serve } from "@flyee/jobs/next";

// Every Inngest function of the platform.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...adminFunctions, ...billingFunctions, ...backupFunctions],
});
