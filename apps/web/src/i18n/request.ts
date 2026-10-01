import { getRequestConfig } from "next-intl/server";

import { DEFAULTS } from "@/config";
import { LocaleOption } from "@/constants";
import { isPublicLocale } from "@/i18n/routing";
import { resolveRequestLocale } from "@/lib/locale-request";

// Message catalogs live in @flyee/content. Static map instead of a
// template-string import so the bundler can resolve each catalog.
const MESSAGES: Record<LocaleOption, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("@flyee/content/messages/en.json"),
  "pt-BR": () => import("@flyee/content/messages/pt-BR.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  try {
    /**
     * Two sources, one per kind of page (docs/PLANO-IMPLEMENTACAO.md, 7.1):
     *
     * - A public page carries its language in the URL. next-intl hands it over
     *   as `requestLocale` (the `[locale]` segment, or the header the
     *   middleware sets for it), and nothing else may override it: the address
     *   is what a crawler indexed and what a link promised.
     * - Everything else (sign-in, the member area, checkout) has no locale in
     *   the URL and follows the visitor: the cookie she chose, or this
     *   request's own signals on a first visit. Detecting here rather than only
     *   in the middleware is deliberate: a cookie the middleware sets lands on
     *   the RESPONSE, so trusting it alone would render this request in
     *   Portuguese and switch only on the next navigation.
     */
    const requested = await requestLocale;
    const locale = isPublicLocale(requested) ? requested : (await resolveRequestLocale()).locale;

    return {
      locale,
      messages: (await MESSAGES[locale]()).default,
      timeZone: "UTC",
    };
  } catch (error: any) {
    if (
      error.digest === "DYNAMIC_SERVER_USAGE" ||
      error.message?.includes("DynamicServerError") ||
      error.name === "DynamicServerError"
    ) {
      throw error;
    }
    // Fallback to default locale if there's an error
    return {
      locale: DEFAULTS.locale,
      messages: (await MESSAGES[DEFAULTS.locale as LocaleOption]()).default,
      timeZone: "UTC",
    };
  }
});
