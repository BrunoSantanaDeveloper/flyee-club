import { Suspense } from "react";

import AppShell from "@/components/layout/app-shell";
import Loading from "@/components/layout/containers/loading-screen";

/** Standalone chrome, like /auth: the consent screen renders without the dashboard's header and menu. */
export default async function OauthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </AppShell>
  );
}
