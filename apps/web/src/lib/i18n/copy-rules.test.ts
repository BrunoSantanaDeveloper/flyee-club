// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "@flyee/content/messages/en.json";
import ptBR from "@flyee/content/messages/pt-BR.json";

/**
 * The copy rules of the home brief (docs/PRODUCT.md, decided 2026-10-07): no
 * dash (— or –), no exclamation mark and no emoji in a text a person reads,
 * and none of the banned words. They hold for everything the platform writes
 * to visitors and members, in both languages. The operator console is out
 * (hardcoded Portuguese, one reader), and so are code comments. The texts the
 * migrations seed (the legal texts in force among them) are checked by pgTAP
 * 0033_copy_rules.
 *
 * Two depths:
 *  - the copy sources (the message catalogs, the home's copy, the e-mails, the
 *    bell, the CLI's messages) hold only text for people, so every rule applies
 *    to every string in them;
 *  - the rest of the shipped code holds a sentence only by exception (a
 *    separator, a fallback, an alt text), beside class names that end in "!"
 *    and message keys such as "module-unlock", so there the dash and the emoji
 *    apply to every string, and the exclamation mark and the words to JSX text.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fromRoot = (...segments: string[]) => path.join(ROOT, ...segments);

type Rule = { name: string; test: (text: string) => boolean };

const DASH: Rule = { name: "dash", test: (text) => /[–—]/u.test(text) };
// The brief keeps © and → on purpose; neither reads as an emoji.
const EMOJI: Rule = { name: "emoji", test: (text) => /(?![©→])\p{Extended_Pictographic}/u.test(text) };
const EXCLAMATION: Rule = { name: "exclamation mark", test: (text) => text.includes("!") };
const WORDS: Rule = {
  name: "banned word",
  test: (text) =>
    /(?<![\p{L}\p{N}])(?:desbloque|potencializ|sem esforço|soluç(?:ão|ões) inovadora|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it['’]s not just)/iu.test(
      text,
    ),
};
const ALL_RULES = [DASH, EXCLAMATION, EMOJI, WORDS];

const breaksOf = (text: string, rules: Rule[]) => rules.filter((rule) => rule.test(text)).map((rule) => rule.name);

/** Every string value of a catalog, with its key path. */
function* catalogStrings(node: unknown, trail: string[] = []): Generator<[string, string]> {
  if (typeof node === "string") {
    yield [trail.join("."), node];
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) yield* catalogStrings(value, [...trail, key]);
  }
}

type Literal = { line: number; text: string; jsx: boolean };

/** The text a file can show: string literals, template parts and JSX text, never comments. */
function literalsOf(file: string): Literal[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Literal[] = [];
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      found.push({ line: lineOf(node), text: node.text, jsx: false });
    } else if (ts.isJsxText(node) && node.text.trim()) {
      found.push({ line: lineOf(node), text: node.text, jsx: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const COPY_SOURCES = [
  "apps/web/src/components/marketing/home-copy/pt-BR.ts",
  "apps/web/src/components/marketing/home-copy/en.ts",
  "packages/email/src/copy/pt-BR.ts",
  "packages/email/src/copy/en.ts",
  "apps/web/src/lib/messages/bell-copy.ts",
  "apps/web/src/lib/cli/messages.ts",
].map((file) => fromRoot(file));

const SHIPPED_CODE = ["apps/web/src", "packages/email/src", "packages/billing/src", "packages/content/src"];
const NOT_SHIPPED_TO_PEOPLE = [
  /\.test\.tsx?$/,
  /\.d\.ts$/,
  /[\\/]app[\\/]\(dashboard\)[\\/]admin[\\/]/,
  /[\\/]app[\\/]api[\\/]admin[\\/]/,
  /[\\/]lib[\\/]admin[\\/]/,
  /[\\/]icons[\\/]/,
];

function* codeFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) yield* codeFiles(full);
    } else if (/\.tsx?$/.test(entry.name) && !NOT_SHIPPED_TO_PEOPLE.some((pattern) => pattern.test(full))) {
      yield full;
    }
  }
}

const where = (file: string, line: number) => `${path.relative(ROOT, file).replaceAll("\\", "/")}:${line}`;

