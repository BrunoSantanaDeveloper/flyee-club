import { cn } from "@/lib/utils";

export type TerminalLine = {
  text: string;
  /** command: the typed line, after a prompt · success: a passed check · muted: secondary output. */
  kind?: "command" | "output" | "success" | "muted";
};

const LINE: Record<NonNullable<TerminalLine["kind"]>, string> = {
  command: "text-text-contrast",
  output: "text-text-contrast/85",
  success: "text-accent-2-light",
  muted: "text-text-contrast/60",
};

/**
 * The signature element of docs/DESIGN.md, "the update moment": a terminal
 * window showing `npx flyee update`, a version moving forward and one
 * changelog line. Same chrome as <ProductFrame> (radius, border, shadow,
 * optional primary glow) so the two read as one family, with a deep body
 * where commands, versions and file names are set in mono.
 *
 * Lines are REAL localized content (i18n strings), read as text by screen
 * readers; module names are fictitious but plausible until the catalog has
 * published modules.
 */
export default function TerminalFrame({
  lines,
  title,
  label,
  glow = false,
  className,
}: {
  lines: TerminalLine[];
  /** Window title in the chrome bar (e.g. "~/meu-projeto"). */
  title?: string;
  /** What the terminal shows, for assistive technology (figcaption). */
  label: string;
  glow?: boolean;
  className?: string;
}) {
  const frame = (
    <figure
      className={cn(
        "border-grey-100 bg-background-paper shadow-darker-xs m-0 w-full overflow-hidden rounded-3xl border",
        !glow && className,
      )}
    >
      <figcaption className="sr-only">{label}</figcaption>
      <div className="border-grey-100 bg-grey-25 flex h-9 flex-none items-center gap-1.5 border-b px-4">
        <span aria-hidden className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        <span aria-hidden className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        <span aria-hidden className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        {title && <span className="text-text-secondary mx-auto truncate font-mono text-xs">{title}</span>}
      </div>
      {/* The global `code, pre` rule (style/data-display/typography.css) draws
          an inline-code chip; the terminal body undoes it on both elements. */}
      <pre className="bg-primary-dark m-0 overflow-x-auto rounded-none border-0 px-5 py-5 font-mono text-sm leading-7 sm:px-6 sm:py-6">
        <code className="flex flex-col rounded-none border-0 bg-transparent p-0">
          {lines.map((line, index) => {
            const kind = line.kind ?? "output";
            return (
              <span key={index} className={cn("whitespace-pre-wrap", LINE[kind])}>
                {kind === "command" && (
                  <span aria-hidden className="text-secondary-light mr-2 select-none">
                    $
                  </span>
                )}
                {line.text}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );

  if (!glow) return frame;

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-10 -bottom-16"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 45%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      <div className="relative">{frame}</div>
    </div>
  );
}
