"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Box, Button, Typography } from "@mui/material";

import AskAiBlock from "@/components/product/ask-ai-block";
import NiCheck from "@/icons/nexture/ni-check";
import NiCloud from "@/icons/nexture/ni-cloud";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import NiExternal from "@/icons/nexture/ni-external";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiTerminal from "@/icons/nexture/ni-terminal";
import { cloudSessionUrl, installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import { cn } from "@/lib/utils";

export type InstallPath = "computer" | "terminal" | "cloud";
const PATHS: { value: InstallPath; icon: typeof NiLaptop; label: string; hint: string }[] = [
  { value: "computer", icon: NiLaptop, label: "install-path-computer", hint: "install-path-computer-hint" },
  { value: "terminal", icon: NiTerminal, label: "install-path-terminal", hint: "install-path-terminal-hint" },
  { value: "cloud", icon: NiCloud, label: "install-path-cloud", hint: "install-path-cloud-hint" },
];

/** The last answer, a per-viewer convenience: a private window or blocked storage only asks again. */
const STORAGE_KEY = "flyee:install-path";

/**
 * How a member installs flyee (the operator's review of 2026-10-20): first
 * WHERE their AI runs, on the computer in an app, in a terminal, or in a
 * Claude Code session in the cloud; then the three steps of that path only.
 * One question before the steps, because the cloud needs a one-time change on
 * Claude's screen the other two do not, and the steps of three paths shown at
 * once read as one confusing list. Nothing here sends anyone to a terminal:
 * "No terminal" names where the AI runs, and the AI runs every command
 * (docs/PRODUCT.md, 2026-10-08).
 *
 * Closest catalog entries: <AskAiBlock>, which the computer and terminal
 * paths keep as their second step, and the choice tiles of <StatTile>'s
 * filter mode, whose radius, border and tint the three options take.
 */
export default function InstallPathBlock({ locale, cloudHosts }: { locale: string; cloudHosts: string[] }) {
  const t = useTranslations("product");
  const [path, setPath] = useState<InstallPath | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "computer" || saved === "terminal" || saved === "cloud") setPath(saved);
    } catch {
      // No storage here: the member answers again.
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const choose = (value: InstallPath) => {
    setPath(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Remembering is a convenience only.
    }
  };

  const copyHost = async (host: string) => {
    try {
      await navigator.clipboard.writeText(host);
      setCopied(host);
    } catch {
      // No clipboard permission: the host stays selectable on screen.
    }
  };

  const sentence = (
    <AskAiBlock
      label={t("ask-ai-label")}
      prompt={t("ask-ai-install", { url: installGuideUrl(locale) })}
      copyLabel={t("ask-ai-copy")}
      copiedLabel={t("ask-ai-copied")}
      referenceLabel={t("ask-ai-reference")}
      command={REFERENCE_COMMAND.install}
    />
  );

  const steps: Record<InstallPath, React.ReactNode[]> = {
    computer: [
      <Typography key="1" variant="body2" className="text-text-primary">
        {t("install-computer-step-1")}
      </Typography>,
      <Box key="2" className="flex flex-col gap-2">
        <Typography variant="body2" className="text-text-primary">
          {t("install-step-paste")}
        </Typography>
        {sentence}
      </Box>,
      <Typography key="3" variant="body2" className="text-text-primary">
        {t("install-computer-step-3")}
      </Typography>,
    ],
    terminal: [
      <Typography key="1" variant="body2" className="text-text-primary">
        {t("install-terminal-step-1")}
      </Typography>,
      <Box key="2" className="flex flex-col gap-2">
        <Typography variant="body2" className="text-text-primary">
          {t("install-step-paste")}
        </Typography>
        {sentence}
      </Box>,
      <Typography key="3" variant="body2" className="text-text-primary">
        {t("install-terminal-step-3")}
      </Typography>,
    ],
    cloud: [
      <Box key="1" className="flex flex-col gap-2">
        <Typography variant="body2" className="text-text-primary">
          {t("cloud-step-allow")}
        </Typography>
        <Box className="flex flex-row flex-wrap gap-2">
          {cloudHosts.map((host) => (
            <Button
              key={host}
              size="small"
              variant="text"
              color="grey"
              onClick={() => void copyHost(host)}
              startIcon={copied === host ? <NiCheck size="small" /> : <NiDuplicate size="small" />}
              aria-label={copied === host ? t("cloud-copied") : t("cloud-copy", { host })}
              aria-live="polite"
              className="bg-grey-50 max-w-full justify-start rounded-lg text-left font-mono break-all normal-case"
            >
              {host}
            </Button>
          ))}
        </Box>
        <Typography variant="body2" className="text-text-primary">
          {t("cloud-step-allow-save")}
        </Typography>
      </Box>,
      <Box key="2" className="flex flex-col items-start gap-2">
        <Typography variant="body2" className="text-text-primary">
          {t("cloud-step-open")}
        </Typography>
        <Button
          size="small"
          variant="contained"
          color="primary"
          href={cloudSessionUrl(t("cloud-prompt", { url: installGuideUrl(locale) }))}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<NiExternal size="small" />}
        >
          {t("cloud-open")}
        </Button>
      </Box>,
      <Typography key="3" variant="body2" className="text-text-primary">
        {t("cloud-step-code")}
      </Typography>,
    ],
  };

  return (
    <Box className="flex w-full flex-col gap-4">
      <Box className="flex flex-col gap-2">
        <Typography variant="subtitle2" component="p" id="install-path-question" className="text-text-primary">
          {t("install-path-question")}
        </Typography>
        <Box
          role="radiogroup"
          aria-labelledby="install-path-question"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {PATHS.map(({ value, icon: Icon, label, hint }) => {
            const selected = path === value;
            return (
              <Box
                key={value}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(value)}
                className={cn(
                  "bg-background-paper flex cursor-pointer flex-row items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                  "focus-visible:outline-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected ? "border-primary-ink bg-primary/20" : "border-grey-100 hover:border-grey-300",
                )}
              >
                <Icon size="medium" className="text-primary-ink mt-0.5 flex-none" aria-hidden />
                <Box className="flex min-w-0 flex-col gap-0.5">
                  <Typography variant="subtitle2" component="span" className="text-text-primary">
                    {t(label)}
                  </Typography>
                  <Typography variant="body2" component="span" className="text-text-secondary">
                    {t(hint)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {path ? (
        <Box component="ol" aria-live="polite" className="m-0 flex list-decimal flex-col gap-4 pl-5">
          {steps[path].map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
