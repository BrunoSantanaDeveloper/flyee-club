import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { DEFAULTS } from "@/config";
import { COOKIE_KEYS } from "@/constants";
import { localizeHref, matchPublicPath, routing } from "@/i18n/routing";
import {
  ATTRIBUTION_COOKIE_MAX_AGE,
  decodeAttribution,
  encodeAttribution,
  readAttributionFromUrl,
} from "@/lib/attribution";
import { CURRENCY_COOKIE_MAX_AGE, CURRENCY_PARAM, normalizeCurrency } from "@/lib/billing-currency";
import { encodeCampaignCookie, hasCampaign, LAST_CAMPAIGN_MAX_AGE, pickCampaignParams } from "@/lib/campaign-params";
import { detectLocale, isCrawler, LOCALE_COOKIE_MAX_AGE } from "@/lib/locale-detection";
import { COUPON_COOKIE_MAX_AGE, COUPON_PARAM, normalizeCouponCode } from "@/lib/offer-link";
import { sanitizeInternalNext } from "@/lib/safe-next";
import { normalizeSegment, SEGMENT_COOKIE_MAX_AGE, SEGMENT_PARAM } from "@/lib/site-segment";
import { countSiteView, isSpeculativeLoad, viewDoor } from "@/lib/site-views";
import { IMPERSONATION_MARKER_COOKIE, parseImpersonationMarker } from "@flyee/auth";
import { updateSession } from "@flyee/auth/middleware";

/**
 * Locale routing of the public site (docs/PLANO-IMPLEMENTACAO.md, 7.1): maps
 * `/planos` to the internal `/pt-BR/planos` and `/en/pricing` to `/en/planos`,
 * and redirects the non-canonical addresses (`/pt-BR/planos` → `/planos`,
 * `/en/planos` → `/en/pricing`). It runs ONLY for public pages: the member
 * area, sign-in and checkout have no locale in the URL.
 */
const handleI18nRouting = createIntlMiddleware(routing);

// Non-page prefixes reachable without a session. Everything else requires
// auth once Supabase is configured (without it, the middleware no-ops and the
// whole site stays browsable). Public PAGES are not listed here: they are the
// pathnames declared in src/i18n/routing.ts, in both languages.
const PUBLIC_PREFIXES = [
  "/auth",
  // Leaving a support impersonation only DELETES session cookies, so it must
  // work even when the session it is ending is already gone — otherwise the
  // way out redirects to sign-in and the operator is stuck.
  "/api/impersonation/exit",
  // Provider callbacks that authenticate THEMSELVES (Asaas token / Stripe
  // signature / Inngest signing key), so they must NOT hit the auth redirect.
  "/api/webhooks",
  "/api/inngest",
  // OAuth endpoints authenticate by their own means (the token endpoint
  // verifies PKCE, the device code or the refresh token). /oauth/authorize and
  // /ativar are deliberately NOT here: the consent screens need the session.
  "/api/oauth",
  // The CLI delivery API authenticates every call with its own bearer token
  // (lib/cli/gates.ts); a cookie session means nothing there.
  "/api/cli",
  // Endpoints a person reaches from an e-mail, with no account or signed out:
  // each carries its own token (the unsubscribe link, lib/unsubscribe.ts). The
  // trailing slash is part of the rule: `/api/publicity` is not this folder.
  "/api/public/",
  // SEO surfaces crawlers hit anonymously.
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
  "/.well-known",
];

const isPublic = (pathname: string) =>
  matchPublicPath(pathname) !== null || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

/** Where a support impersonation ends (also the operator's way back). */
const IMPERSONATION_EXIT = "/api/impersonation/exit";

/**
 * Surfaces a support session must not reach (support visits read everything
 * and write only settings and billing).
 *
 * The database is what actually refuses member writes — they leave the browser
 * straight for PostgREST and never pass through this middleware. What this
 * list adds is the two things Postgres cannot see, credentials and platform
 * admin, plus anything that mints credentials.
 */
