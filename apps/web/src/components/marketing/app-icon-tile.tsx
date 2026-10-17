import type { Tone } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

/** Preset tile sizes; `className` can still set a responsive size of its own. */
const SIZE = {
  xs: "size-7",
  sm: "size-9",
  md: "size-12",
  lg: "size-14",
  xl: "size-18",
  "2xl": "size-22",
} as const;

export type AppIconSize = keyof typeof SIZE;

/**
 * The colour of the glyph, the one place an app's hue shows (decided by the
 * owner on 2026-10-17, between four treatments: a white tile with a coloured
 * glyph, as in the reference of logos on white tiles). The accents keep their
 * values in both modes; on the dark page the glyph takes their light step.
 * The brand's hue is the glyph of the logo: charcoal with its second tone in
 * the yellow on a light page (`app-glyph-duo`, style/site/site.css), the
 * yellow on a dark one. The gold of the secondary reads brown at this size,
 * so a tile in it draws as the brand's.
 */
const GLYPH: Record<Tone, string> = {
  primary: "app-glyph-duo text-primary-contrast dark:text-primary-ink",
  secondary: "app-glyph-duo text-primary-contrast dark:text-primary-ink",
  "accent-1": "text-accent-1 dark:text-accent-1-light",
  "accent-2": "text-accent-2 dark:text-accent-2-light",
  "accent-3": "text-accent-3 dark:text-accent-3-light",
  "accent-4": "text-accent-4 dark:text-accent-4-light",
};

/**
 * The tile of an app's icon without its glyph: a white rounded square with a
 * hairline and a soft neutral shadow, the same in every hue, so the page keeps
 * its calm and the colour sits in the glyph. <AppIcon> puts the glyph in it on
 * the server; the operator console puts it in once the glyph set has loaded
 * (app-icon-lazy.tsx), so neither imports the set where it does not have to.
 */
export default function AppIconTile({
  tone,
  size = "md",
  className,
  children,
}: {
  tone: Tone;
  size?: AppIconSize;
  className?: string;
  /** The glyph, sized by the tile (`h-3/5 w-3/5`, contained variant). */
  children?: React.ReactNode;
}) {
  const small = size === "xs" || size === "sm";
  return (
    <span
      aria-hidden
      className={cn(
        "border-grey-100 bg-background-paper inline-grid flex-none place-items-center border",
        GLYPH[tone],
        SIZE[size],
        className,
      )}
      style={{
        // A squircle's proportion at every size; a class radius would be a fixed length.
        borderRadius: "28%",
        boxShadow: small ? undefined : "0 6px 16px -8px hsl(var(--background-deep) / 0.28)",
      }}
    >
      {children}
    </span>
  );
}

/** The class that sizes a glyph inside a tile. */
export const GLYPH_CLASS = "h-3/5 w-3/5";
