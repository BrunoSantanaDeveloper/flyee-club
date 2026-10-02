import { type CatalogRows, readableCatalog } from "./public";
import { describe, expect, it, vi } from "vitest";

// The module reads with the anonymous client on the server; the filter under test is pure.
vi.mock("server-only", () => ({}));

/** What the shared reader returns, with texts already collapsed (only what the filter reads). */
const catalog = {
  locale: "en",
  channel: "latest",
  trails: [],
  modules: [{ slug: "deploy-check" }, { slug: "product-scope" }],
  recipes: [
    { slug: "launch", modules: ["deploy-check", "product-scope"] },
    { slug: "pt-only", modules: ["product-scope"] },
  ],
} as never;

const rows: CatalogRows = {
  modules: [
    { id: "m1", slug: "deploy-check", name: { "pt-BR": "Checagem de deploy", en: "Deploy check" } },
    { id: "m2", slug: "product-scope", name: { "pt-BR": "Escopo do produto" } },
  ],
  versions: [
    { module_id: "m1", published_at: "2026-09-14T10:00:00Z" },
    { module_id: "m1", published_at: "2026-09-28T10:00:00Z" },
    { module_id: "m2", published_at: "2026-09-30T10:00:00Z" },
  ],
  recipes: [
    { slug: "launch", name: { "pt-BR": "Lançamento", en: "Launch" } },
    { slug: "pt-only", name: { "pt-BR": "Só em português" } },
  ],
};

describe("readableCatalog: an address in a language serves that language", () => {
  it("keeps in English only what has an English name, and counts only that", () => {
    const en = readableCatalog(catalog, rows, "en");
    expect(en.modules.map((module) => module.slug)).toEqual(["deploy-check"]);
    expect(en.recipes.map((recipe) => recipe.slug)).toEqual(["launch"]);
    // A recipe never lists a module the page cannot show.
    expect(en.recipes[0].modules).toEqual(["deploy-check"]);
    expect(en.stats).toEqual({ modules: 1, versions: 2, lastReleaseAt: "2026-09-28T10:00:00Z" });
  });

  it("reads everything in Portuguese, the language every name is written in", () => {
    const pt = readableCatalog(catalog, rows, "pt-BR");
    expect(pt.modules.map((module) => module.slug)).toEqual(["deploy-check", "product-scope"]);
    expect(pt.recipes.map((recipe) => recipe.slug)).toEqual(["launch", "pt-only"]);
    expect(pt.stats).toEqual({ modules: 2, versions: 3, lastReleaseAt: "2026-09-30T10:00:00Z" });
  });

  it("treats a blank English name as no English name", () => {
    const blank = readableCatalog(
      catalog,
      { ...rows, modules: [{ id: "m1", slug: "deploy-check", name: { "pt-BR": "Checagem", en: "  " } }] },
      "en",
    );
    expect(blank.modules).toEqual([]);
    expect(blank.stats).toEqual({ modules: 0, versions: 0, lastReleaseAt: null });
  });
});
