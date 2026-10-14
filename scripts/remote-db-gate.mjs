import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const knownArgs = new Set(["--apply", "--test", "--test-only"]);

for (const arg of args) {
  if (!knownArgs.has(arg)) throw new Error(`Unknown argument: ${arg}`);
}

const shouldApply = args.has("--apply");
const shouldTest = args.has("--test") || args.has("--test-only");
const shouldInspectMigrations = !args.has("--test-only");
// Same precedence as Next.js: apps/web/.env.local wins over apps/web/.env, and
// the FIRST file that defines a key decides it, an empty value included. A
// .env.local that blanks DATABASE_URL therefore disables this gate as well.
const envPaths = process.env.FLYEE_ENV_FILE
  ? [path.resolve(root, process.env.FLYEE_ENV_FILE)]
  : [path.resolve(root, "apps/web/.env.local"), path.resolve(root, "apps/web/.env")];
const migrationsPath = path.resolve(root, "packages/db/migrations");
const testsPath = path.resolve(root, "packages/db/tests");

function parseEnvValue(source, key) {
  const line = source.split(/\r?\n/u).find((candidate) => candidate.startsWith(`${key}=`));

  if (!line) return undefined;
  const value = line.slice(key.length + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

async function getDatabaseUrl() {
  let value = process.env.DATABASE_URL;
  if (value === undefined) {
    for (const envPath of envPaths) {
      const envFile = await readFile(envPath, "utf8").catch(() => null);
      if (envFile === null) continue;
      const fromFile = parseEnvValue(envFile, "DATABASE_URL");
      if (fromFile !== undefined) {
        value = fromFile;
        break;
      }
    }
  }
  if (!value) throw new Error(`DATABASE_URL is not set (checked ${envPaths.join(", ")})`);

  const databaseUrl = new URL(value);
  if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "host.docker.internal"]);
  if (localHosts.has(databaseUrl.hostname)) {
    throw new Error("The remote database gate refuses local DATABASE_URL targets");
  }

  return value;
}

async function getMigrationFiles() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Which migrations the target already holds.
 *
 * Two facts tell four states apart — the history table and the product schema:
 *
 *   neither              a brand-new project. Applying bootstraps the history
 *                        table and the whole baseline goes in as ordinary
 *                        pending migrations; planning just lists them.
 *   both                 the normal case.
 *   history only, EMPTY  a bootstrap that stopped before the first migration
 *                        committed: continue.
 *   anything else        refuse. A product schema without history, or a
 *                        history without schema, is a database this repo did
 *                        not build, and guessing would mean running DDL
 *                        against somebody else's data.
 *
 * A foreign database that happens to have both (the MedChina project this repo
 * was copied from) is stopped one step later: its history names files this
 * repo does not have.
 */
async function readAppliedMigrations(sql) {
  const [state] = await sql`
    select
      to_regclass('public.schema_migrations') is not null as has_history,
      to_regclass('public.organizations') is not null as has_product_schema
  `;

  if (!state.has_history && !state.has_product_schema) {
    if (shouldApply) {
      await sql`
        create table public.schema_migrations (
          version text primary key,
          applied_at timestamptz not null default now()
        )
      `;
      // No policy on purpose: only the owner and the service role read it.
      await sql`alter table public.schema_migrations enable row level security`;
      console.log("Bootstrapped public.schema_migrations on an empty database.");
    }
    return new Set();
  }

  if (!state.has_history) {
    throw new Error("Unknown database: a product schema with no migration history. Refusing to touch it.");
  }

  const rows = await sql`select version from public.schema_migrations order by version`;
  if (!state.has_product_schema && rows.length > 0) {
    throw new Error("Unknown database: a migration history with no product schema. Refusing to touch it.");
  }
  return new Set(rows.map((row) => row.version));
}

/**
 * Takes every privilege on the history table away from PUBLIC and the API
 * roles. The table is created before 0000 revokes the platform's default
 * privileges, so on a Supabase project it kept the original ones: on
 * 2026-10-14 the production project gave `anon` and `authenticated` all of
 * them (row level security, with no policy, still kept every row out of
 * reach). Idempotent; it runs on every --apply, which also repairs a project
 * bootstrapped before this existed.
 */
