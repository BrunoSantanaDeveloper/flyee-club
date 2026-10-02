"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { ANALYTICS_ENABLED, isAnalyticsOptedOut, trackPageView } from "@/lib/analytics";
import { GA4_ID, ga4ScriptUrl, ga4Snippet, META_PIXEL_ID, metaPixelSnippet } from "@/lib/tracker-snippets";

/** The operator's own consoles: their visits are not marketing data, and their addresses stay out of ad tools. */
const UNTRACKED_PREFIXES = ["/admin"];

const isUntracked = (pathname: string) =>
  UNTRACKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * The Meta Pixel and GA4 in the member area (docs/TRACKING.md, phase 7.3): the
 * same snippets as the public site, under the same opt-out, loaded once the
 * page is interactive instead of rendered on the server — the dashboard layout
 * is a client component, and nothing here needs to be in the first HTML.
 *
 * Never on the admin consoles. A member who lands on one and moves to the app
 * loads the trackers then, and the snippet's own first PageView counts that
 * page; every later move inside the app is one SPA PageView.
 */
export default function DashboardTrackers() {
  const pathname = usePathname();
  // Unknown until the cookie is read in the browser: load nothing before that.
  const [optedOut, setOptedOut] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const previous = useRef<string | null>(null);
  const active = ANALYTICS_ENABLED && !optedOut && !isUntracked(pathname);

  useEffect(() => setOptedOut(isAnalyticsOptedOut()), []);

  useEffect(() => {
    if (active) setLoaded(true);
  }, [active]);

  useEffect(() => {
    // A move to another page of the app after the snippets loaded; the page
    // they loaded on was counted by their own first PageView.
    if (active && loaded && previous.current !== null && previous.current !== pathname) trackPageView(pathname);
    previous.current = pathname;
  }, [active, loaded, pathname]);

  if (!active && !loaded) return null;

  return (
    <>
      {META_PIXEL_ID && (
        <Script id="dashboard-meta-pixel" strategy="afterInteractive">
          {metaPixelSnippet(META_PIXEL_ID)}
        </Script>
      )}
      {GA4_ID && (
        <>
          <Script src={ga4ScriptUrl(GA4_ID)} strategy="afterInteractive" />
          <Script id="dashboard-ga4-init" strategy="afterInteractive">
            {ga4Snippet(GA4_ID)}
          </Script>
        </>
      )}
    </>
  );
}
