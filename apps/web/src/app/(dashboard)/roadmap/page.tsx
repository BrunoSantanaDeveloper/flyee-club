import RoadmapView, { type RoadmapState } from "./roadmap-view";

import { loadRoadmap } from "@/lib/member/community";
import { getMemberContext } from "@/lib/member/context";

/** /roadmap: what the club is building next, with the members' votes. */
export default async function RoadmapPage() {
  const context = await getMemberContext();
  let state: RoadmapState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      state = {
        kind: "ready",
        items: await loadRoadmap(context.supabase, { userId: context.userId, locale: context.locale }),
        canVote: context.entitlements.has("roadmap_vote"),
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <RoadmapView state={state} />;
}
