import RoadmapView, { type RoadmapState } from "./roadmap-view";

import { localizeHref } from "@/i18n/routing";
import { loadRoadmap, loadRoadmapContext } from "@/lib/member/community";
import { getMemberContext } from "@/lib/member/context";

/**
 * /roadmap: what the club is building next, with the members' votes, the
 * month's most voted idea, and the two routes to an app the store does not
 * have: a proposal (FlyeeClub Pro) or the contact form (commissioned work).
 */
export default async function RoadmapPage() {
  const context = await getMemberContext();
  let state: RoadmapState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      const [items, extras] = await Promise.all([
        loadRoadmap(context.supabase, { userId: context.userId, locale: context.locale }),
        loadRoadmapContext(context.supabase, { locale: context.locale }),
      ]);
      state = {
        kind: "ready",
        items,
        trails: extras.trails,
        leader: extras.leader,
        canVote: context.entitlements.has("roadmap_vote"),
        locale: context.locale,
        contactHref: localizeHref("/contato?assunto=app", context.locale),
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <RoadmapView state={state} />;
}
