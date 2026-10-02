import { Suspense } from "react";

import Loading from "@/components/layout/containers/loading-screen";

/** Standalone chrome, like /oauth: the device approval renders without the app shell. */
export default function ActivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
