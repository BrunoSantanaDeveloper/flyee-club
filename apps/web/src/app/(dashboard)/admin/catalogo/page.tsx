import CatalogView from "./components/catalog-view";

import { loadCatalogAdmin } from "@/lib/admin/catalog";
import { loadConsole } from "@/lib/admin/session";

export const metadata = { title: "Catálogo" };

/** /admin/catalogo: the tools the CLI installs, their recipes and trails, and the delivery settings. */
export default async function CatalogAdminPage() {
  const state = await loadConsole(({ supabase }) => loadCatalogAdmin(supabase));
  return <CatalogView state={state} />;
}
