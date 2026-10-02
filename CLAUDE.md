# flyee.club — Platform monorepo

The PLATFORM of flyee.club: accounts, billing (Asaas for BRL, Stripe for USD), entitlements, member token issuance with 30-day revalidation, the package-delivery API the `npx flyee` CLI consumes, catalog and release management, the member dashboard, admin consoles, per-segment metrics, the waitlist and the bilingual public site. The PRODUCT (the CLI, the harness core and the module contents) is a separate project that consumes this platform's API contract and module manifest; it never lives here. This repo has no link to any template: it was copied from the MedChina codebase on 2026-09-30 and is being reshaped into the platform phase by phase.

## Where things stand

- Plan and progress: `docs/PLANO-IMPLEMENTACAO.md` (phases 0–8; the "Andamento" table says what is done). Product decisions and open questions: `docs/PRODUCT.md`.
- Done: phase 0 (identity, two locales, de-templated harness), phase 1 (clinical code, mobile app and dead packages removed), phase 2 (the database baseline), phase 7.1 (path-based locales for the public site), the code of the first-deploy milestone (bilingual waitlist with double opt-in, legal pages from `consent_terms`, launch stage and company line managed at `/admin/support`), phase 4 (the billing ladder: kit, membership and Pro, in BRL through Asaas and USD through Stripe, `docs/BILLING.md`), phase 3 (the CLI token server, the `/api/cli/*` delivery API, the module manifest and the package upload, `docs/CLI-CONTRACT.md`), phase 5 (the member dashboard: home, tools, recipes, news, meetings, roadmap, devices, onboarding), the official brand (logo, Londrina Solid and JetBrains Mono, provisional orange palette), phase 6 (the admin consoles: members, metrics with the focus rule, catalog, roadmap, meetings, leads, and the Monday digest) and phases 7.2 and 7.3 (the public pages: the full home, how it works, the public catalog and module pages, about and the founders offer; visits counted per entry door; the Pixel and GA4 in the member area with version 2 of the privacy and cookie policies; the SEO and tracking docs rewritten) and phase 8 (every e-mail in both languages, the bell written in each member's language, the scheduled jobs, messages to the confirmed list and the unsubscribe flow; `docs/DEPLOY.md`, "E-mails e jobs"). Every phase of the plan is done. What is left is the deploy itself, which waits on the new services and the company data (`docs/DEPLOY.md`, "Primeiro deploy").
- **The database is the flyee.club baseline** (`packages/db/migrations`, `0000`–`0018`, plus the migrations added on top through `0023_messages`, with the pgTAP suite in `packages/db/tests`). It has not been applied to a hosted project yet: that happens once the new Supabase project exists (`npm run db:gate:remote`). New schema work is a new numbered migration on top of it. See `packages/db/README.md`.

## Safety during the transition

- `apps/web/.env` is inherited and holds **MedChina production credentials** (Supabase, Asaas, Meta, GA4, AI keys). `apps/web/.env.local` blanks every one of them and must stay in place until the new flyee.club services exist. Next.js loads `.env.local` first, so the blank wins.
- Never run `db:plan:remote`, `db:migrate:remote`, `db:gate:remote` or `test:db:remote` until `.env.local` points at the new flyee.club Supabase project. The gate (`scripts/remote-db-gate.mjs`) reads `.env.local` first, bootstraps an EMPTY project, and refuses a database it did not build (the MedChina one included, whose history names files this repo does not have), but do not lean on that.
- Never commit `.env` or `.env.local`. Commit per plan phase, never push without being asked.

## Product (summary of docs/PRODUCT.md)

- **What it is**: a club sold as a one-time entry kit plus a subscription. Members install the flyee harness in the AI they already use (Claude Code, Codex, Gemini CLI, Cursor) and keep receiving versioned tool modules and the updates that keep them working when the AIs change. The club never spends AI credit on the member's behalf.
- **Ladder** (prices are hypotheses stored as data in `plans`, never in code): free samples → entry kit (one-time, catalog and updates without expiry, 1 device) → subscription (monthly or annual: advanced lessons, recipes, meetings, roadmap vote, 3 devices) → Pro (commercial license, "open the hood" depth, 5 devices) → group mentoring and advisory.
- **Delivery**: the dashboard issues the member token; `npx flyee` installs and updates from the platform's package server. Every update rotates the token; after 30 days without an update the member revalidates in the dashboard, which is where the next tier is offered. Installed tools keep working when access ends; only updates stop.
- **Catalog**: one icon per module, filtered by seven stages (Planejar, Construir, Publicar, Divulgar, Vender, Escalar, Manter). Each module page carries a short lesson in pt-BR and EN (unlisted YouTube), versions, changelog, declared permissions and checksum.
- **Metrics**: usage events only, never content, dimensioned by segment (`produto_proprio`, `freelancer_agencia`, `profissional_ia`, `dev`, `outro`), AI tool and language. The focus segment is chosen by a data rule, not a date.

## Structure

- `apps/web` — Next.js 15 (App Router) + React 19 + MUI v9 + MUI X Premium + Tailwind 4, deployed on Vercel. See `apps/web/CLAUDE.md`.
  - **Member dashboard** (`app/(dashboard)`): `/inicio` (the member's rung, the install block with machines and the revalidation date, the activation checklist, latest releases, an offer when `lib/upsell.ts` says so), `/modulos` and `/modulos/[slug]` (the catalog, lessons, permissions, releases), `/receitas`, `/novidades`, `/encontros`, `/roadmap`, `/settings` (profile, segment, AI tool, language, security and 2FA, devices, billing), plus the three-step wizard at `/onboarding`. Each screen is a server page that loads data with the member's session (`lib/member/*`) and a view that takes plain props. Screens are goal-first, never CRUD by default; quality is enforced by the `product-screen` skill (loaded by `.claude/hooks/product-screen-guard.mjs`, which also injects `components/product/catalog.json`), the `product-lint` hook and the `product-verify` skill.
  - **Admin** (`app/(dashboard)/admin`, superadmin only): overview; the club's consoles — `/admin/membros` (accounts, rungs, machines, the dossier and every action on an account), `/admin/metricas` (the five focus metrics per segment and week, the focus rule, entry doors), `/admin/catalogo` (tools, version upload and publishing, lessons, recipes, trails, delivery settings), `/admin/roadmap`, `/admin/encontros`, `/admin/leads`; then billing, AI model prices, audit, insights, backups, announcements, help, blog and news, site and support. Each console is a server page that reads with the operator's session (`lib/admin/*`, `loadConsole`) and a client view; writes are server actions that check the role again and audit. A Monday digest (`lib/admin-jobs.ts`) rings and e-mails the operators. Admin copy is hardcoded pt-BR.
  - **Public site** (`app/[locale]/(marketing)`): the home, `/como-funciona`, `/catalogo` and `/catalogo/[slug]` (published modules, read-only), `/planos`, `/sobre`, `/contato`, `/ajuda`, `/blog`, the waitlist (`/espera`), the checksum page (`/verificar/[ref]`) and the legal pages rendered from `consent_terms`, composed from `components/marketing/*`, in Portuguese at `/` and in English at `/en` with translated addresses (`src/i18n/routing.ts`). Campaign pages without the site menu live in `app/[locale]/(funil)` (`/fundadores`, `noindex`). Until the launch stage is `open`, every primary CTA leads to the waitlist. Every number on a public page comes from the database. Quality is enforced by the `marketing-page` skill (loaded by `.claude/hooks/marketing-guard.mjs`) and the `marketing-lint` hook, both covering the two groups.
  - **Checkout and auth**: `/assinatura`, `/auth/*`, billing webhooks at `/api/webhooks/[provider]`.
  - **CLI connection and delivery** (`docs/CLI-CONTRACT.md`): the OAuth 2.1 server for the first-party `flyee-cli` client (`/oauth/authorize` with its revalidation variant, `/ativar` for device codes, `/revalidar`, `/api/oauth/{token,device,revoke}`), the delivery API `/api/cli/*` (every call walks `lib/cli/gates.ts`: token → scope → entitlement → device → rate), the package upload `/api/admin/catalog/{uploads,versions}` and the public checksum page `/verificar/[ref]`.
- `packages/design-tokens` — design system source of truth: the provisional palette in `css/orange.css` (`theme-orange`), neutrals and the deep band (`--background-deep`) in `css/common.css`, `css/marketing.css` (fluid display scale, section rhythm, motion). See its README.
- `packages/db` — the SQL baseline with RLS on every table and explicit grants (one organization per member: the personal workspace), the pgTAP suite, and a Drizzle mirror generated from the migrations. See its README.
- `packages/auth` — Supabase clients (browser/server/middleware/service), 2FA step-up, and the parallel session cookie used by support impersonation.
- `packages/billing` — the ladder (the kit as a one-time access purchase; membership and Pro, monthly and yearly; every plan in BRL and in USD), subscriptions with price snapshots, entitlement grants, coupons, invoices; Asaas (BRL) and Stripe (USD) behind one `PaymentProvider`, routed by the plan's currency. Pure, client-safe helpers in `@flyee/billing/currency` and `@flyee/billing/entitlements`. See `docs/BILLING.md`.
- `packages/email` — Resend + React Email (server-only): one sender per message, the templates and their copy in both languages (`src/copy/pt-BR.ts` is the structural source). No sender throws, and all no-op without `RESEND_API_KEY`, so callers keep a path that works without e-mail. See its README.
- `packages/jobs` — Inngest client + typed event map; functions live next to the code they run (`apps/web/src/lib/*-jobs.ts`, a package's `src/jobs.ts`) and are served by `apps/web` at `/api/inngest`. `sendEvent` never throws; callers fall back to inline work. Jobs that write to people follow claim-then-send (its README).
- `packages/audit` — append-only `audit_events`, the `access_events` sign-in trail, row versioning, versioned consent terms and acceptances.
- `packages/backup` — nightly logical backups of every `public` table, plus on demand from `/admin/backups`.
- `packages/ai` — chat providers (Anthropic/Gemini/OpenRouter) behind one interface, used by `/admin/insights`; usage feeds the `ai_spend` ledger.
- `packages/fields` — pure validators/formatters/masks (phone, CPF/CNPJ, CEP, currency; persist digits) + the ViaCEP lookup provider.
- `packages/onboarding` — activation state machinery; the steps live in `apps/web/src/lib/onboarding.ts`.
- `packages/content` — `BRAND` (site identity) + the message catalogs `messages/{pt-BR,en}.json`. The official brand art (the SVGs, as delivered) lives in `apps/web/public/brand/`; every raster is derived from the mark by `npm run brand:assets -w @flyee/web`.
- `packages/catalog` — the `flyee.module.json` manifest schema (zod, published as JSON Schema at `/api/cli/schema/module`) and the catalog's version rules, shared by the upload pipeline and the delivery API.
- `docs/` — `PRODUCT.md`, `PLANO-IMPLEMENTACAO.md`, `DEPLOY.md`, `DESIGN.md` (provisional direction), `HOME-COPY.md` (the home copy the product owner delivered), `ASAAS-GO-LIVE.md`, `BILLING.md` (the billing design), `CLI-CONTRACT.md` (the contract the CLI builds against), `BILLING-AUDIT.md` (historical), `SEO.md` and `TRACKING.md` (rewritten in phase 7).
- `attachments/` — input inbox: drop project material here; agents route each file to its canonical home per `attachments/README.md`.

## Golden rules

- **Platform, not product.** Never add CLI, harness or module logic here. The product exists in this repo only as the `/api/cli/*` contract and the module manifest schema.
- **Configurable data, never constants**: prices, plan limits, device ceilings, rate limits, grace windows, guarantee days and trial lengths live in `plans` and `platform_settings`.
- **Honest metrics**: `product_events` records usage, never content, through one allowlist of names and property values; segment, locale and AI tool are stamped from the profile on the server, never trusted from the client.
- Every mutation records an audit event (`recordAudit` in `apps/web/src/lib/audit.ts`). Every table has RLS, and every new migration states its grants explicitly.
- Visual identity changes ONLY in `packages/design-tokens/css/*.css`; run `npm run tokens:generate` and commit `tokens.generated.ts` with it.
- npm workspaces: install dependencies from the root (`npm install`), never inside an app.
- Icons: Phosphor through the tsconfig alias `@/icons/nexture/*` → `src/icons/phosphor/*` (fallback stubs re-export Nexture).
- Fonts: Mulish (`--font-body`), Londrina Solid (`--font-heading`; `font-display` falls back to it) and JetBrains Mono (`--font-mono`). Londrina Solid has two weights, Regular and Black: Black (`font-bold`) for the display scale and headings from 24px up, Regular (`font-normal`) below that.
- The dark band (footer, deep sections, terminal bodies) is `bg-background-deep`, never the dark primary: it has to stay dark under any palette.
- Red is reserved for risk and failure.

## Shared Claude/Codex harness

- `CLAUDE.md`, `apps/web/CLAUDE.md`, `.claude/rules/*`, `.claude/skills/*` and `.claude/hooks/*` are the canonical shared sources. They are the platform's development harness: nothing in them is distributed to members. Do not maintain a second hand-written Codex copy.
- Codex reads the generated `AGENTS.md` mirror and the generated `.agents/skills/*` bridges. `.codex/config.toml` points its lifecycle hooks at the same implementations under `.claude/hooks/`.
- `PostToolUse` runs `scripts/sync-agent-harness.mjs` after canonical harness edits. `npm run harness:check` and `npm run harness:test` also run in the pre-commit hook.

## Commands (root)

- `npm run dev` / `build` / `start` / `lint` / `lint:fix` / `prettier` — delegate to `apps/web`.
- `npm run typecheck` — `apps/web` with its pinned TypeScript 5.8. Never run a bare root `npx tsc` on apps/web: it picks the hoisted TS 6.
- `npm run test` — `@flyee/ai` node tests + the web vitest suite. `npm run test:e2e` / `test:a11y` — Playwright against a production build.
- `npm run ci:verify` — everything CI runs: harness checks, MUI class check, typecheck, tests, build.
- `node scripts/prune-messages.mjs --check|--write|--list` — message catalogs without unused or missing keys (pt-BR is the reference).
- `npm run test:db:embedded` — migrations + pgTAP on an embedded PostgreSQL 17, no Docker (first run installs it into `.cache/`). `npm run db:start` / `db:stop` / `test:db` — the same through local Supabase (needs Docker). The `db:*:remote` scripts are gated: see "Safety during the transition".
- `npm run db:schema:pull` — regenerate the Drizzle mirror from the migrations.
- `npm run tokens:generate` — regenerate the TS token mirror.

## Platform decisions

- Deploy: Vercel, only through GitHub Actions (`docs/DEPLOY.md`). Database, auth and storage: Supabase (Postgres + RLS). ORM: Drizzle. Email: Resend. Jobs and cron: Inngest. Billing: Asaas for BRL (PIX, card, Asaas issues the NFS-e) and Stripe for USD, routed by the purchase currency.
- Locales: pt-BR (default) and en, hybrid since phase 7.1: the public site lives under `app/[locale]` with next-intl `pathnames` (pt-BR at `/`, English at `/en` with translated paths, both indexed with hreflang), while dashboard, admin, auth and checkout keep the cookie and profile locale.
- Lessons are unlisted YouTube videos gated by the page and by RLS. Meetings use an external link (Zoom/Meet), with registration and click-through recorded on the platform.
- Do not introduce Cloudflare-specific services (Workers, D1, R2, Workers AI).

This repo stays **private**: the UI layer contains commercially licensed code (MUI X Premium license and the Nexture template components).
