"use client";

import { TextInput } from "./fields";

import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";

import AppIconLazy, { useAppGlyphs } from "@/components/marketing/app-icon-lazy";
import type { Tone } from "@/components/marketing/tone";
import { APP_GLYPH_SUGGESTIONS } from "@/icons/app-glyph-suggestions";
import { cn } from "@/lib/utils";

/**
 * The icon of an app, chosen by name, shown as the store shows it: the tile in
 * the hue of the app's category (else its stage) with the original Nexture
 * glyph (components/marketing/app-icon.tsx, decided 2026-10-17). The row
 * offers the glyphs that say what an app does, the five drawn for the store
 * first; any other name of the set can still be typed. The glyph set loads
 * after the dialog opens (app-icon-lazy.tsx).
 */
export default function AppIconField({
  value,
  onChange,
  tone,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The hue the store gives the app now: its category's, else its stage's. */
  tone: Tone;
}) {
  const glyphs = useAppGlyphs();
  const typed = value.trim();
  const unknown = glyphs !== null && typed !== "" && !glyphs.isKnown(typed);
  return (
    <Box className="flex flex-col gap-3">
      <Box className="flex flex-row items-end gap-4">
        <TextInput
          label="Ícone"
          value={value}
          onChange={onChange}
          placeholder="NiScript"
          help={
            unknown
              ? "Esse nome não existe no conjunto: a loja mostra o ícone padrão."
              : "Nome do conjunto Ni. Vazio usa o ícone padrão das apps. A loja desenha o ícone assim:"
          }
        />
        <Box className="mb-6">
          <AppIconLazy name={typed} tone={tone} size="lg" />
        </Box>
      </Box>
      <Box className="flex flex-col gap-2">
        <Typography variant="caption" color="text.secondary" component="p" className="m-0">
          Sugestões para apps
        </Typography>
        <Box role="group" aria-label="Sugestões de ícone" className="flex flex-row flex-wrap gap-2">
          {APP_GLYPH_SUGGESTIONS.map((name) => {
            const chosen = typed === name;
            return (
              <Tooltip key={name} title={name}>
                <ButtonBase
                  aria-label={name}
                  aria-pressed={chosen}
                  onClick={() => onChange(name)}
                  className={cn("rounded-xl p-0.5", chosen && "ring-primary-ink ring-2")}
                >
                  <AppIconLazy name={name} tone={tone} size="sm" />
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
