import type { CampaignAttribution } from "@/lib/attribution";

/**
 * One page load of the public site, counted per day, page, entry door and
 * language (`site_page_views`, migration 0005): the visits half of the entry
 * doors table in /admin/metricas, next to the kit purchases of each door.
 *
 * The middleware calls it AFTER answering a document load of a public page
 * (`event.waitUntil`), so counting never delays the page. `count_site_view`
 * accepts the service role only and bounds its own growth (30 doors per page
 * per day, 60 paths per day); a lost count never breaks a page.
 */
export type SiteView = {
  /** The internal (Portuguese) path, so /planos and /en/pricing count as one page. */
  path: string;
  /** The entry door; null is counted as "direto". */
  origem: string | null;
  locale: string;
};

export async function countSiteView(view: SiteView): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;
  try {
    await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/count_site_view`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target_path: view.path, target_origem: view.origem, target_locale: view.locale }),
      cache: "no-store",
    });
  } catch {
    // A view that is not counted costs less than a page that waits on it.
  }
}

/**
 * The entry door of a view: the link's own `?origem=` first, then the door the
 * visitor first came through (the first-touch cookie). Purchases count for the
 * door of the account's first contact, so visits follow the same rule and the
 * conversion of a door compares like with like.
 */
export function viewDoor(linkOrigem: string | null | undefined, firstTouch: CampaignAttribution | null): string | null {
  const fromLink = linkOrigem?.trim();
  if (fromLink) return fromLink.slice(0, 64);
  return firstTouch?.origem ?? null;
}

/**
 * A browser asking for the page ahead of a click (`Sec-Purpose: prefetch`,
 * the older `Purpose: prefetch`) is not a visit; it may never be opened.
 */
export function isSpeculativeLoad(headers: Headers): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch") || purpose.includes("prerender");
}
