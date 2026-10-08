import { BRAND } from "@/brand";
import { localizeHref } from "@/i18n/routing";

/**
 * The page an AI reads to install flyee (lib/install-guide.ts), by its
 * internal (Portuguese) address. Declared in src/i18n/routing.ts, so it is
 * public and has its English address, /en/install.md.
 */
export const INSTALL_GUIDE_PATH = "/instalar.md";

/**
 * The page's absolute address in a language, the one a member pastes into the
 * conversation with their AI. Every sentence a screen offers ends with it, so
 * the AI finds the commands whether or not flyee is already in the project.
 * Takes the language as the member area has it (cookie or profile); anything
 * but English reads the Portuguese page.
 */
export function installGuideUrl(locale: string): string {
  return `${BRAND.siteUrl}${localizeHref(INSTALL_GUIDE_PATH, locale)}`;
}

/**
 * The command behind each sentence a member gives their AI. The member never
 * types it (docs/PRODUCT.md, 2026-10-08): a screen shows it beside the
 * sentence as a reference, for whoever wants to know what the AI will run.
 * /instalar.md names the same commands with the flags only an AI needs
 * (`npx --yes`, `--json`, `--dry-run`, `--yes`); lib/install-guide.test.ts
 * holds the two together.
 */
export const REFERENCE_COMMAND = {
  install: "npx flyee@latest login",
  reconnect: "npx flyee login",
  update: "npx flyee update",
  add: (slug: string) => `npx flyee add ${slug}`,
  addRecipe: (slug: string) => `npx flyee add receita:${slug}`,
} as const;
