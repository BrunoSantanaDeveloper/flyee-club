import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { format, inspect, layerEnv, looksInherited, main, parseEnv, pulledFromVercel } from "./preflight-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = "abcdefghijklmnopqrst";
const OTHER_REF = "zyxwvutsrqponmlkjihg";

// Credentials are assembled at run time so that no line of this file looks
// like one to a secret scanner.
const fake = (...parts) => parts.join("_");
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload) => [b64({ alg: "HS256", typ: "JWT" }), b64(payload), "c2lnbmF0dXJl"].join(".");
const poolerUrl = (ref) =>
  `postgresql://postgres.${ref}:not-a-password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

/** Everything a production deployment of the open store holds. */
const complete = () => ({
  NEXT_PUBLIC_SITE_URL: "https://flyee.club",
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "anon", ref: REF }),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "service_role", ref: REF }),
  DATABASE_URL: poolerUrl(REF),
  RESEND_API_KEY: fake("re", "x".repeat(24)),
  EMAIL_FROM: "FlyeeClub <no-reply@flyee.club>",
  CONTACT_FORM_TO: "contato@flyee.club",
  INNGEST_EVENT_KEY: "inngest-event-key-of-production",
  INNGEST_SIGNING_KEY: `signkey-prod-${"a".repeat(32)}`,
  PUBLIC_FORMS_IP_SALT: "s".repeat(40),
  ASAAS_API_KEY: `$${fake("aact", "prod", "k".repeat(32))}`,
  ASAAS_WEBHOOK_TOKEN: "asaas-webhook-token-of-production",
  ASAAS_BASE_URL: "https://api.asaas.com/v3",
  STRIPE_SECRET_KEY: fake("sk", "live", "k".repeat(24)),
  STRIPE_WEBHOOK_SECRET: fake("whsec", "k".repeat(24)),
});

const envOf = (values, source) =>
  new Map(
    Object.entries(values).map(([key, value]) => [key, { value, bareDollar: false, ...(source ? { source } : {}) }]),
  );

const judge = (values, options) => inspect(envOf(values), options);
const of = (report, key) => report.findings.filter((finding) => finding.key === key);
const levelOf = (report, key) => of(report, key).map((finding) => finding.level);

test("a complete production environment of the open store has nothing to fix", () => {
  const report = judge(complete());
  assert.deepEqual(
    report.findings.filter((finding) => finding.level === "error" || finding.level === "warning"),
    [],
  );
  assert.equal(report.errors, 0);
});

test("each variable the open store cannot run without is an error when missing", () => {
  for (const key of [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "PUBLIC_FORMS_IP_SALT",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
    "ASAAS_BASE_URL",
    "STRIPE_WEBHOOK_SECRET",
  ]) {
    const values = complete();
    delete values[key];
    assert.ok(levelOf(judge(values), key).includes("error"), `${key} missing should stop the deploy`);
  }
});

test("a MUI X licence key is a leftover: the platform uses the free packages only", () => {
  const report = judge({ ...complete(), NEXT_PUBLIC_MUI_X_LICENSE_KEY: "licence-key-of-someone" });
  assert.deepEqual(
    of(report, "NEXT_PUBLIC_MUI_X_LICENSE_KEY").map((finding) => [finding.group, finding.level]),
    [["Leftovers", "warning"]],
  );
});

test("the waitlist stage asks for no billing, and says nothing is on sale", () => {
  const values = complete();
  for (const key of [
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
    "ASAAS_BASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ])
    delete values[key];
  const report = judge(values, { stage: "waitlist" });
  assert.equal(report.errors, 0);
  assert.deepEqual(levelOf(report, "ASAAS_API_KEY"), ["note"]);
  // The same environment cannot open the store: BRL is what every button sells.
  assert.ok(levelOf(judge(values, { stage: "open" }), "ASAAS_API_KEY").includes("error"));
  // USD is the operator's call: a warning, with what it costs.
  assert.deepEqual(levelOf(judge(values, { stage: "open" }), "STRIPE_SECRET_KEY"), ["warning"]);
});

test("a Supabase key is judged by what it is, not by the variable it sits in", () => {
  const swapped = judge({
    ...complete(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "service_role", ref: REF }),
    SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "anon", ref: REF }),
  });
  assert.match(of(swapped, "NEXT_PUBLIC_SUPABASE_ANON_KEY")[0].message, /SERVICE ROLE key.*every browser/u);
  assert.equal(of(swapped, "NEXT_PUBLIC_SUPABASE_ANON_KEY")[0].level, "error");
  assert.equal(of(swapped, "SUPABASE_SERVICE_ROLE_KEY")[0].level, "error");

  // The new key format carries its kind in the prefix.
  const modern = judge({
    ...complete(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fake("sb", "secret", "k".repeat(24)),
    SUPABASE_SERVICE_ROLE_KEY: fake("sb", "secret", "k".repeat(24)),
  });
  assert.equal(of(modern, "NEXT_PUBLIC_SUPABASE_ANON_KEY")[0].level, "error");
  assert.equal(of(modern, "SUPABASE_SERVICE_ROLE_KEY")[0].level, "ok");
});

test("keys and database of another project than the address are an error", () => {
  const report = judge({
    ...complete(),
    SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "service_role", ref: OTHER_REF }),
    DATABASE_URL: poolerUrl(OTHER_REF),
  });
  assert.match(of(report, "SUPABASE_SERVICE_ROLE_KEY")[0].message, /another Supabase project/u);
  assert.match(of(report, "DATABASE_URL")[0].message, /another Supabase project/u);
  assert.equal(report.errors, 2);
});

test("the database address is the pooled one, filled in and remote", () => {
  const database = (value) => of(judge({ ...complete(), DATABASE_URL: value }), "DATABASE_URL")[0];
  assert.match(
    database(`postgresql://postgres.${REF}:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`).message,
    /placeholder/u,
  );
  assert.equal(database("postgresql://postgres:postgres@127.0.0.1:54322/postgres").level, "error");
  assert.equal(database("mysql://user:pass@example.com/db").level, "error");
  assert.equal(database(`postgresql://postgres:pass@db.${REF}.supabase.co:5432/postgres`).level, "warning");
  assert.equal(
    database(`postgresql://postgres.${REF}:pass@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`).level,
    "warning",
  );
});

