import { cn } from "@/lib/utils";

/**
 * The short label above a headline. The brand yellow rides on a bar and the
 * words keep a text colour: as text on a light ground the yellow measures
 * 1.5:1, against the 4.5:1 of WCAG AA (docs/DESIGN.md, palette usage). The
 * feature rows do the same with their family hue.
 */
export default function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-text-secondary flex items-center gap-2.5 text-sm font-semibold tracking-wide uppercase",
        className,
      )}
    >
      <span aria-hidden className="bg-primary h-1 w-6 flex-none rounded-full" />
      {children}
    </p>
  );
}
