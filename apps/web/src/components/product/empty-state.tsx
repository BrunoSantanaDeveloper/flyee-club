"use client";

import Link from "next/link";

import { Box, Button, Typography } from "@mui/material";

import StatusChip from "@/components/product/status-chip";
import { cn } from "@/lib/utils";

type Action = { label: string; href?: string; onClick?: () => void };

/**
 * An empty state is NEVER a blank screen. It answers three things at a
 * glance: what this area is, why it's empty, and the ONE next action that
 * fills it (the nudge). Use it for every zero-data view (product-screen
 * skill rule) — a bare "No data" is a UX failure. An area that has nothing
 * yet because its content is still being made carries a `badge` ("Em breve",
 * docs/PRODUCT.md, 2026-10-08): a state, so it is a StatusChip.
 */
export default function EmptyState({
  icon,
  title,
  badge,
  description,
  action,
  secondaryAction,
  className,
}: {
  /** Meaningful icon (the concept, in a soft tinted chip). */
  icon?: React.ReactNode;
  title: string;
  /** A named state above the title, e.g. "Em breve". */
  badge?: string;
  description?: string;
  /** The primary nudge — what the user should do to get value here. */
  action?: Action;
  secondaryAction?: Action;
  className?: string;
}) {
  const renderAction = (a: Action, variant: "contained" | "text") =>
    a.href ? (
      <Button variant={variant} color={variant === "text" ? "grey" : "primary"} href={a.href} LinkComponent={Link}>
        {a.label}
      </Button>
    ) : (
      <Button variant={variant} color={variant === "text" ? "grey" : "primary"} onClick={a.onClick}>
        {a.label}
      </Button>
    );

  return (
    <Box
      className={cn(
        "border-grey-100 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="bg-primary/20 text-primary-ink flex h-14 w-14 items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </span>
      )}
      {badge ? <StatusChip label={badge} tone="attention" className="mt-1" /> : null}
      <Typography variant="h5" component="h2" className="text-text-primary mt-1">
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" className="text-text-secondary max-w-md leading-6">
          {description}
        </Typography>
      )}
      {(action || secondaryAction) && (
        <Box className="mt-3 flex flex-col items-center gap-2 sm:flex-row">
          {action && renderAction(action, "contained")}
          {secondaryAction && renderAction(secondaryAction, "text")}
        </Box>
      )}
    </Box>
  );
}
