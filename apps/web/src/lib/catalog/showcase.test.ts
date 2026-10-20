// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { checkExample, EXAMPLE_LIMITS, exampleIn, readShowcase } from "@/lib/catalog/showcase";

const example = {
  request: "Quero gravar um vídeo de 10 minutos sobre marmita. Me ajuda com o roteiro?",
  reply: [
    { label: "Título", text: "Marmita da semana em 1 hora" },
    { label: "Gancho · 0:00", text: "Na quarta você já não aguenta a mesma comida." },
    { text: "Uma linha sem rótulo." },
  ],
  saved: "Salvo em roteiros/marmita/estrutura.md",
};

describe("the example of an app answering a request", () => {
  it("keeps an example as the product writes it", () => {
    expect(checkExample(example)).toEqual({ example, problems: [] });
    // The closing line is optional.
    const withoutSaved = { request: example.request, reply: example.reply };
    expect(checkExample(withoutSaved)).toEqual({ example: withoutSaved, problems: [] });
  });

  it("names every reason an example cannot be shown", () => {
    expect(checkExample({ reply: [] })).toEqual({
      problems: [`request: must be a text of 1 to ${EXAMPLE_LIMITS.request} characters`, "reply: 1 to 8 lines"],
    });
    expect(checkExample("texto")).toEqual({ problems: ["must be an object with request and reply"] });
    const tooMany = { ...example, reply: Array.from({ length: 9 }, () => ({ text: "Linha" })) };
    expect(checkExample(tooMany)).toEqual({ problems: ["reply: 1 to 8 lines"] });
  });

  it("holds every text to the copy rules", () => {
    const broken = {
      request: "Me ajuda com o roteiro!",
      reply: [{ label: "Gancho — 0:00", text: "Um app grátis para você" }],
      saved: "Salvo",
    };
    expect(checkExample(broken)).toEqual({
      problems: [
        "request: breaks the copy rules (exclamation mark)",
        "reply[0].label: breaks the copy rules (dash)",
        "reply[0].text: breaks the copy rules (free)",
      ],
    });
  });

  it("checks each language on its own", () => {
    const { showcase, problems } = readShowcase({ "pt-BR": example, en: { request: "Help", reply: "x" } });
    expect(showcase).toEqual({ "pt-BR": example });
    expect(problems).toEqual(["en.reply: 1 to 8 lines"]);
    expect(readShowcase(undefined)).toEqual({ showcase: {}, removed: [], problems: [] });
    expect(readShowcase({ en: null }).removed).toEqual(["en"]);
    expect(readShowcase([example]).problems).toEqual(['must be an object by language ("pt-BR", "en")']);
  });

  it("serves the example of the address's language and never another one", () => {
    expect(exampleIn({ "pt-BR": example }, "pt-BR")).toEqual(example);
    expect(exampleIn({ "pt-BR": example }, "en")).toBeNull();
    expect(exampleIn({}, "pt-BR")).toBeNull();
    expect(exampleIn(null, "pt-BR")).toBeNull();
  });
});

describe("the example migration 0043 moved from the home to its app", () => {
  it("passes the rules the import holds the product's examples to, in both languages", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
    const sql = fs.readFileSync(path.join(root, "packages/db/migrations/0043_module_showcase.sql"), "utf8");
    // The example sits between the two dollar-quote marks of the update.
    const json = sql.split("$json$")[1];
    expect(json).toBeTruthy();
    const { showcase, problems } = readShowcase(JSON.parse(json ?? "{}"));
    expect(problems).toEqual([]);
    expect(Object.keys(showcase)).toEqual(["pt-BR", "en"]);
  });
});
