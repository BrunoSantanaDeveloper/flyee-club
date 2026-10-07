import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { pickPublicClientMessages } from "@/i18n/public-client-messages";
import { isPublicLocale } from "@/i18n/routing";

/**
 * The language segment of the public site (docs/PLANO-IMPLEMENTACAO.md, 7.1).
 * The middleware rewrites `/planos` to `/pt-BR/planos` and `/en/pricing` to
 * `/en/planos`, so every public page renders here with its language in the
 * URL. The member area, sign-in and checkout are not under it and keep the
 * visitor's own language (lib/locale-request.ts).
 *
 * This is the only provider of the public site: the root layout mounts none,
 * and MUI with the full catalogs belongs to the signed-in areas
 * (components/layout/app-shell.tsx). It carries only the `marketing` keys the
 * client components of the public site read (i18n/public-client-messages.ts;
 * lib/public-shell.test.ts fails if one of them asks for another namespace or
 * for a key the list lacks). The four catalogs went to every phone before,
 * twice over, for strings only the server renders.
 *
 * It re-renders when the language in the URL changes, so those components
 * always speak the language of the address.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // `[locale]` also catches any unknown one-segment address; only the
  // languages of the site are pages.
  if (!isPublicLocale(locale)) notFound();
  setRequestLocale(locale);
  const { marketing } = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={{ marketing: pickPublicClientMessages(marketing) }}>
      {children}
    </NextIntlClientProvider>
  );
}
