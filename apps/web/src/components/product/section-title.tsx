import type { ReactNode } from "react";

import { Box, Typography } from "@mui/material";

import InfoHint from "@/components/product/info-hint";

/**
 * The heading of a section of a page that is not a card (a row of tiles, a
 * table, a group of cards): its title, what it is behind the "i" beside it,
 * where it stands (a `StatusChip`) and its own action at the right. A page had
 * a heading and a paragraph under it for each section, read on every visit
 * (the owner, 2026-11-09).
 *
 * `variant` keeps the heading style the screen already uses for its sections
 * (the member home sets them in `subtitle1`, the catalog in `h5`), so a section
 * reads like its neighbours; a section inside a card takes the card's
 * sub-heading, `subtitle2`, with `as="h3"`.
 *
 * Closest catalog entry: `PageHeader`, the title block of a page, which puts
 * what the page is behind the same "i"; a section of a page sits under it.
 */
export default function SectionTitle({
  id,
  title,
  description,
  chip,
  action,
  as = "h2",
  variant = "h5",
}: {
  /** The heading's id: what the section is labelled by. */
  id: string;
  title: string;
  /** What the section is, behind the "i" beside the title. At most 200 characters (a test keeps it). */
  description?: string;
  /** Where the section stands, as a `StatusChip`. */
  chip?: ReactNode;
  /** The section's own action, at the right. */
  action?: ReactNode;
  as?: "h2" | "h3" | "h4";
  /** The heading style of the screen's other sections. */
  variant?: "h5" | "h6" | "subtitle1" | "subtitle2";
}) {
  return (
    <Box className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Typography id={id} variant={variant} component={as} className="mb-0">
        {title}
      </Typography>
      {description ? <InfoHint label={description} placement="bottom-start" className="self-center" /> : null}
      {chip ? <Box className="flex items-center">{chip}</Box> : null}
      {action ? <Box className="ml-auto flex items-center gap-2">{action}</Box> : null}
    </Box>
  );
}
