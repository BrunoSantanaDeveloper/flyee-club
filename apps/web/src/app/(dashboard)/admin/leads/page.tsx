import LeadsView from "./components/leads-view";

import { loadLeads } from "@/lib/admin/leads";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Leads" };

/** /admin/leads: the waitlist and newsletter contacts, with opt-out, erasure and the consented export (migration 0013). */
export default async function LeadsPage() {
  const state = await loadConsole(async ({ supabase }) => ({ leads: await loadLeads(supabase) }));
  return <LeadsView state={state} />;
}
