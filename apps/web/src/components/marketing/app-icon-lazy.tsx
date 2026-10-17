"use client";

import AppIconTile, { type AppIconSize, GLYPH_CLASS } from "./app-icon-tile";
import { useEffect, useState } from "react";

import type { Tone } from "@/components/marketing/tone";
import type { appGlyph, isAppGlyphName } from "@/icons/app-glyphs";

export type AppGlyphs = { glyphOf: typeof appGlyph; isKnown: typeof isAppGlyphName };

/** One request for the glyph set, shared by every lazy icon of the page. */
let loading: Promise<AppGlyphs> | null = null;
const loadGlyphs = () =>
  (loading ??= import("@/icons/app-glyphs").then((module) => ({
    glyphOf: module.appGlyph,
    isKnown: module.isAppGlyphName,
  })));

/**
 * The glyph set of the app tiles, loaded after the page in its own chunk
 * (the whole original Nexture set); null until it arrives.
 */
export function useAppGlyphs(): AppGlyphs | null {
  const [glyphs, setGlyphs] = useState<AppGlyphs | null>(null);
  useEffect(() => {
    let live = true;
    loadGlyphs().then((loaded) => {
      if (live) setGlyphs(loaded);
    });
    return () => {
      live = false;
    };
  }, []);
  return glyphs;
}

/**
 * <AppIcon> for client code that must draw any name the operator types (the
 * operator console). The tile shows at once; the glyph follows when the set
 * has loaded, instead of the set riding in the page's first load.
 */
export default function AppIconLazy({
  name,
  tone,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  tone: Tone;
  size?: AppIconSize;
  className?: string;
}) {
  const glyphs = useAppGlyphs();
  const Glyph = glyphs ? glyphs.glyphOf(name) : null;
  return (
    <AppIconTile tone={tone} size={size} className={className}>
      {Glyph ? <Glyph variant="contained" className={GLYPH_CLASS} /> : null}
    </AppIconTile>
  );
}
