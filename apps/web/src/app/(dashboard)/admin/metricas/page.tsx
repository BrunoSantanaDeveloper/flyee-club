import MetricsView from "./components/metrics-view";

import { loadMembersOverview } from "@/lib/admin/members";
import { doorTotals, focusRule, loadDoorWeekly, loadSegmentWeekly, segmentPopulation } from "@/lib/admin/metrics";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Métricas" };

/**
 * /admin/metricas: the five focus metrics per segment and week
 * (`admin_segment_weekly`, migrations 0015 and 0021), the entry doors
 * (`admin_door_weekly`) and the focus rule read from them.
 */
export default async function MetricsPage() {
  const state = await loadConsole(async ({ supabase }) => {
    const [weekly, doors, overview] = await Promise.all([
      loadSegmentWeekly(supabase),
      loadDoorWeekly(supabase),
      loadMembersOverview(supabase),
    ]);
    const generatedAt = new Date().toISOString();
    return {
      weekly,
      doors: doorTotals(doors),
      focus: focusRule(weekly, segmentPopulation(overview.members), Date.parse(generatedAt)),
      generatedAt,
    };
  });
  return <MetricsView state={state} />;
}