async function lockHistory(sql) {
  const roles = await sql`select rolname from pg_roles where rolname in ('anon', 'authenticated') order by rolname`;
  const grantees = ["public", ...roles.map((role) => role.rolname)].join(", ");
  await sql.unsafe(`revoke all on table public.schema_migrations from ${grantees}`);
}

async function migrate(databaseUrl) {
  const sql = postgres(databaseUrl, {
    application_name: "flyee-remote-db-gate",
    connect_timeout: 20,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });

  const files = await getMigrationFiles();

  try {
    if (shouldApply) {
      await sql`select pg_advisory_lock(hashtext('flyee'), hashtext('schema_migrations'))`;
    }

    const applied = await readAppliedMigrations(sql);
    const unknownApplied = [...applied].filter((version) => !files.includes(version));
    if (unknownApplied.length > 0) {
      throw new Error(`Remote migration history contains unknown files: ${unknownApplied.join(", ")}`);
    }

    if (shouldApply) await lockHistory(sql);

    const pending = files.filter((file) => !applied.has(file));
    console.log(`Remote migrations: ${applied.size} applied, ${pending.length} pending.`);

    if (pending.length === 0) return;

    if (!shouldApply) {
      for (const file of pending) console.log(`  pending ${file}`);
      return;
    }

    for (const file of pending) {
      const migration = await readFile(path.join(migrationsPath, file), "utf8");
      console.log(`Applying ${file}...`);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration);
        await transaction`
          insert into public.schema_migrations (version)
          values (${file})
        `;
      });
      console.log(`Applied ${file}.`);
    }
  } finally {
    if (shouldApply) {
      await sql`select pg_advisory_unlock(hashtext('flyee'), hashtext('schema_migrations'))`.catch(() => undefined);
    }
    await sql.end({ timeout: 5 });
  }
}

async function testDatabase(databaseUrl) {
  const sql = postgres(databaseUrl, {
    application_name: "flyee-remote-pgtap",
    connect_timeout: 20,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });
  const entries = await readdir(testsPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  let total = 0;
  // Every file runs, so one run against a live project shows every failure,
  // not only the first; the gate still fails at the end.
  const failed = [];

  try {
    await sql.unsafe("set statement_timeout = '120s'");

    for (const file of files) {
      const source = await readFile(path.join(testsPath, file), "utf8");
      let results;

      try {
        results = await sql.unsafe(source);
      } catch (error) {
        await sql.unsafe("rollback").catch(() => undefined);
        console.error(`pgTAP ${file}: failed to run: ${error.message}`);
        failed.push(file);
        continue;
      }

      const rows = results.flatMap((result) => (Array.isArray(result) ? result : [result]));
      const tap = rows.flatMap((row) =>
        row && typeof row === "object" ? Object.values(row).filter((value) => typeof value === "string") : [],
      );
      const plan = tap.map((line) => /^1\.\.(\d+)$/u.exec(line)).find(Boolean);
      const assertions = tap.filter((line) => /^(?:not )?ok\s+\d+/u.test(line));
      const failures = assertions.filter((line) => line.startsWith("not ok"));

      if (!plan) {
        console.error(`pgTAP ${file}: no pgTAP plan emitted`);
        failed.push(file);
        continue;
      }
      const planned = Number(plan[1]);
      if (assertions.length !== planned || failures.length > 0) {
        console.error(`pgTAP ${file}: ${assertions.length}/${planned} assertions, ${failures.length} failure(s)`);
        for (const failure of failures) console.error(`  ${failure}`);
        failed.push(file);
        continue;
      }

      total += assertions.length;
      console.log(`pgTAP ${file}: ${assertions.length}/${planned} passed.`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (failed.length > 0) {
    throw new Error(`Remote pgTAP: ${total} assertions passed, ${failed.length} file(s) failing: ${failed.join(", ")}`);
  }
  console.log(`Remote pgTAP: ${total} assertions passed.`);
}

const databaseUrl = await getDatabaseUrl();

if (shouldInspectMigrations) await migrate(databaseUrl);

if (shouldTest) {
  if (shouldInspectMigrations && !shouldApply) {
    throw new Error("Use --apply --test to migrate and test, or --test-only to test the current schema");
  }
  await testDatabase(databaseUrl);
}