test("on this machine's own files the site address is left to Vercel", () => {
  // The runbook copies .env.local to Vercel and adds the address there.
  const withoutSite = { ...complete() };
  delete withoutSite.NEXT_PUBLIC_SITE_URL;
  const localRun = judge(withoutSite, { nextReads: true });
  assert.deepEqual(levelOf(localRun, "NEXT_PUBLIC_SITE_URL"), ["note"]);
  assert.equal(localRun.errors, 0);
  assert.deepEqual(
    levelOf(
      judge({ ...complete(), NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, { nextReads: true }),
      "NEXT_PUBLIC_SITE_URL",
    ),
    ["note"],
  );
  // Where it is held: what Vercel holds, and any file passed with --file.
  assert.deepEqual(levelOf(judge(withoutSite), "NEXT_PUBLIC_SITE_URL"), ["error"]);
  // A wrong address that is not this machine is wrong here as well.
  assert.deepEqual(
    levelOf(
      judge({ ...complete(), NEXT_PUBLIC_SITE_URL: "https://flyee.club/" }, { nextReads: true }),
      "NEXT_PUBLIC_SITE_URL",
    ),
    ["error"],
  );
});

test("the site address is an https origin, and production is flyee.club", () => {
  const site = (value, options) =>
    of(judge({ ...complete(), NEXT_PUBLIC_SITE_URL: value }, options), "NEXT_PUBLIC_SITE_URL")[0];
  for (const wrong of [
    "https://flyee.club/",
    "https://flyee.club/en",
    "http://flyee.club",
    "http://localhost:3000",
    "flyee.club",
  ]) {
    assert.equal(site(wrong).level, "error", wrong);
  }
  assert.equal(site("https://www.flyee.club").level, "warning");
  assert.equal(site("https://flyee-club-git-ensaio.vercel.app", { target: "preview" }).level, "ok");
});

test("Asaas: production sells through the production address with a production key", () => {
  const asaas = (changes, options) => judge({ ...complete(), ...changes }, options);
  // An empty address is the sandbox: the mistake that sells nothing.
  assert.match(of(asaas({ ASAAS_BASE_URL: "" }), "ASAAS_BASE_URL")[0].message, /sandbox and nobody pays/u);
  const sandboxKey = `$${fake("aact", "hmlg", "k".repeat(32))}`;
  assert.equal(of(asaas({ ASAAS_API_KEY: sandboxKey }), "ASAAS_API_KEY")[0].level, "error");
  // A preview is where the sandbox belongs, and production there charges for real.
  const preview = asaas({}, { target: "preview" });
  assert.match(of(preview, "ASAAS_API_KEY")[0].message, /real money/u);
  assert.equal(of(preview, "ASAAS_API_KEY")[0].level, "warning");
  const sandbox = asaas({ ASAAS_API_KEY: sandboxKey, ASAAS_BASE_URL: "" }, { target: "preview" });
  assert.deepEqual(levelOf(sandbox, "ASAAS_API_KEY"), ["ok"]);
});

test("Stripe: a test key cannot open the store, a live one does not belong in a preview", () => {
  const testKey = fake("sk", "test", "k".repeat(24));
  assert.equal(of(judge({ ...complete(), STRIPE_SECRET_KEY: testKey }), "STRIPE_SECRET_KEY")[0].level, "error");
  assert.equal(of(judge(complete(), { target: "preview" }), "STRIPE_SECRET_KEY")[0].level, "warning");
  assert.equal(
    of(judge({ ...complete(), STRIPE_SECRET_KEY: testKey }, { target: "preview" }), "STRIPE_SECRET_KEY")[0].level,
    "ok",
  );
});

test("reais on Stripe: the store opens without Asaas, and not without Stripe", () => {
  const values = { ...complete(), BILLING_BRL_PROVIDER: "stripe" };
  for (const key of ["ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "ASAAS_BASE_URL"]) delete values[key];
  const report = judge(values, { stage: "open" });
  assert.equal(report.errors, 0);
  assert.deepEqual(levelOf(report, "ASAAS_API_KEY"), ["note"]);
  // What reais lose on Stripe is said once, beside the choice.
  assert.match(of(report, "BILLING_BRL_PROVIDER")[0].message, /no card installments/u);

  const withoutStripe = { ...values };
  delete withoutStripe.STRIPE_SECRET_KEY;
  assert.deepEqual(levelOf(judge(withoutStripe, { stage: "open" }), "STRIPE_SECRET_KEY"), ["error"]);
  assert.deepEqual(levelOf(judge(withoutStripe, { stage: "waitlist" }), "STRIPE_SECRET_KEY"), ["note"]);
});

test("a BRL provider that is neither asaas nor stripe closes the till in reais", () => {
  assert.deepEqual(levelOf(judge({ ...complete(), BILLING_BRL_PROVIDER: "strype" }), "BILLING_BRL_PROVIDER"), [
    "error",
  ]);
  // Empty and "asaas" are the default, and say nothing.
  assert.deepEqual(levelOf(judge({ ...complete(), BILLING_BRL_PROVIDER: "" }), "BILLING_BRL_PROVIDER"), []);
  assert.deepEqual(levelOf(judge({ ...complete(), BILLING_BRL_PROVIDER: "Asaas" }), "BILLING_BRL_PROVIDER"), []);
});

test("e-mail: no sender means the test sender, and the sender's domain is the site's", () => {
  const missing = judge({ ...complete(), EMAIL_FROM: "" });
  assert.match(of(missing, "EMAIL_FROM")[0].message, /onboarding@resend\.dev/u);
  assert.equal(of(judge({ ...complete(), EMAIL_FROM: "FlyeeClub <oi@outro.com>" }), "EMAIL_FROM")[0].level, "warning");
  assert.equal(of(judge({ ...complete(), EMAIL_FROM: "oi@mail.flyee.club" }), "EMAIL_FROM")[0].level, "ok");
  assert.equal(of(judge({ ...complete(), EMAIL_FROM: "FlyeeClub" }), "EMAIL_FROM")[0].level, "error");
  assert.equal(of(judge({ ...complete(), CONTACT_FORM_TO: "" }), "CONTACT_FORM_TO")[0].level, "warning");
  // The rehearsal's own address sends from the verified parent domain, and a
  // preview's address says nothing about what Resend verified.
  const rehearsal = { ...complete(), NEXT_PUBLIC_SITE_URL: "https://ensaio.flyee.club" };
  assert.equal(of(judge(rehearsal, { target: "preview" }), "EMAIL_FROM")[0].level, "ok");
  assert.equal(
    of(
      judge({ ...rehearsal, NEXT_PUBLIC_SITE_URL: "https://flyee-club-abc.vercel.app" }, { target: "preview" }),
      "EMAIL_FROM",
    )[0].level,
    "ok",
  );
});

test("jobs need both Inngest keys", () => {
  assert.equal(of(judge({ ...complete(), INNGEST_SIGNING_KEY: "" }), "INNGEST_SIGNING_KEY")[0].level, "error");
  assert.equal(
    of(judge({ ...complete(), INNGEST_EVENT_KEY: "", INNGEST_SIGNING_KEY: "" }), "INNGEST_EVENT_KEY")[0].level,
    "error",
  );
  const branch = judge({ ...complete(), INNGEST_SIGNING_KEY: `signkey-branch-${"a".repeat(32)}` });
  assert.equal(of(branch, "INNGEST_SIGNING_KEY")[0].level, "warning");
  // The other way round: production's keys in a preview send its events to the production jobs.
  const shared = of(judge(complete(), { target: "preview" }), "INNGEST_SIGNING_KEY")[0];
  assert.equal(shared.level, "warning");
  assert.match(shared.message, /runs the production jobs/u);
  assert.equal(
    of(
      judge({ ...complete(), INNGEST_SIGNING_KEY: `signkey-branch-${"a".repeat(32)}` }, { target: "preview" }),
      "INNGEST_SIGNING_KEY",
    )[0].level,
    "ok",
  );
});

test("trackers come in pairs, and the test code stays out of production", () => {
  const report = judge({
    ...complete(),
    META_CAPI_TOKEN: "token-with-no-pixel",
    NEXT_PUBLIC_GA4_ID: "UA-123",
    META_CAPI_TEST_EVENT_CODE: "TEST123",
  });
  assert.equal(of(report, "META_CAPI_TOKEN")[0].level, "warning");
  assert.equal(of(report, "NEXT_PUBLIC_GA4_ID")[0].level, "warning");
  assert.equal(of(report, "META_CAPI_TEST_EVENT_CODE")[0].level, "warning");
});

test("a variable nothing reads is named, and what the host sets is not", () => {
  const report = judge({
    ...complete(),
    NEXT_PUBLIC_POSTHOG_KEY: "phc_leftover",
    VERCEL_ENV: "production",
    NX_DAEMON: "false",
    WHATSAPP_PROVIDER: "",
  });
  assert.deepEqual(
    report.findings.filter((finding) => finding.group === "Leftovers").map((finding) => finding.key),
    ["NEXT_PUBLIC_POSTHOG_KEY"],
  );
});

test("the MedChina copy is recognised by the variables only its code read", () => {
  assert.equal(looksInherited(parseEnv("WHATSAPP_PROVIDER=meta\nRESEND_API_KEY=x")), true);
  assert.equal(looksInherited(parseEnv("RESEND_API_KEY=x\nEMAIL_FROM=y")), false);
  assert.equal(looksInherited(null), false);
});

test("layered files: a value still read from the inherited copy is an error, by name", () => {
  const theirs = parseEnv(
    [
      "WHATSAPP_PROVIDER=meta",
      "NEXT_PUBLIC_SUPABASE_URL=https://medchinaprojectref00.supabase.co",
      `STRIPE_SECRET_KEY=${fake("sk", "live", "m".repeat(24))}`,
      `STRIPE_WEBHOOK_SECRET=${fake("whsec", "m".repeat(24))}`,
      "CONTACT_FORM_TO=operator@example.com",
      "NEXT_PUBLIC_TITLE=MedChina",
      "META_CAPI_TOKEN=",
    ].join("\n"),
  );
  // .env.local overrides Supabase, blanks nothing else: Stripe shines through.
  const ours = { ...complete() };
  delete ours.STRIPE_SECRET_KEY;
  delete ours.STRIPE_WEBHOOK_SECRET;
  delete ours.CONTACT_FORM_TO;
  const env = layerEnv([
    { name: "apps/web/.env.local", entries: envOf(ours) },
    { name: "apps/web/.env", entries: theirs },
  ]);
  const report = inspect(env, { inherited: theirs, layeredOver: "apps/web/.env" });
  const inherited = report.findings.filter((finding) => finding.group === "Inherited from MedChina");
  assert.deepEqual(
    inherited.map((finding) => [finding.key, finding.level]),
    [
      ["STRIPE_SECRET_KEY", "error"],
      ["STRIPE_WEBHOOK_SECRET", "error"],
      ["CONTACT_FORM_TO", "warning"],
    ],
  );
  assert.match(inherited[0].message, /MedChina value.*\.env\.local/u);
  // What nothing reads is a leftover of the copy, said once.
  assert.deepEqual(
    of(report, "NEXT_PUBLIC_TITLE").map((finding) => finding.group),
    ["Leftovers"],
  );
  // A key .env.local defines, even empty, never falls through.
  const blanked = layerEnv([
    { name: "apps/web/.env.local", entries: envOf({ ...ours, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "" }) },
    { name: "apps/web/.env", entries: theirs },
  ]);
  assert.equal(blanked.get("STRIPE_SECRET_KEY").value, "");
  assert.equal(
    inspect(blanked, { stage: "waitlist", inherited: theirs, layeredOver: "apps/web/.env" }).findings.filter(
      (finding) => finding.key === "STRIPE_SECRET_KEY" && finding.level === "error",
    ).length,
    0,
  );
});

test("an inherited setting is a note", () => {
  const theirs = parseEnv("WHATSAPP_PROVIDER=meta\nBACKUP_RETENTION_DAYS=30");
  const ours = complete();
  const env = layerEnv([
    { name: "apps/web/.env.local", entries: envOf(ours) },
    { name: "apps/web/.env", entries: theirs },
  ]);
  const report = inspect(env, { inherited: theirs, layeredOver: "apps/web/.env" });
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.group === "Inherited from MedChina")
      .map((finding) => [finding.key, finding.level]),
    [["BACKUP_RETENTION_DAYS", "note"]],
  );
});

test("layered files: a value copied from the copy into .env.local is an error under any name", () => {
  // The usual way to start: copy the whole .env to .env.local, then edit it.
  const theirAi = fake("sk", "ant", "m".repeat(32));
  const theirs = parseEnv(
    [
      "WHATSAPP_PROVIDER=meta",
      `ANTHROPIC_API_KEY=${theirAi}`,
      "CONTACT_FORM_TO=operator@example.com",
      "ASAAS_BASE_URL=https://api.asaas.com/v3",
    ].join("\n"),
  );
  const ours = {
    ...complete(),
    // Moved to another name, and still the other product's key.
    GEMINI_API_KEY: theirAi,
    CONTACT_FORM_TO: "operator@example.com",
  };
  const env = layerEnv([
    { name: "apps/web/.env.local", entries: envOf(ours) },
    { name: "apps/web/.env", entries: theirs },
  ]);
  const report = inspect(env, { inherited: theirs, layeredOver: "apps/web/.env" });
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.group === "Inherited from MedChina")
      .map((finding) => [finding.key, finding.level]),
    [
      ["CONTACT_FORM_TO", "note"],
      ["GEMINI_API_KEY", "error"],
      // ANTHROPIC_API_KEY is not in .env.local, so it is read from the copy.
      ["ANTHROPIC_API_KEY", "error"],
    ],
  );
  // The same production address in both is a setting, not a leak.
  assert.equal(of(report, "ASAAS_BASE_URL").filter((finding) => finding.group !== "Billing").length, 0);
  // A key read from the copy can be cleared: defining it in .env.local, a warning until then.
  const unset = { ...ours };
  delete unset.CONTACT_FORM_TO;
  const fallsThrough = inspect(
    layerEnv([
      { name: "apps/web/.env.local", entries: envOf(unset) },
      { name: "apps/web/.env", entries: theirs },
    ]),
    { inherited: theirs, layeredOver: "apps/web/.env" },
  );
  assert.deepEqual(
    of(fallsThrough, "CONTACT_FORM_TO")
      .filter((finding) => finding.group === "Inherited from MedChina")
      .map((finding) => finding.level),
    ["warning"],
  );
});

