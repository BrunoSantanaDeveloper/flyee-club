import AppIconTile, { type AppIconSize, GLYPH_CLASS } from "./app-icon-tile";

import type { Tone } from "@/components/marketing/tone";
import { appGlyph } from "@/icons/app-glyphs";

export type { AppIconSize };

/**
 * An app's icon, the same wherever the app appears (the hero, the store
 * carousel, the featured app, /catalogo and the app's page): a rounded
 * square filled with the hue of its store category, as the home brief asks
 * ("ícone quadrado de cantos arredondados, com uma cor por categoria"), and
 * the app's own glyph in white.
 *
 * The glyph is the one the operator names in the console, drawn from the
 * ORIGINAL Nexture set (icons/app-glyphs.tsx) and not from the interface's
 * icons, so an app never looks like a control of the page (decided
 * 2026-10-17). It renders on the server; a client component receives it as
 * an element, never imports it (the glyph map holds the whole set; the
 * console has its own loader, app-icon-lazy.tsx).
 *
 * Decorative: the app's name is always written beside it.
 */
export default function AppIcon({
  name,
  tone,
  size = "md",
  className,
}: {
  /** The icon name of the app (`catalog_modules.icon`); empty or unknown draws the apps glyph. */
  name: string | null | undefined;
  tone: Tone;
  size?: AppIconSize;
  className?: string;
}) {
  const Glyph = appGlyph(name);
  return (
    <AppIconTile tone={tone} size={size} className={className}>
      <Glyph variant="contained" className={GLYPH_CLASS} />
    </AppIconTile>
  );
}
