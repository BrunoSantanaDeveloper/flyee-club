/**
 * Single source for site identity. A rebrand edits THIS file plus the assets it
 * points to:
 * - name/tagline/description → web metadata, marketing pages, OG image
 * - siteUrl → metadataBase, sitemap.ts, robots.ts (reads NEXT_PUBLIC_SITE_URL)
 * - favicons → apps/web/public/favicon/favicon-{light,dark}.ico + the square `mark`
 * - logo SVGs → apps/web/src/components/logo/logo.tsx and the master art in
 *   packages/content/brand/, plus apps/web/public/images/email/logo.svg
 *
 * The brand is PROVISIONAL (decision 2026-09-30, docs/PRODUCT.md): placeholder
 * logo, current palette. The tagline/description here are the locale-neutral
 * fallbacks; localized copy lives in the `marketing` message namespace.
 */
export const BRAND = {
  name: "flyee.club",
  tagline: "The AI changes every week. flyee.club keeps your tools working.",
  description:
    "A club that keeps your AI agent harness and tools up to date, in the AI you already use, in Portuguese and English.",
  /**
   * Canonical site URL — set NEXT_PUBLIC_SITE_URL in production (no trailing
   * slash). Not `??`: a defined-but-empty variable is not null, and an empty
   * canonical would silently poison every metadata URL, the sitemap and the
   * JSON-LD rather than falling back to something visibly wrong in dev.
   */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/u, "") || "http://localhost:3000",
  favicon: {
    /**
     * Theme-aware tab icons. Browser-only BY CONSTRUCTION: they are served
     * behind `media="(prefers-color-scheme: …)"`, and Googlebot does not
     * evaluate that — which is the whole reason `mark` below has to exist.
     */
    light: "/favicon/favicon-light.ico",
    dark: "/favicon/favicon-dark.ico",
  },
  /**
   * The square master mark (512×512) — the only icon a search engine can use.
   * Google requires a SQUARE favicon, recommends a multiple of 48px, and reads
   * no media query. Also the Organization logo in the site's JSON-LD.
   */
  mark: "/brand/flyee-mark.png",
  /**
   * Quick-support channels for the floating widget (web marketing +
   * dashboard). Leave a channel empty ("") to hide it; leave all empty
   * and the widget renders nothing. whatsapp is digits only, with the
   * country code (e.g. "5511999999999" → wa.me deep link).
   */
  support: {
    whatsapp: "",
    email: "",
    helpCenter: "/ajuda",
  },
} as const;
