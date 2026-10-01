# @flyee/db

The flyee.club database: hand-written SQL migrations with Row Level Security on every table, a pgTAP suite, and a Drizzle mirror generated from the migrations.

## The baseline

`migrations/` holds the baseline `0000`–`0018`, written for a new Supabase project (each file states the inherited MedChina migrations it was rewritten from), and the migrations added on top of it since.

| File | What it holds |
| --- | --- |
| `0000_init` | profiles, organizations (one personal workspace per person), memberships, the sign-up trigger, the superadmin and workspace-deletion guards |
| `0001_audit` | audit trail, row versioning, consent terms per language and `accept_terms()`, sign-in log, `set_user_superadmin()`, `update_member_profile()` |
| `0002_platform` | platform settings (`is_public` decides who reads a key), notifications, announcements, onboarding state, avatars, backups |
| `0003_billing` | plans (`recurring` or one-time `access`, BRL or USD), coupons, subscriptions with price snapshots, invoices, entitlement grants, idempotent checkout and webhook functions |
| `0004_entitlements` | `org_entitlements()`, the single answer to what a workspace may use; `org_has_entitlement()`; the founders offer; comp paths |
| `0005_attribution` | first-touch and purchase attribution, public page views per day and entry door |
| `0006_product_events` | usage telemetry: one vocabulary, one property allowlist, a browser writer and a server writer, daily rollup and retention |
| `0007_content` | help center and blog (`kind`, `audience`, translation groups) |
| `0008_catalog` | trails, modules, immutable versions, lessons with gated video ids, recipes with gated workflows, the public checksum lookup |
| `0009_roadmap` | roadmap items and votes |
| `0010_oauth` | the OAuth 2.1 server: clients, codes, rotating tokens with families, device codes; the `flyee-cli` client |
| `0011_delivery` | member devices with the device ceiling, the CLI request trail and rate limits, downloads, activation facts |
| `0012_impersonation` | support visits and the database-level write fence |
| `0013_leads` | waitlist and newsletter with double opt-in and erasure |
| `0014_meetings` | live sessions: registrations, the gated join link, lifecycle |
| `0015_admin` | operator reports: metrics, members, dossier, weekly segment and entry-door reports |
| `0016_account_deletion` | permanent account deletion |
| `0017_ai_spend` | the platform's own AI spend ledger |
| `0018_seed` | plan ladder (prices are hypotheses), settings, legal texts version 1 in pt-BR and en |
| `0019_launch` | after the baseline: the public site's launch stage (`waitlist` until the kit is on sale) and the operating company shown in the footer |
| `0020_coupon_redemption` | coupon uses counted atomically per purchase (`redeem_coupon`), kit and split purchases included |
| `0021_admin_consoles` | what the phase 6 consoles read: payers per currency in the weekly segment report, catalog usage per module and version (`admin_catalog_stats`), meeting registrants (`admin_meeting_registrants`) |

## Conventions every migration follows

- **Secure by default.** Nothing in `public` is reachable by the API roles unless the migration grants it: an explicit `grant` beside each table's policies, RLS on every table, and for every function `revoke all ... from public, anon` followed by an explicit `grant execute`. PostgreSQL grants EXECUTE to PUBLIC by default, so the revoke is never optional.
- Definer functions pin `set search_path = public`.
- Consent and money tables get `select public.enable_row_versioning('public.<table>')`.
- A file is recorded by its full name (`NNNN_name.sql`) in `public.schema_migrations`; never rename one that a database already applied.
- Every behaviour worth keeping gets a pgTAP file in `tests/` (`NNNN_name.test.sql`, wrapped in `begin` … `rollback`).
- `tests/0016_grants_catalog_scan.test.sql` reads the system catalog: a table or function that becomes reachable by `anon`, a table without RLS, or a definer function without a pinned search path fails it.

## Running the tests

Three ways, same migrations and same tests:

```bash
npm run test:db:embedded   # no Docker: embedded PostgreSQL 17 + a Supabase stand-in (first run installs it into .cache/)
npm run db:start && npm run test:db   # local Supabase via the CLI (needs Docker)
npm run test:db:remote     # against DATABASE_URL (see the remote section)
```

`scripts/db-embedded/run.mjs` also takes `--only <name>`, `--no-tests`, `--sql <file>` and `--keep`.

## Applying to a hosted project

`scripts/remote-db-gate.mjs` reads `DATABASE_URL` from `apps/web/.env.local`, then `apps/web/.env` (or `FLYEE_ENV_FILE`), and refuses localhost targets:

```bash
npm run db:plan:remote     # read-only list of pending migrations
npm run db:migrate:remote  # transactional migrations under an advisory lock
npm run db:gate:remote     # migrate, then run pgTAP
```

On an empty project it bootstraps `public.schema_migrations` and applies the whole baseline. It refuses a database that has a product schema without history, or a history naming files this repo does not have. **Do not point it at the inherited MedChina database**: the root `CLAUDE.md` explains the transition safety rules.

## The Drizzle mirror

`src/schema/schema.ts` and `relations.ts` are generated from the migrations, never edited by hand:

```bash
npm run db:schema:pull     # applies the migrations to the embedded server and runs drizzle-kit pull
```

## Usage

```ts
import { createDb, organizations } from "@flyee/db";

const db = createDb(); // uses DATABASE_URL (Supabase pooler, port 6543)
const orgs = await db.select().from(organizations);
```

**RLS caveat:** `createDb` connects with the `DATABASE_URL` role and bypasses RLS when that role is privileged. Use it in trusted server code only and scope queries by organization. Browser and user-scoped access go through the Supabase client from `@flyee/auth`, which enforces RLS through the user's JWT.
