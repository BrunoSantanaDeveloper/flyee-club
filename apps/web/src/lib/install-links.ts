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
 * The hosts a Claude Code session in the cloud has to allow for flyee to work
 * (the product's request of 2026-10-20, item 1): the site, which serves this
 * guide and the CLI API, and the package storage while a download URL comes
 * from it. Once packages leave from the platform (`packagesFromPlatform`, the
 * switch of lib/cli/package-host.ts, item 2), the site alone. The session's
 * network reaches only what its environment allows, and only the person can
 * change that list. lib/cli/settings.ts, `cloudHostsNow`, reads the switch.
 */
export function cloudAllowedHosts(packagesFromPlatform = false): string[] {
  const hosts = [new URL(BRAND.siteUrl).host];
  if (packagesFromPlatform) return hosts;
  try {
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (storage) hosts.push(new URL(storage).host);
  } catch {
    // A malformed address names nothing to allow.
  }
  return [...new Set(hosts)];
}

/**
 * A new Claude Code session in the cloud with the request already written: it
 * fills the box and sends nothing. It chooses no environment (decision D3 of
 * 2026-10-20): the session opens in the one the person already uses, which is
 * where they make the network change.
 */
export function cloudSessionUrl(prompt: string): string {
  return `https://claude.ai/code?prompt=${encodeURIComponent(prompt)}`;
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
