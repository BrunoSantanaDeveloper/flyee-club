import DevicesView, { type DevicesState } from "./devices-view";

import { getMemberContext } from "@/lib/member/context";
import { loadDevices } from "@/lib/member/devices";
import { limitOf } from "@flyee/billing/entitlements";

/** /settings/devices: the machines connected to the account, each with its revalidation date. */
export default async function DevicesPage() {
  const context = await getMemberContext();
  let state: DevicesState;
  if (!context || !context.orgId) {
    state = { kind: "unavailable" };
  } else {
    try {
      const limits = context.entitlements.active ? context.entitlements.limits : {};
      state = {
        kind: "ready",
        overview: await loadDevices(context.supabase, { orgId: context.orgId, limit: limitOf(limits, "devices") }),
        locale: context.locale,
        // FlyeeClub Pro raises the ceiling; an account already on it has nowhere to go.
        canUpgrade: context.entitlements.tier !== "club" && context.entitlements.tier !== "pro",
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <DevicesView state={state} />;
}
