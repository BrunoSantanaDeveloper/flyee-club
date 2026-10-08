import { z } from "zod";

import type { ProductEventName } from "@/lib/product-events-server";

/**
 * What POST /api/cli/events takes (docs/CLI-CONTRACT.md 4.7): a batch of up
 * to 50 usage events the CLI is the witness of. Logins, device registrations,
 * denials and revalidations are recorded by the server where they happen.
 *
 * Properties pass through `product_event_sanitize` (migration 0006), which
 * keeps an allowlist of keys and values and drops everything else: never
 * content, paths, prompts or free text. Segment, language and AI tool are
 * stamped from the member's profile by the database.
 */

export const CLI_EVENTS = [
  "module.installed",
  "module.activated",
  "module.updated",
  "tool.executed",
  "recipe.installed",
] as const satisfies readonly ProductEventName[];

export type CliEventName = (typeof CLI_EVENTS)[number];

export const isCliEvent = (name: string): name is CliEventName => (CLI_EVENTS as readonly string[]).includes(name);

const MAX_BATCH = 50;
/** A batch delivered late (an offline laptop) keeps its dates within a week. */
const MAX_AGE_MS = 7 * 86_400_000;
const MAX_SKEW_MS = 5 * 60_000;

export const eventBatchSchema = z
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

/** When the event happened, if that is a believable date; otherwise the server stamps it. */
export function occurredAt(value: string | undefined, now: number): Date | undefined {
  if (!value) return undefined;
  const at = Date.parse(value);
  if (!Number.isFinite(at) || at > now + MAX_SKEW_MS || at < now - MAX_AGE_MS) return undefined;
  return new Date(at);
}

/** Only short string values survive; the database allowlist does the rest. */
export function stringProperties(properties: Record<string, unknown> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties ?? {}).slice(0, 20)) {
    if (typeof value === "string" && value.length <= 60 && key.length <= 40) clean[key] = value;
  }
  return clean;
}
