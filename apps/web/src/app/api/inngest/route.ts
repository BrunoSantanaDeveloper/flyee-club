// Background work here is short (billing maintenance, digests, reminders,
// backups), and the long jobs are cut into steps: a send to the list is one
// step per batch of 100 readers. The Vercel Hobby plan accepts at most 300;
// nothing on this route needs more than a minute per step.
export const maxDuration = 60;

import { adminFunctions } from "@/lib/admin-jobs";
import { billingFunctions } from "@/lib/billing-jobs";
import { leadFunctions } from "@/lib/lead-jobs";
import { maintenanceFunctions } from "@/lib/maintenance-jobs";
import { meetingFunctions } from "@/lib/meeting-jobs";
import { newsletterFunctions } from "@/lib/newsletter-jobs";
import { tokenFunctions } from "@/lib/token-jobs";
import { updatesDigestFunctions } from "@/lib/updates-digest-jobs";
import { backupFunctions } from "@flyee/backup/jobs";
import { inngest } from "@flyee/jobs";
import { serve } from "@flyee/jobs/next";

// Every Inngest function of the platform. A function that is not listed here
// never runs, whatever its file declares.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...adminFunctions,
    ...billingFunctions,
    ...leadFunctions,
    ...meetingFunctions,
    ...newsletterFunctions,
    ...tokenFunctions,
    ...updatesDigestFunctions,
    ...maintenanceFunctions,
    ...backupFunctions,
  ],
});
