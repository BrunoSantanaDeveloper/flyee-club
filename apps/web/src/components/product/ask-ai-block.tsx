"use client";

import { useEffect, useState } from "react";

import { Box, Button, Typography } from "@mui/material";

import NiCheck from "@/icons/nexture/ni-check";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import NiMessage from "@/icons/nexture/ni-message";
import { cn } from "@/lib/utils";

/**
 * The sentence a member gives their AI, with a copy button: how the member
 * area tells someone to install, add an app, update or reconnect. The member
 * never uses the terminal (docs/PRODUCT.md, decided 2026-10-08): the AI runs
 * every flyee command, and the member only confirms in the conversation and
 * approves the login in the browser. The command stays below the sentence as
 * a reference, for whoever wants to know what the AI will run.
 *
 * Closest template section: the terminal line with a copy button it replaced
 * (CommandBlock, removed in 12.6: `git show 6eebf3d:apps/web/src/components/product/command-block.tsx`),
 * on the primary tint instead of the deep terminal band. A terminal body
 * around words to say would send the member to a terminal, which is the one
 * thing this block exists to stop.
 */
export default function AskAiBlock({
  label,
  prompt,
  copyLabel,
  copiedLabel,
  referenceLabel,
  command,
  className,
}: {
  /** "Peça à sua IA": names whom the sentence is for. */
  label: string;
  /** The sentence itself, in the member's language. */
  prompt: string;
  /** "Copiar frase": the button's accessible name and visible label. */
  copyLabel: string;
  /** Announced (and shown) for two seconds after a successful copy. */
  copiedLabel: string;
  /** "Comando de referência:", shown before `command`. */
  referenceLabel?: string;
  /** What the AI runs for this sentence; a reference, never a task. */
  command?: string;
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
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // No clipboard permission: the sentence stays selectable on screen.
    }
  };

  return (
    <Box className={cn("flex w-full flex-col gap-2", className)}>
      <Box className="bg-primary/20 flex w-full flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <Box className="flex min-w-0 flex-1 flex-row items-start gap-3">
          <NiMessage size="medium" className="text-primary-ink mt-0.5 flex-none" aria-hidden />
          <Box className="flex min-w-0 flex-col gap-0.5">
            <Typography variant="body2" className="text-text-primary">
              {label}
            </Typography>
            <Typography
              variant="body1"
              component="p"
              className="text-text-primary font-semibold break-words select-all"
            >
              {prompt}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => void copy()}
          startIcon={copied ? <NiCheck size="small" /> : <NiDuplicate size="small" />}
          className="flex-none self-start sm:self-center"
          aria-live="polite"
        >
          {copied ? copiedLabel : copyLabel}
        </Button>
      </Box>
      {command && referenceLabel ? (
        <Typography variant="body2" className="text-text-secondary">
          {referenceLabel} <code>{command}</code>
        </Typography>
      ) : null}
    </Box>
  );
}
