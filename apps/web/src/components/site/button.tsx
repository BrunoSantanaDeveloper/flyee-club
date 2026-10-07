import type { ComponentProps, ReactNode } from "react";

import LocaleLink from "@/components/marketing/locale-link";
import { cn } from "@/lib/utils";

export type SiteButtonVariant = "contained" | "pastel" | "text" | "outlined";
/** The colour of a text or outlined button; contained and pastel are always the primary. */
export type SiteButtonTone = "primary" | "text-primary" | "grey" | "inherit";
export type SiteButtonSize = "small" | "medium" | "large";

const SIZE: Record<SiteButtonSize, string> = { small: "site-btn-sm", medium: "site-btn-md", large: "site-btn-lg" };

type Look = {
  variant?: SiteButtonVariant;
  tone?: SiteButtonTone;
  size?: SiteButtonSize;
  fullWidth?: boolean;
  /** An icon before the label; decorative, the label names the action. */
  startIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

type LinkProps = Look & {
  href: string;
  /**
   * A plain `<a>`: an address outside the site, an anchor of the page, or a
   * link whose click handler does the navigating. Without it the link is a
   * LocaleLink, which writes the address of the language being read.
   */
  plain?: boolean;
} & Omit<ComponentProps<"a">, keyof Look | "href">;

type ButtonProps = Look & { href?: undefined; plain?: undefined } & Omit<ComponentProps<"button">, keyof Look>;

/**
 * The button of the public site and of the chrome it shares with the member
 * area. An ordinary `<a>` or `<button>` styled by style/site/site.css: the
 * look is the one MUI's Button had here (same sizes, radii, colours and focus
 * ring, measured against it), without MUI or its styling engine behind it.
 *
 * It holds no state, so a server component renders it as plain HTML; the only
 * client code under it is the LocaleLink of an internal address.
 */
export default function SiteButton({
  variant = "text",
  tone = "primary",
  size = "medium",
  fullWidth,
  startIcon,
  className,
  children,
  ...rest
}: LinkProps | ButtonProps) {
  const classes = cn(
    "site-btn",
    `site-btn-${variant}`,
    SIZE[size],
    (variant === "text" || variant === "outlined") && `site-btn-tone-${tone}`,
    fullWidth && "site-btn-full",
    className,
  );
  const content = (
    <>
      {startIcon ? <span className="site-btn-start">{startIcon}</span> : null}
      {children}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, plain, ...anchor } = rest as Omit<LinkProps, keyof Look>;
    return plain ? (
      <a href={href} className={classes} {...anchor}>
        {content}
      </a>
    ) : (
      <LocaleLink href={href} className={classes} {...anchor}>
        {content}
      </LocaleLink>
    );
  }

  const { type = "button", ...button } = rest as Omit<ComponentProps<"button">, keyof Look>;
  return (
    <button type={type} className={classes} {...button}>
      {content}
    </button>
  );
}

/** A button that is only an icon. `aria-label` is required: nothing else names it. */
export function SiteIconButton({
  size = "medium",
  className,
  children,
  type = "button",
  ...button
}: { size?: "small" | "medium"; "aria-label": string } & Omit<ComponentProps<"button">, "aria-label">) {
  return (
    <button
      type={type}
      className={cn("site-icon-btn", size === "small" ? "site-icon-btn-sm" : "site-icon-btn-md", className)}
      {...button}
    >
      {children}
    </button>
  );
}
