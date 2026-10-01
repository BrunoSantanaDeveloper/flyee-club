import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { isPublicLocale } from "@/i18n/routing";

/**
 * The language segment of the public site (docs/PLANO-IMPLEMENTACAO.md, 7.1).
 * The middleware rewrites `/planos` to `/pt-BR/planos` and `/en/pricing` to
 * `/en/planos`, so every public page renders here with its language in the
 * URL. The member area, sign-in and checkout are not under it and keep the
 * visitor's own language (lib/locale-request.ts).
 *
 * The provider is repeated on purpose. The root layout is shared by every
 * route and is not re-rendered by a client-side navigation, so its messages
 * stay those of the first page loaded; this segment does re-render when the
 * language in the URL changes, so the client components of a public page
 * always speak the language of its address.
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
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
