import { EventSchemas, Inngest } from "inngest";

/**
 * Platform-wide event map. Packages and apps/web declare their events here so
 * every `inngest.send` and function trigger stays typed. flyee.club events use
 * the `flyee/` prefix (phase 8 of docs/PLANO-IMPLEMENTACAO.md adds them).
 */
export type JobEvents = {
  /** Run a logical database backup now (@flyee/backup); also fires on a daily cron. */
  "backup/run.requested": { data: Record<string, never> };
};

export const isInngestConfigured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);

/**
 * Single Inngest client for the whole platform. In local dev it talks to
 * `npx inngest-cli dev` (no keys needed); in production it requires
 * INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({
  id: "flyee",
  schemas: new EventSchemas().fromRecord<JobEvents>(),
});

export type SendEventResult = { sent: true } | { sent: false; hint: string };

/**
 * Fire-and-forget event send that never throws. When Inngest is unreachable
 * (no keys in production, dev server not running locally) it returns
 * `{ sent: false }` so the caller can fall back to inline processing.
 */
export async function sendEvent<Name extends keyof JobEvents & string>(
  name: Name,
  data: JobEvents[Name]["data"],
): Promise<SendEventResult> {
  try {
    await inngest.send({ name, data } as never);
    return { sent: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      sent: false,
      hint: isInngestConfigured
        ? `Inngest send failed: ${detail}`
        : `Inngest is not configured (set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY, or run "npx inngest-cli dev" locally): ${detail}`,
    };
  }
}
