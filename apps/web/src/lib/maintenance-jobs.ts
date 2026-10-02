import "server-only";

import { MODULES_BUCKET } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nightly housekeeping of the things that only grow.
 *
 * - `rollup_product_events`: yesterday's usage events folded into
 *   `product_events_daily`, which is what the metrics console reads;
 * - `purge_product_events`: raw events older than 13 months (the rollup stays);
 * - `purge_cli_requests`: the installer's request trail older than 30 days
 *   (it exists for the rate window and for support, not as history);
 * - `purge_oauth_leftovers`: expired device codes and authorization codes, and
 *   token rows dead for 90 days;
 * - the staging sweep: an upload the operator started and never finished
 *   leaves a ZIP in private storage that no version points to.
 *
 * Every task is idempotent and independent: each runs as its own step, so one
 * that fails is retried alone and does not hold the others back.
 */

/** A staged upload is validated within seconds; a day is far past any upload still in flight. */
const STAGING_MAX_AGE_MS = 24 * 3_600_000;

const STAGING_FOLDER = "staging";

async function call(service: SupabaseClient, fn: string): Promise<unknown> {
  const { data, error } = await service.rpc(fn);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data;
}

/** Removes staged uploads older than a day. Returns how many files went. */
export async function sweepStagedUploads(service: SupabaseClient, now: number = Date.now()): Promise<number> {
  const bucket = service.storage.from(MODULES_BUCKET);
  let removed = 0;
  // Oldest first, a page at a time: whatever a page leaves behind is younger than the cut.
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await bucket.list(STAGING_FOLDER, {
      limit: 100,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw new Error(`staging list failed: ${error.message}`);
    const stale = (data ?? [])
      .filter((file) => file.created_at && now - Date.parse(file.created_at) > STAGING_MAX_AGE_MS)
      .map((file) => `${STAGING_FOLDER}/${file.name}`);
    if (stale.length === 0) break;
    const { error: removeError } = await bucket.remove(stale);
    if (removeError) throw new Error(`staging remove failed: ${removeError.message}`);
    removed += stale.length;
    if (stale.length < 100) break;
  }
  return removed;
}

/** Every night at 01:30 in Brasília (04:30 UTC), after the day in São Paulo has closed. */
export const maintenanceFunction = inngest.createFunction(
  { id: "flyee-maintenance", retries: 2, concurrency: { limit: 1 } },
  { cron: "30 4 * * *" },
  async ({ step }) => {
    const rolledUp = await step.run("rollup-product-events", async () =>
      call(createServiceClient(), "rollup_product_events"),
    );
    const eventsPurged = await step.run("purge-product-events", async () =>
      call(createServiceClient(), "purge_product_events"),
    );
    const requestsPurged = await step.run("purge-cli-requests", async () =>
      call(createServiceClient(), "purge_cli_requests"),
    );
    const oauthPurged = await step.run("purge-oauth-leftovers", async () =>
      call(createServiceClient(), "purge_oauth_leftovers"),
    );
    const stagedRemoved = await step.run("sweep-staged-uploads", async () => sweepStagedUploads(createServiceClient()));
    return { rolledUp, eventsPurged, requestsPurged, oauthPurged, stagedRemoved };
  },
);

export const maintenanceFunctions = [maintenanceFunction];