test("one file: a value equal to one of the copy's is an error under any name", () => {
  const leaked = fake("sk", "live", "m".repeat(24));
  const theirs = parseEnv(`WHATSAPP_PROVIDER=meta\nSTRIPE_SECRET_KEY=${leaked}\nBACKUP_RETENTION_DAYS=30`);
  const report = judge(
    { ...complete(), STRIPE_SECRET_KEY: leaked, BACKUP_RETENTION_DAYS: "30" },
    { inherited: theirs },
  );
  const inherited = report.findings.filter((finding) => finding.group === "Inherited from MedChina");
  assert.deepEqual(
    inherited.map((finding) => [finding.key, finding.level]),
    [["STRIPE_SECRET_KEY", "error"]],
  );
  // Short values (a number of days, a flag) coincide by chance and say nothing.
  assert.equal(of(report, "BACKUP_RETENTION_DAYS").length, 0);
});

/** What Vercel keeps as a Secret when the keys are saved as the CLI saves them by default. */
const SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "PUBLIC_FORMS_IP_SALT",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];
const sealed = (mark) => ({ ...complete(), ...Object.fromEntries(SECRETS.map((key) => [key, mark])) });

test("a pulled file is known by the line the Vercel CLI writes first", () => {
  assert.equal(pulledFromVercel('# Created by Vercel CLI\nA="1"\n'), true);
  assert.equal(pulledFromVercel(`${String.fromCharCode(0xfeff)}# Created by Vercel CLI\nA="1"\n`), true);
  assert.equal(pulledFromVercel('A="1"\n# Created by Vercel CLI\n'), false);
});

