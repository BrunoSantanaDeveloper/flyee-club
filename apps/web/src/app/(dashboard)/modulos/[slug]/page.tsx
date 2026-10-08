import ModuleView, { type ModuleState } from "./module-view";
import { notFound } from "next/navigation";

import { loadModule } from "@/lib/catalog/read";
import { getMemberContext } from "@/lib/member/context";
import { loadGuide } from "@/lib/member/guides";
import { loadLessons } from "@/lib/member/lessons";
import { channelOf } from "@flyee/catalog/channels";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/**
 * /modulos/<slug>: one tool, with everything a member needs to decide and
 * install it. A slug that is not published answers 404, like a typo.
 */
export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();

  const context = await getMemberContext();
  if (!context) return <ModuleView slug={slug} state={{ kind: "unavailable" }} />;

  let state: ModuleState | null = null;
  let missing = false;
  try {
    const limits = context.entitlements.active ? context.entitlements.limits : {};
    const channel = channelOf(limits);
    const module = await loadModule(context.supabase, { slug, locale: context.locale, limits });
    if (!module) {
      missing = true;
    } else {
      const [lessons, guide] = await Promise.all([
        loadLessons(context.supabase, { moduleId: module.id, userId: context.userId, locale: context.locale }),
        loadGuide(context.supabase, {
          moduleId: module.id,
          slug,
          orgId: context.orgId,
          locale: context.locale,
          // Nothing installed yet: the guide of the version this account would install.
          preferVersion: module.entitled ? (module.latest?.version ?? null) : null,
        }),
      ]);
      state = { kind: "ready", module, lessons, guide, locale: context.locale, channel };
    }
  } catch {
    state = { kind: "error" };
  }
  if (missing) notFound();
  return <ModuleView slug={slug} state={state ?? { kind: "error" }} />;
}
