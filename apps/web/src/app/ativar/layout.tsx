import { Suspense } from "react";

import Loading from "@/app/loading";

/** Standalone chrome, like /oauth: the device approval renders without the app shell. */
export default function ActivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
