import { TONE, type Tone } from "@/components/marketing/tone";
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
 * The gradient of a tile. Every stop keeps a white glyph at 3:1 or more (the
 * WCAG floor for an icon). The accents keep their values in both modes and run
 * from their main step to the dark one. The gold changes with the mode (it is
 * a lighter foreground on the dark page, where white on it measures 2:1), so on
 * a light page it runs from its light step to the main one and on a dark page
 * it stays on its dark step, which is the light page's main (5.6:1). The
 * yellow is the one fill that takes the charcoal glyph.
 */
const FILL: Record<Tone, string> = {
  primary: "from-primary-light to-primary",
  secondary: "from-secondary-light to-secondary dark:from-secondary-dark dark:to-secondary-dark/80",
  "accent-1": "from-accent-1 to-accent-1-dark",
  "accent-2": "from-accent-2 to-accent-2-dark",
  "accent-3": "from-accent-3 to-accent-3-dark",
  "accent-4": "from-accent-4 to-accent-4-dark",
};

/**
 * The tile of an app's icon without its glyph: the shape, the fill in the
 * app's hue and the glyph's colour. <AppIcon> puts the glyph in it on the
 * server; the operator console puts it in once the glyph set has loaded
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
  /** The glyph, sized by the tile (`h-3/5 w-3/5`). */
  children?: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid flex-none place-items-center bg-linear-150",
        FILL[tone],
        tone === "primary" ? "text-primary-contrast" : "text-text-contrast",
        SIZE[size],
        className,
      )}
      style={{
        // A squircle's proportion at every size; a class radius would be a fixed length.
        borderRadius: "28%",
        boxShadow: `inset 0 1px 0 hsl(var(--text-contrast) / 0.22), 0 10px 22px -12px hsl(var(${TONE[tone].cssVar}) / 0.7)`,
      }}
    >
      {children}
    </span>
  );
}

/** The class that sizes a glyph inside a tile. */
export const GLYPH_CLASS = "h-3/5 w-3/5";
