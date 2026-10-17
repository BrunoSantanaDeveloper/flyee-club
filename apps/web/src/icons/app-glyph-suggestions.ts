/**
 * Glyphs that say what an app does, offered first in the operator console
 * (`AppIconField`). The five drawn for the store in 2026-10 (script, video
 * search, clapperboard, film, carousel) come first, then the originals that
 * fit kinds of work. Names only, so the console lists them without loading
 * the glyph set; `app-glyphs.test.ts` checks that each one exists.
 */
export const APP_GLYPH_SUGGESTIONS = [
  "NiScript",
  "NiVideoSearch",
  "NiEyeOpen",
  "NiClapperboard",
  "NiFilm",
  "NiCarousel",
  "NiCamera",
  "NiMicrophone",
  "NiDocumentVideo",
  "NiDocumentFull",
  "NiTextQuote",
  "NiAnnouncement",
  "NiTelescope",
  "NiChartLine",
  "NiTrendUp",
  "NiPen",
  "NiPalette",
  "NiMagicWand",
  "NiMessages",
  "NiEmail",
  "NiStore",
  "NiWallet",
  "NiCode",
  "NiRocket",
] as const;
