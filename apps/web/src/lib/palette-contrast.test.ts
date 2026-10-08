// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { DEFAULTS } from "@/config";
import { common, type ThemeName, themes } from "@flyee/design-tokens";

/**
 * "Contraste" (docs/PRODUCT.md, decided 2026-10-08): the home brief asks for
 * WCAG 2.2 AA, and the palette is the yellow of the logo, which measures 1.5:1
 * on a light ground. So the yellow is a FILL: a label on it is
 * `--primary-contrast`, and where the primary has to be a foreground on the
 * page (text, links, icons, focus rings) it is `--primary-ink`, the charcoal
 * in light mode and the yellow in dark mode. On the deep band, dark in both
 * modes, the yellow itself is the foreground.
 *
 * The first half holds the palette to that; the second keeps the code from
 * drifting back to the yellow as a foreground.
 */

// The scan reads every source file: on a busy machine that outlasts the default limit.
vi.setConfig({ testTimeout: 60_000 });

const AA_TEXT = 4.5;

function rgb(triplet: string): [number, number, number] {
  const [h, s, l] = triplet.replace(/%/g, "").trim().split(/\s+/).map(Number);
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [channel(0), channel(8), channel(4)];
}

function luminance(triplet: string): number {
  const [r, g, b] = rgb(triplet).map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const palette = themes[DEFAULTS.themeColor.slice("theme-".length) as ThemeName];

describe("the palette in force passes WCAG AA where it is used", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = palette[mode] as Record<string, string>;
    const ground = common[mode] as Record<string, string>;

    it(`${mode}: the label on a primary fill reads on every step of the primary`, () => {
      for (const fill of ["primary", "primary-light", "primary-dark"]) {
        expect(contrast(theme["primary-contrast"], theme[fill]), fill).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it(`${mode}: the ink reads as text on the page and on paper`, () => {
      for (const surface of ["background", "background-paper"]) {
        expect(contrast(theme["primary-ink"], ground[surface]), surface).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it(`${mode}: the primary itself reads on the deep band`, () => {
      expect(contrast(theme["primary"], ground["background-deep"])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${mode}: the secondary reads as text on the page`, () => {
      for (const surface of ["background", "background-paper"]) {
        expect(contrast(theme["secondary"], ground[surface]), surface).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  it("a white label reads on the secondary fills the app paints (light: main, dark: the dark step)", () => {
    expect(contrast(common.light["text-contrast"], palette.light["secondary"])).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(common.dark["text-contrast"], palette.dark["secondary-dark"])).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where the yellow IS the foreground, on purpose: the deep band, the charcoal
 * disc of a chip's delete icon and the controls over a video, all dark in both
 * modes.
 */
const ON_A_DARK_GROUND = new Set([
  "components/marketing/cta.tsx",
  "components/marketing/comparison.tsx",
  "components/marketing/index-grid.tsx",
  "components/marketing/ruled-grid.tsx",
  "components/marketing/terminal-frame.tsx",
  "style/data-display/chip.css",
  "style/plugins/video-player-vidstack.css",
]);

function* sources(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "icons") yield* sources(full);
    } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

const relative = (file: string) => path.relative(SRC, file).replaceAll("\\", "/");
const START = "(^|[^A-Za-z0-9_-])";
const END = "(?![A-Za-z0-9_-])";
/** The primary hue as a foreground utility (not `text-text-primary`, the text colour, nor the ink). */
const FOREGROUND = new RegExp(`${START}((?:text|ring|outline|decoration|fill|stroke)-primary(?:-dark)?)${END}`, "g");
const SOLID_FILL = new RegExp(`${START}bg-primary(-light|-dark)?${END}(?!/)`);
const WHITE_LABEL = new RegExp(`${START}(text-text-contrast|text-white)${END}`);

describe("the yellow is a fill, never a foreground on a light ground", () => {
  it("is written as the ink wherever the primary is text, a link, an icon or a focus ring", () => {
    const found: string[] = [];
    for (const file of sources(SRC)) {
      const name = relative(file);
      if (ON_A_DARK_GROUND.has(name)) continue;
      const code = /\.tsx?$/.test(file);
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          // Comments quote the classes they explain.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          for (const match of line.matchAll(FOREGROUND)) {
            const at = (match.index ?? 0) + match[1].length;
            const before = line.slice(0, at);
            const after = line[at + match[2].length] ?? "";
            // "text-primary" alone in quotes is MUI's name for the TEXT colour
            // (color="text-primary"), unless it is a className.
            const quoted = /["'`]$/.test(before) && /["'`]/.test(after);
            if (code && quoted && !/className=\{?["'`]$/.test(before)) continue;
            found.push(`${name}:${index + 1} ${match[2]}`);
          }
        });
    }
    // Use text-primary-ink (ring-, outline-): the charcoal in light mode, the yellow in dark.
    expect(found).toEqual([]);
  });

  it("never puts a white label on a primary fill", () => {
    const found = [...sources(SRC)].flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line, index) =>
          SOLID_FILL.test(line) && WHITE_LABEL.test(line) ? `${relative(file)}:${index + 1}` : null,
        )
        .filter((hit): hit is string => hit !== null),
    );
    // Use text-primary-contrast: white on the yellow measures 1.5:1.
    expect(found).toEqual([]);
  });
});
