"use client";

import { useEffect, useState } from "react";

import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Typography } from "@mui/material";

import NiCheck from "@/icons/nexture/ni-check";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiCloud from "@/icons/nexture/ni-cloud";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import NiExternal from "@/icons/nexture/ni-external";

/**
 * The way into a Claude Code session in the cloud (the product's request of
 * 2026-10-20, item 1), collapsed under the <AskAiBlock> that installs flyee. A
 * session there reaches only the hosts its environment allows, and only the
 * person can change that list, once, on Claude's screen: the block names the
 * three clicks, gives the hosts to copy and opens claude.ai/code with the
 * request written (lib/install-links.ts, `cloudSessionUrl`: no environment is
 * chosen, decision D3). Nothing here sends anyone to a terminal.
 *
 * Closest template section: <AskAiBlock>, whose tint, radius and copy button
 * it keeps; collapsed, because most members install on their own computer.
 */
export default function CloudSessionBlock({
  title,
  summary,
  steps,
  hosts,
  copyLabel,
  copiedLabel,
  openLabel,
  openHint,
  openHref,
}: {
  /** "Claude Code na nuvem". */
  title: string;
  /** One sentence on why: the session's network and the change only the person makes. */
  summary: string;
  /** The three clicks on Claude's screen, the second followed by the hosts. */
  steps: [string, string, string];
  /** What the environment has to allow (lib/install-links.ts, `cloudAllowedHosts`). */
  hosts: string[];
  /** "Copiar {host}", with the host already in. */
  copyLabel: (host: string) => string;
  copiedLabel: string;
  openLabel: string;
  openHint: string;
  /** claude.ai/code with the request written. */
  openHref: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (host: string) => {
    try {
      await navigator.clipboard.writeText(host);
      setCopied(host);
    } catch {
      // No clipboard permission: the host stays selectable on screen.
    }
  };

  return (
    // The frame sits on a Box, as AskAiBlock does: the theme zeroes the Accordion's own padding (style/surfaces/accordion.css).
    <Box className="border-grey-100 bg-background-paper w-full rounded-2xl border px-4 py-3">
      <Accordion disableGutters className="bg-transparent">
        <AccordionSummary expandIcon={<NiChevronDownSmall size="small" className="text-text-secondary" />}>
          <Box className="flex min-w-0 flex-row items-start gap-3 pr-2">
            <NiCloud size="medium" className="text-primary-ink mt-0.5 flex-none" aria-hidden />
            <Box className="flex min-w-0 flex-col gap-0.5">
              <Typography variant="subtitle2" component="span" className="text-text-primary">
                {title}
              </Typography>
              <Typography variant="body2" component="span" className="text-text-secondary">
                {summary}
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails className="flex flex-col gap-4 pt-4 sm:pl-9">
          <Box component="ol" className="m-0 flex list-decimal flex-col gap-3 pl-5">
            <li>
              <Typography variant="body2" className="text-text-primary">
                {steps[0]}
              </Typography>
            </li>
            <li>
              <Typography variant="body2" className="text-text-primary">
                {steps[1]}
              </Typography>
              <Box className="mt-2 flex flex-row flex-wrap gap-2">
                {hosts.map((host) => (
                  <Button
                    key={host}
                    size="small"
                    variant="text"
                    color="grey"
                    onClick={() => void copy(host)}
                    startIcon={copied === host ? <NiCheck size="small" /> : <NiDuplicate size="small" />}
                    aria-label={copied === host ? copiedLabel : copyLabel(host)}
                    aria-live="polite"
                    className="bg-grey-50 max-w-full justify-start rounded-lg text-left font-mono break-all normal-case"
                  >
                    {host}
                  </Button>
                ))}
              </Box>
            </li>
            <li>
              <Typography variant="body2" className="text-text-primary">
                {steps[2]}
              </Typography>
            </li>
          </Box>
          <Box className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              size="small"
              variant="contained"
              color="primary"
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<NiExternal size="small" />}
              className="flex-none self-start"
            >
              {openLabel}
            </Button>
            <Typography variant="body2" className="text-text-secondary">
              {openHint}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
