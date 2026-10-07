import { Suspense } from "react";

import AppShell from "@/components/layout/app-shell";
import Loading from "@/components/layout/containers/loading-screen";

/** Standalone chrome, like /oauth: the revalidation explainer renders without the dashboard's header and menu. */
export default function RevalidateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </AppShell>
  );
}
