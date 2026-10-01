import MeetingsAdminView from "./components/meetings-admin-view";

import { loadMeetingsOverview } from "@/lib/admin/meetings";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Encontros" };

/** /admin/encontros: every meeting by state, with its two counters (`meetings_overview`, migration 0014). */
export default async function MeetingsAdminPage() {
  const state = await loadConsole(async ({ supabase }) => ({ meetings: await loadMeetingsOverview(supabase) }));
  return <MeetingsAdminView state={state} />;
}
