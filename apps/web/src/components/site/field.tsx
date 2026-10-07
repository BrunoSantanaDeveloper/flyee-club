import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The form pieces of the public site: ordinary `<label>`, `<input>`,
 * `<textarea>`, `<select>` and checkbox, styled by style/site/site.css to the
 * look the MUI "outlined" fields had here (measured against them). The select
 * opens the browser's own list, which is also what a phone handles best.
 */

/** One field: its label, its control and its message, stacked. */
export function SiteField({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("site-field", className)} {...props} />;
}

export function SiteLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("site-label", className)} {...props} />;
}

/** The line under a control: an error when `error`, a hint otherwise. */
export function SiteHelp({ error, className, ...props }: { error?: boolean } & ComponentProps<"p">) {
  return <p className={cn("site-help", error && "site-help-error", className)} {...props} />;
}

type Frame = {
  /** `medium` is the taller, rounder control of a search box; forms use `small`. */
  fieldSize?: "small" | "medium";
  error?: boolean;
  /** Shown inside the control, before the text (a search icon). */
  startAdornment?: ReactNode;
  /** Classes of the bordered frame; the control's own go in `className`. */
  frameClassName?: string;
};

const frame = ({ fieldSize = "small", error, frameClassName }: Frame) =>
  cn("site-input", fieldSize === "medium" && "site-input-md", error && "site-input-error", frameClassName);

export function SiteInput({
  fieldSize,
  error,
  startAdornment,
  frameClassName,
  className,
  ...input
}: Frame & ComponentProps<"input">) {
  return (
    <div className={frame({ fieldSize, error, frameClassName })}>
      {startAdornment}
      <input aria-invalid={error || undefined} className={cn(startAdornment ? "pl-2" : null, className)} {...input} />
    </div>
  );
}

/** A text area that starts at `rows` lines and grows with what is typed, where the browser can. */
export function SiteTextarea({
  fieldSize,
  error,
  frameClassName,
  className,
  rows = 3,
  style,
  ...textarea
}: Omit<Frame, "startAdornment"> & ComponentProps<"textarea">) {
  return (
    <div className={frame({ fieldSize, error, frameClassName })}>
      <textarea
        rows={rows}
        aria-invalid={error || undefined}
        className={className}
        // 20px a line plus the control's own 2px above and below.
        style={{ minHeight: rows * 20 + 4, ...style }}
        {...textarea}
      />
    </div>
  );
}

export function SiteSelect({
  fieldSize,
  error,
  frameClassName,
  className,
  children,
  ...select
}: Omit<Frame, "startAdornment"> & ComponentProps<"select">) {
  return (
    <div className={frame({ fieldSize, error, frameClassName })}>
      <select aria-invalid={error || undefined} className={className} {...select}>
        {children}
      </select>
      <svg className="site-input-chevron" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </div>
  );
}

/** A checkbox and its label, the whole line clickable. */
export function SiteCheckbox({
  label,
  className,
  inputClassName,
  ...input
}: { label: ReactNode; inputClassName?: string } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("site-check", className)}>
      <input type="checkbox" className={cn("site-check-input", inputClassName)} {...input} />
      {label}
    </label>
  );
}
