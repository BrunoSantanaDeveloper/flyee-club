"use client";

import { useEffect, useState } from "react";

import { Box, Button } from "@mui/material";

import NiCheck from "@/icons/nexture/ni-check";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import { cn } from "@/lib/utils";

/**
 * One terminal command with a copy button: how the member area tells someone
 * to run the CLI (`npx flyee login`, `npx flyee add <slug>`).
 *
 * Closest template section: the marketing `TerminalFrame` (the update moment
 * of docs/DESIGN.md), whose deep primary body and mono type it shares, so the
 * command already looks like the terminal it is pasted into. Nothing in the
 * product catalog showed a command: a `<code>` chip is too small to target on
 * a phone and gives no copy affordance.
 */
export default function CommandBlock({
  command,
  copyLabel,
  copiedLabel,
  className,
}: {
  command: string;
  /** "Copiar comando": the button's accessible name and visible label. */
  copyLabel: string;
  /** Announced (and shown) for two seconds after a successful copy. */
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // No clipboard permission: the command stays selectable on screen.
    }
  };

  return (
    <Box
      className={cn(
        "bg-background-deep flex w-full flex-row items-center gap-3 overflow-hidden rounded-2xl py-2 pr-2 pl-4",
        className,
      )}
    >
      {/* The global `code` rule draws an inline chip; the block undoes it.
          Focusable because a long command scrolls sideways on a phone, and a
          scrollable region must be reachable from the keyboard. */}
      <code
        tabIndex={0}
        className="text-text-contrast focus-visible:outline-primary-light min-w-0 flex-1 overflow-x-auto rounded-none border-0 bg-transparent p-0 font-mono text-sm leading-6 whitespace-nowrap select-all focus-visible:outline-2"
      >
        <span aria-hidden className="text-text-contrast/60 mr-2">
          $
        </span>
        {command}
      </code>
      <Button
        size="small"
        variant="contained"
        color="primary"
        onClick={() => void copy()}
        startIcon={copied ? <NiCheck size="small" /> : <NiDuplicate size="small" />}
        className="flex-none"
        aria-live="polite"
      >
        {copied ? copiedLabel : copyLabel}
      </Button>
    </Box>
  );
}
