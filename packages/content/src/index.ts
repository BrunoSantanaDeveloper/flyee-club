/**
 * Single source for site identity. A rebrand edits THIS file plus the assets it
 * points to:
 * - name/tagline/description → web metadata, marketing pages, OG image
 * - siteUrl → metadataBase, sitemap.ts, robots.ts (reads NEXT_PUBLIC_SITE_URL)
 * - the art → apps/web/public/brand/, the official SVGs as delivered: the
 *   lockup (logo-and-lettermark-{light,dark,white,black}.svg) and the mark
 *   (flyeeclub-logo.svg, flyeeclub-logo-dark.svg). The logo component
 *   (apps/web/src/components/logo/logo.tsx) references those files, and
 *   apps/web/public/images/email/logo.svg is the light lockup again.
 * - every raster below (the square `mark`, the home-screen tile, the three
 *   .ico files) is DERIVED from the mark: after replacing a master, run
 *   `npm run brand:assets -w @flyee/web` instead of exporting by hand.
 *
 * The logo is official (delivered 2026-10-01). The palette is still
 * provisional (docs/PRODUCT.md). The tagline/description here are the
 * locale-neutral fallbacks; localized copy lives in the `marketing` message
 * namespace.
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
   * The home-screen tile (180×180, full bleed). A file of its own because iOS
   * paints black behind transparent pixels and then applies its own mask, so
   * the rounded mark would arrive with dark corners.
   */
  appleIcon: "/brand/apple-touch-icon.png",
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
