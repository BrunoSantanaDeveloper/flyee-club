// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  descriptionFromReadme,
  type ExistingModule,
  importCatalogIndex,
  type IndexedModule,
  parseCatalogIndex,
  planImport,
} from "@/lib/catalog/index-import";

/** One app as the product's `npm run index` writes it (packages/module-tools/src/index-build.ts). */
const app = (overrides: Record<string, unknown> = {}) => ({
  slug: "youtube-research",
  version: "1.0.0",
  trail: "planejar",
  type: "tool",
  title: { "pt-BR": "Pesquisa no YouTube", en: "YouTube research" },
  summary: {
    "pt-BR": "Mostra quais vídeos de um tema fizeram mais que o normal.",
    en: "Shows the outliers of a topic.",
  },
  description_md: "# Pesquisa no YouTube\n\nMostra, com números de verdade, quais vídeos subiram.\n",
  compatible_ais: ["claude_code"],
  external_credentials: [],
  permissions: [],
  lessons: null,
  changelog: { "pt-BR": "Primeira versão.", en: "First version." },
  license: "member",
  sha256: "a".repeat(64),
  size_bytes: 1234,
  package: "modules/youtube-research-1.0.0.zip",
  ...overrides,
});

const index = (...apps: unknown[]) => ({ generated_at: "2026-10-14T12:00:00.000Z", apps });

const parsedApps = (input: unknown): IndexedModule[] => {
  const parsed = parseCatalogIndex(input);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.apps;
};

describe("the product's index, read before anything is written", () => {
  it("takes the index exactly as the product writes it", () => {
    const parsed = parseCatalogIndex(index(app()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.refused).toEqual([]);
    expect(parsed.apps).toEqual([
      {
        slug: "youtube-research",
        trail: "planejar",
        type: "tool",
        name: { "pt-BR": "Pesquisa no YouTube", en: "YouTube research" },
        summary: {
          "pt-BR": "Mostra quais vídeos de um tema fizeram mais que o normal.",
          en: "Shows the outliers of a topic.",
        },
        description: "Mostra, com números de verdade, quais vídeos subiram.",
        compatibleAis: ["claude_code"],
        externalCredentials: [],
        showcase: {},
        warnings: [],
      },
    ]);
  });

  it("refuses a file that is not an index, so nothing is written", () => {
    expect(parseCatalogIndex(null)).toMatchObject({ ok: false, error: "invalid_index" });
    expect(parseCatalogIndex({ apps: [] })).toMatchObject({ ok: false, error: "invalid_index" });
    expect(parseCatalogIndex({ apps: "x" })).toMatchObject({ ok: false, error: "invalid_index" });
  });

  it("refuses one app and keeps the others", () => {
    const parsed = parseCatalogIndex(
      index(
        app(),
        app({ slug: "Bad_Slug" }),
        app({ slug: "video-render", type: "plugin" }),
        app({ slug: "video-studio", title: { en: "Studio" } }),
        app({ slug: "video-analysis", compatible_ais: ["chatgpt"] }),
        app({ slug: "youtube-research" }),
      ),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.apps.map((entry) => entry.slug)).toEqual(["youtube-research"]);
    expect(Object.fromEntries(parsed.refused.map((entry) => [entry.slug, entry.errors[0]]))).toEqual({
      "apps[1]": "slug: lowercase letters, digits and hyphens, 2 to 60",
      "video-render": "type: one of skill, workflow, framework, tool",
      "video-studio": "title.pt-BR: is required",
      "video-analysis": "compatible_ais: at least one of claude_code, codex, gemini_cli, cursor, other",
      "youtube-research": "slug: appears twice in the index",
    });
  });

  it("holds every text the store shows to the copy rules", () => {
    const parsed = parseCatalogIndex(
      index(
        app({ title: { "pt-BR": "Pesquisa grátis" } }),
        app({
          slug: "video-render",
          summary: { "pt-BR": "Renderiza vídeos — rápido.", en: "Renders videos." },
          description_md: "# Motor\n\nTudo é lido sem chave e sem custo.",
        }),
      ),
    );
    if (!parsed.ok) throw new Error("unexpected");
    // A name that breaks a rule refuses the app: the store has no page without one.
    expect(parsed.refused).toEqual([
      { slug: "youtube-research", errors: ["title.pt-BR: breaks the copy rules (free), left out"] },
    ]);
    // A summary or a description that breaks one is left out, and the operator is told.
    const [render] = parsed.apps;
    expect(render.summary).toEqual({ en: "Renders videos." });
    expect(render.description).toBeNull();
    expect(render.warnings).toEqual([
      "summary.pt-BR: breaks the copy rules (dash), left out",
      "description_md: breaks the copy rules (free), left out",
    ]);
  });

  it("takes the README without its title, which the page already shows", () => {
    expect(descriptionFromReadme("# Motor de vídeo\n\nRenderiza.\n\n## Requisitos\n\nNode.")).toBe(
      "Renderiza.\n\n## Requisitos\n\nNode.",
    );
    expect(descriptionFromReadme(`${String.fromCharCode(0xfeff)}# Título\nTexto`)).toBe("Texto");
    expect(descriptionFromReadme("Sem título.\n# Não é o topo")).toBe("Sem título.\n# Não é o topo");
  });

  it("checks the keys the member provides", () => {
    const key = {
      name: "Chave da API do Gemini",
      env: "GEMINI_API_KEY",
      url: "https://aistudio.google.com/apikey",
      required: false,
      purpose: { "pt-BR": "Gera as imagens.", en: "Makes the images." },
    };
    expect(parsedApps(index(app({ external_credentials: [key] })))[0].externalCredentials).toEqual([key]);
    const parsed = parseCatalogIndex(
      index(app({ external_credentials: [{ ...key, env: "gemini", url: "http://x" }] })),
    );
    if (!parsed.ok) throw new Error("unexpected");
    expect(parsed.refused[0].errors).toEqual([
      "external_credentials[0].env: must be an environment variable name in capitals",
      "external_credentials[0].url: must be an https address",
    ]);
  });
});

const existing = (overrides: Partial<ExistingModule> = {}): ExistingModule => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "youtube-research",
  trail: "planejar",
  type: "tool",
  name: { "pt-BR": "Pesquisa no YouTube", en: "YouTube research" },
  summary: {
    "pt-BR": "Mostra quais vídeos de um tema fizeram mais que o normal.",
    en: "Shows the outliers of a topic.",
  },
  description_md: { "pt-BR": "Texto que o operador escreveu para a loja." },
  compatible_ais: ["claude_code"],
  external_credentials: [],
  showcase: null,
  ...overrides,
});

