"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from "@mui/material";

import AskAiBlock from "@/components/product/ask-ai-block";
import CloudSessionBlock from "@/components/product/cloud-session-block";
import SetupWizard from "@/components/product/setup-wizard";
import { DEFAULTS } from "@/config";
import { setClientLocale } from "@/i18n/locale";
import { cloudAllowedHosts, cloudSessionUrl, installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import { updateProfile } from "@/lib/member/actions";
import { AI_TOOL_OPTIONS, aiToolName, SEGMENT_OPTIONS } from "@/lib/member/labels";

type Answers = { segment: string; aiTool: string; locale: "pt-BR" | "en" };

/**
 * Who: someone who just created an account. Job: get from "account created"
 * to "my AI is installing flyee on my machine". Success: the sentence that has
 * their AI install it, copied (never a command to type, docs/PRODUCT.md,
 * 2026-10-08), with the club already knowing what they build and which AI
 * they use (the catalog and the lessons follow those two answers).
 *
 * One decision per screen. Each step saves its own answer when the member
 * moves on, so leaving halfway loses nothing and the wizard reopens on the
 * first unanswered step.
 */
export default function OnboardingWizard({
  firstName,
  initial,
  hasAccess,
}: {
  firstName: string;
  initial: Answers;
  hasAccess: boolean;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [error, setError] = useState(false);

  const save = async (update: Parameters<typeof updateProfile>[0]) => {
    setError(false);
    const result = await updateProfile(update);
    if (!result.ok) setError(true);
    return result.ok;
  };

  const failure = error ? (
    <Alert severity="error" className="neutral bg-background-paper/60! mt-3">
      {t("onboarding-save-error")}
    </Alert>
  ) : null;

  return (
    <Box className="flex flex-col gap-6">
      <Box className="flex flex-col gap-1">
        <Typography variant="h1" component="h1" className="mb-0">
          {firstName ? t("onboarding-title", { name: firstName }) : t("onboarding-title-generic")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          {t("onboarding-subtitle")}
        </Typography>
      </Box>

      <SetupWizard
        initialIndex={initial.segment ? (initial.aiTool ? 2 : 1) : 0}
        completeLabel={t("onboarding-finish")}
        onComplete={() => router.push(DEFAULTS.appRoot)}
        steps={[
          {
            title: t("onboarding-segment-title"),
            hint: t("onboarding-segment-hint"),
            canAdvance: Boolean(answers.segment),
            onPrimary: () => save({ segment: answers.segment as (typeof SEGMENT_OPTIONS)[number]["value"] }),
            content: (
              <>
                <FormControl>
                  <FormLabel id="onboarding-segment" className="sr-only">
                    {t("onboarding-segment-title")}
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="onboarding-segment"
                    value={answers.segment}
                    onChange={(event) => setAnswers({ ...answers, segment: event.target.value })}
                  >
                    {SEGMENT_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        label={t(option.label)}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
                {failure}
              </>
            ),
          },
          {
            title: t("onboarding-ai-title"),
            hint: t("onboarding-ai-hint"),
            canAdvance: Boolean(answers.aiTool),
            onPrimary: async () => {
              const saved = await save({ aiTool: answers.aiTool as (typeof AI_TOOL_OPTIONS)[number] });
              if (saved && answers.locale !== initial.locale) {
                // The switch writes the cookie and the profile; the page comes back in the new language, on the last step.
                await setClientLocale(answers.locale);
                window.location.reload();
                return false;
              }
              return saved;
            },
            content: (
              <>
                <FormControl>
                  <FormLabel id="onboarding-ai" className="sr-only">
                    {t("onboarding-ai-title")}
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby="onboarding-ai"
                    value={answers.aiTool}
                    onChange={(event) => setAnswers({ ...answers, aiTool: event.target.value })}
                  >
                    {AI_TOOL_OPTIONS.map((tool) => (
                      <FormControlLabel
                        key={tool}
                        value={tool}
                        control={<Radio />}
                        label={aiToolName(tool, t("ai-tool-other"))}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormControl className="mt-4 max-w-xs" fullWidth>
                  <FormLabel id="onboarding-locale" component="label">
                    {t("settings-member-locale")}
                  </FormLabel>
                  <Select
                    labelId="onboarding-locale"
                    value={answers.locale}
                    onChange={(event) => setAnswers({ ...answers, locale: event.target.value as Answers["locale"] })}
                  >
                    <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </Select>
                </FormControl>
                {failure}
              </>
            ),
          },
          {
            title: t("onboarding-install-title"),
            hint: t("onboarding-install-hint"),
            content: (
              <Box className="flex flex-col gap-3">
                <AskAiBlock
                  label={t("ask-ai-label")}
                  prompt={t("ask-ai-install", { url: installGuideUrl(answers.locale) })}
                  copyLabel={t("ask-ai-copy")}
                  copiedLabel={t("ask-ai-copied")}
                  referenceLabel={t("ask-ai-reference")}
                  command={REFERENCE_COMMAND.install}
                />
                <CloudSessionBlock
                  title={t("cloud-title")}
                  summary={t("cloud-summary")}
                  steps={[t("cloud-step-1"), t("cloud-step-2"), t("cloud-step-3")]}
                  hosts={cloudAllowedHosts()}
                  copyLabel={(host) => t("cloud-copy", { host })}
                  copiedLabel={t("cloud-copied")}
                  openLabel={t("cloud-open")}
                  openHint={t("cloud-open-hint")}
                  openHref={cloudSessionUrl(t("cloud-prompt", { url: installGuideUrl(answers.locale) }))}
                />
                <Typography variant="body2" className="text-text-secondary">
                  {hasAccess ? t("onboarding-install-note-access") : t("onboarding-install-note-free")}
                </Typography>
              </Box>
            ),
          },
        ]}
      />
    </Box>
  );
}
