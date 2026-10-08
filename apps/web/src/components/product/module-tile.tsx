import Link from "next/link";

import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

import { TRAIL_TONE } from "@/components/marketing/tone";
import CatalogIcon from "@/components/product/catalog-icon";
import StatusChip, { type StatusTone } from "@/components/product/status-chip";
import { TILE_TONE } from "@/components/product/tile-tone";
import { cn } from "@/lib/utils";

/**
 * How each state of a tile reads: a named badge whose word stays in the text
 * colour (a white label on the success fill measured 2.1:1).
 */
const STATUS_TONE: Record<"entry" | "locked" | "soon", StatusTone> = {
  entry: "positive",
  locked: "neutral",
  soon: "attention",
};

/**
 * One tool of the catalog in the member's grid (`/modulos`): what it is, at a
 * glance, and whether this account can install it.
 *
 * Closest template section: `StatTile` (the 72px tinted box over a card body),
 * kept verbatim for the icon, so the catalog reads as the same family as the
 * home's tiles. Nothing in the catalog carried a title, a two-line summary and
 * a status line, which is what choosing a tool needs. The trail's hue comes
 * from `TRAIL_TONE`, the same mapping the public site uses. An app the
 * roadmap has planned is a tile too, marked "Em breve" (a state, so a
 * StatusChip) and linked to its idea (docs/PRODUCT.md, 2026-10-08).
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
  trail: string | null;
  name: string;
  summary: string | null;
  /** The trail's name; a planned app may have none yet. */
  trailLabel?: string;
  /** e.g. "v1.2.0 · Claude Code, Codex". */
  meta?: string;
  /**
   * The entry version an account with no purchase installs (migration 0040), a
   * tool outside the plan, or an app still on the roadmap; nothing when it
   * simply installs.
   */
  status?: { kind: "entry" | "locked" | "soon"; label: string } | null;
}) {
  const tone = TILE_TONE[(trail ? TRAIL_TONE[trail] : undefined) ?? "primary"];
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
          {trailLabel ? <Chip size="small" variant="outlined" label={trailLabel} /> : null}
          {status ? <StatusChip label={status.label} tone={STATUS_TONE[status.kind]} /> : null}
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
