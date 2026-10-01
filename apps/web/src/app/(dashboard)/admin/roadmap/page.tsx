import RoadmapAdminView from "./components/roadmap-admin-view";

import { loadRoadmapAdmin } from "@/lib/admin/roadmap";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Roadmap" };

/** /admin/roadmap: the ideas members vote on, moved along by the operator (migration 0009). */
export default async function RoadmapAdminPage() {
  const state = await loadConsole(({ supabase }) => loadRoadmapAdmin(supabase));
  return <RoadmapAdminView state={state} />;
}
