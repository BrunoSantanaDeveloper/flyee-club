import MeetingAdminView from "./components/meeting-admin-view";

import { loadMeetingAdmin, NO_MEETING_EMAILS } from "@/lib/admin/meetings";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Encontro" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /admin/encontros/[id]: one meeting, its page and links, its results, its e-mails and its registrants. */
export default async function MeetingAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await loadConsole(async ({ supabase }) => {
    const found = UUID.test(id) ? await loadMeetingAdmin(supabase, id) : null;
    return (
      found ?? {
        meeting: null,
        results: { registered: 0, joined: 0, bySegment: [] },
        registrants: [],
        emails: NO_MEETING_EMAILS,
      }
    );
  });
  return <MeetingAdminView state={state} id={id} />;
}
