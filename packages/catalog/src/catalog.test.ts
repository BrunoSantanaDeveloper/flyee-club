import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guideAvailability, guideOf, guidePath } from "./guides.ts";
import { isSafePackagePath, manifestJsonSchema, MANIFEST_SCHEMA_ID, parseManifest } from "./manifest.ts";
import { compareSemver, isSemver, latestVersion, minimumOfRange } from "./semver.ts";

const valid = {
  manifest_version: 1,
  name: "deploy-check",
  version: "1.2.0",
  type: "skill",
  trail: "publicar",
  title: { "pt-BR": "Checagem de deploy", en: "Deploy check" },
  summary: { "pt-BR": "Confere o que falta antes de publicar." },
  compatible_ais: ["claude_code", "codex"],
  min_core: ">=0.3.0",
  entry: "SKILL.md",
  files: ["SKILL.md", "scripts/check.sh"],
  permissions: [{ kind: "fs:read", scope: "./", reason: { "pt-BR": "Ler o projeto." } }],
  external_credentials: [
    {
      name: "Vercel",
      env: "VERCEL_TOKEN",
      url: "https://vercel.com/account/tokens",
      required: false,
      purpose: { "pt-BR": "Consultar o último deploy." },
    },
  ],
  changelog: { "pt-BR": "Primeira versão." },
};

describe("semver, as the database orders it", () => {
  it("accepts what semver_ok accepts and nothing else", () => {
    for (const ok of ["0.0.1", "1.2.3", "10.0.0", "1.0.0-beta.1", "99999.0.0"]) assert.equal(isSemver(ok), true, ok);
    for (const bad of ["1.2", "01.2.3", "1.2.3+build", "v1.2.3", "1.2.3-", "100000.0.0", "1.2.3-.x"]) {
      assert.equal(isSemver(bad), false, bad);
    }
  });

  it("orders by major, minor and patch, and puts a release after its prereleases", () => {
    assert.ok(compareSemver("1.10.0", "1.9.9") > 0);
    assert.ok(compareSemver("1.0.0-rc.1", "1.0.0") < 0);
    assert.equal(compareSemver("1.0.0-alpha", "1.0.0-beta"), 0, "two prereleases tie, like semver_sort_key");
  });

  it("picks the newest version, breaking a tie by the latest publication", () => {
    const picked = latestVersion([
      { version: "1.0.0-alpha", published_at: "2026-10-02T00:00:00Z" },
      { version: "0.9.0", published_at: "2026-10-03T00:00:00Z" },
      { version: "1.0.0-beta", published_at: "2026-10-01T00:00:00Z" },
    ]);
    assert.equal(picked?.version, "1.0.0-alpha");
    assert.equal(latestVersion([]), null);
  });

  it("reads the lowest core version of a declared range", () => {
    assert.equal(minimumOfRange(">=0.3.0"), "0.3.0");
    assert.equal(minimumOfRange("^1.2.0"), "1.2.0");
    assert.equal(minimumOfRange("0.4.1"), "0.4.1");
    assert.equal(minimumOfRange("<2.0.0"), null);
    assert.equal(minimumOfRange(undefined), null);
  });
});

describe("flyee.module.json", () => {
  it("accepts a complete manifest and fills the defaults", () => {
    const result = parseManifest(JSON.stringify({ ...valid, permissions: undefined }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.manifest.permissions, []);
      assert.equal(result.manifest.license, "member");
    }
  });

  it("reads bytes with a byte-order mark", () => {
    const bytes = new TextEncoder().encode(`\uFEFF${JSON.stringify(valid)}`);
    assert.equal(parseManifest(bytes).ok, true);
  });

  it("names every problem by its path", () => {
    const result = parseManifest(
      JSON.stringify({ ...valid, version: "1.2", entry: "MISSING.md", typo_key: true, compatible_ais: [] }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      const text = result.errors.join("\n");
      assert.match(text, /version/);
      assert.match(text, /compatible_ais/);
      assert.match(text, /typo_key|Unrecognized/i);
    }
  });

  it("refuses an entry outside the files, repeated files and the manifest listed as a file", () => {
    const result = parseManifest(
      JSON.stringify({ ...valid, entry: "other.md", files: ["SKILL.md", "SKILL.md", "flyee.module.json"] }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((error) => error.startsWith("entry:")));
      assert.ok(result.errors.some((error) => error.includes("must not repeat a path")));
      assert.ok(result.errors.some((error) => error.includes("must not list flyee.module.json")));
    }
  });

  it("refuses a credential URL that is not https", () => {
    const result = parseManifest(
      JSON.stringify({
        ...valid,
        external_credentials: [{ ...valid.external_credentials[0], url: "http://example.com" }],
      }),
    );
    assert.equal(result.ok, false);
  });

  it("says so when the file is not JSON", () => {
    const result = parseManifest("{ not json");
    assert.deepEqual(result, { ok: false, errors: ["flyee.module.json is not valid JSON"] });
  });

  it("keeps every path inside the package", () => {
    for (const ok of ["SKILL.md", "scripts/check.sh", "a/b/c.txt"]) assert.equal(isSafePackagePath(ok), true, ok);
    for (const bad of ["/etc/passwd", "../up.md", "a/../b", "a//b", "C:/x", "a\\b", "./a", ""]) {
      assert.equal(isSafePackagePath(bad), false, bad);
    }
  });

  it("publishes itself as JSON Schema", () => {
    const schema = manifestJsonSchema();
    assert.equal(schema.$id, MANIFEST_SCHEMA_ID);
    const properties = schema.properties as Record<string, unknown>;
    assert.ok(properties.name && properties.version && properties.permissions);
    assert.ok((schema.required as string[]).includes("manifest_version"));
  });
});

describe("guides: a path convention inside the package", () => {
  it("reads the language and depth of the four guide paths and nothing else", () => {
    assert.deepEqual(guideOf("guides/pt-BR/usar.md"), { locale: "pt-BR", depth: "usar" });
    assert.deepEqual(guideOf("guides/en/abrir-o-capo.md"), { locale: "en", depth: "abrir_o_capo" });
    for (const other of ["guides/pt/usar.md", "guides/en/abrir_o_capo.md", "guides/en/usar.txt", "docs/usar.md", "guides/en/x/usar.md"]) {
      assert.equal(guideOf(other), null, other);
    }
  });

  it("writes the path of a guide back, so the two directions agree", () => {
    assert.equal(guidePath("en", "abrir_o_capo"), "guides/en/abrir-o-capo.md");
    assert.deepEqual(guideOf(guidePath("pt-BR", "usar")), { locale: "pt-BR", depth: "usar" });
  });

  it("records which guides a package carries, by language, in depth order", () => {
    assert.deepEqual(
      guideAvailability([
        { locale: "pt-BR", depth: "abrir_o_capo" },
        { locale: "pt-BR", depth: "usar" },
        { locale: "en", depth: "usar" },
      ]),
      { "pt-BR": ["usar", "abrir_o_capo"], en: ["usar"] },
    );
    assert.deepEqual(guideAvailability([]), {});
  });
});