test("a pulled file: a Secret that did not come back is set and not read, never missing or wrong", () => {
  // 59.x and newer write a mark in its place.
  const marked = judge(sealed("[SENSITIVE]"), { pulled: true });
  assert.equal(marked.errors, 0);
  assert.equal(marked.warnings, 0);
  // Where being set is all there is to check, the mark is the whole answer.
  const presenceOnly = ["ASAAS_WEBHOOK_TOKEN", "INNGEST_EVENT_KEY"];
  for (const key of SECRETS) {
    assert.deepEqual(levelOf(marked, key), [presenceOnly.includes(key) ? "ok" : "unread"], key);
  }
  assert.equal(marked.unread, SECRETS.length - presenceOnly.length);
  assert.match(of(marked, "DATABASE_URL")[0].message, /Not checked: the pooled address/u);
  // What is public came back and is judged as ever.
  assert.deepEqual(levelOf(marked, "NEXT_PUBLIC_SUPABASE_ANON_KEY"), ["ok"]);
  assert.deepEqual(levelOf(marked, "ASAAS_BASE_URL"), ["ok"]);
  assert.match(format(marked, "a pulled file"), /8 not read \(\?\)/u);

  // 54.x and older leave it empty: the name is there, a value cannot be told.
  const blank = judge(sealed(""), { pulled: true });
  assert.equal(blank.errors, 0);
  assert.equal(blank.unread, SECRETS.length);
  assert.match(of(blank, "ASAAS_WEBHOOK_TOKEN")[0].message, /Not checked: that it holds a value/u);
  // The report says how to tell a Secret from a variable saved empty: a newer CLI.
  assert.deepEqual([blank.cameBackEmpty, marked.cameBackEmpty], [SECRETS.length, 0]);
  assert.match(format(blank, "a pulled file"), /vercel@latest env pull/u);
  assert.doesNotMatch(format(marked, "a pulled file"), /vercel@latest env pull/u);

  // A name the file does not have at all is still missing.
  const absent = sealed("[SENSITIVE]");
  delete absent.DATABASE_URL;
  assert.deepEqual(levelOf(judge(absent, { pulled: true }), "DATABASE_URL"), ["error"]);

  // And the same empty values, in a file nobody pulled, are variables that are not set.
  assert.ok(judge(sealed("")).errors > 5);
});

