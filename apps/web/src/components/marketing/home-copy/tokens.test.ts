import { homeCopy as en } from "./en";
import { homeCopyPtBR as ptBR } from "./pt-BR";
import { splitTokens } from "./tokens";
import { describe, expect, it } from "vitest";

const SEGMENTS = ["negocio", "agencia", "produto", "dev"];

describe("the hero subtitle's segments", () => {
  it("splits a line on its known tokens and keeps the words between them", () => {
    expect(splitTokens("Para o {negocio}, a {agencia} ou o {dev}.", SEGMENTS)).toEqual([
      { text: "Para o " },
      { token: "negocio" },
      { text: ", a " },
      { token: "agencia" },
      { text: " ou o " },
      { token: "dev" },
      { text: "." },
    ]);
  });

  it("leaves an unknown token as text", () => {
    expect(splitTokens("Para o {cliente}.", SEGMENTS)).toEqual([{ text: "Para o {cliente}" }, { text: "." }]);
  });

  it("names every segment once in both languages, with a word for each", () => {
    for (const copy of [ptBR, en]) {
      const tokens = splitTokens(copy.hero.subtitle, SEGMENTS).flatMap((part) => ("token" in part ? [part.token] : []));
      expect([...tokens].sort()).toEqual([...SEGMENTS].sort());
      for (const segment of SEGMENTS) {
        expect(copy.hero.segments[segment as keyof typeof copy.hero.segments].trim()).not.toBe("");
      }
    }
  });
});
