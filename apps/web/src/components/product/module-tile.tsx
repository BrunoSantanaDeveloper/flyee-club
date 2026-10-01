import Link from "next/link";

import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

import { TRAIL_TONE } from "@/components/marketing/tone";
import CatalogIcon from "@/components/product/catalog-icon";
import { TILE_TONE } from "@/components/product/tile-tone";
import { cn } from "@/lib/utils";

/**
 * One tool of the catalog in the member's grid (`/modulos`): what it is, at a
 * glance, and whether this account can install it.
 *
 * Closest template section: `StatTile` (the 72px tinted box over a card body),
 * kept verbatim for the icon, so the catalog reads as the same family as the
 * home's tiles. Nothing in the catalog carried a title, a two-line summary and
 * a status line, which is what choosing a tool needs. The trail's hue comes
 * from `TRAIL_TONE`, the same mapping the public site uses.
 */
export default function ModuleTile({
  href,
  icon,
  trail,
  name,
  summary,
  trailLabel,
  meta,
  status,
}: {
  href: string;
  icon: string | null;
  /** The trail slug: decides the hue. */
  trail: string;
  name: string;
  summary: string | null;
  trailLabel: string;
  /** e.g. "v1.2.0 · Claude Code, Codex". */
  meta?: string;
  /** A free sample, or a tool outside the plan; nothing when it simply installs. */
  status?: { kind: "free" | "locked"; label: string } | null;
}) {
  const tone = TILE_TONE[TRAIL_TONE[trail] ?? "primary"];
  return (
    <Card
      component={Link}
      href={href}
      className="flex h-full w-full flex-col p-1 transition-transform hover:scale-[1.02]"
    >
      <Box
        aria-hidden
        className={cn("flex h-[4.5rem] w-full flex-none items-center justify-center rounded-2xl", tone.bg, tone.text)}
      >
        <CatalogIcon name={icon} />
      </Box>
      <CardContent className="flex w-full flex-1 flex-col gap-2">
        <Typography variant="subtitle2" component="h3" className="mb-0 leading-5">
          {name}
        </Typography>
        {summary ? (
          <Typography variant="body2" className="text-text-secondary line-clamp-2 leading-5">
            {summary}
          </Typography>
        ) : null}
        <Box className="mt-auto flex flex-row flex-wrap items-center gap-1.5 pt-1">
          <Chip size="small" variant="outlined" label={trailLabel} />
          {status ? (
            <Chip
              size="small"
              color={status.kind === "free" ? "success" : "default"}
              variant={status.kind === "free" ? "filled" : "outlined"}
              label={status.label}
            />
          ) : null}
          {meta ? (
            <Typography variant="body2" className="text-text-secondary text-xs leading-4">
              {meta}
            </Typography>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}