const IMPERSONATION_BLOCKED_PREFIXES = [
  // Credential takeover: password, email and 2FA changes go to GoTrue, not to
  // Postgres, so no trigger can fence them.
  "/settings/security",
  // Platform administration is the operator's own account's business.
  "/admin",
  // Authorizing a client (the flyee CLI) mints credentials that OUTLIVE the
  // support visit — a support session must never leave a standing token on
  // the member's account behind. Approving a device code does the same.
  "/oauth",
  "/ativar",
  // The CLI API never runs on a cookie session; a support browser has no
  // business there.
  "/api/cli",
];

/** API routes whose non-GET methods write member work (none today: member writes go to PostgREST). */
const IMPERSONATION_READONLY_API: string[] = [];

/** A browser loading a page (not an API call, an asset or a client-side fetch). */
const isDocumentRequest = (request: NextRequest) =>
  request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");

export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;
  const requestedPath = `${pathname}${search}`;
  const publicPage = matchPublicPath(pathname);

  // An address that only exists in English, typed without the prefix
  // (`/pricing`): whoever typed it reads English. Nothing to refresh on a
  // redirect, so it answers before the session lookup.
  if (publicPage && !publicPage.prefixed && publicPage.locale !== routing.defaultLocale) {
    return NextResponse.redirect(
      new URL(localizeHref(`${publicPage.internal}${search}`, publicPage.locale), request.url),
    );
  }

  // The waitlist confirmation link carries a one-time token. Analytics scripts
  // send the page URL to third parties and links send it as Referer, so the
  // token moves into a short-lived httpOnly cookie and the page loads at the
  // clean address; the confirm action reads it from there.
  const confirmToken = request.nextUrl.searchParams.get("t");
  if (publicPage?.internal === "/espera/confirmar" && confirmToken) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("t");
    const redirect = NextResponse.redirect(clean);
    redirect.cookies.set(COOKIE_KEYS.leadConfirm, confirmToken.slice(0, 128), {
      path: "/",
      maxAge: 15 * 60,
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    });
    return redirect;
  }

  const { response: sessionResponse, user, needsMfa, impersonating } = await updateSession(request);

  /**
   * A campaign code (`?cupom=`) must reach the checkout, and between the click
   * and the checkout sit a sign-up, an e-mail confirmation and redirects that
   * all drop the query string. Capturing it here — before any of them — is the
   * only place that sees the original link on EVERY route.
   *
   * The newest link wins over an older stored code: typing a code in a URL is a
   * deliberate act, not passive attribution, and the last campaign she followed
   * is the offer she believes she is getting.
   */
  const linkCoupon = normalizeCouponCode(request.nextUrl.searchParams.get(COUPON_PARAM));

  /**
   * A link that names the currency (`?moeda=USD`): a campaign for one market,
   * or the currency switch of the pricing page. Like the coupon it has to
   * survive the sign-up on the way to the checkout, so it is kept here.
   */
  const linkCurrency = normalizeCurrency(request.nextUrl.searchParams.get(CURRENCY_PARAM));

  /**
   * A segment link (`?segment=agencia`): the audience the visitor declared,
   * kept for the sign-up and the onboarding to pre-fill (lib/site-segment.ts).
   * The newest link wins, like the coupon; an unknown value writes nothing.
   */
  const linkSegment = normalizeSegment(request.nextUrl.searchParams.get(SEGMENT_PARAM));

  /**
   * Campaign attribution (?origem/?onda/utm_*), captured on the FIRST touch and
   * never overwritten: the campaign that brought her earned the signup, and a
   * later visit through a bookmark must not take the credit. Persisted to the
   * workspace once the account exists (lib/signup-attribution.ts).
   */
  const linkAttribution = request.cookies.has(COOKIE_KEYS.attribution)
    ? null
    : readAttributionFromUrl(request.nextUrl, request.headers.get("referer"));

  /**
   * The LAST-touch campaign, the opposite rule: rewritten by every link that
   * carries one, because it credits the SALE, not the signup. The checkout
   * reads it when its own link has no campaign — a live event's button that
   * sends to /planos crosses a sign-up and the billing page, which drop the
   * query string (lib/campaign-params.ts, migration 0113).
   */
  const linkCampaign = pickCampaignParams(Object.fromEntries(request.nextUrl.searchParams));

  /**
   * The language a page sets for the rest of the visit.
   *
   * A public page carries its language in the address, and reading it is the
   * visitor's answer: sign-in, sign-up and the member area that follow (none
   * of which has a locale in the URL) continue in that language. Set on every
   * public page whose language differs from the cookie, never flagged as
   * automatic: the address was followed, not guessed.
   *
   * Anywhere else, a first visit (no cookie yet) gets the first-visit
   * detection. The RENDER already resolves it from the request's own headers
   * (lib/locale-request.ts); the cookie is what makes it STAY, the thing the
   * switcher overrides, and the reason detection runs once per visitor. A
   * crawler is never switched (detectLocale) and an API call or asset has no
   * language to choose.
   */
  const currentLocaleCookie = request.cookies.get(COOKIE_KEYS.locale)?.value;
  const readsPublicPage = publicPage !== null && isDocumentRequest(request);
  const urlLocale = readsPublicPage && currentLocaleCookie !== publicPage.locale ? publicPage.locale : null;
  // The address decided, not a guess: an earlier automatic switch has nothing
  // left to announce or undo.
  const clearsAutoFlag = readsPublicPage && request.cookies.has(COOKIE_KEYS.localeAuto);
  const detectedLocale =
    !publicPage && !currentLocaleCookie && isDocumentRequest(request)
      ? detectLocale({
          acceptLanguage: request.headers.get("accept-language"),
          country: request.headers.get("x-vercel-ip-country"),
          userAgent: request.headers.get("user-agent"),
        })
      : null;

  const withVisitCookies = <T extends NextResponse>(res: T): T => {
    if (linkCoupon) {
      res.cookies.set(COOKIE_KEYS.offerCoupon, linkCoupon, {
        path: "/",
        maxAge: COUPON_COOKIE_MAX_AGE,
        sameSite: "lax",
        // Read by the billing page to confirm the code visually. A coupon code
        // is public by nature — it is printed in the campaign itself.
        httpOnly: false,
      });
    }
    if (linkCurrency) {
      res.cookies.set(COOKIE_KEYS.currency, linkCurrency, {
        path: "/",
        maxAge: CURRENCY_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
      });
    }
    if (linkAttribution) {
      res.cookies.set(COOKIE_KEYS.attribution, encodeAttribution(linkAttribution), {
        path: "/",
        maxAge: ATTRIBUTION_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: true,
      });
    }
    if (hasCampaign(linkCampaign)) {
      res.cookies.set(COOKIE_KEYS.lastCampaign, encodeCampaignCookie(linkCampaign), {
        path: "/",
        maxAge: LAST_CAMPAIGN_MAX_AGE,
        sameSite: "lax",
        httpOnly: true,
      });
    }
    if (linkSegment) {
      res.cookies.set(COOKIE_KEYS.segment, linkSegment, {
        path: "/",
        maxAge: SEGMENT_COOKIE_MAX_AGE,
        sameSite: "lax",
        // Read by the client: it stamps the site events and pre-fills the waitlist.
        httpOnly: false,
      });
    }
    const locale = urlLocale ?? detectedLocale;
    if (locale) {
      // Read by the client (the switcher shows the active language), like the
      // locale cookie the logged-in switcher writes.
      res.cookies.set(COOKIE_KEYS.locale, locale, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
      });
    }
    if (clearsAutoFlag) {
      res.cookies.delete(COOKIE_KEYS.localeAuto);
    } else if (detectedLocale) {
      // The flag that makes an automatic switch VISIBLE: sign-in and the app
      // offer the way back to Portuguese while it is set, and acknowledging or
      // choosing a language clears it (i18n/locale.ts).
      res.cookies.set(COOKIE_KEYS.localeAuto, detectedLocale, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
      });
    }
    return res;
  };

  if (impersonating && pathname !== IMPERSONATION_EXIT) {
    const marker = parseImpersonationMarker(request.cookies.get(IMPERSONATION_MARKER_COOKIE)?.value);

    // The support session died (revoked, or its refresh token expired). Drop
    // the parallel cookies so the very next request reads the operator's own
    // session again — being impersonated must never strand anyone signed out.
    if (!user || !marker) {
      const back = NextResponse.redirect(new URL(IMPERSONATION_EXIT, request.url));
      back.cookies.delete(IMPERSONATION_MARKER_COOKIE);
      return back;
    }

    // A support access is a visit, not a tenancy.
    if (marker.expiresAt <= Date.now()) {
      return NextResponse.redirect(new URL(`${IMPERSONATION_EXIT}?reason=expired`, request.url));
    }

    if (IMPERSONATION_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL(DEFAULTS.appRoot, request.url));
    }

    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      IMPERSONATION_READONLY_API.some((prefix) => pathname.startsWith(prefix))
    ) {
      return NextResponse.json(
        {
          error: "impersonation_read_only",
          message: "Support sessions cannot write member data. Leave the session to act as yourself.",
        },
        { status: 403 },
      );
    }
  }

  if (publicPage) {
    // A public page never needs a session: next-intl maps the address to its
    // internal route, or redirects a non-canonical one. Its response must
    // carry the session cookies the refresh above may have rotated; the
    // refreshed REQUEST cookies are already in, because next-intl copies the
    // request headers after updateSession rewrote them.
    const intlResponse = handleI18nRouting(request);
    for (const cookie of sessionResponse.cookies.getAll()) intlResponse.cookies.set(cookie);

    // One visit of the entry doors table (/admin/metricas): a page load by a
    // person who is not signed in. A redirect is not a view (its target is),
    // and neither is a crawler or a browser prefetching ahead of a click.
    // Counted after the response, so the page never waits on it.
    const counts =
      readsPublicPage &&
      !user &&
      !intlResponse.headers.get("location") &&
      !isCrawler(request.headers.get("user-agent")) &&
      !isSpeculativeLoad(request.headers);
    if (counts && event) {
      event.waitUntil(
        countSiteView({
          path: publicPage.internal,
          origem: viewDoor(
            request.nextUrl.searchParams.get("origem"),
            decodeAttribution(request.cookies.get(COOKIE_KEYS.attribution)?.value),
          ),
          locale: publicPage.locale,
        }),
      );
    }
    return withVisitCookies(intlResponse);
  }

  // Users with a verified TOTP factor must complete the challenge before
  // reaching anything protected (their session is still AAL1).
  if (user && needsMfa && !isPublic(pathname)) {
    const twoFactor = new URL("/auth/two-factor", request.url);
    twoFactor.searchParams.set("next", sanitizeInternalNext(requestedPath));
    return withVisitCookies(NextResponse.redirect(twoFactor));
  }

  // Signed-in users don't need the sign-in/sign-up screens.
  if (user && !needsMfa && (pathname.startsWith("/auth/sign-in") || pathname.startsWith("/auth/sign-up"))) {
    const destination = sanitizeInternalNext(request.nextUrl.searchParams.get("next"), DEFAULTS.appRoot);
    return withVisitCookies(NextResponse.redirect(new URL(destination, request.url)));
  }

  if (!user && !isPublic(pathname)) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", sanitizeInternalNext(requestedPath));
    return withVisitCookies(NextResponse.redirect(signIn));
  }

  return withVisitCookies(sessionResponse);
}

export const config = {
  matcher: [
    // Skip static assets and image optimization; run everywhere else.
    // `videos` belongs here for the same reason `images` does: a file under
    // `public/` has no session to refresh, and without it every <video> on a
    // public page answered a 307 to /auth/sign-in.
    "/((?!_next/static|_next/image|favicon|images|videos|initial-loader|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
