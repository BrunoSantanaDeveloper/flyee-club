import "@/style/app.css";

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import BackgroundWrapper from "@/components/layout/containers/background-wrapper";
import SnackbarWrapper from "@/components/layout/containers/snackbar-wrapper";
import LayoutContextProvider from "@/components/layout/layout-context";
import ThemeProvider from "@/theme/theme-provider";

/**
 * The shell of every screen that is NOT the public site: sign-in, the member
 * area, the admin consoles, the checkout, the onboarding and the CLI consent
 * screens. It mounts what those screens are built on (MUI with its styling
 * engine and theme, every message namespace, the layout state, the snackbars)
 * and loads the stylesheet with the overrides of the MUI components.
 *
 * It used to live in the root layout, which made every public page hydrate
 * MUI and carry all four message catalogs for components it never renders:
 * the phone score of the home stood at 55 (docs/PLANO-IMPLEMENTACAO.md,
 * "Casca pública"). The public site (`app/[locale]`) now renders outside it,
 * with no MUI at all, and the layout of each of the other segments wraps its
 * children in this shell. A navigation between two of those segments mounts
 * a new shell, which is fine: nothing in it holds state a screen relies on
 * across them.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
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
            <SnackbarWrapper>{children}</SnackbarWrapper>
          </LayoutContextProvider>
        </NextIntlClientProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
