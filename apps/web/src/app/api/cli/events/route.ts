import { z } from "zod";

import { type CliOutcome, runCliRequest } from "@/lib/cli/gates";
import { type ProductEventName, trackServerEvent } from "@/lib/product-events-server";

/**
 * POST /api/cli/events: a batch of up to 50 usage events from the CLI
 * (docs/CLI-CONTRACT.md). Only what the CLI is the witness of is accepted
 * here; logins, device registrations, denials and revalidations are recorded
 * by the server where they happen.
 *
 * Properties pass through `product_event_sanitize` (migration 0006), which
 * keeps an allowlist of keys and values and drops everything else: never
 * content, paths, prompts or free text. Segment, language and AI tool are
 * stamped from the member's profile by the database.
 */

const CLI_EVENTS = [
  "module.installed",
  "module.activated",
  "module.updated",
  "tool.executed",
  "recipe.installed",
] as const satisfies readonly ProductEventName[];

const MAX_BATCH = 50;
/** A batch delivered late (an offline laptop) keeps its dates within a week. */
const MAX_AGE_MS = 7 * 86_400_000;
const MAX_SKEW_MS = 5 * 60_000;

const batchSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            name: z.string().max(60),
            properties: z.record(z.string(), z.unknown()).optional(),
            occurred_at: z.string().max(40).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_BATCH),
  })
  .strict();

function occurredAt(value: string | undefined, now: number): Date | undefined {
  if (!value) return undefined;
  const at = Date.parse(value);
  if (!Number.isFinite(at) || at > now + MAX_SKEW_MS || at < now - MAX_AGE_MS) return undefined;
  return new Date(at);
}

/** Only short string values survive; the database allowlist does the rest. */
function stringProperties(properties: Record<string, unknown> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties ?? {}).slice(0, 20)) {
    if (typeof value === "string" && value.length <= 60 && key.length <= 40) clean[key] = value;
  }
  return clean;
}

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
      const parsed = batchSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, status: 400, code: "invalid_request" };

      const now = Date.now();
      let accepted = 0;
      let dropped = 0;
      // Sequential: the database serializes one member's events anyway (it
      // enforces the hourly ceiling under a per-member lock).
      for (const event of parsed.data.events) {
        if (!(CLI_EVENTS as readonly string[]).includes(event.name)) {
          dropped += 1;
          continue;
        }
        const recorded = await trackServerEvent({
          actorId: auth.userId,
          orgId: auth.orgId,
          event: event.name as (typeof CLI_EVENTS)[number],
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
