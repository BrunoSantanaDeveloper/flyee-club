import { getRequestConfig } from "next-intl/server";

import { DEFAULTS } from "@/config";
import { LocaleOption } from "@/constants";
import { resolveRequestLocale } from "@/lib/locale-request";

// Message catalogs live in @flyee/content. Static map instead of a
// template-string import so the bundler can resolve each catalog.
const MESSAGES: Record<LocaleOption, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("@flyee/content/messages/en.json"),
  "pt-BR": () => import("@flyee/content/messages/pt-BR.json"),
};

export default getRequestConfig(async () => {
  try {
    /**
     * The cookie is the visitor's own choice and always wins. Without one — a
     * first visit — this request's own signals decide, so an English reader
     * gets English on the FIRST render. Detecting here rather than only in the
     * middleware is deliberate: a cookie the middleware sets lands on the
     * RESPONSE, so trusting it alone would serve this page in Portuguese and
     * switch only on the next navigation. The middleware persists the same
     * decision so it survives and can be overridden.
     */
    const { locale } = await resolveRequestLocale();

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