test("a pulled file: each half of the Asaas pair is judged alone when the other did not come back", () => {
  const half = (changes, options) => judge({ ...complete(), ...changes }, { pulled: true, ...options });
  const sandboxKey = `$${fake("aact", "hmlg", "k".repeat(32))}`;
  // The address came back and is the sandbox: the open store sells nothing, whatever the key.
  const sandboxAddress = half({ ASAAS_API_KEY: "[SENSITIVE]", ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3" });
  assert.equal(of(sandboxAddress, "ASAAS_BASE_URL")[0].level, "error");
  assert.deepEqual(levelOf(sandboxAddress, "ASAAS_API_KEY"), ["unread"]);
  // The key came back and is the sandbox one.
  const sandboxOnly = half({ ASAAS_BASE_URL: "[SENSITIVE]", ASAAS_API_KEY: sandboxKey });
  assert.equal(of(sandboxOnly, "ASAAS_API_KEY")[0].level, "error");
  assert.deepEqual(levelOf(sandboxOnly, "ASAAS_BASE_URL"), ["unread"]);
  // In a preview it is the production address that is the finding.
  assert.equal(of(half({ ASAAS_API_KEY: "[SENSITIVE]" }, { target: "preview" }), "ASAAS_BASE_URL")[0].level, "warning");
});

test("a pulled file: an empty leftover is named, and what could not be compared with the copy is said", () => {
  const theirs = parseEnv(`WHATSAPP_PROVIDER=meta\nRESEND_API_KEY=${fake("re", "m".repeat(24))}`);
  const report = judge(
    { ...complete(), RESEND_API_KEY: "[SENSITIVE]", WHATSAPP_TOKEN: "", VERCEL_URL: "" },
    { pulled: true, inherited: theirs },
  );
  assert.deepEqual(
    report.findings.filter((finding) => finding.group === "Leftovers").map((finding) => finding.key),
    ["WHATSAPP_TOKEN"],
  );
  const blind = report.findings.filter((finding) => finding.group === "Inherited from MedChina");
  assert.deepEqual(
    blind.map((finding) => [finding.key, finding.level]),
    [["Values not read", "note"]],
  );
  assert.match(blind[0].message, /^2 did not come back/u);
});

test("the mark of a pulled Secret, in a file the app reads, is no value", () => {
  const copied = { ...complete(), ASAAS_WEBHOOK_TOKEN: "[SENSITIVE]" };
  assert.deepEqual(
    judge(copied)
      .findings.filter((finding) => finding.group === "Placeholders")
      .map((finding) => [finding.key, finding.level]),
    [["ASAAS_WEBHOOK_TOKEN", "error"]],
  );
  // In the pulled file itself it is a Secret that is set, and nothing more.
  assert.equal(judge(copied, { pulled: true }).errors, 0);
});

test("an env file is read the way Next.js reads it", () => {
  const entries = parseEnv(
    [
      "# a comment",
      "PLAIN=value # trailing comment",
      "CUT=value#no space needed",
      'DOUBLE="two words # kept"',
      "SINGLE='$expanded all the same'",
      "export EXPORTED=yes",
      "EMPTY=",
      "ESCAPED=\\$aact_prod_abc",
      "ESCAPED_SINGLE='\\$aact_prod_abc'",
      "BARE=$aact_prod_abc",
      "DIGIT=$1abc",
      "BRACES=${other}tail",
      "PASSWORD=postgresql://user:pa$sword@host:6543/postgres",
      "ENCODED=postgresql://user:pa%24sword@host:6543/postgres",
      'LONE="a $ b and a last $"',
      "not a line",
    ].join("\r\n"),
  );
  assert.equal(entries.get("PLAIN").value, "value");
  assert.equal(entries.get("CUT").value, "value");
  assert.equal(entries.get("DOUBLE").value, "two words # kept");
  assert.equal(entries.get("EXPORTED").value, "yes");
  assert.equal(entries.get("EMPTY").value, "");
  // A backslash keeps the dollar sign, in either kind of quotes.
  for (const key of ["ESCAPED", "ESCAPED_SINGLE"]) {
    assert.deepEqual([entries.get(key).value, entries.get(key).bareDollar], ["$aact_prod_abc", false], key);
  }
  // Without it Next.js expands the name, single quotes included.
  for (const key of ["BARE", "SINGLE", "DIGIT", "BRACES", "PASSWORD"]) {
    assert.equal(entries.get(key).bareDollar, true, key);
  }
  // A dollar sign that names nothing stays, and so does an encoded one.
  for (const key of ["ENCODED", "LONE", "PLAIN"]) assert.equal(entries.get(key).bareDollar, false, key);
  // The comment and the line with no assignment are not entries.
  assert.equal(entries.size, 14);
});

test("a dollar sign before a name: an error where Next.js reads the file, a note in a list for Vercel", () => {
  const env = envOf(complete());
  env.set("ASAAS_API_KEY", { ...env.get("ASAAS_API_KEY"), bareDollar: true });
  const dollar = (options) =>
    inspect(env, options)
      .findings.filter((finding) => finding.group === "Dollar signs")
      .map((finding) => [finding.key, finding.level]);
  // The app would read the key empty, whatever the report says of the written one.
  assert.deepEqual(dollar({ nextReads: true }), [["ASAAS_API_KEY", "error"]]);
  assert.equal(inspect(env, { nextReads: true }).errors, 1);
  // A list of values to paste into Vercel is right as it is.
  assert.deepEqual(dollar({}), [["ASAAS_API_KEY", "note"]]);
  // And the pulled file was written by Vercel itself, which Next.js never reads.
  assert.deepEqual(dollar({ pulled: true }), []);
});

test("the first file that defines a key decides it, an empty value included", () => {
  const env = layerEnv([
    { name: "first", entries: parseEnv("A=\nB=one") },
    { name: "second", entries: parseEnv("A=shadowed\nB=two\nC=three") },
  ]);
  assert.deepEqual([env.get("A").value, env.get("A").source], ["", "first"]);
  assert.deepEqual([env.get("B").value, env.get("C").value, env.get("C").source], ["one", "three", "second"]);
});

test("the report never prints a credential", () => {
  const values = {
    ...complete(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "service_role", ref: REF }),
    DATABASE_URL: poolerUrl(OTHER_REF),
  };
  const text = format(judge(values), "a test");
  const json = JSON.stringify(judge(values));
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "RESEND_API_KEY",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "PUBLIC_FORMS_IP_SALT",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]) {
    assert.ok(!text.includes(values[key]), `${key} printed in the report`);
    assert.ok(!json.includes(values[key]), `${key} printed in the JSON report`);
  }
  assert.ok(!text.includes(REF) && !text.includes(OTHER_REF), "a project reference printed");
  // What identifies nothing is shown, because it is what the operator checks by eye.
  assert.ok(text.includes("https://flyee.club"));
});