describe("copy rules: no dash, exclamation mark, emoji or banned word in what people read", () => {
  it("knows each mark it promises to catch, and lets © and → through", () => {
    expect(breaksOf("Pronto — feito", ALL_RULES)).toEqual(["dash"]);
    expect(breaksOf("10–12 de outubro", ALL_RULES)).toEqual(["dash"]);
    expect(breaksOf("E-mail enviado!", ALL_RULES)).toEqual(["exclamation mark"]);
    expect(breaksOf("Lançamos 🚀", ALL_RULES)).toEqual(["emoji"]);
    expect(breaksOf("Feito ✅", ALL_RULES)).toEqual(["emoji"]);
    expect(breaksOf("Desbloqueie seu acesso", ALL_RULES)).toEqual(["banned word"]);
    expect(breaksOf("Potencialize seu negócio sem esforço", ALL_RULES)).toEqual(["banned word"]);
    expect(breaksOf("FlyeeClub unlocks every app", ALL_RULES)).toEqual(["banned word"]);
    expect(breaksOf("It’s not just a tool", ALL_RULES)).toEqual(["banned word"]);
    expect(breaksOf("© 2026 FlyeeClub · Ver planos →", ALL_RULES)).toEqual([]);
    expect(breaksOf("Use o seu próprio plano de IA, com acesso por 1 ano.", ALL_RULES)).toEqual([]);
  });

  it("the message catalogs hold none, in either language", () => {
    const found: string[] = [];
    for (const [locale, catalog] of Object.entries({ "pt-BR": ptBR, en })) {
      for (const [key, text] of catalogStrings(catalog)) {
        for (const rule of breaksOf(text, ALL_RULES)) found.push(`${locale} ${key} (${rule}): ${text}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("neither do the home's copy, the e-mails, the bell or the CLI's messages", () => {
    const found: string[] = [];
    for (const file of COPY_SOURCES) {
      for (const literal of literalsOf(file)) {
        for (const rule of breaksOf(literal.text, ALL_RULES)) {
          found.push(`${where(file, literal.line)} (${rule}): ${literal.text.trim()}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("and the rest of the shipped code adds none, the operator console and comments aside", { timeout: 60_000 }, () => {
    const found: string[] = [];
    let files = 0;
    for (const dir of SHIPPED_CODE) {
      for (const file of codeFiles(fromRoot(dir))) {
        files += 1;
        for (const literal of literalsOf(file)) {
          const rules = literal.jsx ? ALL_RULES : [DASH, EMOJI];
          for (const rule of breaksOf(literal.text, rules)) {
            found.push(`${where(file, literal.line)} (${rule}): ${literal.text.trim()}`);
          }
        }
      }
    }
    // A walk that found nothing to read would pass for the wrong reason.
    expect(files).toBeGreaterThan(300);
    expect(found).toEqual([]);
  });
});

/**
 * "O plano gratuito nunca é oferecido" (docs/PRODUCT.md, decided 2026-10-06;
 * the wording fixed on 2026-10-08): nothing a visitor or a member reads sells,
 * announces or names a free plan, a free account or a free sample. The account
 * with no purchase is reached through content and described by what it is
 * ("sem acesso à loja", "app de entrada"), never as a plan with a name. The
 * operator console is out: there the flag is called what it is.
 */
const FREE: Rule = {
  name: "free",
  test: (text) =>
    // "sem custo extra" stays: the brief says it of the apps that join an access already paid for.
    /(?<![\p{L}\p{N}])(?:gr[aá]tis|gratuit|free(?![\p{L}\p{N}])|sem custo(?! extra)|no cost|at no charge)/iu.test(text),
};

/** The one place the word is true and allowed: the waiting list itself costs nothing. */
const FREE_ALLOWED = new Set(["marketing.waitlist-faq-1-answer"]);

describe("the free rung is never offered: no free plan, account or sample in what people read", () => {
  it("knows the words, and leaves the ones that only look like them", () => {
    for (const text of [
      "Criar conta gratuita",
      "Crie a conta grátis",
      "Amostra grátis",
      "volta ao plano Gratuito",
      "Create your free account",
      "Risk-free purchase",
      "Uma conta sem custo",
    ]) {
      expect(FREE.test(text), text).toBe(true);
    }
    for (const text of [
      "Criar conta",
      "App de entrada",
      "Sem acesso",
      "Use it freely",
      "Acesso na hora, sem cartão.",
      "Entram no seu acesso sem custo extra.",
      "They join your access at no extra cost.",
    ]) {
      expect(FREE.test(text), text).toBe(false);
    }
  });

  it("the message catalogs offer none, in either language, the waitlist answer aside", () => {
    const found: string[] = [];
    for (const [locale, catalog] of Object.entries({ "pt-BR": ptBR, en })) {
      for (const [key, text] of catalogStrings(catalog)) {
        if (!FREE_ALLOWED.has(key) && FREE.test(text)) found.push(`${locale} ${key}: ${text}`);
      }
    }
    expect(found).toEqual([]);
    // The allowed answer still exists and still says it: an entry that outlived its text is a hole.
    for (const catalog of [ptBR, en]) {
      const answer = (catalog.marketing as Record<string, string>)["waitlist-faq-1-answer"];
      expect(FREE.test(answer)).toBe(true);
    }
  });

  it(
    "neither do the home's copy, the e-mails, the bell, the CLI's messages or the text written in a screen",
    {
      timeout: 60_000,
    },
    () => {
      const found: string[] = [];
      for (const file of COPY_SOURCES) {
        for (const literal of literalsOf(file)) {
          if (FREE.test(literal.text)) found.push(`${where(file, literal.line)}: ${literal.text.trim()}`);
        }
      }
      // Outside the copy sources a string is a key, a slug or a class ("is_free_sample",
      // kind "free"): only the text written between tags is read by a person.
      for (const dir of SHIPPED_CODE) {
        for (const file of codeFiles(fromRoot(dir))) {
          for (const literal of literalsOf(file)) {
            if (literal.jsx && FREE.test(literal.text))
              found.push(`${where(file, literal.line)}: ${literal.text.trim()}`);
          }
        }
      }
      expect(found).toEqual([]);
    },
  );
});

/**
 * "O FlyeeClub Pro só é oferecido por dentro" (docs/PRODUCT.md, decided
 * 2026-10-08): the public site sells FlyeeClub alone. No text of a public page
 * names FlyeeClub Pro, or the "flyeeClub completo" of the home brief; the
 * member area offers it on the click of one of its features. The legal texts
 * (consent_terms, in the database) still describe both plans: they are the
 * contract, not an advertisement.
 */
const PRO: Rule = {
  name: "FlyeeClub Pro",
  test: (text) => /\bPro\b/.test(text) || /flyee\s?club\s+complet/i.test(text),
};

const PUBLIC_SITE_CODE = [
  "apps/web/src/app/[locale]",
  "apps/web/src/components/marketing",
  "apps/web/src/components/site",
];
const HOME_COPY = COPY_SOURCES.filter((file) => /home-copy/.test(file));

describe("the public site never names FlyeeClub Pro", () => {
  it("knows the names, and leaves the words that only look like them", () => {
    for (const text of ["Assinar FlyeeClub Pro", "No FlyeeClub Pro", "o flyeeClub completo", "flyeeClub complete"]) {
      expect(PRO.test(text), text).toBe(true);
    }
    for (const text of ["Assinar {plan}", "Produto digital", "Proposta e voto", "a pro tip", "FlyeeClub"]) {
      expect(PRO.test(text), text).toBe(false);
    }
  });

  it("in the marketing catalogs of either language", () => {
    const found: string[] = [];
    for (const [locale, catalog] of Object.entries({ "pt-BR": ptBR, en })) {
      for (const [key, text] of catalogStrings(catalog.marketing)) {
        if (PRO.test(text)) found.push(`${locale} marketing.${key}: ${text}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("in the home's copy and in any string of the public site's code", { timeout: 60_000 }, () => {
    const found: string[] = [];
    for (const file of HOME_COPY) {
      for (const literal of literalsOf(file)) {
        if (PRO.test(literal.text)) found.push(`${where(file, literal.line)}: ${literal.text.trim()}`);
      }
    }
    let files = 0;
    for (const dir of PUBLIC_SITE_CODE) {
      for (const file of codeFiles(fromRoot(dir))) {
        files += 1;
        for (const literal of literalsOf(file)) {
          if (PRO.test(literal.text)) found.push(`${where(file, literal.line)}: ${literal.text.trim()}`);
        }
      }
    }
    expect(HOME_COPY).toHaveLength(2);
    expect(files).toBeGreaterThan(40);
    expect(found).toEqual([]);
  });
});
