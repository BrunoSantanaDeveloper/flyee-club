"use server";

import { cookies } from "next/headers";

import { COOKIE_KEYS, LocaleOption, LOCALES } from "@/constants";
import { LOCALE_COOKIE_MAX_AGE } from "@/lib/locale-detection";
import { IMPERSONATION_MARKER_COOKIE, isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";

/**
 * Reading the locale moved to `lib/locale-request.ts` (`resolveRequestLocale`),
 * which also knows WHO decided it. This file keeps only the writes: every
 * export of a "use server" module is a callable endpoint, and a reader that
 * nothing calls is an endpoint with no reason to exist.
 *
 * These are the switches of the surfaces WITHOUT a locale in the URL (sign-in,
 * the member area). The public site switches language by address instead
 * (components/marketing/language-switch.tsx).
 */
export async function setClientLocale(locale: LocaleOption) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEYS.locale, locale, {
    path: "/",
    // A deliberate choice must outlive the browser session: as a session
    // cookie it died on close and the public site's detection switched her
    // language back on the next visit (lib/locale-detection.ts).
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  // She has now chosen — there is nothing left to announce or undo.
  cookieStore.delete(COOKIE_KEYS.localeAuto);

  // A member's language also lives on the profile, which is what the e-mails
  // and the CLI read: the cookie only reaches this browser. A support session
  // reads in the operator's language and must not change the member's.
  if (!isSupabaseConfigured || cookieStore.has(IMPERSONATION_MARKER_COOKIE)) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.rpc("update_member_profile", { p_locale: locale });
  } catch {
    // The cookie already holds the choice for this browser; the profile
    // catches up on the next switch.
  }
}

/**
 * Keep the detected language, stop announcing it. Dismissing the notice is an
 * answer ("yes, English is right"), so the choice is persisted as hers.
 */
export async function acknowledgeDetectedLocale() {
  const cookieStore = await cookies();
  const current = cookieStore.get(COOKIE_KEYS.locale)?.value;
  if ((LOCALES as readonly string[]).includes(current ?? "")) {
    cookieStore.set(COOKIE_KEYS.locale, current as LocaleOption, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  cookieStore.delete(COOKIE_KEYS.localeAuto);
}
