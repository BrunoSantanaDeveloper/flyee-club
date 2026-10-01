import { BRAND } from "@/brand";
import { cn } from "@/lib/utils";

/**
 * The single logo component — admin header AND marketing header/footer render this;
 * never create a second logo implementation.
 *
 * PROVISIONAL flyee.club mark (decision 2026-09-30: placeholder logo, current
 * palette — docs/PRODUCT.md). Master art: packages/content/brand/logo.svg and
 * mark.svg. The mark is an open ring with a dot in its gap (continuous update),
 * deliberately free of letterforms so it cannot be mistaken for another brand.
 *
 * Every colour comes from a token, so the logo follows light/dark mode and a
 * future palette change in @flyee/design-tokens without touching this file.
 * Variants: full (mark + wordmark) and compact mobile mark, toggled via className.
 */

function Mark({ tone }: { tone: "default" | "contrast" }) {
  const tile = tone === "contrast" ? "hsl(var(--text-contrast))" : "hsl(var(--primary))";
  const ink = tone === "contrast" ? "hsl(var(--primary))" : "hsl(var(--text-contrast))";
  return (
    <>
      <rect width="512" height="512" rx="112" fill={tile} />
      <path d="M384 256A128 128 0 1 1 256 128" fill="none" stroke={ink} strokeWidth="48" strokeLinecap="round" />
      <circle cx="346.5" cy="165.5" r="34" fill={ink} />
    </>
  );
}

export default function Logo({
  classNameFull,
  classNameMobile,
  tone = "default",
}: {
  classNameFull?: string;
  classNameMobile?: string;
  /** "contrast": light tile and light wordmark for the deep/dark bands (footer). */
  tone?: "default" | "contrast";
}) {
  const word = tone === "contrast" ? "hsl(var(--text-contrast))" : "hsl(var(--text-primary))";
  const accent = tone === "contrast" ? "hsl(var(--text-contrast))" : "hsl(var(--primary))";
  return (
    <>
      <svg
        className={cn(classNameFull)}
        width="122"
        height="27"
        viewBox="0 0 216 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={BRAND.name}
      >
        <g transform="scale(0.09375)">
          <Mark tone={tone} />
        </g>
        <text
          x="58"
          y="35"
          fontSize="30"
          fontWeight="700"
          letterSpacing="-0.6"
          fill={word}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          flyee<tspan fill={accent}>.club</tspan>
        </text>
      </svg>

      <svg
        className={cn(classNameMobile)}
        width="27"
        height="27"
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={BRAND.name}
      >
        <Mark tone={tone} />
      </svg>
    </>
  );
}
