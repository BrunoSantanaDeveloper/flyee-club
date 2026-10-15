#!/usr/bin/env node
// Environment preflight: what a deployment's variables have to hold before the
// waitlist goes up or the store opens (docs/DEPLOY.md, "Roteiro da abertura").
//
//   node scripts/preflight-env.mjs [--stage waitlist|open] [--target production|preview]
//                                  [--file <env file>] [--json]
//
// Without --file it reads what Next.js and the database gate read on this
// machine: apps/web/.env.local over apps/web/.env, where the FIRST file that
// defines a key decides it, an empty value included. With --file it reads one
// file, for instance what `vercel env pull` wrote. Vercel keeps a Secret
// write-only, so in that file its value does not come back: the name is
// confirmed and what it holds is reported as not read (?), never as wrong.
//
// It reads files and nothing else: no network, no database, no account. It
// never prints a value that could be a credential, only names and what is
// wrong with them. A check that needs an account (the DNS, the webhooks, the
// Supabase Auth addresses) is a step of the runbook, not of this script.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The address the site's own copy names ("flyee.club/instalar.md"). */
const CANONICAL_HOST = "flyee.club";

export const STAGES = ["waitlist", "open"];
export const TARGETS = ["production", "preview"];

/** Every variable the platform reads (apps/web/.env.example is the reference). */
const KNOWN = new Set([
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STORAGE_PREFIX",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "ASAAS_BASE_URL",
  "BILLING_PIX_ENABLED",
  "BILLING_BRL_PROVIDER",
  "NEXT_PUBLIC_META_PIXEL_ID",
  "NEXT_PUBLIC_GA4_ID",
  "GA4_API_SECRET",
  "META_CAPI_TOKEN",
  "META_CAPI_TEST_EVENT_CODE",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "BACKUP_RETENTION_DAYS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CONTACT_FORM_TO",
  "PUBLIC_FORMS_IP_SALT",
  "MODULE_UPLOAD_MAX_MB",
]);

/** What the host, the runner or a tool sets by itself: never a leftover. */
const TOOLING = /^(?:VERCEL|NEXT_PUBLIC_VERCEL_|NX_|TURBO_|NODE_|NEXT_RUNTIME$|CI$|PORT$|FLYEE_|PLAYWRIGHT_|npm_)/u;

/**
 * Variables only the MedChina code read. Their presence is how the copy of
 * its .env is recognised (CLAUDE.md, "Safety during the transition"): once
 * apps/web/.env is rewritten from .env.example they are gone, and so are the
 * checks that depend on them.
 */
const INHERITED_MARKERS = /^(?:WHATSAPP_|EVOLUTION_|NEXT_PUBLIC_POSTHOG_)/u;

/**
 * Inherited values that name no service of the other product, so they stop
 * nothing: the address the contact form writes to, and plain settings.
 */
const SHARED_WHEN_INHERITED = new Set(["CONTACT_FORM_TO"]);
const SETTINGS_WHEN_INHERITED = new Set([
  "NEXT_PUBLIC_STORAGE_PREFIX",
  "ASAAS_BASE_URL",
  "OPENAI_BASE_URL",
  "BACKUP_RETENTION_DAYS",
  "MODULE_UPLOAD_MAX_MB",
  "BILLING_PIX_ENABLED",
]);

/** How much an inherited value under this name matters, and what to say about it. */
function inheritedFinding(key, where) {
  if (SETTINGS_WHEN_INHERITED.has(key)) {
    return [
      "note",
      `${where}: a plain setting, harmless, but define it in .env.local so nothing is read from the copy`,
    ];
  }
  if (SHARED_WHEN_INHERITED.has(key)) {
    return ["warning", `${where}: confirm it is yours to use here, then define it in .env.local`];
  }
  return null;
}

const ASAAS_PRODUCTION = "https://api.asaas.com/v3";

/** The first line of a file `vercel env pull` wrote. */
const VERCEL_HEADER = "# Created by Vercel CLI";

/**
 * What stands where a value did not come back. Vercel keeps a Secret
 * write-only after saving, and its CLI writes "[SENSITIVE]" in the pulled file
 * (read in 59.1.4 and 63.1.0; 54.6.1 and older leave the value empty, which
 * only the header of a pulled file tells apart from a variable saved empty).
 */
const UNREAD_MARK = /^\[[A-Z][A-Z _-]*\]$/u;

/** The text without the byte order mark some editors write first. */
const withoutMark = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/** Whether an env file was written by `vercel env pull`. */
export function pulledFromVercel(text) {
  return withoutMark(text).startsWith(VERCEL_HEADER);
}

/**
 * A dotenv file as Next.js reads it, closely enough to judge it: KEY=value,
 * `export KEY=value`, quotes, and a `#` that ends an unquoted value wherever it
 * stands.
 *
 * `bareDollar` says the value holds a `$` right before a name. Next.js expands
 * it, inside either kind of quotes too, and a name that is not defined expands
 * to nothing: an Asaas key written without its backslash reads empty, and a
 * database password is cut at its dollar sign. Checked against @next/env on
 * 2026-10-08; `value` is what was written, with `\$` as the `$` it stands for.
 */