test("run on files: the exit code says whether the stage can go ahead", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "flyee-preflight-"));
  const lines = (values) =>
    Object.entries(values)
      .map(([key, value]) => `${key}="${value.replaceAll("$", "\\$")}"`)
      .join("\n");
  const logged = [];
  const log = console.log;
  console.log = (text) => logged.push(String(text));
  try {
    await mkdir(path.join(root, "apps/web"), { recursive: true });
    await writeFile(path.join(root, "apps/web/.env.local"), lines(complete()));
    assert.equal(await main([], root), 0);
    assert.match(logged.at(-1), /source {2}apps\/web\/\.env\.local/u);

    // The Asaas key without its backslash: Next.js would read it empty.
    const unescaped = (text) => text.replace("\\$aact", () => "$aact");
    await writeFile(path.join(root, "apps/web/.env.local"), unescaped(lines(complete())));
    assert.equal(await main(["--json"], root), 1);
    assert.deepEqual(
      JSON.parse(logged.at(-1))
        .findings.filter((finding) => finding.level === "error")
        .map((finding) => [finding.group, finding.key]),
      [["Dollar signs", "ASAAS_API_KEY"]],
    );
    await writeFile(path.join(root, "apps/web/.env.local"), lines(complete()));

    // The copy next to it, with a key .env.local does not define.
    await writeFile(path.join(root, "apps/web/.env"), `WHATSAPP_PROVIDER=meta\nMETA_CAPI_TOKEN=${"t".repeat(40)}\n`);
    assert.equal(await main(["--json"], root), 1);
    const report = JSON.parse(logged.at(-1));
    assert.equal(report.source, "apps/web/.env.local over apps/web/.env");
    assert.deepEqual(
      report.findings.filter((finding) => finding.level === "error").map((finding) => finding.key),
      ["META_CAPI_TOKEN"],
    );

    // One file, as `vercel env pull` writes it, checked against the copy.
    await writeFile(
      path.join(root, "pulled.env"),
      `${lines(complete())}\nMETA_CAPI_TOKEN="${"t".repeat(40)}"\nNEXT_PUBLIC_META_PIXEL_ID="1234567890"\n`,
    );
    assert.equal(await main(["--file", "pulled.env", "--json"], root), 1);
    assert.deepEqual(
      JSON.parse(logged.at(-1))
        .findings.filter((finding) => finding.level === "error")
        .map((finding) => finding.group),
      ["Inherited from MedChina"],
    );

    // What the Vercel CLI itself wrote: its first line makes a Secret a value
    // not read, and a dollar sign is the value as it is.
    await writeFile(
      path.join(root, "vercel.env"),
      `# Created by Vercel CLI\n${unescaped(lines({ ...complete(), STRIPE_SECRET_KEY: "[SENSITIVE]" }))}\nVERCEL_OIDC_TOKEN="${"o".repeat(40)}"\n`,
    );
    assert.equal(await main(["--file", "vercel.env", "--json"], root), 0);
    const pulled = JSON.parse(logged.at(-1));
    assert.deepEqual([pulled.pulled, pulled.unread], [true, 1]);
    assert.match(pulled.source, /written by vercel env pull$/u);
    assert.equal(await main(["--file", "vercel.env"], root), 0);
    assert.match(logged.at(-1), /\? STRIPE_SECRET_KEY/u);
    assert.match(logged.at(-1), /1 not read \(\?\)/u);

    await assert.rejects(main(["--stage", "soon"], root), /--stage must be one of/u);
    await assert.rejects(main(["--file", "absent.env"], root), /Cannot read/u);
  } finally {
    console.log = log;
    await rm(root, { recursive: true, force: true });
  }
});

