import { breaksOf } from "@/lib/i18n/copy-rules";

/**
 * The example of an app answering a request (decided 2026-10-17): the RESULT
 * of the app, never the command that installs it. Each app carries its own,
 * per language, in `catalog_modules.showcase` (migration 0043), written by the
 * product and sent in its index (docs/CLI-CONTRACT.md, 10.1). <AppShowcase>
 * shows it on the home, on /catalogo and on the app's page.
 *
 *   { "pt-BR": { request, reply: [{ label?, text }], saved? }, "en": { … } }
 *
 * The import holds every text to the copy rules before it is stored; the
 * public pages check again when they read, so a row written another way can
 * never put a broken text on a page.
 */

export type ShowcaseLocale = "pt-BR" | "en";
export const SHOWCASE_LOCALES: readonly ShowcaseLocale[] = ["pt-BR", "en"];

/** One line of the reply: a short label (a scene and its time, "Gancho · 0:00") and what it says. */
export type ExampleLine = { label?: string; text: string };
export type AppExample = { request: string; reply: ExampleLine[]; saved?: string };
export type Showcase = Partial<Record<ShowcaseLocale, AppExample>>;

export const EXAMPLE_LIMITS = { request: 400, lines: 8, label: 40, text: 280, saved: 160 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One language's example: the example, or every reason it cannot be shown. */
export function checkExample(value: unknown): { example: AppExample; problems: [] } | { problems: string[] } {
  if (!isRecord(value)) return { problems: ["must be an object with request and reply"] };
  const problems: string[] = [];
  const text = (field: string, raw: unknown, max: number): string | null => {
    const found = typeof raw === "string" ? raw.trim() : "";
    if (!found || found.length > max) {
      problems.push(`${field}: must be a text of 1 to ${max} characters`);
      return null;
    }
    const broken = breaksOf(found);
    if (broken.length > 0) {
      problems.push(`${field}: breaks the copy rules (${broken.join(", ")})`);
      return null;
    }
    return found;
  };

  const request = text("request", value.request, EXAMPLE_LIMITS.request);
  const reply: ExampleLine[] = [];
  if (!Array.isArray(value.reply) || value.reply.length === 0 || value.reply.length > EXAMPLE_LIMITS.lines) {
    problems.push(`reply: 1 to ${EXAMPLE_LIMITS.lines} lines`);
  } else {
    value.reply.forEach((line, index) => {
      if (!isRecord(line)) {
        problems.push(`reply[${index}]: must be an object with text`);
        return;
      }
      const label =
        line.label === undefined ? undefined : text(`reply[${index}].label`, line.label, EXAMPLE_LIMITS.label);
      const said = text(`reply[${index}].text`, line.text, EXAMPLE_LIMITS.text);
      if (said && label !== null) reply.push(label ? { label, text: said } : { text: said });
    });
  }
  const saved = value.saved === undefined ? undefined : text("saved", value.saved, EXAMPLE_LIMITS.saved);

  if (problems.length > 0 || !request) return { problems };
  return { example: { request, reply, ...(saved ? { saved } : {}) }, problems: [] };
}

/** Every language of a showcase, each checked on its own: one broken language never hides the other. */
export function readShowcase(value: unknown): { showcase: Showcase; problems: string[] } {
  const showcase: Showcase = {};
  const problems: string[] = [];
  if (value === undefined || value === null) return { showcase, problems };
  if (!isRecord(value)) return { showcase, problems: ['must be an object by language ("pt-BR", "en")'] };
  for (const locale of SHOWCASE_LOCALES) {
    if (value[locale] === undefined) continue;
    const checked = checkExample(value[locale]);
    if ("example" in checked) showcase[locale] = checked.example;
    else problems.push(...checked.problems.map((problem) => `${locale}.${problem}`));
  }
  return { showcase, problems };
}

/**
 * The example in the language of the address and only in it: an English page
 * never shows the Portuguese example (docs/SEO.md). Null when the app has none
 * there, and the page shows what the app does instead.
 */
export function exampleIn(value: unknown, locale: ShowcaseLocale): AppExample | null {
  return readShowcase(value).showcase[locale] ?? null;
}