export function parseEnv(text) {
  const entries = new Map();
  for (const rawLine of withoutMark(text).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    let raw;
    if (rest.startsWith('"')) {
      const end = rest.lastIndexOf('"');
      raw = (end > 0 ? rest.slice(1, end) : rest.slice(1)).replace(/\\n/gu, "\n").replace(/\\"/gu, '"');
    } else if (rest.startsWith("'")) {
      const end = rest.indexOf("'", 1);
      raw = end > 0 ? rest.slice(1, end) : rest.slice(1);
    } else {
      raw = rest.replace(/#.*$/u, "").trim();
    }
    entries.set(key, {
      value: raw.replace(/\\\$/gu, "$"),
      bareDollar: /(?:^|[^\\])\$[A-Za-z0-9_{]/u.test(raw),
    });
  }
  return entries;
}

/** Several files as one environment: the first that defines a key decides it, empty included. */
export function layerEnv(files) {
  const env = new Map();
  for (const file of files) {
    for (const [key, entry] of file.entries) {
      if (!env.has(key)) env.set(key, { ...entry, source: file.name });
    }
  }
  return env;
}

/** Whether a parsed file is still the copy of the MedChina environment. */
export function looksInherited(entries) {
  return entries ? [...entries.keys()].some((key) => INHERITED_MARKERS.test(key)) : false;
}

const hashOf = (value) => createHash("sha256").update(value).digest("hex");

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** The project a Supabase address names: its reference, null for a custom domain, undefined when it is no address. */
function supabaseRef(value) {
  const url = parseUrl(value);
  if (!url) return undefined;
  return /^([a-z0-9]{12,})\.supabase\.(?:co|in|net)$/u.exec(url.hostname)?.[1] ?? null;
}

/** What kind of Supabase key a value is, and the project it belongs to, without trusting the variable's name. */
function supabaseKey(value) {
  if (value.startsWith("sb_publishable_")) return { kind: "public" };
  if (value.startsWith("sb_secret_")) return { kind: "secret" };
  const parts = value.split(".");
  if (parts.length !== 3) return { kind: "unknown" };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.role === "anon") return { kind: "public", ref: payload.ref ?? null };
    if (payload.role === "service_role") return { kind: "secret", ref: payload.ref ?? null };
    return { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

function databaseUrl(value) {
  if (/YOUR-PASSWORD/iu.test(value)) return { problem: "placeholder" };
  const url = parseUrl(value);
  if (!url) return { problem: "unparseable" };
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return { problem: "protocol" };
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/u.exec(host);
  const pooler = host.endsWith(".pooler.supabase.com");
  let user = url.username;
  try {
    user = decodeURIComponent(url.username);
  } catch {
    // an undecodable user name names no project
  }
  return {
    local: ["127.0.0.1", "localhost", "::1", "host.docker.internal"].includes(host),
    pooled: pooler && url.port === "6543",
    supabase: pooler || Boolean(direct),
    ref: direct ? direct[1] : pooler ? (user.split(".")[1] ?? null) : null,
  };
}

/** Whether two domains belong together: the same one, or one inside the other. */
const relatedDomains = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

/** The address inside `Name <user@host>` or a bare `user@host`. */
function mailDomain(value) {
  const address = /<([^>]+)>/u.exec(value)?.[1] ?? value;
  return /^[^\s@]+@([^\s@]+\.[^\s@]+)$/u.exec(address.trim())?.[1]?.toLowerCase() ?? null;
}

const isPositiveInteger = (value) => /^[1-9]\d*$/u.test(value);

/**
 * Judges an environment for a stage of the launch and a kind of deployment.
 *
 * `env` maps a name to `{ value, source?, bareDollar? }`. `stage` is what the
 * deployment is for: "waitlist" (the list and the legal pages; nothing is on
 * sale) or "open" (the store sells). `target` is "production" or "preview": a
 * preview is expected to hold sandbox and test keys, and live ones are the
 * finding there.
 *
 * `inherited`, when given, is the parsed apps/web/.env of this machine while
 * it is still the MedChina copy: no value of it may reach a flyee.club
 * deployment. `layeredOver` names that file when `env` was layered over it.
 *
 * `pulled` says the file was written by `vercel env pull`. There a name that
 * is set and whose value did not come back is "unread": a finding of its own
 * level, which never stops a stage and never passes for a checked value.
 *
 * `nextReads` says these are the files Next.js itself reads on this machine,
 * where a `$` before a name is expanded and the app gets another value than
 * the one written.
 */
export function inspect(
  env,
  {
    stage = "open",
    target = "production",
    inherited = null,
    layeredOver = null,
    pulled = false,
    nextReads = false,
  } = {},
) {
  const findings = [];
  const add = (level, group, key, message) => findings.push({ level, group, key, message });
  const raw = (key) => (env.get(key)?.value ?? "").trim();
  const marked = (key) => UNREAD_MARK.test(raw(key));
  /** Set on Vercel, and the value did not come back. */
  const unread = (key) => pulled && env.has(key) && (marked(key) || raw(key) === "");
  /** The value as far as it can be read, and whether the name is set at all. */
  const get = (key) => (unread(key) ? "" : raw(key));
  const has = (key) => unread(key) || raw(key) !== "";
  /** Reports a value that did not come back, with what stayed unchecked because of it. */
  const skip = (group, key, unchecked = null) => {
    if (!marked(key)) {
      add("unread", group, key, `came back empty. Not checked: ${unchecked ?? "that it holds a value"}`);
    } else if (unchecked) {
      add("unread", group, key, `a Secret on Vercel, set and not read. Not checked: ${unchecked}`);
    } else {
      add("ok", group, key, "set (a Secret on Vercel)");
    }
  };
  const production = target === "production";
  const open = stage === "open";

  // ---- Site
  {
    const group = "Site";
    const key = "NEXT_PUBLIC_SITE_URL";
    const url = parseUrl(get(key));
    // The one value the local files leave to Vercel: the address of the site
    // is this machine while working here, and the run on what `vercel env
    // pull` wrote is where it is held to the site's.
    const local = nextReads && (!has(key) || ["localhost", "127.0.0.1"].includes(url?.hostname ?? ""));
    if (local) {
      add(
        "note",
        group,
        key,
        `${has(key) ? "names this machine" : "not set here"}: right for local work. On Vercel it is https://${CANONICAL_HOST}, checked with --file on what vercel env pull wrote`,
      );
    } else if (!has(key)) {
      add(
        "error",
        group,
        key,
        "missing: canonical, sitemap, e-mail links and /instalar.md fall back to http://localhost:3000",
      );
    } else if (unread(key)) {
      skip(group, key, "that it is the https origin of the site");
    } else if (!url) {
      add("error", group, key, "not an address");
    } else if (get(key).endsWith("/") || url.pathname !== "/" || url.search || url.hash) {
      add("error", group, key, "must be the origin alone, without a trailing slash or a path");
    } else if (["localhost", "127.0.0.1"].includes(url.hostname)) {
      add("error", group, key, "names this machine: every link the site prints would lead nowhere");
    } else if (url.protocol !== "https:") {
      add("error", group, key, "must be https");
    } else if (production && url.hostname !== CANONICAL_HOST) {
      add(
        "warning",
        group,
        key,
        `${url.hostname} is not ${CANONICAL_HOST}: the site's copy tells people to follow ${CANONICAL_HOST}/instalar.md`,
      );
    } else {
      add("ok", group, key, get(key));
    }
  }

  // ---- Supabase
  {
    const group = "Supabase";
    const ref = supabaseRef(get("NEXT_PUBLIC_SUPABASE_URL"));
    if (!has("NEXT_PUBLIC_SUPABASE_URL")) {
      add(
        "error",
        group,
        "NEXT_PUBLIC_SUPABASE_URL",
        "missing: without it the whole site is browsable and nothing signs in",
      );
    } else if (unread("NEXT_PUBLIC_SUPABASE_URL")) {
      skip(group, "NEXT_PUBLIC_SUPABASE_URL", "the project it names, so no key is matched against it");
    } else if (ref === undefined) {
      add("error", group, "NEXT_PUBLIC_SUPABASE_URL", "not an address");
    } else if (ref === null) {
      add(
        "note",
        group,
        "NEXT_PUBLIC_SUPABASE_URL",
        "a custom domain: the project cannot be told from it, so the keys are not matched against it",
      );
    } else {
      add("ok", group, "NEXT_PUBLIC_SUPABASE_URL", "a Supabase project address");
    }

    for (const [key, wanted, why] of [
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "public", "missing: nobody signs in"],
      ["SUPABASE_SERVICE_ROLE_KEY", "secret", "missing: the consoles, the CLI API, the webhooks and the backups fail"],
    ]) {
      if (!has(key)) {
        add("error", group, key, why);
        continue;
      }
      if (unread(key)) {
        skip(group, key, `that it is the ${wanted === "public" ? "public" : "service role"} key of this project`);
        continue;
      }
      const found = supabaseKey(get(key));
      if (found.kind === "unknown") {
        add("warning", group, key, "does not look like a Supabase key");
      } else if (found.kind !== wanted) {
        add(
          "error",
          group,
          key,
          wanted === "public"
            ? "holds a SERVICE ROLE key: a NEXT_PUBLIC variable ships to every browser, and this key bypasses every policy"
            : "holds the anon key: the service role key goes here",
        );
      } else if (ref && found.ref && found.ref !== ref) {
        add("error", group, key, "belongs to another Supabase project than NEXT_PUBLIC_SUPABASE_URL");
      } else {
        add("ok", group, key, `a ${wanted === "public" ? "public" : "service role"} key`);
      }
    }

    const key = "DATABASE_URL";
    if (!has(key)) {
      add("error", group, key, "missing: the backups and the migration gate have no database");
    } else if (unread(key)) {
      skip(group, key, "the pooled address on port 6543, its project and its password");
    } else {
      const db = databaseUrl(get(key));
      if (db.problem === "placeholder") {
        add("error", group, key, "still holds the [YOUR-PASSWORD] placeholder of the dashboard");
      } else if (db.problem === "unparseable") {
        add("error", group, key, "not an address: a password with special characters must be percent-encoded");
      } else if (db.problem === "protocol") {
        add("error", group, key, "must use the postgres or postgresql protocol");
      } else if (db.local) {
        add("error", group, key, "names a database on this machine");
      } else if (ref && db.ref && db.ref !== ref) {
        add("error", group, key, "belongs to another Supabase project than NEXT_PUBLIC_SUPABASE_URL");
      } else if (db.supabase && !db.pooled) {
        add(
          "warning",
          group,
          key,
          "not the pooled string on port 6543 (transaction mode): serverless functions run out of direct connections",
        );
      } else {
        add("ok", group, key, db.supabase ? "the pooled connection string" : "a remote database");
      }
    }
  }

  // ---- E-mail
  {
    const group = "E-mail";
    if (!has("RESEND_API_KEY")) {
      add(
        production ? "error" : "warning",
        group,
        "RESEND_API_KEY",
        open
          ? "missing: no welcome, no receipt, no connection reminder, and the waitlist form answers that the list is off"
          : "missing: nobody can confirm the waitlist, and the form answers that the list is off",
      );
    } else if (unread("RESEND_API_KEY")) {
      skip(group, "RESEND_API_KEY", "that it is a Resend key (re_…)");
    } else if (!get("RESEND_API_KEY").startsWith("re_")) {
      add("warning", group, "RESEND_API_KEY", "does not look like a Resend key (re_…)");
    } else {
      add("ok", group, "RESEND_API_KEY", "set");
    }

    const from = get("EMAIL_FROM");
    const site = parseUrl(get("NEXT_PUBLIC_SITE_URL"))?.hostname.replace(/^www\./u, "") ?? null;
    if (unread("EMAIL_FROM")) {
      skip(group, "EMAIL_FROM", "the sender and that its domain is the site's");
    } else if (!from) {
      add(
        has("RESEND_API_KEY") || production ? "error" : "warning",
        group,
        "EMAIL_FROM",
        "missing: messages leave from onboarding@resend.dev, which only reaches the owner of the Resend account",
      );
    } else if (!mailDomain(from)) {
      add("error", group, "EMAIL_FROM", 'not a sender: write "Name <address@domain>" or the address alone');
    } else if (production && site && !relatedDomains(mailDomain(from), site)) {
      // A preview's address says nothing about the domain verified at Resend.
      add(
        "warning",
        group,
        "EMAIL_FROM",
        `${from}: its domain is not the site's (${site}); it has to be the one verified at Resend`,
      );
    } else {
      add("ok", group, "EMAIL_FROM", from);
    }

    if (unread("CONTACT_FORM_TO")) {
      skip(group, "CONTACT_FORM_TO", "that it is an e-mail address");
    } else if (!has("CONTACT_FORM_TO")) {
      add(
        "warning",
        group,
        "CONTACT_FORM_TO",
        "missing: the contact form is delivered to EMAIL_FROM, usually an address nobody reads",
      );
    } else if (!mailDomain(get("CONTACT_FORM_TO"))) {
      add("error", group, "CONTACT_FORM_TO", "not an e-mail address");
    } else {
      add("ok", group, "CONTACT_FORM_TO", get("CONTACT_FORM_TO"));
    }
  }

  // ---- Jobs
  {
    const group = "Jobs (Inngest)";
    const [event, signing] = [has("INNGEST_EVENT_KEY"), has("INNGEST_SIGNING_KEY")];
    if (!event && !signing) {
      add(
        production ? "error" : "warning",
        group,
        "INNGEST_EVENT_KEY",
        "both Inngest keys are missing: nothing scheduled runs (reminders, summaries, the end of a paid term, the cleanups)",
      );
    } else if (event !== signing) {
      add(
        "error",
        group,
        event ? "INNGEST_SIGNING_KEY" : "INNGEST_EVENT_KEY",
        "missing while the other Inngest key is set: jobs need both",
      );
    } else {
      if (unread("INNGEST_EVENT_KEY")) skip(group, "INNGEST_EVENT_KEY");
      else add("ok", group, "INNGEST_EVENT_KEY", "set");
      const key = get("INNGEST_SIGNING_KEY");
      if (unread("INNGEST_SIGNING_KEY")) {
        skip(
          group,
          "INNGEST_SIGNING_KEY",
          production
            ? "that it is the signing key of the production environment (signkey-prod-…)"
            : "that it is a signing key (signkey-…)",
        );
      } else if (!key.startsWith("signkey-")) {
        add("warning", group, "INNGEST_SIGNING_KEY", "does not look like an Inngest signing key (signkey-…)");
      } else if (production && !key.startsWith("signkey-prod-")) {
        add("warning", group, "INNGEST_SIGNING_KEY", "not the key of the production environment (signkey-prod-…)");
      } else if (!production && key.startsWith("signkey-prod-")) {
        add(
          "warning",
          group,
          "INNGEST_SIGNING_KEY",
          "the key of the production environment in a preview: what this deployment sends runs the production jobs. Leave both keys empty here, or use a branch environment's",
        );
      } else {
        add("ok", group, "INNGEST_SIGNING_KEY", "set");
      }
    }
  }

  // ---- Public forms
  {
    const group = "Public forms";
    const salt = get("PUBLIC_FORMS_IP_SALT");
    if (unread("PUBLIC_FORMS_IP_SALT")) {
      skip(group, "PUBLIC_FORMS_IP_SALT", "that it is 32 characters or longer");
    } else if (!salt) {
      add(
        production ? "error" : "warning",
        group,
        "PUBLIC_FORMS_IP_SALT",
        "missing: the waitlist has no limit per network",
      );
    } else if (salt.length < 32) {
      add("warning", group, "PUBLIC_FORMS_IP_SALT", "shorter than 32 characters: use a long random string");
    } else {
      add("ok", group, "PUBLIC_FORMS_IP_SALT", "set");
    }
  }

  // ---- Billing
  {
    const group = "Billing";
    // BRL goes through Asaas unless BILLING_BRL_PROVIDER names Stripe (decided
    // 2026-10-12: Stripe charges everything until Asaas is set up), and
    // FlyeeClub, the plan every button sells, is priced in BRL. The rule is
    // parseBrlProvider in packages/billing/src/currency.ts: empty is Asaas,
    // anything but the two names closes the till in reais.
    const brlValue = get("BILLING_BRL_PROVIDER").trim().toLowerCase();
    const brlProvider = brlValue === "" ? "asaas" : brlValue === "asaas" || brlValue === "stripe" ? brlValue : null;
    if (unread("BILLING_BRL_PROVIDER")) {
      skip(group, "BILLING_BRL_PROVIDER", "which provider charges reais");
    } else if (brlProvider === null) {
      add(
        "error",
        group,
        "BILLING_BRL_PROVIDER",
        "neither asaas nor stripe: nothing priced in BRL can be bought, FlyeeClub included",
      );
    } else if (brlProvider === "stripe") {
      add(
        "note",
        group,
        "BILLING_BRL_PROVIDER",
        "stripe: reais go through Stripe, with no card installments, PIX only if it is on in Stripe's dashboard, and the NFS-e issued outside the platform",
      );
    }
    const brlOnStripe = brlProvider === "stripe";

    const asaas = get("ASAAS_API_KEY");
    const base = get("ASAAS_BASE_URL").replace(/\/+$/u, "");
    const liveBase = base === ASAAS_PRODUCTION;
    const sandboxBase = base === "" || /sandbox/iu.test(base);
    const liveKey = asaas.startsWith("$aact_prod_");
    const sandboxKey = asaas.startsWith("$aact_hmlg_");
    if (!has("ASAAS_API_KEY")) {
      add(
        open && !brlOnStripe ? "error" : "note",
        group,
        "ASAAS_API_KEY",
        brlOnStripe
          ? "not set: not needed while BILLING_BRL_PROVIDER=stripe"
          : open
            ? "missing: nothing priced in BRL can be bought, FlyeeClub included"
            : "not set: nothing is on sale at this stage",
      );
    } else {
      if (!has("ASAAS_WEBHOOK_TOKEN")) {
        add(
          "error",
          group,
          "ASAAS_WEBHOOK_TOKEN",
          "missing: the webhook refuses every call, so a paid purchase never grants its access",
        );
      } else if (unread("ASAAS_WEBHOOK_TOKEN")) {
        skip(group, "ASAAS_WEBHOOK_TOKEN");
      } else {
        add("ok", group, "ASAAS_WEBHOOK_TOKEN", "set");
      }
      if (!unread("ASAAS_BASE_URL") && !sandboxBase && !liveBase) {
        add(
          "warning",
          group,
          "ASAAS_BASE_URL",
          `${base}: neither the production address (${ASAAS_PRODUCTION}) nor the sandbox`,
        );
      }
      if (unread("ASAAS_API_KEY") || unread("ASAAS_BASE_URL")) {
        // Half of the pair did not come back: each half is judged alone.
        if (unread("ASAAS_API_KEY")) {
          skip(group, "ASAAS_API_KEY", "whether it is the production key or the sandbox one");
        } else if (production && open && sandboxKey) {
          add(
            "error",
            group,
            "ASAAS_API_KEY",
            "a sandbox key ($aact_hmlg_…): the open store sells with the production key",
          );
        } else if (!production && liveKey) {
          add(
            "warning",
            group,
            "ASAAS_API_KEY",
            "a production key in a preview: a test purchase there charges real money",
          );
        } else {
          add("ok", group, "ASAAS_API_KEY", liveKey ? "a production key" : sandboxKey ? "a sandbox key" : "set");
        }
        if (unread("ASAAS_BASE_URL")) {
          skip(group, "ASAAS_BASE_URL", `whether it is the production address (${ASAAS_PRODUCTION}) or the sandbox`);
        } else if (production && open && !liveBase) {
          add(
            "error",
            group,
            "ASAAS_BASE_URL",
            `${base || "empty"}: charges go to the sandbox and nobody pays; production is ${ASAAS_PRODUCTION}`,
          );
        } else if (!production && liveBase) {
          add(
            "warning",
            group,
            "ASAAS_BASE_URL",
            "the production address in a preview: a test purchase there charges real money",
          );
        } else if (sandboxBase || liveBase) {
          add("ok", group, "ASAAS_BASE_URL", base || "empty: the sandbox");
        }
      } else if (production && open) {
        if (!liveBase) {
          add(
            "error",
            group,
            "ASAAS_BASE_URL",
            `${base || "empty"}: charges go to the sandbox and nobody pays; production is ${ASAAS_PRODUCTION}`,
          );
        } else if (sandboxKey) {
          add(
            "error",
            group,
            "ASAAS_API_KEY",
            "a sandbox key ($aact_hmlg_…) against the production address: every charge is refused",
          );
        } else {
          add(
            "ok",
            group,
            "ASAAS_API_KEY",
            liveKey ? "a production key" : "set (an older key format: confirm it is the production one)",
          );
          add("ok", group, "ASAAS_BASE_URL", base);
        }
      } else if (!production && (liveBase || liveKey)) {
        add(
          "warning",
          group,
          "ASAAS_API_KEY",
          "production Asaas in a preview: a test purchase there charges real money",
        );
      } else if (liveBase && sandboxKey) {
        add(
          "error",
          group,
          "ASAAS_API_KEY",
          "a sandbox key ($aact_hmlg_…) against the production address: every charge is refused",
        );
      } else if (sandboxBase && liveKey) {
        add(
          "error",
          group,
          "ASAAS_BASE_URL",
          "empty or sandbox while the key is a production one: every charge is refused",
        );
      } else {
        add("ok", group, "ASAAS_API_KEY", liveKey ? "a production key" : sandboxKey ? "a sandbox key" : "set");
      }
    }

    // USD goes through Stripe: the English site sells the same access in USD.
    // With reais on Stripe too, it is the one provider the store has.
    const stripe = get("STRIPE_SECRET_KEY");
    if (!has("STRIPE_SECRET_KEY")) {
      add(
        open ? (brlOnStripe ? "error" : "warning") : "note",
        group,
        "STRIPE_SECRET_KEY",
        open
          ? brlOnStripe
            ? "missing: nothing can be bought, FlyeeClub in BRL included, while BILLING_BRL_PROVIDER=stripe"
            : "missing: nothing priced in USD can be bought, so /en sells nothing"
          : "not set: nothing is on sale at this stage",
      );
    } else {
      const live = /^(?:sk|rk)_live_/u.test(stripe);
      const test = /^(?:sk|rk)_test_/u.test(stripe);
      if (unread("STRIPE_SECRET_KEY")) {
        skip(group, "STRIPE_SECRET_KEY", "whether it is a live key or a test one");
      } else if (!live && !test) {
        add("warning", group, "STRIPE_SECRET_KEY", "does not look like a Stripe secret key (sk_live_… or sk_test_…)");
      } else if (production && open && test) {
        add(
          "error",
          group,
          "STRIPE_SECRET_KEY",
          "a test key: a purchase through Stripe would grant the access and charge nothing",
        );
      } else if (!production && live) {
        add("warning", group, "STRIPE_SECRET_KEY", "a live key in a preview: a test purchase there charges real money");
      } else {
        add("ok", group, "STRIPE_SECRET_KEY", live ? "a live key" : "a test key");
      }
      const secret = get("STRIPE_WEBHOOK_SECRET");
      if (unread("STRIPE_WEBHOOK_SECRET")) {
        skip(group, "STRIPE_WEBHOOK_SECRET", "that it is a signing secret (whsec_…)");
      } else if (!secret) {
        add(
          "error",
          group,
          "STRIPE_WEBHOOK_SECRET",
          "missing: the webhook refuses every call, so a paid purchase never grants its access",
        );
      } else if (!secret.startsWith("whsec_")) {
        add("warning", group, "STRIPE_WEBHOOK_SECRET", "does not look like a Stripe signing secret (whsec_…)");
      } else {
        add("ok", group, "STRIPE_WEBHOOK_SECRET", "set");
      }
    }

    const pix = get("BILLING_PIX_ENABLED").toLowerCase();
    if (pix === "false") add("note", group, "BILLING_PIX_ENABLED", "false: the checkout never offers Pix");
    else if (pix !== "" && pix !== "true")
      add(
        "warning",
        group,
        "BILLING_PIX_ENABLED",
        `"${get("BILLING_PIX_ENABLED")}" is read as empty: only "false" switches Pix off`,
      );
  }

  // ---- Trackers
  {
    const group = "Trackers";
    // An id is public and comes back; `has` also counts one that did not.
    const pixel = get("NEXT_PUBLIC_META_PIXEL_ID");
    const ga4 = get("NEXT_PUBLIC_GA4_ID");
    const [pixelSet, ga4Set] = [has("NEXT_PUBLIC_META_PIXEL_ID"), has("NEXT_PUBLIC_GA4_ID")];
    if (unread("NEXT_PUBLIC_META_PIXEL_ID")) skip(group, "NEXT_PUBLIC_META_PIXEL_ID", "that it is a Pixel id");
    else if (pixel && !/^\d{8,}$/u.test(pixel))
      add("warning", group, "NEXT_PUBLIC_META_PIXEL_ID", "not a Pixel id (digits only)");
    if (unread("NEXT_PUBLIC_GA4_ID")) skip(group, "NEXT_PUBLIC_GA4_ID", "that it is a GA4 measurement id");
    else if (ga4 && !/^G-[A-Z0-9]{6,}$/u.test(ga4))
      add("warning", group, "NEXT_PUBLIC_GA4_ID", "not a GA4 measurement id (G-XXXXXXXXXX)");
    if (has("META_CAPI_TOKEN") && !pixelSet)
      add(
        "warning",
        group,
        "META_CAPI_TOKEN",
        "set without NEXT_PUBLIC_META_PIXEL_ID: no server event has a dataset to go to",
      );
    if (has("GA4_API_SECRET") && !ga4Set)
      add("warning", group, "GA4_API_SECRET", "set without NEXT_PUBLIC_GA4_ID: no server event has a stream to go to");
    if (pixelSet && !has("META_CAPI_TOKEN"))
      add(
        "note",
        group,
        "META_CAPI_TOKEN",
        "not set: purchases reach Meta from the browser only, where blockers drop them",
      );
    if (ga4Set && !has("GA4_API_SECRET"))
      add("note", group, "GA4_API_SECRET", "not set: purchases reach GA4 from the browser only");
    if (production && has("META_CAPI_TEST_EVENT_CODE")) {
      add(
        "warning",
        group,
        "META_CAPI_TEST_EVENT_CODE",
        "set in production: every server event is filed as a test and counts for nothing",
      );
    }
    if (!pixelSet && !ga4Set)
      add("note", group, "Pixel and GA4", "no tracker set: nothing loads and the cookie notice stays hidden");
  }

  // ---- Operator's AI, backups, uploads
  {
    const group = "Operator";
    const providers = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"].filter(has);
    add(
      "note",
      group,
      "AI provider",
      providers.length
        ? `/admin/insights answers through ${providers.join(", ")}`
        : "no AI key: /admin/insights is off, and nothing else needs one",
    );
    for (const key of ["BACKUP_RETENTION_DAYS", "MODULE_UPLOAD_MAX_MB"]) {
      if (get(key) && !isPositiveInteger(get(key)))
        add("warning", group, key, `"${get(key)}" is not a whole number: the default is used`);
    }
  }

  // ---- What nothing here reads
  const fromInheritedFile = (key) => Boolean(layeredOver) && env.get(key)?.source === layeredOver;
  for (const [key, entry] of env) {
    // In a pulled file an empty value is a name set on Vercel all the same.
    if (KNOWN.has(key) || TOOLING.test(key) || (entry.value.trim() === "" && !pulled)) continue;
    add(
      "warning",
      "Leftovers",
      key,
      fromInheritedFile(key)
        ? `comes from ${layeredOver}, the copy inherited from MedChina, and nothing in this codebase reads it`
        : "nothing in this codebase reads it: a leftover of another project?",
    );
  }

  // ---- The mark of a pulled Secret, copied into a file the app reads
  if (!pulled) {
    for (const [key, entry] of env) {
      const value = entry.value.trim();
      if (TOOLING.test(key) || !UNREAD_MARK.test(value)) continue;
      add(
        "error",
        "Placeholders",
        key,
        value === "[SENSITIVE]"
          ? `holds ${value}, what vercel env pull writes in place of a Secret: here it is read as the value itself`
          : `holds ${value}, a placeholder: here it is read as the value itself`,
      );
    }
  }

  // ---- A dollar sign Next.js expands (a pulled file is never read by it)
  if (!pulled) {
    for (const [key, entry] of env) {
      if (!entry.bareDollar || !KNOWN.has(key)) continue;
      add(
        nextReads ? "error" : "note",
        "Dollar signs",
        key,
        nextReads
          ? "holds a $ right before a name: Next.js expands it, so the app reads another value than the one written. Write \\$ (inside an address, %24)"
          : "holds a $ right before a name: right in the Vercel settings, but in a file Next.js reads it has to be written \\$ (inside an address, %24)",
      );
    }
  }

  // ---- The inherited copy must not reach a flyee.club deployment
  if (inherited) {
    const group = "Inherited from MedChina";
    const copy = layeredOver ?? "apps/web/.env";
    // Every value of the copy long enough not to coincide by chance.
    const theirs = new Set(
      [...inherited.values()]
        .map((entry) => entry.value.trim())
        .filter((value) => value.length >= 8)
        .map(hashOf),
    );
    for (const [key, entry] of env) {
      const value = entry.value.trim();
      if (value === "" || TOOLING.test(key) || unread(key)) continue;
      if (layeredOver && entry.source === layeredOver) {
        // Still read from the copy: a key .env.local forgot to define.
        if (!KNOWN.has(key)) continue;
        const [level, message] = inheritedFinding(key, `read from ${copy}, the inherited copy`) ?? [
          "error",
          `read from ${copy}, the inherited copy: this is a MedChina value. Define the key in .env.local, empty to switch it off`,
        ];
        add(level, group, key, message);
        continue;
      }
      // Written here and equal to a value of the copy, under any name: copied
      // over (the whole .env copied to .env.local and edited is the usual way).
      if (value.length < 8 || !theirs.has(hashOf(value)) || SETTINGS_WHEN_INHERITED.has(key)) continue;
      const where = `equals a value of ${copy}, the inherited copy`;
      if (SHARED_WHEN_INHERITED.has(key)) add("note", group, key, `${where}: fine if it is yours to use in both`);
      else add("error", group, key, `${where}: this deployment would talk to a MedChina service`);
    }
    // A value that did not come back cannot be compared, and that has to be said.
    const blind = [...env.keys()].filter((key) => !TOOLING.test(key) && unread(key)).length;
    if (blind) {
      add(
        "note",
        group,
        "Values not read",
        `${blind} did not come back and could not be compared with the copy: the run without --file covers the files they were copied from`,
      );
    }
  }

  const count = (level) => findings.filter((finding) => finding.level === level).length;
  return {
    stage,
    target,
    findings,
    errors: count("error"),
    warnings: count("warning"),
    unread: count("unread"),
    // Names a pulled file holds with no value and no mark: a newer CLI tells what they are.
    cameBackEmpty: [...env.keys()].filter((key) => !TOOLING.test(key) && unread(key) && !marked(key)).length,
  };
}

const MARK = { error: "✘", warning: "!", unread: "?", note: "·", ok: "✔" };

/** The report as text. Values appear only where a rule chose to show one. */
export function format(report, source) {
  const lines = [
    "flyee.club environment preflight",
    `  stage   ${report.stage === "open" ? "open: the store sells" : "waitlist: the list and the legal pages, nothing on sale"}`,
    `  target  ${report.target}`,
    `  source  ${source}`,
  ];
  const width = Math.max(...report.findings.map((finding) => finding.key.length), 0);
  let group = null;
  for (const finding of report.findings) {
    if (finding.group !== group) {
      group = finding.group;
      lines.push("", group);
    }
    lines.push(`  ${MARK[finding.level]} ${finding.key.padEnd(width)}  ${finding.message}`);
  }
  lines.push(
    "",
    report.errors
      ? `${report.errors} to fix before this stage, ${report.warnings} to look at. ✘ stops the deploy, ! is yours to judge.`
      : report.warnings
        ? `Nothing stops this stage. ${report.warnings} to look at (!).`
        : "Nothing stops this stage.",
    ...(report.unread
      ? [
          `${report.unread} not read (?): the value of a Secret does not come back from Vercel. The name is set there,`,
          "and what it holds was not checked. Check those in the file the values were copied from.",
        ]
      : []),
    ...(report.cameBackEmpty
      ? [
          `${report.cameBackEmpty} came back empty: an older Vercel CLI writes a Secret that way, and so does a variable saved with`,
          "no value. `npx vercel@latest env pull` writes [SENSITIVE] for a Secret, which tells the two apart.",
        ]
      : []),
    "Not checked here, because it needs an account: the DNS, the webhooks, the Supabase Auth addresses,",
    'the Inngest sync and the database itself. docs/DEPLOY.md, "Roteiro da abertura", has each step.',
  );
  return lines.join("\n");
}

async function readEntries(file) {
  const text = await readFile(file, "utf8").catch(() => null);
  return text === null ? null : parseEnv(text);
}

export async function main(argv, root = process.cwd()) {
  const options = { stage: "open", target: "production", file: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--stage" || arg === "--target" || arg === "--file") {
      options[arg.slice(2)] = argv[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!STAGES.includes(options.stage)) throw new Error(`--stage must be one of: ${STAGES.join(", ")}`);
  if (!TARGETS.includes(options.target)) throw new Error(`--target must be one of: ${TARGETS.join(", ")}`);

  const inheritedPath = path.resolve(root, "apps/web/.env");
  const copy = await readEntries(inheritedPath);
  const inherited = looksInherited(copy) ? copy : null;

  let env;
  let source;
  let layeredOver = null;
  let pulled = false;
  if (options.file) {
    const file = path.resolve(root, options.file);
    const text = await readFile(file, "utf8").catch(() => null);
    if (text === null) throw new Error(`Cannot read ${file}`);
    pulled = pulledFromVercel(text);
    env = layerEnv([{ name: options.file, entries: parseEnv(text) }]);
    source = pulled ? `${options.file}, written by vercel env pull` : options.file;
  } else {
    const local = await readEntries(path.resolve(root, "apps/web/.env.local"));
    if (!local && !copy)
      throw new Error("Neither apps/web/.env.local nor apps/web/.env exists: pass --file <env file>");
    env = layerEnv([
      ...(local ? [{ name: "apps/web/.env.local", entries: local }] : []),
      ...(copy ? [{ name: "apps/web/.env", entries: copy }] : []),
    ]);
    source = [local && "apps/web/.env.local", copy && "apps/web/.env"].filter(Boolean).join(" over ");
    // While .env is the MedChina copy, every real value lives in .env.local.
    if (local && inherited) layeredOver = "apps/web/.env";
  }

  const report = inspect(env, {
    stage: options.stage,
    target: options.target,
    inherited,
    layeredOver,
    pulled,
    // Without --file these are the files the app itself reads here.
    nextReads: !options.file,
  });
  console.log(options.json ? JSON.stringify({ source, pulled, ...report }, null, 2) : format(report, source));
  return report.errors ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(2);
    },
  );
}
