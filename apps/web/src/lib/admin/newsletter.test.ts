import { draftLanguages, draftPayload } from "./newsletter";
import { describe, expect, it } from "vitest";

describe("a draft written per language", () => {
  it("sends a language only when both its subject and its text are written", () => {
    expect(
      draftLanguages({ "pt-BR": "Abrimos", en: "We are open" }, { "pt-BR": "A loja abriu.", en: "It is open." }),
    ).toEqual({
      ready: ["pt-BR", "en"],
      incomplete: [],
    });
    expect(draftLanguages({ "pt-BR": "Abrimos" }, { "pt-BR": "A loja abriu." })).toEqual({
      ready: ["pt-BR"],
      incomplete: [],
    });
  });

  it("points out a half-written language instead of skipping it in silence", () => {
    expect(draftLanguages({ "pt-BR": "Abrimos", en: "We are open" }, { "pt-BR": "A loja abriu." })).toEqual({
      ready: ["pt-BR"],
      incomplete: ["en"],
    });
    expect(draftLanguages({}, { en: "Only a text" })).toEqual({ ready: [], incomplete: ["en"] });
  });

  it("treats blank space as nothing written", () => {
    expect(draftLanguages({ "pt-BR": "  ", en: "" }, { "pt-BR": "\n", en: " " })).toEqual({
      ready: [],
      incomplete: [],
    });
  });

  it("stores only the complete languages, trimmed", () => {
    expect(draftPayload({ "pt-BR": "  Abrimos ", en: "Half" }, { "pt-BR": "A loja abriu.\n", en: "   " })).toEqual({
      subject: { "pt-BR": "Abrimos" },
      body: { "pt-BR": "A loja abriu." },
    });
  });
});
