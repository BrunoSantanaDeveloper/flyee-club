/** The languages the platform writes in (`profiles.locale`, `leads.locale`). */
export type EmailLocale = "pt-BR" | "en";

/** Anything that is not English reads Portuguese, the default language. */
export const toEmailLocale = (value: string | null | undefined): EmailLocale => (value === "en" ? "en" : "pt-BR");
