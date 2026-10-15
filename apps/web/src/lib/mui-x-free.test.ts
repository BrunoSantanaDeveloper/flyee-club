// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * MUI X through its free packages only (decided 2026-10-14, as MedChina did):
 * no Pro or Premium package and no licence key. A feature that only a paid
 * package has (pinned columns, row grouping, a range picker, a funnel chart) is
 * built as the platform's own component instead, so no deployment depends on a
 * licence and no screen can show the MUI X watermark. Removing the packages is
 * not enough on its own: adding one back compiles again, so it is checked here.
 */

const THIS_FILE = fileURLToPath(import.meta.url);
const SRC = path.resolve(path.dirname(THIS_FILE), "..");
const ROOT = path.resolve(SRC, "../../..");

/** A paid MUI X package, or the licence package only they need. */
const PAID = /^@mui\/x-(?:license|[a-z-]+-(?:pro|premium))(?:\/|$)/;
const LICENSE_VARIABLE = ["MUI", "X", "LICENSE", "KEY"].join("_");

function workspaceManifests(): string[] {
  const packages = path.join(ROOT, "packages");
  return [
    path.join(ROOT, "package.json"),
    path.join(ROOT, "apps/web/package.json"),
    ...fs.readdirSync(packages).map((name) => path.join(packages, name, "package.json")),
  ].filter((file) => fs.existsSync(file));
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") yield* sourceFiles(full);
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name) && full !== THIS_FILE) {
      yield full;
    }
  }
}

function sourceRoots(): string[] {
  const packages = path.join(ROOT, "packages");
  return [
    SRC,
    ...fs
      .readdirSync(packages)
      .map((name) => path.join(packages, name, "src"))
      .filter((dir) => fs.existsSync(dir)),
  ];
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

describe("MUI X: free packages only", () => {
  it("no workspace package depends on a paid MUI X package", () => {
    const found: string[] = [];
    for (const file of workspaceManifests()) {
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        for (const name of Object.keys(manifest[field] ?? {})) {
          if (PAID.test(name)) found.push(`${relative(file)}: ${name}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("no source file imports one or sets a licence key", () => {
    const specifier = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
    const found: string[] = [];
    for (const root of sourceRoots()) {
      for (const file of sourceFiles(root)) {
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(specifier)) {
          if (PAID.test(match[1])) found.push(`${relative(file)}: ${match[1]}`);
        }
        if (text.includes(LICENSE_VARIABLE)) found.push(`${relative(file)}: ${LICENSE_VARIABLE}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("the env reference names no licence key", () => {
    const example = fs.readFileSync(path.join(ROOT, "apps/web/.env.example"), "utf8");
    expect(example.includes(LICENSE_VARIABLE)).toBe(false);
  });
});
