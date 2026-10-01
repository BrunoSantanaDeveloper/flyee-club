import { redirect } from "next/navigation";

/** The accounts console became /admin/membros (phase 6); old links and bookmarks land there. */
export default function OrganizationsRedirect() {
  redirect("/admin/membros");
}
