import ModulesView, { type ModulesState } from "./modules-view";

import { loadCatalog } from "@/lib/catalog/read";
import { loadPlannedApps } from "@/lib/member/community";
import { getMemberContext } from "@/lib/member/context";
import { channelOf } from "@flyee/catalog/channels";

/**
 * /modulos: the member's catalog. Read on the server with the member's
 * session (row-level security serves only what is published); each tool says
 * whether this account can install it, from `org_entitlements`. Below them,
 * the apps the roadmap has planned or is building, marked "Em breve".
 */
export default async function ModulesPage() {
  const context = await getMemberContext();
  let state: ModulesState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      const limits = context.entitlements.active ? context.entitlements.limits : {};
      const [catalog, planned] = await Promise.all([
        loadCatalog(context.supabase, { locale: context.locale, stableOnly: false, limits }),
        loadPlannedApps(context.supabase, { locale: context.locale }),
      ]);
      state = {
        kind: "ready",
        trails: catalog.trails,
        modules: catalog.modules,
        planned,
        channel: channelOf(limits),
        hasAccess: Boolean(context.entitlements.tier),
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <ModulesView state={state} />;
}
