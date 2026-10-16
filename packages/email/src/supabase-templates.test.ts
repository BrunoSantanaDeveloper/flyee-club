import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emailCopyFor } from "./copy";
import { AUTH_EMAIL_KINDS, supabaseSubject, supabaseTemplate } from "./supabase-templates";

const SUPABASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../supabase");

/** The Go template actions a file may hold: the language branch, the fields Supabase fills in and the note. */
const ALLOWED_ACTIONS = new Set([
  '{{ if eq (printf "%v" .Data.locale) "en" -}}',
  "{{- else -}}",
  "{{- end }}",
  "{{ .ConfirmationURL }}",
  "{{ .SiteURL }}",
  "{{ .Email }}",
  "{{ .NewEmail }}",
]);

/**
 * The three messages Supabase Auth sends are rendered from templates/auth.tsx,
 * so they keep the frame of every other e-mail. These tests fail when a file
 * under supabase/templates/ is not what the source renders today: run
 * `npm run supabase:templates -w @flyee/email` to write them again.
 */
describe("the Supabase Auth templates", () => {
  for (const kind of AUTH_EMAIL_KINDS) {
    it(`supabase/templates/${kind}.html is what templates/auth.tsx renders`, async () => {
      await expect(await supabaseTemplate(kind)).toMatchFileSnapshot(`../../../supabase/templates/${kind}.html`);
    });
  }

  it("hold both languages, the fields as Supabase reads them and nothing else in braces", async () => {
    for (const kind of AUTH_EMAIL_KINDS) {
      const file = await supabaseTemplate(kind);
      const body = file.slice(file.indexOf("*/ -}}") + "*/ -}}".length);
      expect(body.match(/\{\{[\s\S]*?\}\}/g)?.filter((action) => !ALLOWED_ACTIONS.has(action)) ?? [], kind).toEqual([]);
      expect(body.match(/\{\{ if /g), kind).toHaveLength(1);
      expect(body.match(/\{\{- end \}\}/g), kind).toHaveLength(1);
      expect(body, kind).toContain('lang="en"');
      expect(body, kind).toContain('lang="pt-BR"');
      expect(body, kind).toContain('href="{{ .ConfirmationURL }}"');
      expect(body, kind).toContain('src="{{ .SiteURL }}/images/email/logo.png"');
      expect(body.includes("{{ .NewEmail }}"), kind).toBe(kind === "email_change");
      // The pretty print wraps long sentences: compare them on one line.
      const oneLine = body.replace(/\s+/g, " ");
      for (const locale of ["pt-BR", "en"] as const) {
        expect(oneLine, `${kind} ${locale}`).toContain(emailCopyFor(locale).shell.fallback);
      }
    }
  });

  it("config.toml wires each file with its subject in both languages", () => {
    const toml = fs.readFileSync(path.join(SUPABASE, "config.toml"), "utf8");
    for (const kind of AUTH_EMAIL_KINDS) {
      const block = toml.split(`[auth.email.template.${kind}]`)[1]?.split("\n[")[0] ?? "";
      expect(block, kind).toContain(`subject = '${supabaseSubject(kind)}'`);
      expect(block, kind).toContain(`content_path = "./supabase/templates/${kind}.html"`);
    }
  });
});
