import ModuleAdminView from "./components/module-admin-view";

import { loadModuleAdmin } from "@/lib/admin/catalog";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Ferramenta" };

/** /admin/catalogo/[slug]: one tool, its versions (upload, publish, yank) and its lessons. */
export default async function ModuleAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await loadConsole(async ({ supabase }) => {
    const found = await loadModuleAdmin(supabase, slug);
    return found ?? { module: null, lessons: [], trails: [] };
  });
  return <ModuleAdminView state={state} slug={slug} />;
}
