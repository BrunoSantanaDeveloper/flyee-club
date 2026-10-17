import { describe, expect, it } from "vitest";

import { storeLook } from "@/lib/catalog/store-look";

const catalog = {
  trails: [
    { slug: "construir", name: "Construir" },
    { slug: "divulgar", name: "Divulgar" },
  ],
  storeCategories: [
    { slug: "sell", name: "Vender" },
    { slug: "video", name: "Vídeo" },
    { slug: "research", name: "Pesquisa" },
  ],
};

const videoApp = { slug: "video-cut", trail: "divulgar", storeCategory: "video" };
const starter = { slug: "saas-starter", trail: "construir", storeCategory: null };
const copy = { slug: "copy-lp", trail: "divulgar", storeCategory: "sell" };

describe("storeLook: two layers, the store shows the category", () => {
  it("names a card by its store category, and by its stage when it has none", () => {
    const { lookOf } = storeLook(catalog);
    // Vídeo takes the brand's hue since 2026-10-17 (components/marketing/tone.ts).
    expect(lookOf(videoApp)).toEqual({ name: "Vídeo", tone: "primary" });
    expect(lookOf(starter)).toEqual({ name: "Construir", tone: "accent-2" });
  });

  it("offers as chips only the categories that hold an app, and names the empty ones", () => {
    const { chipsFor, emptyFor } = storeLook(catalog);
    expect(chipsFor([videoApp, starter, copy]).map((chip) => chip.slug)).toEqual(["sell", "video"]);
    expect(emptyFor([videoApp, starter, copy]).map((category) => category.slug)).toEqual(["research"]);
  });

  it("orders the store by category, uncategorized apps last", () => {
    const { sort } = storeLook(catalog);
    expect(sort([starter, videoApp, copy]).map((app) => app.slug)).toEqual(["copy-lp", "video-cut", "saas-starter"]);
  });
});
