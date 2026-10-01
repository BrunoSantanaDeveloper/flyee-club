import MembersView from "./components/members-view";

import { loadMembersOverview, loadPeopleWithoutWorkspace, loadSuperadminIds } from "@/lib/admin/members";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Membros" };

/**
 * /admin/membros: every account of the club, the rung it is on and what needs
 * attention, read through `admin_members_overview()` (migration 0015).
 */
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ impersonation?: string }> }) {
  const { impersonation } = await searchParams;
  const state = await loadConsole(async ({ supabase, userId }) => {
    const [overview, people, superadminIds] = await Promise.all([
      loadMembersOverview(supabase),
      loadPeopleWithoutWorkspace(supabase),
      loadSuperadminIds(supabase),
    ]);
    return {
      overview,
      people,
      superadminIds,
      selfId: userId,
      serviceAvailable: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    };
  });
  // Where a support session lands when it ends (api/impersonation/exit).
  const notice = impersonation === "expired" ? "expired" : impersonation === "ended" ? "ended" : null;
  return <MembersView state={state} notice={notice} />;
}
