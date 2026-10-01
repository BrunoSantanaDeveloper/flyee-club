import MeetingsView, { type MeetingsState } from "./meetings-view";

import { loadMeetings, splitMeetings } from "@/lib/member/community";
import { getMemberContext } from "@/lib/member/context";

/** /encontros: the membership's live meetings, upcoming first, then the recordings. */
export default async function MeetingsPage() {
  const context = await getMemberContext();
  let state: MeetingsState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      const meetings = splitMeetings(
        await loadMeetings(context.supabase, { userId: context.userId, locale: context.locale }),
      );
      state = { kind: "ready", ...meetings, entitled: context.entitlements.has("meetings") };
    } catch {
      state = { kind: "error" };
    }
  }
  return <MeetingsView state={state} />;
}
