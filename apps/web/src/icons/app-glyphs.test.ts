import { APP_GLYPH_SUGGESTIONS } from "./app-glyph-suggestions";
import { APP_GLYPH_FALLBACK, APP_GLYPHS, appGlyph, isAppGlyphName } from "./app-glyphs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => fs.readFileSync(path.join(HERE, file), "utf8");

/**
 * The names of `IconMap`, read from the registry's text: importing it would
 * load every Phosphor adapter, which takes minutes on a busy machine.
 */
function registryNames(): string[] {
  const source = read("icon-registry.tsx");
  const body = source.slice(
    source.indexOf("export const IconMap = {"),
    source.indexOf("};", source.indexOf("export const IconMap = {")),
  );
  return [...body.matchAll(/^\s+(Ni\w+)(?::|,)/gm)].map((match) => match[1]);
}

describe("the glyphs of the app tiles", () => {
  it("answer to the same names as the icon registry, so a name the console accepts always draws", () => {
    const names = registryNames();
    expect(names.length).toBeGreaterThan(400);
    expect(Object.keys(APP_GLYPHS).sort()).toEqual([...names].sort());
  });

  it("import every glyph of the original Nexture set, by its relative path", () => {
    const source = read("app-glyphs.tsx");
    const files = fs.readdirSync(path.join(HERE, "nexture")).filter((file) => file.endsWith(".tsx"));
    const missing = files.filter((file) => !source.includes(`"./nexture/${file.replace(/\.tsx$/, "")}"`));
    expect(missing).toEqual([]);
    // The alias would draw the interface's Phosphor icons instead.
    expect(source).not.toMatch(/from "@\/icons\/nexture\//);
  });

  it("fall back to the apps glyph for an empty or unknown name", () => {
    expect(appGlyph(null)).toBe(APP_GLYPHS[APP_GLYPH_FALLBACK]);
    expect(appGlyph("NiDoesNotExist")).toBe(APP_GLYPHS[APP_GLYPH_FALLBACK]);
    expect(appGlyph("NiScript")).toBe(APP_GLYPHS.NiScript);
    expect(isAppGlyphName("toString")).toBe(false);
  });

  it("offer only names that exist", () => {
    expect(APP_GLYPH_SUGGESTIONS.filter((name) => !isAppGlyphName(name))).toEqual([]);
    expect(new Set(APP_GLYPH_SUGGESTIONS).size).toBe(APP_GLYPH_SUGGESTIONS.length);
  });
});
