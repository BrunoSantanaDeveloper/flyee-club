import "@/style/global.css";

import { Metadata } from "next";
import { JetBrains_Mono, Londrina_Solid, Mulish } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Suspense } from "react";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import Loading from "@/app/loading";
import { BRAND } from "@/brand";
import BackgroundWrapper from "@/components/layout/containers/background-wrapper";
import SnackbarWrapper from "@/components/layout/containers/snackbar-wrapper";
import LayoutContextProvider from "@/components/layout/layout-context";
import ThemeProvider from "@/theme/theme-provider";

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap", // Use 'swap' to ensure text remains visible during font loading
  preload: true,
});

// The brand face: the "flyeeclub" lettermark is set in it. The family ships
// four static weights only (100, 300, 400 and 900), so a heading class gets
// the nearest real face, never a synthesised one: font-normal and font-medium
// render Regular; font-semibold, font-bold and font-extrabold render Black.
// Add "300" or "100" to the list when a design calls for a lighter display.
const londrina = Londrina_Solid({
  weight: ["400", "900"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  preload: true,
});

// Commands, versions and file names: the `font-mono` utility and every
// <code>, <pre> and <kbd>. A variable font, so one file covers 100 to 800.
// Not preloaded: most pages show no mono text above the fold, and an unused
// preload only competes with the fonts that are. No metric-adjusted fallback
// either, because that fallback is Arial: while the file loads, the stack in
// tailwind.config.ts falls to the system mono face and the columns hold.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

// `font-display` has no face of its own: it falls back to --font-heading
// (Londrina Solid) through tailwind.config.ts. A separate display face, if one
// is ever chosen, is wired here as --font-display.

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  icons: {
    icon: [
      /**
       * UNCONDITIONAL first, and it has to stay here: Googlebot does not
       * evaluate `prefers-color-scheme`, so a list of only theme-aware icons
       * left it with nothing declared and it fell back to /favicon.ico — 32×32,
       * upscaled into the search result. This one is the 512×512 square master
       * mark, which Google downscales instead.
       */
      { url: BRAND.mark, type: "image/png", sizes: "512x512" },
      { media: "(prefers-color-scheme: dark)", url: BRAND.favicon.dark },
      { media: "(prefers-color-scheme: light)", url: BRAND.favicon.light },
    ],
    // A touch icon is a home-screen tile. It has its own full-bleed file: iOS
    // paints black behind transparent corners and applies its own mask.
    apple: BRAND.appleIcon,
  },
  /**
   * Lets Google show a full-size image preview instead of the default thumbnail
   * cap. Harmless where it does not apply — a `noindex` page overrides this
   * whole field, and robots.txt keeps the app out regardless.
   */
  robots: { "max-image-preview": "large" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      style={{ "--inner-shadow-opacity": "0.6", "--foreground-opacity": "0.6" } as React.CSSProperties}
      className={`${mulish.variable} ${londrina.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* We need to include the loader CSS directly to avoid flash of unstyled content */}
        <link rel="stylesheet" href="/initial-loader.css" />

        {/* Load the loader script directly for fastest execution */}
        <Script id="loader-script" src="/initial-loader.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased">
        {/* Initial loader */}
        <div id="initial-loader">
          <div className="spinner"></div>
        </div>
        {/* Initial loader end */}
        <AppRouterCacheProvider
          options={{
            key: "css",
            prepend: false,
            enableCssLayer: true,
          }}
        >
          <ThemeProvider>
            <NextIntlClientProvider messages={messages}>
              <LayoutContextProvider>
                <BackgroundWrapper />
                <SnackbarWrapper>
                  <Suspense fallback={<Loading />}>{children}</Suspense>
                </SnackbarWrapper>
              </LayoutContextProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
