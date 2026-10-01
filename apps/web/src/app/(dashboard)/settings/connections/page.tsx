import { redirect } from "next/navigation";

/** The old address of the devices screen: links already sent by the CLI keep working. */
export default function ConnectionsRedirect() {
  redirect("/settings/devices");
}
