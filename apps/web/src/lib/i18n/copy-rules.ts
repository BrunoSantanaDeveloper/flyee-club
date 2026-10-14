/**
 * The copy rules (docs/PRODUCT.md, decided 2026-10-07 and 2026-10-08) as code
 * the platform runs, not only tests. lib/i18n/copy-rules.test.ts holds the
 * platform's own texts to them; the catalog import (lib/catalog/index-import.ts)
 * holds the texts the product sends, before the store shows them.
 */

export type CopyRule = { name: string; test: (text: string) => boolean };

export const DASH: CopyRule = { name: "dash", test: (text) => /[–—]/u.test(text) };

// The brief keeps © and → on purpose; neither reads as an emoji.
export const EMOJI: CopyRule = { name: "emoji", test: (text) => /(?![©→])\p{Extended_Pictographic}/u.test(text) };

export const EXCLAMATION: CopyRule = { name: "exclamation mark", test: (text) => text.includes("!") };

export const WORDS: CopyRule = {
  name: "banned word",
  test: (text) =>
    /(?<![\p{L}\p{N}])(?:desbloque|potencializ|sem esforço|soluç(?:ão|ões) inovadora|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it['’]s not just)/iu.test(
      text,
    ),
};

/**
 * "O plano gratuito nunca é oferecido" (decided 2026-10-06, the wording fixed
 * on 2026-10-08). "sem custo extra" stays: the brief says it of the apps that
 * join an access already paid for.
 */
export const FREE: CopyRule = {
  name: "free",
  test: (text) =>
    /(?<![\p{L}\p{N}])(?:gr[aá]tis|gratuit|free(?![\p{L}\p{N}])|sem custo(?! extra)|no cost|at no charge)/iu.test(text),
};

/** "O FlyeeClub Pro só é oferecido por dentro" (decided 2026-10-08): no public text names it. */
export const PRO: CopyRule = {
  name: "FlyeeClub Pro",
  test: (text) => /\bPro\b/.test(text) || /flyee\s?club\s+complet/i.test(text),
};

/** Every rule a text on a public page answers to. */
export const PUBLIC_TEXT_RULES: CopyRule[] = [DASH, EXCLAMATION, EMOJI, WORDS, FREE, PRO];

/** The names of the rules a text breaks, empty when it breaks none. */
export const breaksOf = (text: string, rules: CopyRule[] = PUBLIC_TEXT_RULES): string[] =>
  rules.filter((rule) => rule.test(text)).map((rule) => rule.name);