/** The rules of an ignore file, comments and blank lines out. */
async function ignoreRules(name) {
  return (await readFile(path.join(ROOT, name), "utf8"))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

test("no env file is ever uploaded to Vercel from a developer's machine", async () => {
  // The Vercel CLI never reads .gitignore: it skips a fixed list (.env.local
  // and .env.*.local among it, plain .env not) plus .vercelignore. Without
  // these two lines a `vercel deploy` typed on the operator's machine uploads
  // apps/web/.env, the build reads it, and every variable the project lacks
  // takes its value from there (docs/DEPLOY.md, ".vercelignore: o que nunca sobe").
  // The CLI reads the ignore file of the directory it is run from, so the
  // rules live in both places a deploy could be typed.
  for (const file of [".vercelignore", "apps/web/.vercelignore"]) {
    const rules = await ignoreRules(file);
    assert.ok(rules.includes(".env"), `${file} must list .env`);
    assert.ok(rules.includes(".env.*"), `${file} must list .env.*`);
    // A slash would anchor the rule to that directory, and the files live in apps/web.
    assert.ok(!rules.some((rule) => rule.startsWith("/") && rule.includes(".env")), `${file} anchors an env rule`);
  }
});

test("no env file is ever committed, whatever its suffix", async () => {
  // The rehearsal's file (apps/web/.env.ensaio) and the one `vercel env pull`
  // writes are as secret as .env.local, and neither ends in .local.
  const rules = await ignoreRules(".gitignore");
  assert.ok(rules.includes(".env"), ".gitignore must list .env");
  assert.ok(rules.includes(".env.*"), ".gitignore must list .env.*");
  // The reference is the one env file that is tracked, and the exception has
  // to come after the rule it opens.
  assert.ok(rules.indexOf("!.env.example") > rules.indexOf(".env.*"));
  assert.deepEqual(
    rules.filter((rule) => rule.startsWith("!") && rule.includes(".env")),
    ["!.env.example"],
  );
});
