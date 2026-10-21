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
| `0004_entitlements` | `org_entitlements()`, the single answer to what a workspace may use; `org_has_entitlement()`; the founders offer, dropped by `0038`; comp paths |
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
| `0022_tracking_terms` | version 2 of the privacy and cookie policies, in both languages: the Pixel and GA4 also load in the member area (version 1 switched off, never edited) |
| `0023_messages` | what the phase 8 jobs and e-mails need: claim-then-send functions for the connection reminder (`claim_token_reminders`), the end of a paid period that does not renew (`claim_term_end_notices`), meeting e-mails (`due_meeting_emails`, `claim_meeting_emails`) and messages to the confirmed list (`newsletter_sends`, `newsletter_deliveries` and their functions); retention of sign-in leftovers (`purge_oauth_leftovers`); who a message is written to, with the address read once from `auth.users` (`member_recipients`) |
| `0024_access_term` | the commercial rules of the home brief: a one-time access lasts `plans.access_months` (12) from the paid invoice and a repurchase chains a new term after the current one (`grant_entitlement_on_invoice`); every paid plan allows client projects (`commercial_license`); the end of an access is announced and settled once (`claim_access_end_notices`, `claim_access_endings`); a refunded parcel reaches the grant of its installment (`revert_paid_invoice` with a purchase reference); terms of use version 2 |
| `0025_two_plans` | two plans named after the club: the access is "FlyeeClub" and the subscription "FlyeeClub Pro" (which inherits `open_the_hood`); the former Pro family is inactive and off the grids, never deleted; `consulting` joins the offers an event may name; terms of use version 3 with the names. |
| `0026_roadmap_proposals` | the custom app, the minimal honest way: a FlyeeClub Pro member proposes a roadmap item into a moderated queue (`submitted`, `propose_roadmap_item`, ceiling in `platform_settings.roadmap`), visible to the author and the operator only; `roadmap_month_leader(month)` names the open idea with the most votes cast in the month; `roadmap.proposed` joins the events and `custom_app` the offers. |
| `0027_legal_texts_v3` | version 3 of the privacy and cookie policies, built from version 2 by checked replacements: the cookie policy names the segment cookie and the click measurement, the privacy policy names the platform FlyeeClub; no consent change. |
| `0028_segments_from_the_site` | the segments are the public site's personas: `member_segment` renamed to `negocio`, `agencia`, `produto`, `dev`, `outro`; the rows of the retired `profissional_ia` become `outro` before its slot takes the name `negocio`, and the daily rollup (segment as text) is summed into `outro` and renamed. |
| `0029_store_categories` | two layers in the catalog: `catalog_store_categories` (the kinds of work the public store filters by, seeded with the home brief's Vender, Divulgar, Vídeo, Pesquisa, Construir; public read, operator write) and an optional `catalog_modules.store_category` (on delete set null); the stages stay the catalog's taxonomy. |
| `0030_guides` | written guides carried by each version's package: `catalog_module_versions.guides` (which guides a version carries, public) and `catalog_guides` (the text, written only by the upload, read through `can_read_guide`: the basic depth with the app's entitlement, "abrir o capô" with `advanced_lessons`, drafts by the operator only). |
| `0031_terms_custom_apps` | terms of use version 4, built from version 3 by one checked replacement: an app built on demand joins the store for every member unless an exclusivity agreement is made in writing before hiring. |
| `0032_module_personas` | `catalog_modules.personas`: the site personas (`member_segment` without `outro`) an app is a good start for, marked by the operator, public on published apps; read by the home brief's "Para quem é" block. |
| `0033_roadmap_coming_next` | "Próximos na loja": `roadmap_items.won_month` (the month an idea was the most voted, recorded when planned from the leaders card) and `commissioned` (a paid request), and `roadmap_coming_next()`, the only part of the roadmap a visitor reads (planned and building ideas, with those two marks). |
| `0034_store_badges` | `platform_settings.catalog` (public): how many days after its first publication an app shows "Novo" in the store (30 to start); "Usa sua conta" comes from each app's required external credentials. |
| `0035_legal_copy_rules` | The copy rules (no dash, exclamation mark, emoji or banned word) in the legal texts: version 5 of the English terms of use and version 2 of the English CLI connection term, each built from the text in force by one checked replacement ("unlocks" out). The Portuguese texts keep their versions. pgTAP `0033_copy_rules` keeps every seeded text in force inside the rules. |
| `0036_ai_tool_detail` | The tool the CLI found when no tested AI is there: `member_devices.ai_tool_detail`, kept by `register_member_device` (new last argument) only beside `ai_tool = 'other'` and only when `platform_settings.cli.known_tools` lists the name (seeded with the core's six "compatible by the standard" tools); anything else is dropped, never refused. The finished CLI already sends it, and the strict report refused the login. |
| `0037_plans_on_site` | `plans.listed_on_site`: whether the public site lists a plan, read together with `is_public` (the member area's grids). FlyeeClub (`kit`, `kit-usd`) is on both, FlyeeClub Pro on the member area only, and a new plan starts off the site (docs/PRODUCT.md, 2026-10-08). |
| `0038_no_founders` | The founders offer leaves the platform, a concept of the MedChina codebase that FlyeeClub does not have: `founders_offer()` is dropped (anon now calls four functions), the `founders` setting deleted, and `club-fundador-anual` kept for history, inactive and off every grid and the site. `founders` stays among the offers the event allowlist accepts. |
| `0039_pro_features` | Which feature sells FlyeeClub Pro, now offered on the click of one of its features (docs/PRODUCT.md, 2026-10-08): the offer events keep `feature` (a closed list of seven) and the screens `roadmap`, `recipes`, `meetings` and `devices` as `origin`; `admin_pro_features(days)` reads per feature the workspaces that opened the prompt, clicked to buy and bought Pro within 14 days of that click; `catalog_recipe_has_workflow(slug)` tells a member without the right whether a recipe has its step by step written, without reading it. |
| `0040_entry_version` | The entry version of each app (docs/PRODUCT.md, 2026-10-06 and option 1 of 2026-10-08): `catalog_module_versions.is_entry`, at most one per module and only on a published version, marked on a module's first release, moved or cleared by the operator through `catalog_set_entry_version`, never yanked while marked; the free plan's `update_channel` becomes `free`, and `entitlement_merge` lets the widest channel win (every account carries the free plan as floor and as its own subscription, merged after the grants); `can_read_guide` and `can_watch_lesson` open the basic depth of the entry version to every account; `catalog_modules.is_free_sample` is dropped. |
| `0041_payment_processors` | The terms of use name both processors (docs/PRODUCT.md, 2026-10-12: Stripe charges reais too until Asaas is set up): the payment paragraph of the terms in force, in both languages, says purchases are processed by Stripe or by Asaas as the payment page shows, and that card installments in reais apply when the payment page offers them. One checked replacement per language on the version in force, the previous one kept on record (the method of `0035`). |
| `0042_version_guides_readable` | The column grant `guides` never had: `catalog_module_versions` is read through column grants (0008), and 0030 added `guides` without one, so every session read that named it was refused (the catalog console, the guides in the member area and on the public page). anon and authenticated now read it; the package address, the manifest and the author stay closed. pgTAP `0040_version_columns_readable` fails on the next column that forgets its grant. |
| `0043_module_showcase` | `catalog_modules.showcase`: the example of each app answering a request, per language (`{request, reply: [{label?, text}], saved?}`), which the home, `/catalogo` and each app page show instead of an install command (decided 2026-10-17). Sent by the product's index and checked by the import (`lib/catalog/showcase.ts`); the column only insists on an object. The example the home copy carried moves to `youtube-script` where that app exists and has none. |
| `0044_cloud_slot` | One Claude Code session in the cloud per account, out of the device ceiling (the product's request of 2026-10-20, item 4, decision D1): `member_devices.cloud` (null for a computer, `claude_code` for a cloud session, fixed at creation by a trigger), `plans.limits.cloud_sessions = 1` in every plan, `oauth_device_codes.cloud` for /ativar, and `register_member_device` with `target_cloud`: computers count against `limits.devices` without the cloud rows, and a cloud registration past `cloud_sessions` revokes the oldest cloud session and its tokens (reason `replaced`, now in the event allowlist and in `revoke_member_device`), never a computer. |

## Conventions every migration follows

- **Secure by default.** Nothing in `public` is reachable by the API roles unless the migration grants it: an explicit `grant` beside each table's policies, RLS on every table, and for every function `revoke all ... from public, anon` followed by an explicit `grant execute`. PostgreSQL grants EXECUTE to PUBLIC by default, so the revoke is never optional.
- A table read through COLUMN grants (`catalog_module_versions`, whose package address and manifest no session reads) needs a grant for every column added later, beside the `add column`: without it, every session read that names the column is refused as "permission denied for table" (`guides` until 0042).
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
