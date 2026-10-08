/**
 * The platform speaks two languages (decision 2026-09-30, docs/PRODUCT.md):
 * Brazilian Portuguese, the default and home market, and English.
 */
export const LOCALES = ["pt-BR", "en"] as const;
export type LocaleOption = (typeof LOCALES)[number];

/**
 * Reading order wherever a person PICKS a language — by audience: the home
 * market first. Declared as a rank per locale rather than as a list, because a
 * `Record` over `LocaleOption` is what makes the compiler REQUIRE every
 * language: a locale added to the catalogs and forgotten here would otherwise
 * just be missing from every switcher, silently.
 */
const LOCALE_RANK: Record<LocaleOption, number> = {
  "pt-BR": 0,
  en: 1,
};

export const LOCALE_DISPLAY_ORDER: readonly LocaleOption[] = [...LOCALES].sort(
  (a, b) => LOCALE_RANK[a] - LOCALE_RANK[b],
);

/**
 * A single locked palette (packages/design-tokens/css/yellow.css): the yellow
 * of the FlyeeClub logo, by the owner's decision of 2026-10-08 (it replaced the
 * provisional orange). The theme provider applies only a class listed here,
 * whatever a browser has stored, so a browser that kept "theme-orange" gets
 * this one.
 */
export const THEME_OPTIONS = {
  YELLOW: "theme-yellow",
} as const;

export type ThemeVariant = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

export type ModeVariant = (typeof THEME_MODE_OPTIONS)[number];
export const THEME_MODE_OPTIONS = ["light", "dark", "system"] as const;

const storagePrefix = process.env.NEXT_PUBLIC_STORAGE_PREFIX || "";
export const COOKIE_KEYS = {
  locale: `${storagePrefix}-locale`,
  // Present only while the ACTIVE locale was chosen for the visitor by the
  // middleware (Accept-Language / IP country) and she has not acknowledged it.
  // It carries the detected locale so the public page can say "we switched the
  // language for you" and offer the way back — a silent switch is how someone
  // ends up reading a language she did not ask for and cannot undo.
  localeAuto: `${storagePrefix}-locale-auto`,
  // Opt-out flag for marketing analytics (read server-side to SSR the trackers,
  // and client-side by lib/analytics). Absent = tracking on (opt-out model).
  analyticsOptOut: `${storagePrefix}-analytics-optout`,
  // Coupon code carried by a campaign link (`?cupom=`). Captured by the
  // middleware on ANY page so it survives the sign-up + e-mail confirmation
  // round trip and is still there when she reaches checkout. Not a secret:
  // readable by the client so the billing page can confirm it visually.
  offerCoupon: `${storagePrefix}-cupom`,
  // FIRST-touch campaign attribution (?origem/?onda/utm_*), captured by the
  // middleware and persisted to the workspace at signup. httpOnly: nothing in
  // the browser reads it, unlike the coupon.
  attribution: `${storagePrefix}-atrib`,
  // LAST-touch campaign (origem/utm_*), rewritten by the middleware on every
  // link that carries one. The checkout falls back to it when its own link has
  // none (e.g. an event's button → /planos → sign-up → billing), so a sale is
  // credited to the campaign that brought it. httpOnly; 14 days, the same
  // window the billing webhook accepts (migration 0113).
  lastCampaign: `${storagePrefix}-campanha`,
  // The currency the visitor chose to see and buy in (`?moeda=USD` or the
  // currency switch); without it the language decides (lib/billing-currency.ts).
  // Readable by the client, which shows the active currency.
  currency: `${storagePrefix}-moeda`,
  // The waitlist confirmation token, moved out of the e-mail link by the
  // middleware (a URL is what analytics scripts and Referer headers carry).
  // httpOnly, 15 minutes, consumed by the confirm action.
  leadConfirm: `${storagePrefix}-confirmacao`,
  // The request of an unsubscribe link ("m:<token>" or "l:<token>"), moved out
  // of the address on the way to the page that asks before acting
  // (lib/unsubscribe.ts). httpOnly, 15 minutes, consumed by that page.
  unsubscribe: `${storagePrefix}-descadastro`,
  // The audience the visitor declared before any account exists: a segment
  // link (`?segment=`, written by the middleware) or a click on the page
  // (lib/site-events.ts). The newest choice wins. Readable by the client: it
  // stamps every site event and pre-fills the waitlist; the sign-up and the
  // onboarding pre-fill the profile from it (lib/site-segment.ts).
  segment: `${storagePrefix}-segmento`,
};

export const SESSION_STORAGE_KEYS = {
  /**
   * The address a sign-up just used, handed to /auth/get-verification so it can
   * resend the confirmation without asking her to retype it. sessionStorage,
   * not the URL: an e-mail in a query string ends up in history and server logs.
   */
  signupEmail: `${storagePrefix}-signup-email`,
};

export const LOCAL_STORAGE_KEYS = {
  themeColor: `${storagePrefix}-theme-color`,
  themeMode: `${storagePrefix}-theme-mode`,
  leftMenuType: `${storagePrefix}-left-menu-type`,
  contentType: `${storagePrefix}-content-type`,
  cookieConsent: `${storagePrefix}-cookie-consent`,
  // Set once the visitor has answered the public site's language suggestion
  // (or picked a language with the switch): the offer is never repeated.
  languageSuggestion: `${storagePrefix}-language-suggestion`,
};
