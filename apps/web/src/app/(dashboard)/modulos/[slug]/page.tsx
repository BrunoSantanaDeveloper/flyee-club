import ModuleView, { type ModuleState } from "./module-view";
import { notFound } from "next/navigation";

import { loadModule } from "@/lib/catalog/read";
import { getMemberContext } from "@/lib/member/context";
import { loadLessons } from "@/lib/member/lessons";

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
    const module = await loadModule(context.supabase, {
      slug,
      locale: context.locale,
      limits: context.entitlements.active ? context.entitlements.limits : {},
    });
    if (!module) {
      missing = true;
    } else {
      const lessons = await loadLessons(context.supabase, {
        moduleId: module.id,
        userId: context.userId,
        locale: context.locale,
      });
      state = { kind: "ready", module, lessons, locale: context.locale };
    }
  } catch {
    state = { kind: "error" };
  }
  if (missing) notFound();
  return <ModuleView slug={slug} state={state ?? { kind: "error" }} />;
}
