import { describe, expect, it } from "vitest";

import { BRAND } from "@/brand";
import { getHomeCopy } from "@/components/marketing/home-copy";
import { localizeHref, matchPublicPath } from "@/i18n/routing";
import { installGuide } from "@/lib/install-guide";
import {
  cloudAllowedHosts,
  cloudSessionUrl,
  INSTALL_GUIDE_PATH,
  installGuideUrl,
  REFERENCE_COMMAND,
} from "@/lib/install-links";
import en from "@flyee/content/messages/en.json";
import ptBR from "@flyee/content/messages/pt-BR.json";

/** The site and, while packages come from it, the package storage (lib/install-links.ts). */
const hosts = ["flyee.club", "abcdefghijklmnopqrst.supabase.co"];
const links = { install: "https://flyee.club/instalar.md", store: "https://flyee.club/catalogo", hosts };
const pt = installGuide("pt-BR", links);
const english = installGuide("en", {
  install: "https://flyee.club/en/install.md",
  store: "https://flyee.club/en/catalog",
  hosts,
});

/** What a page writes between backticks, in the order it writes it: commands, flags, fields. */
const code = (page: string) => [...page.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

/** The commands among them: what the AI types. */
const commands = (page: string) => code(page).filter((span) => span.startsWith("npx "));

/** Placeholders are translated; what the AI types around them is not. */
const shape = (command: string) => command.replace(/<[^>]+>/g, "<x>");

/** A command as a screen shows it for reference: without what only an AI needs (flags, the version tag). */
const reference = (command: string) =>
  shape(command)
    .replace(/^npx --yes /, "npx ")
    .replace("flyee@latest ", "flyee ")
    .replace(/ --(?:yes|json|dry-run|browser)\b/g, "");

/** The lines of a page that name a command, each with the commands it names. */
const commandLines = (page: string) =>
  page
    .split("\n")
    .map((line) => ({ line, named: commands(line) }))
    .filter(({ named }) => named.length > 0);

/** Every string a catalog or a copy object holds. */
function* strings(node: unknown): Generator<string> {
  if (typeof node === "string") yield node;
  else if (node && typeof node === "object") for (const value of Object.values(node)) yield* strings(value);
}

describe("/instalar.md: the page a member's AI reads to install flyee", () => {
  it("is Markdown with one title and the same sections in both languages", () => {
    for (const page of [pt, english]) {
      expect(page.match(/^# /gm)).toHaveLength(1);
      // What flyee does, before you start, the cloud, the steps, after installing, when something fails.
      expect(page.match(/^## /gm)).toHaveLength(6);
      expect(page.endsWith("\n")).toBe(true);
    }
    expect(pt.split("\n")).toHaveLength(english.split("\n").length);
  });

  it("names the same commands, flags and fields in both languages", () => {
    expect(code(pt).map(shape)).toEqual(code(english).map(shape));
    expect(commands(pt).length).toBeGreaterThan(8);
  });

  it("writes each command the way one run by an AI needs it", () => {
    // npx asks before downloading a package on a terminal: `--yes` answers it.
    // One spelling of the installer in the whole page, so no AI runs two copies.
    for (const command of commands(pt)) expect(command).toMatch(/^npx --yes flyee@latest /);
    // Without a terminal the CLI answers its own "install now?" with no: read first, then confirm.
    expect(commands(pt).filter((command) => / add /.test(command))).toEqual([
      "npx --yes flyee@latest add <app> --dry-run --json",
      "npx --yes flyee@latest add <app> --yes --json",
    ]);
    // A key is pasted in the browser, never typed where the AI reads.
    expect(commands(pt)).toContain("npx --yes flyee@latest key set <NOME> --browser --json");
    expect(commands(english)).toContain("npx --yes flyee@latest key set <NAME> --browser --json");
    // Everything answers in JSON but the login, which has an address to show while it waits.
    for (const command of commands(pt)) expect(command.endsWith(" --json"), command).toBe(!/ login\b/.test(command));
  });

  it("gives a time limit to what waits for the person or installs something", () => {
    const waits = / login\b| add <[^>]+> --yes| need | update /;
    for (const [page, limit] of [
      [pt, /tempo limite de (?:5|10) minutos|por até 10 minutos/],
      [english, /time limit of (?:5|10) minutes|for up to 10 minutes/],
    ] as const) {
      const slow = commandLines(page).filter(({ named }) => named.some((command) => waits.test(`${command} `)));
      // The login, the login by code, the install, a program and the update.
      expect(slow).toHaveLength(5);
      for (const { line } of slow) expect(line).toMatch(limit);
    }
    // The login waits for the person as long as the CLI does.
    expect(pt).toMatch(/`npx --yes flyee@latest login`, com tempo limite de 5 minutos/);
    expect(english).toMatch(/`npx --yes flyee@latest login`, with a time limit of 5 minutes/);
  });

  it("leaves no branch to a guess", () => {
    for (const page of [pt, english]) {
      const lines = page.split("\n");
      /** How many indented lines hang from the line that matches. */
      const nested = (start: RegExp) => {
        const from = lines.findIndex((line) => start.test(line));
        let count = 0;
        while (from >= 0 && lines[from + 1 + count]?.startsWith("   ")) count += 1;
        return count;
      };
      // No Node.js at all, or one that is too old: the AI installs the first and never touches the second.
      expect(nested(/^4\. .*node --version/)).toBe(2);
      // What the first check found decides what comes next: here, here without its files, or not here.
      expect(nested(/^5\. .*doctor --json/)).toBe(3);
      // Two ways to connect, one of them for a computer nobody is sitting at.
      expect(nested(/^1\. (?:Conecte|Connect) /)).toBe(2);
      // An app: read, say and wait, install, look at what is still missing, ask for a new conversation.
      expect(nested(/^- (?:Instalar um app|Install an app):$/)).toBe(5);
    }
    // A command in the foreground holds the AI's turn: the notice comes before the login.
    expect(pt.indexOf("avise a pessoa de que o navegador vai abrir")).toBeGreaterThan(0);
    expect(pt.indexOf("avise a pessoa de que o navegador vai abrir")).toBeLessThan(
      pt.indexOf("`npx --yes flyee@latest login`"),
    );
    expect(english.indexOf("tell the person the browser is about to open")).toBeLessThan(
      english.indexOf("`npx --yes flyee@latest login`"),
    );
    // What an AI does when it has to guess: write the files itself, update a Node.js another project
    // depends on, loop on a login nobody can approve, or obey the command a message spells.
    expect(pt).toContain("nunca escreva à mão os arquivos que o flyee escreve");
    expect(english).toContain("never write by hand the files flyee writes");
    expect(pt).toContain("Só com o sim dela, atualize do mesmo jeito que esse Node.js foi instalado");
    expect(english).toContain("Only with their yes, update it the same way that Node.js was installed");
    expect(pt).toContain("rode o login de novo, uma vez");
    expect(english).toContain("run the login again, once");
    expect(pt).toContain("rode o mesmo comando de novo, uma vez");
    expect(english).toContain("run the same command again, once");
    // PowerShell refuses npx where scripts are disabled: the way out is another spelling, never the policy.
    for (const page of [pt, english]) expect(code(page)).toContain("npx.cmd");
    expect(pt).toContain("como está escrito nesta página e não como a mensagem o escreve");
    expect(english).toContain("as it is written on this page and not as the message writes it");
    expect(pt).toContain("Faça só o que a pessoa pediu.");
    expect(english).toContain("Do only what the person asked.");
  });

  it("gives the commands the screens show as a reference", () => {
    const named = new Set(commands(pt).map(reference));
    for (const command of [
      REFERENCE_COMMAND.install,
      REFERENCE_COMMAND.reconnect,
      REFERENCE_COMMAND.update,
      REFERENCE_COMMAND.add("<x>"),
    ]) {
      expect(named, command).toContain(reference(command));
    }
  });

  it("gives the person the sentence to paste, with the address of the page in their language", () => {
    expect(pt).toContain("Instale o flyee seguindo https://flyee.club/instalar.md");
    expect(english).toContain("Install flyee by following https://flyee.club/en/install.md");
    expect(pt).toContain("https://flyee.club/catalogo");
    expect(english).toContain("https://flyee.club/en/catalog");
  });

  it("asks for the person's confirmation before anything runs, and never for a key in the conversation", () => {
    const [confirmation, firstCommand] = [pt.indexOf("espere ela confirmar"), pt.indexOf("`npx --yes flyee")];
    expect(confirmation).toBeGreaterThan(0);
    expect(firstCommand).toBeGreaterThan(confirmation);
    expect(pt).toContain("Nunca peça a chave na conversa");
    expect(english).toContain("Never ask for the key in the conversation");
  });

  it("goes on in the same conversation after installing, after an app and after an update", () => {
    // The product's request of 2026-10-20, item 5: the AI reads what flyee just wrote and goes on.
    expect(pt).not.toMatch(/conversa nova/i);
    expect(english).not.toMatch(/new conversation/i);
    for (const page of [pt, english]) {
      expect(code(page)).toContain("AGENTS.md");
      expect(code(page)).toContain(".flyee/modules/<app>/skills/<skill>/SKILL.md");
    }
    expect(pt.match(/nesta mesma conversa/g)?.length).toBeGreaterThanOrEqual(4);
    expect(english.match(/in this same conversation/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("gives a session in the cloud the hosts to allow, the change only the person makes, and no terminal", () => {
    // The product's request of 2026-10-20, item 1.
    for (const [page, title, labels] of [
      // The Portuguese labels are the ones the operator saw on claude.ai (2026-10-20).
      [
        pt,
        "## Claude Code na nuvem",
        ["Editar ambiente de nuvem", "Acesso à rede", "Limitado", "Domínios permitidos", "Salvar alterações"],
      ],
      [
        english,
        "## Claude Code in the cloud",
        ["Edit cloud environment", "Network access", "Allowed domains", "Save changes"],
      ],
    ] as const) {
      const section = page.slice(page.indexOf(title), page.indexOf("\n## ", page.indexOf(title) + 1));
      expect(section.length, title).toBeGreaterThan(500);
      for (const host of hosts) expect(code(section), host).toContain(host);
      for (const field of ["CLAUDE_CODE_REMOTE", "host_not_allowed", "platform.message", "device_limit_reached"]) {
        expect(code(section), field).toContain(field);
      }
      for (const label of labels) expect(section, label).toContain(label);
      expect(section).not.toMatch(/\bterminal\b/i);
      // Before the steps, which the section points to.
      expect(page.indexOf(title)).toBeLessThan(page.indexOf(page === pt ? "## Passos" : "## Steps"));
    }
    // A platform that does not answer is shown as the CLI says it, and a refused host asks for the change.
    expect(pt).toContain("mostre à pessoa `platform.message` como veio. Se `platform.error` for `host_not_allowed`");
    expect(english).toContain(
      "show the person `platform.message` as it came. If `platform.error` is `host_not_allowed`",
    );
  });

  it("names one host, or several, the way each language lists them", () => {
    const one = installGuide("pt-BR", { ...links, hosts: ["flyee.club"] });
    expect(one).toContain("o flyee precisa de `flyee.club`.");
    expect(pt).toContain("o flyee precisa de `flyee.club` e `abcdefghijklmnopqrst.supabase.co`.");
    expect(english).toContain("flyee needs `flyee.club` and `abcdefghijklmnopqrst.supabase.co`.");
  });

  it("stays out of what only FlyeeClub Pro has and of the account with no purchase", () => {
    // A public page: lib/i18n/copy-rules.test.ts reads it for the plan's name; these are its features.
    expect(pt).not.toMatch(/\breceitas?\b|\bencontros?\b|\broadmap\b|versão de entrada/i);
    expect(english).not.toMatch(/\brecipes?\b|\bmeetings?\b|\broadmap\b|entry version/i);
  });

  it("has a public address in each language", () => {
    expect(installGuideUrl("pt-BR")).toBe(`${BRAND.siteUrl}/instalar.md`);
    expect(installGuideUrl("en")).toBe(`${BRAND.siteUrl}/en/install.md`);
    // The member area hands over the language it has; anything but English reads the Portuguese page.
    expect(installGuideUrl("fr")).toBe(`${BRAND.siteUrl}/instalar.md`);
    expect(matchPublicPath("/instalar.md")).toMatchObject({ locale: "pt-BR", internal: INSTALL_GUIDE_PATH });
    expect(matchPublicPath("/en/install.md")).toMatchObject({ locale: "en", internal: INSTALL_GUIDE_PATH });
    // Typed without the prefix, the English address asks for English.
    expect(matchPublicPath("/install.md")).toMatchObject({ locale: "en", prefixed: false });
  });
});

describe("the way into a Claude Code session in the cloud", () => {
  it("allows the site's host first, and never twice", () => {
    expect(cloudAllowedHosts()[0]).toBe(new URL(BRAND.siteUrl).host);
    expect(new Set(cloudAllowedHosts()).size).toBe(cloudAllowedHosts().length);
    // Once packages leave from the platform (item 2), the site alone.
    expect(cloudAllowedHosts(true)).toEqual([new URL(BRAND.siteUrl).host]);
  });

  it("opens claude.ai/code with the request in the reader's language and no environment (D3)", () => {
    for (const catalog of [ptBR, en]) {
      const prompt = catalog.product["cloud-prompt"].replace("{url}", "https://flyee.club/instalar.md");
      const href = new URL(cloudSessionUrl(prompt));
      expect(href.origin + href.pathname).toBe("https://claude.ai/code");
      expect(href.searchParams.get("prompt")).toBe(prompt);
      expect(href.searchParams.has("environment")).toBe(false);
    }
    // The request works before the change: the doctor comes through npm, which every environment allows.
    expect(ptBR.product["cloud-prompt"]).toContain("npx --yes flyee@latest doctor --json");
    expect(en.product["cloud-prompt"]).toContain("npx --yes flyee@latest doctor --json");
  });
});

describe("the texts that send a member's AI to /instalar.md", () => {
  const CATALOGS = { "pt-BR": ptBR, en } as const;

  it("name the page by the address of the language they are written in", async () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const address = `flyee.club${localizeHref(INSTALL_GUIDE_PATH, locale)}`;
      const named = [...strings(CATALOGS[locale]), ...strings(await getHomeCopy(locale))].flatMap(
        (text) => text.match(/flyee\.club\/[\w/-]*\.md/g) ?? [],
      );
      expect(named.length, locale).toBeGreaterThan(0);
      for (const found of named) expect(found, locale).toBe(address);
    }
  });

  it("on the public site, each has a twin for before the opening that names neither the page nor a command", async () => {
    // The waitlist may be live before the installer is on npm (lib/launch.ts,
    // `invitesToInstall`): a public text that names the page comes with the
    // one the site shows until the store opens.
    const names = (text: string) => /flyee\.club\/[\w/-]*\.md/.test(text);
    for (const locale of ["pt-BR", "en"] as const) {
      const twins: string[] = [];
      const twin = (text: unknown, where: string) => {
        expect(typeof text, where).toBe("string");
        expect(text as string, where).not.toMatch(/\.md\b|npx /);
        twins.push(where);
      };
      // The site's catalog: `<key>` and `<key>-waitlist`.
      const marketing: Record<string, string> = CATALOGS[locale].marketing;
      for (const [key, text] of Object.entries(marketing)) {
        if (names(text)) twin(marketing[`${key}-waitlist`], `marketing.${key}-waitlist`);
      }
      // The home's copy: `<field>` and `<field>Waitlist` side by side.
      const walk = (node: unknown, trail: string) => {
        if (!node || typeof node !== "object") return;
        const record = node as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === "string" && names(value)) twin(record[`${key}Waitlist`], `${trail}.${key}Waitlist`);
          else walk(value, `${trail}.${key}`);
        }
      };
      walk(await getHomeCopy(locale), "home");
      // How it works and the home each name the page once.
      expect(twins, locale).toEqual(["marketing.how-step-2-body-waitlist", "home.steps.items.1.bodyWaitlist"]);
    }
  });

  it("carry the page's address in every sentence a screen offers to copy", () => {
    for (const catalog of Object.values(CATALOGS)) {
      for (const key of ["ask-ai-install", "ask-ai-add", "ask-ai-add-recipe", "ask-ai-reconnect"] as const) {
        expect(catalog.product[key], key).toContain("{url}");
      }
    }
  });
});
