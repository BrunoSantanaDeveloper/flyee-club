// @vitest-environment node
import { strToU8, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { inspectModulePackage } from "@/lib/catalog/package";

/**
 * The upload refuses a package before anything is stored. Fixtures are built
 * in memory with the same ZIP library the reader uses.
 */

const manifest = {
  manifest_version: 1,
  name: "deploy-check",
  version: "1.2.0",
  type: "skill",
  trail: "publicar",
  title: { "pt-BR": "Checagem de deploy", en: "Deploy check" },
  summary: { "pt-BR": "Confere o que falta antes de publicar." },
  compatible_ais: ["claude_code"],
  entry: "SKILL.md",
  files: ["SKILL.md", "scripts/check.sh"],
};

function pack(entries: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, body]) => [name, strToU8(body)])));
}

const VALID = {
  "flyee.module.json": JSON.stringify(manifest),
  "SKILL.md": "# Deploy check",
  "scripts/check.sh": "echo ok",
};

describe("inspectModulePackage", () => {
  it("accepts a package whose files match its manifest, with the checksum of the exact bytes", () => {
    const bytes = pack(VALID);
    const result = inspectModulePackage(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.name).toBe("deploy-check");
      expect(result.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      expect(result.sizeBytes).toBe(bytes.byteLength);
      expect(result.files).toEqual(["SKILL.md", "scripts/check.sh"]);
    }
  });

  it("refuses something that is not a ZIP", () => {
    expect(inspectModulePackage(strToU8("not a zip at all"))).toEqual({
      ok: false,
      errors: ["the file is not a valid ZIP archive"],
    });
  });

  it("refuses a package without a manifest at its root", () => {
    const result = inspectModulePackage(
      pack({ "SKILL.md": "x", "nested/flyee.module.json": JSON.stringify(manifest) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/missing from the root/);
  });

  it("refuses an entry that would escape the install folder", () => {
    const result = inspectModulePackage(pack({ ...VALID, "../evil.sh": "rm -rf /" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/escapes the package folder/);
  });

  it("refuses a file list that disagrees with the archive, both ways", () => {
    const missing = inspectModulePackage(
      pack({ "flyee.module.json": JSON.stringify(manifest), "SKILL.md": "only one of two files" }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.join("\n")).toMatch(/scripts\/check.sh: listed in files but missing/);

    const undeclared = inspectModulePackage(pack({ ...VALID, "secret.env": "TOKEN=1" }));
    expect(undeclared.ok).toBe(false);
    if (!undeclared.ok) expect(undeclared.errors.join("\n")).toMatch(/secret.env: in the package but not listed/);
  });

  it("names the manifest problems", () => {
    const result = inspectModulePackage(
      pack({ ...VALID, "flyee.module.json": JSON.stringify({ ...manifest, version: "one" }) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/flyee.module.json version/);
  });
});

describe("inspectModulePackage: the guides a package carries", () => {
  const withGuides = (extra: Record<string, string | Uint8Array>) => {
    const files = [...manifest.files, ...Object.keys(extra)];
    const entries: Record<string, Uint8Array> = {
      "flyee.module.json": strToU8(JSON.stringify({ ...manifest, files })),
      "SKILL.md": strToU8("# Deploy check"),
      "scripts/check.sh": strToU8("echo ok"),
    };
    for (const [name, body] of Object.entries(extra)) entries[name] = typeof body === "string" ? strToU8(body) : body;
    return inspectModulePackage(zipSync(entries));
  };

  it("reads each guide at its path, with its language and depth", () => {
    const result = withGuides({
      "guides/pt-BR/usar.md": "# Usar\n\n1. Rode o app.",
      "guides/en/abrir-o-capo.md": "# Under the hood",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guides).toEqual([
        { locale: "en", depth: "abrir_o_capo", body: "# Under the hood" },
        { locale: "pt-BR", depth: "usar", body: "# Usar\n\n1. Rode o app." },
      ]);
    }
  });

  it("carries no guide when the package has none", () => {
    const result = inspectModulePackage(pack(VALID));
    expect(result.ok && result.guides).toEqual([]);
  });

  it("refuses a file under guides/ that is not one of the four guide paths", () => {
    const result = withGuides({ "guides/pt/usar.md": "# typo" });
    expect(result).toEqual({
      ok: false,
      errors: ["guides/pt/usar.md: a guide is guides/<pt-BR|en>/<usar|abrir-o-capo>.md"],
    });
  });

  it("refuses a guide that is too large, empty or not UTF-8", () => {
    expect(withGuides({ "guides/pt-BR/usar.md": "a".repeat(200_001) })).toEqual({
      ok: false,
      errors: ["guides/pt-BR/usar.md: a guide is at most 200 KB"],
    });
    expect(withGuides({ "guides/pt-BR/usar.md": "   " })).toEqual({
      ok: false,
      errors: ["guides/pt-BR/usar.md: the guide is empty"],
    });
    expect(withGuides({ "guides/en/usar.md": new Uint8Array([0xff, 0xfe, 0xfd]) })).toEqual({
      ok: false,
      errors: ["guides/en/usar.md: a guide must be UTF-8 text"],
    });
  });
});