describe("what the import does to each app", () => {
  it("creates an app the catalog does not have, as a draft, with the README as its description", () => {
    const [operation] = planImport([], parsedApps(index(app())));
    expect(operation).toMatchObject({
      kind: "create",
      row: {
        slug: "youtube-research",
        description_md: { "pt-BR": "Mostra, com números de verdade, quais vídeos subiram." },
      },
    });
    // The state is not written: the column's default makes it a draft.
    expect(operation.kind === "create" && "status" in operation.row).toBe(false);
  });

  it("leaves an app that did not change alone, the operator's description included", () => {
    expect(planImport([existing()], parsedApps(index(app())))).toEqual([
      { kind: "unchanged", slug: "youtube-research", warnings: [] },
    ]);
  });

  it("follows the product on what the app is, and keeps an English text the index lacks", () => {
    const [operation] = planImport(
      [existing({ compatible_ais: ["codex", "claude_code"] })],
      parsedApps(
        index(
          app({
            trail: "divulgar",
            title: { "pt-BR": "Pesquisa de vídeos" },
            compatible_ais: ["claude_code", "codex", "cursor"],
          }),
        ),
      ),
    );
    expect(operation).toMatchObject({
      kind: "update",
      fields: ["trail", "name", "compatible_ais"],
      patch: {
        trail: "divulgar",
        name: { "pt-BR": "Pesquisa de vídeos", en: "YouTube research" },
        compatible_ais: ["claude_code", "codex", "cursor"],
      },
    });
  });

  it("fills a missing description once, and never rewrites one", () => {
    const [filled] = planImport([existing({ description_md: {} })], parsedApps(index(app())));
    expect(filled).toMatchObject({
      kind: "update",
      fields: ["description_md"],
      patch: { description_md: { "pt-BR": "Mostra, com números de verdade, quais vídeos subiram." } },
    });
    const [kept] = planImport(
      [existing()],
      parsedApps(index(app({ description_md: "# Pesquisa\n\nUm README novo." }))),
    );
    expect(kept.kind).toBe("unchanged");
  });

  it("takes the example of the app from the product, language by language", () => {
    const pt = {
      request: "Quais vídeos sobre marmita fizeram mais que o normal este mês?",
      reply: [{ label: "1 · 4,2x", text: "Marmita fit para a semana toda" }],
      saved: "Salvo em pesquisas/marmita.csv",
    };
    const en = {
      request: "Which videos on meal prep beat the usual this month?",
      reply: [{ text: "Meal prep for the week" }],
    };

    // New: the example goes in with the app.
    const [created] = planImport([], parsedApps(index(app({ showcase: { "pt-BR": pt } }))));
    expect(created).toMatchObject({ kind: "create", row: { showcase: { "pt-BR": pt } } });

    // An index with only Portuguese keeps the English example the catalog has.
    const [updated] = planImport(
      [existing({ showcase: { en } })],
      parsedApps(index(app({ showcase: { "pt-BR": pt } }))),
    );
    expect(updated).toMatchObject({ kind: "update", fields: ["showcase"], patch: { showcase: { "pt-BR": pt, en } } });

    // An index with no example leaves the catalog's alone.
    expect(planImport([existing({ showcase: { en } })], parsedApps(index(app())))[0].kind).toBe("unchanged");
  });

  it("leaves out an example that breaks a rule, and keeps the app", () => {
    const parsed = parseCatalogIndex(
      index(
        app({
          showcase: {
            "pt-BR": { request: "Me mostra os vídeos!", reply: [{ text: "Marmita fit" }] },
            en: { request: "Show me the videos", reply: [{ text: "Meal prep" }] },
          },
        }),
      ),
    );
    if (!parsed.ok) throw new Error("unexpected");
    expect(parsed.refused).toEqual([]);
    expect(parsed.apps[0].showcase).toEqual({ en: { request: "Show me the videos", reply: [{ text: "Meal prep" }] } });
    expect(parsed.apps[0].warnings).toEqual([
      "showcase: pt-BR.request: breaks the copy rules (exclamation mark), left out",
    ]);
  });
});

