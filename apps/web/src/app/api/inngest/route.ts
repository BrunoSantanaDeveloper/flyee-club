// Background work here is short (billing maintenance, digests, backups). The
// Vercel Hobby plan accepts at most 300; nothing on this route needs more than
// a minute.
export const maxDuration = 60;

import { billingFunctions } from "@/lib/billing-jobs";
import { leadFunctions } from "@/lib/lead-jobs";
import { backupFunctions } from "@flyee/backup/jobs";
import { inngest } from "@flyee/jobs";
import { serve } from "@flyee/jobs/next";

// Every Inngest function of the platform. The daily operator watch
// (lib/admin-jobs.ts) is not registered: it reads the inherited accounts
// overview, which the baseline replaced with admin_members_overview(). Phase 6
// of docs/PLANO-IMPLEMENTACAO.md brings it back as the weekly segment digest.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...billingFunctions, ...leadFunctions, ...backupFunctions],
});
