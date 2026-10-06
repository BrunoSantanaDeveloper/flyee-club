import { describe, expect, it } from "vitest";

import { startersByPersona, startersFor } from "@/lib/catalog/starters";

const app = (slug: string, personas: string[]) => ({ slug, personas });

const catalog = [
  app("copy-lp", ["negocio", "agencia", "produto"]),
  app("copy-social", ["negocio", "agencia"]),
  app("pauta", ["negocio"]),
  app("radar", ["agencia", "negocio"]),
  app("saas-starter", ["dev"]),
];

describe("the apps to start with, per persona", () => {
  it("keeps the catalog's order and stops at three", () => {
    expect(startersFor(catalog, "negocio").map((entry) => entry.slug)).toEqual(["copy-lp", "copy-social", "pauta"]);
    expect(startersFor(catalog, "dev").map((entry) => entry.slug)).toEqual(["saas-starter"]);
  });

  it("gives a persona no app is marked for nothing, never a made-up app", () => {
    expect(startersFor([app("x", ["dev"])], "produto")).toEqual([]);
  });

  it("lists the four personas of the site, in their order, and never outro", () => {
    const all = startersByPersona(catalog);
    expect(all.map((entry) => entry.persona)).toEqual(["negocio", "agencia", "produto", "dev"]);
    expect(all.find((entry) => entry.persona === "produto")?.apps.map((entry) => entry.slug)).toEqual(["copy-lp"]);
  });
});
