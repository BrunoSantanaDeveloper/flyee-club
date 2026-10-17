import { lineEnds, replyLength, replyText, revealLines } from "./app-showcase-text";
import { describe, expect, it } from "vitest";

const lines = [
  { label: "Título", text: "Marmita" },
  { label: "Gancho · 0:00", text: "Na quarta." },
  { text: "Sem rótulo" },
];

describe("the typed reply of a showcase", () => {
  it("counts every character, labels included", () => {
    expect(replyLength(lines)).toBe(6 + 7 + 13 + 10 + 10);
    expect([...lineEnds(lines)]).toEqual([13, 36, 46]);
  });

  it("shows nothing before the first character, with the caret on the first line", () => {
    const revealed = revealLines(lines, 0);
    expect(revealed.map((line) => line.labelShown + line.textShown)).toEqual(["", "", ""]);
    expect(revealed.map((line) => line.current)).toEqual([true, false, false]);
  });

  it("types the label before the text, line after line", () => {
    const revealed = revealLines(lines, 16);
    expect(revealed[0]).toMatchObject({ labelShown: "Título", textShown: "Marmita", current: false });
    expect(revealed[1]).toMatchObject({ labelShown: "Gan", textShown: "", current: true });
    expect(revealed[2]).toMatchObject({ labelShown: "", textShown: "", current: false });
  });

  it("keeps the caret at the end of a finished line until the next one starts", () => {
    expect(revealLines(lines, 13).map((line) => line.current)).toEqual([true, false, false]);
  });

  it("shows the whole reply at its length or beyond", () => {
    const full = revealLines(lines, 999);
    expect(full.every((line) => line.labelShown === line.label && line.textShown === line.text)).toBe(true);
    expect(full.map((line) => line.current)).toEqual([false, false, true]);
  });

  it("reads as one sentence per line for assistive technology", () => {
    expect(replyText(lines)).toBe("Título: Marmita Gancho · 0:00: Na quarta. Sem rótulo");
  });
});
