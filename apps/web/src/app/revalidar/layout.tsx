import { Suspense } from "react";

import Loading from "@/app/loading";

/** Standalone chrome, like /oauth: the revalidation explainer renders without the app shell. */
export default function RevalidateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
