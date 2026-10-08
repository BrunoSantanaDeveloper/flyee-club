import { eventBatchSchema, isCliEvent, occurredAt, stringProperties } from "@/lib/cli/events";
import { type CliOutcome, runCliRequest } from "@/lib/cli/gates";
import { trackServerEvent } from "@/lib/product-events-server";

/**
 * POST /api/cli/events: a batch of up to 50 usage events from the CLI
 * (docs/CLI-CONTRACT.md). What a batch may hold, and what is dropped from it,
 * is `lib/cli/events.ts`; the database allowlist does the rest.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  return runCliRequest(
    request,
    { endpoint: "events", scope: "telemetry:write", device: "required" },
    async ({ auth }): Promise<CliOutcome> => {
      const parsed = eventBatchSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, status: 400, code: "invalid_request" };

      const now = Date.now();
      let accepted = 0;
      let dropped = 0;
      // Sequential: the database serializes one member's events anyway (it
      // enforces the hourly ceiling under a per-member lock).
      for (const event of parsed.data.events) {
        if (!isCliEvent(event.name)) {
          dropped += 1;
          continue;
        }
        const recorded = await trackServerEvent({
          actorId: auth.userId,
          orgId: auth.orgId,
          event: event.name,
          properties: stringProperties(event.properties),
          occurredAt: occurredAt(event.occurred_at, now),
          platform: "cli",
        });
        if (recorded) accepted += 1;
        else dropped += 1;
      }
      return { ok: true, body: { accepted, dropped } };
    },
  );
}
