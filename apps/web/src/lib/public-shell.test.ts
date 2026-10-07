// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { PUBLIC_CLIENT_MESSAGE_KEYS } from "@/i18n/public-client-messages";

/**
 * The public shell (docs/PLANO-IMPLEMENTACAO.md, "Casca pública", decided
 * 2026-10-07): the public site renders with no MUI, no styling engine and no
 * form library, and with the `marketing` messages alone. Those belong to the
 * signed-in areas, whose layouts mount them through
 * components/layout/app-shell.tsx. With MUI in the root layout the home scored
 * 55 on a phone; one stray import in a public component brings it all back,
 * silently, so the import graph is checked here.
 */

// These tests read hundreds of source files: on a busy machine that outlasts the default limit.
vi.setConfig({ testTimeout: 60_000 });

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(SRC, "app");

/** What a public page must never pull in. */
const FORBIDDEN = /^(@mui\/|@emotion\/|notistack$|formik$|yup$)/;

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolve(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/icons/nexture/")) {
    // The tsconfig alias of the icon set (src/icons/README.md).
    base = path.join(SRC, "icons/phosphor", specifier.slice("@/icons/nexture/".length));
  } else if (specifier.startsWith("@/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(from), specifier);
  } else {
    return null;
  }
  for (const extension of EXTENSIONS) {
    const file = base + extension;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

/**
 * What a file really imports: static imports and re-exports that are not
 * type-only (the compiler erases those), and dynamic `import()` calls. Read
 * from the syntax tree: a pattern over the text mistakes one for the other.
 */
function importsOf(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, false);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypes =
        clause?.isTypeOnly ||
        (clause !== undefined &&
          !clause.name &&
          bindings !== undefined &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly));
      if (!onlyTypes) found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const relative = (file: string) => path.relative(SRC, file).replaceAll("\\", "/");

/** Every module a public page can load, with the file that first imported it. */
function publicGraph() {
  const entries = [
    ...sourceFiles(path.join(APP, "[locale]")),
    path.join(APP, "not-found.tsx"),
    path.join(APP, "layout.tsx"),
  ];
  const parents = new Map<string, string | null>();
  const forbidden: string[] = [];
  const queue: [string, string | null][] = entries.map((file) => [file, null]);
  while (queue.length > 0) {
    const [file, parent] = queue.shift()!;
    if (parents.has(file)) continue;
    parents.set(file, parent);
    for (const specifier of importsOf(file)) {
      if (FORBIDDEN.test(specifier)) {
        const chain: string[] = [];
        for (let at: string | null | undefined = file; at; at = parents.get(at)) chain.push(relative(at));
        forbidden.push(`${specifier} in ${chain.slice(0, 4).join(" <- ")}`);
        continue;
      }
      const target = resolve(file, specifier);
      if (target) queue.push([target, file]);
    }
  }
  return { files: [...parents.keys()], forbidden };
}

describe("the public shell: no MUI and only its own messages on the public site", () => {
  const graph = publicGraph();

  it("reaches no MUI, styling engine, snackbar or form library from any public page", () => {
    // A walk that found nothing to read would pass for the wrong reason.
    expect(graph.files.length).toBeGreaterThan(100);
    expect(graph.forbidden).toEqual([]);
  });

  it("asks only for the marketing messages, the one namespace the public provider carries", () => {
    const other = graph.files.flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(/\b(?:useTranslations|getTranslations)\(\s*["']([\w-]+)["']\s*\)/g)]
        .filter((match) => match[1] !== "marketing")
        .map((match) => `${relative(file)}: ${match[1]}`),
    );
    expect(other).toEqual([]);
  });

  it("hands the browser exactly the marketing keys the public client components read", () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.resolve(SRC, "../../../packages/content/messages/pt-BR.json"), "utf8"),
    ) as { marketing: Record<string, string> };
    const keys = new Set(Object.keys(catalog.marketing));
    // A key is read where it is written: as a literal in the client component.
    const read = new Set<string>();
    for (const file of graph.files) {
      const text = fs.readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(text)) continue;
      const visit = (node: ts.Node) => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && keys.has(node.text)) {
          read.add(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false));
    }
    const listed = new Set<string>(PUBLIC_CLIENT_MESSAGE_KEYS);
    expect(read.size).toBeGreaterThan(20);
    // Missing from i18n/public-client-messages.ts: the page would print the key's name.
    expect([...read].filter((key) => !listed.has(key)).sort()).toEqual([]);
    // Listed but read by no client component: weight on every public page for nothing.
    expect([...listed].filter((key) => !read.has(key)).sort()).toEqual([]);
  });

  it("keeps the providers out of the root layout", () => {
    const root = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    expect(root).not.toMatch(/ThemeProvider|AppRouterCacheProvider|NextIntlClientProvider|SnackbarWrapper/);
  });

  it("mounts the app shell in the layout of every other segment", () => {
    // `[locale]` is the public site; a folder of route handlers alone renders no page.
    const segments = fs
      .readdirSync(APP, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "[locale]")
      .map((entry) => entry.name)
      .filter((segment) =>
        [...sourceFiles(path.join(APP, segment))].some((file) => path.basename(file) === "page.tsx"),
      );
    expect(segments.length).toBeGreaterThan(4);
    const missing = segments.filter((segment) => {
      const layout = path.join(APP, segment, "layout.tsx");
      return !fs.existsSync(layout) || !/<AppShell>/.test(fs.readFileSync(layout, "utf8"));
    });
    expect(missing).toEqual([]);
  });
});