/** Just enough of a Supabase client for importCatalogIndex: the reads it makes and the writes it sends. */
function fakeCatalog(rows: ExistingModule[]) {
  const writes: { kind: string; table: string; value: unknown; id?: string }[] = [];
  const client = {
    from(table: string) {
      return {
        select: () =>
          table === "catalog_trails"
            ? Promise.resolve({ data: [{ slug: "planejar" }, { slug: "divulgar" }], error: null })
            : { in: () => Promise.resolve({ data: rows, error: null }) },
        insert(value: unknown) {
          writes.push({ kind: "insert", table, value });
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-id" }, error: null }) }) };
        },
        update(value: unknown) {
          return {
            eq: (_column: string, id: string) => {
              writes.push({ kind: "update", table, value, id });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client: client as never, writes };
}

describe("the import against the catalog", () => {
  it("writes once per app that changes, audits each write, and refuses an unknown stage", async () => {
    const parsed = parseCatalogIndex(
      index(
        app(),
        app({ slug: "video-render", trail: "divulgar", type: "tool", title: { "pt-BR": "Motor de vídeo" } }),
        app({ slug: "video-studio", trail: "lancar", type: "workflow", title: { "pt-BR": "Estúdio" } }),
      ),
    );
    if (!parsed.ok) throw new Error("unexpected");
    const { client, writes } = fakeCatalog([existing({ description_md: {} })]);
    const audits: { action: string; metadata?: Record<string, unknown> }[] = [];
    const report = await importCatalogIndex(client, parsed, async (action, options) => {
      audits.push({ action, metadata: options.metadata });
    });

    expect(report).toEqual([
      { slug: "video-studio", result: "refused", errors: ['trail: "lancar" is not a catalog stage'] },
      { slug: "youtube-research", result: "updated", fields: ["description_md"] },
      { slug: "video-render", result: "created" },
    ]);
    expect(writes.map((write) => [write.kind, write.table])).toEqual([
      ["update", "catalog_modules"],
      ["insert", "catalog_modules"],
    ]);
    // A module created by the CI has no person as its author.
    expect(writes[1].value).toMatchObject({ slug: "video-render", created_by: null });
    expect(audits).toEqual([
      {
        action: "catalog.module.imported",
        metadata: { slug: "youtube-research", result: "updated", fields: ["description_md"] },
      },
      { action: "catalog.module.imported", metadata: { slug: "video-render", result: "created" } },
    ]);
  });
});
