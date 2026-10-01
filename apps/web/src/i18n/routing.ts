import { defineRouting } from "next-intl/routing";

import { DEFAULTS } from "@/config";
import { type LocaleOption, LOCALES } from "@/constants";

/**
 * Path-based locales for the PUBLIC site only (docs/PLANO-IMPLEMENTACAO.md,
 * phase 7.1). Portuguese lives at the root (`/planos`), English under `/en`
 * with translated addresses (`/en/pricing`). The member area, the admin,
 * sign-in, checkout and OAuth are NOT routed here: they are not indexed and
 * keep the cookie/profile language (lib/locale-request.ts).
 *
 * The keys are the internal paths, which are the Portuguese ones and match the
 * folders under app/[locale]/(marketing). A page that does not exist yet may
 * already be declared: its address is part of the contract, and an address
 * with no page simply answers 404.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULTS.locale as LocaleOption,
  localePrefix: "as-needed",
  // The URL is the language. No redirect from Accept-Language or a cookie: a
  // crawler must always find the Portuguese page at the Portuguese address,
  // and a person is offered the other language, never moved to it.
  localeDetection: false,
  // The language cookie is the platform's own (COOKIE_KEYS.locale), written by
  // the middleware when a public page is read in a language.
  localeCookie: false,
  // hreflang is emitted in each page's metadata (lib/seo.ts), where the help
  // and blog translations, whose slugs differ per language, are known.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/planos": { "pt-BR": "/planos", en: "/pricing" },
    "/como-funciona": { "pt-BR": "/como-funciona", en: "/how-it-works" },
    "/catalogo": { "pt-BR": "/catalogo", en: "/catalog" },
    "/catalogo/[slug]": { "pt-BR": "/catalogo/[slug]", en: "/catalog/[slug]" },
    "/sobre": { "pt-BR": "/sobre", en: "/about" },
    "/contato": { "pt-BR": "/contato", en: "/contact" },
    "/ajuda": { "pt-BR": "/ajuda", en: "/help" },
    "/ajuda/[slug]": { "pt-BR": "/ajuda/[slug]", en: "/help/[slug]" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/legal/termos": { "pt-BR": "/legal/termos", en: "/legal/terms" },
    "/legal/privacidade": { "pt-BR": "/legal/privacidade", en: "/legal/privacy" },
    "/legal/cookies": "/legal/cookies",
    "/espera": { "pt-BR": "/espera", en: "/waitlist" },
    "/espera/confirmar": { "pt-BR": "/espera/confirmar", en: "/waitlist/confirm" },
    "/verificar/[ref]": { "pt-BR": "/verificar/[ref]", en: "/verify/[ref]" },
    "/fundadores": { "pt-BR": "/fundadores", en: "/founders" },
  },
});

export type PublicLocale = (typeof routing.locales)[number];
export type PublicPathname = keyof typeof routing.pathnames;

export const isPublicLocale = (value: unknown): value is PublicLocale =>
  typeof value === "string" && (routing.locales as readonly string[]).includes(value);

type Template = { source: string; pattern: RegExp; names: string[] };

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `/catalog/[slug]` → a matcher capturing `slug`. */
function compile(source: string): Template {
  const names: string[] = [];
  const pattern = source
    .split(/(\[[^\]]+\])/)
    .map((part) => {
      const param = /^\[([^\]]+)\]$/.exec(part);
      if (!param) return escapeForRegExp(part);
      names.push(param[1]);
      return "([^/]+)";
    })
    .join("");
  return { source, pattern: new RegExp(`^${pattern}$`), names };
}

function capture(template: Template, path: string): Record<string, string> | null {
  const match = template.pattern.exec(path);
  if (!match) return null;
  return Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
}

const fill = (source: string, params: Record<string, string>) =>
  source.replace(/\[([^\]]+)\]/g, (_, name: string) => params[name] ?? "");

const ENTRIES = Object.entries(routing.pathnames).map(([internal, value]) => ({
  internal: compile(internal),
  external: Object.fromEntries(
    routing.locales.map((locale) => [locale, compile(typeof value === "string" ? value : value[locale])]),
  ) as Record<PublicLocale, Template>,
}));

/** Splits `/planos?x=1#y` into the path and the rest. */
function splitHref(href: string): [string, string] {
  const cut = href.search(/[?#]/);
  return cut === -1 ? [href, ""] : [href.slice(0, cut), href.slice(cut)];
}

/** `/en/pricing` → ["en", "/pricing"]; `/planos` → [null, "/planos"]. */
function splitLocalePrefix(pathname: string): [PublicLocale | null, string] {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return [locale, pathname.slice(prefix.length) || "/"];
    }
  }
  return [null, pathname];
}

export type PublicPathMatch = {
  /** The language the address asks for. */
  locale: PublicLocale;
  /** The internal (Portuguese) path with its parameters filled: `/blog/x`. */
  internal: string;
  /** Whether the address carries a locale prefix (`/en/...`, `/pt-BR/...`). */
  prefixed: boolean;
};

/**
 * Whether a request path is a page of the public site, in either language and
 * with or without a locale prefix, and which language it asks for.
 *
 * An unprefixed address that only exists in English (`/pricing`) asks for
 * English: whoever typed it reads English, and the middleware sends it to
 * `/en/pricing` instead of letting it fall back to Portuguese.
 */
export function matchPublicPath(pathname: string): PublicPathMatch | null {
  const [prefixLocale, rest] = splitLocalePrefix(pathname);
  const order = prefixLocale
    ? [prefixLocale, ...routing.locales.filter((locale) => locale !== prefixLocale)]
    : [routing.defaultLocale, ...routing.locales.filter((locale) => locale !== routing.defaultLocale)];

  for (const locale of order) {
    for (const entry of ENTRIES) {
      const params = capture(entry.external[locale], rest);
      if (params) {
        return {
          locale: prefixLocale ?? locale,
          internal: fill(entry.internal.source, params),
          prefixed: prefixLocale !== null,
        };
      }
    }
  }
  return null;
}

/**
 * The address of a public page in a language: `/planos` → `/en/pricing`,
 * `/blog/x?y=1` → `/en/blog/x?y=1`, `/` → `/en`. The input is the internal
 * (Portuguese) path. Anything that is not a public page (`/auth/sign-up`, an
 * absolute URL, an address that already carries a prefix) comes back
 * unchanged, so every link on the site can go through this.
 */
export function localizeHref(href: string, locale: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const target: PublicLocale = isPublicLocale(locale) ? locale : routing.defaultLocale;
  const [path, suffix] = splitHref(href);
  if (splitLocalePrefix(path)[0] !== null) return href;

  for (const entry of ENTRIES) {
    const params = capture(entry.internal, path);
    if (!params) continue;
    const external = fill(entry.external[target].source, params);
    if (target === routing.defaultLocale) return `${external}${suffix}`;
    return `/${target}${external === "/" ? "" : external}${suffix}`;
  }
  return href;
}
