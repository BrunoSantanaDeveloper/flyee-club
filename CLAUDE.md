# flyee.club — Platform monorepo

The PLATFORM of flyee.club: accounts, billing (Asaas for BRL, Stripe for USD), entitlements, member token issuance with 30-day revalidation, the package-delivery API the `npx flyee` CLI consumes, catalog and release management, the member dashboard, admin consoles, per-segment metrics, the waitlist and the bilingual public site. The PRODUCT (the CLI, the harness core and the module contents) is a separate project that consumes this platform's API contract and module manifest; it never lives here. This repo has no link to any template: it was copied from the MedChina codebase on 2026-09-30 and is being reshaped into the platform phase by phase.

## Where things stand

- Plan and progress: `docs/PLANO-IMPLEMENTACAO.md` (phases 0–8; the "Andamento" table says what is done). Product decisions and open questions: `docs/PRODUCT.md`.
- Done: phase 0 (identity, two locales, de-templated harness) and phase 1 (clinical code, mobile app and dead packages removed). Next: phase 2, the new database baseline.
- **The database still runs the inherited MedChina migrations** (`packages/db/migrations`) until phase 2 replaces them with the baseline `0000`–`0018`. Code written now must not depend on clinical tables, and new schema work goes into the baseline, not on top of the inherited set.

## Safety during the transition

- `apps/web/.env` is inherited and holds **MedChina production credentials** (Supabase, Asaas, Meta, GA4, AI keys). `apps/web/.env.local` blanks every one of them and must stay in place until the new flyee.club services exist. Next.js loads `.env.local` first, so the blank wins.
- Never run `db:plan:remote`, `db:migrate:remote`, `db:gate:remote` or `test:db:remote` until `.env.local` points at the new flyee.club Supabase project. The gate (`scripts/remote-db-gate.mjs`) reads `.env.local` first and refuses a database it does not recognize, but do not lean on that.
- Never commit `.env` or `.env.local`. Commit per plan phase, never push without being asked.

## Product (summary of docs/PRODUCT.md)

- **What it is**: a club sold as a one-time entry kit plus a subscription. Members install the flyee harness in the AI they already use (Claude Code, Codex, Gemini CLI, Cursor) and keep receiving versioned tool modules and the updates that keep them working when the AIs change. The club never spends AI credit on the member's behalf.
- **Ladder** (prices are hypotheses stored as data in `plans`, never in code): free samples → entry kit (one-time, catalog and updates without expiry, 1 device) → subscription (monthly or annual: advanced lessons, recipes, meetings, roadmap vote, 3 devices) → Pro (commercial license, "open the hood" depth, 5 devices) → group mentoring and advisory.
- **Delivery**: the dashboard issues the member token; `npx flyee` installs and updates from the platform's package server. Every update rotates the token; after 30 days without an update the member revalidates in the dashboard, which is where the next tier is offered. Installed tools keep working when access ends; only updates stop.
- **Catalog**: one icon per module, filtered by seven stages (Planejar, Construir, Publicar, Divulgar, Vender, Escalar, Manter). Each module page carries a short lesson in pt-BR and EN (unlisted YouTube), versions, changelog, declared permissions and checksum.
- **Metrics**: usage events only, never content, dimensioned by segment (`produto_proprio`, `freelancer_agencia`, `profissional_ia`, `dev`, `outro`), AI tool and language. The focus segment is chosen by a data rule, not a date.

## Structure

- `apps/web` — Next.js 15 (App Router) + React 19 + MUI v9 + MUI X Premium + Tailwind 4, deployed on Vercel. See `apps/web/CLAUDE.md`.
  - **Member dashboard** (`app/(dashboard)`): `/inicio` (interim home: activation checklist + empty state until phase 5), `/settings` (profile, security and 2FA, connected apps, billing). Phase 5 adds the catalog, recipes, news, meetings, roadmap and devices screens. Screens are goal-first, never CRUD by default; quality is enforced by the `product-screen` skill (loaded by `.claude/hooks/product-screen-guard.mjs`, which also injects `components/product/catalog.json`), the `product-lint` hook and the `product-verify` skill.
  - **Admin** (`app/(dashboard)/admin`, superadmin only): overview, organizations, billing, AI model prices, audit, insights, backups, announcements, help, blog, support. Phase 6 adds catálogo, roadmap, membros, métricas, encontros and leads. Admin copy is hardcoded pt-BR.
  - **Public site** (`app/(marketing)`): interim pages (home, `/planos`, `/contato`, `/ajuda`, `/blog`, `/legal/*`) composed from `components/marketing/*`. Phase 7 rebuilds it bilingual with path-based locales. Quality is enforced by the `marketing-page` skill (loaded by `.claude/hooks/marketing-guard.mjs`) and the `marketing-lint` hook.
  - **Checkout and auth**: `/assinatura`, `/auth/*`, `/oauth/authorize` with `/api/oauth/*` (the OAuth 2.1 server that phase 3 turns into the CLI token server), billing webhooks at `/api/webhooks/[provider]`.
- `packages/design-tokens` — design system source of truth: the provisional palette in `css/green.css`, neutrals in `css/common.css`, `css/marketing.css` (fluid display scale, section rhythm, motion). See its README.
- `packages/db` — Drizzle schema + SQL migrations with RLS (one organization per member: the personal workspace). See its README.
- `packages/auth` — Supabase clients (browser/server/middleware/service), 2FA step-up, and the parallel session cookie used by support impersonation.
- `packages/billing` — plans, subscriptions, coupons, invoices; Asaas and Stripe behind one `PaymentProvider`. Phase 4 adds the one-time access purchase (kit), entitlement grants and routing by currency.
- `packages/email` — Resend + React Email (server-only); no-ops without `RESEND_API_KEY`, so callers keep a fallback.
- `packages/jobs` — Inngest client + typed event map; functions are served by `apps/web` at `/api/inngest`. `sendEvent` never throws; callers fall back to inline work.
- `packages/audit` — append-only `audit_events`, the `access_events` sign-in trail, row versioning, versioned consent terms and acceptances.
- `packages/backup` — nightly logical backups of every `public` table, plus on demand from `/admin/backups`.
- `packages/ai` — chat providers (Anthropic/Gemini/OpenRouter) behind one interface, used by `/admin/insights`; usage feeds the `ai_spend` ledger.
- `packages/fields` — pure validators/formatters/masks (phone, CPF/CNPJ, CEP, currency; persist digits) + the ViaCEP lookup provider.
- `packages/onboarding` — activation state machinery; the steps live in `apps/web/src/lib/onboarding.ts`.
- `packages/content` — `BRAND` (site identity) + the message catalogs `messages/{pt-BR,en}.json`; brand master art in `packages/content/brand/`.
- Phase 3 adds `packages/catalog` (`@flyee/catalog`): the `flyee.module.json` manifest schema the CLI and the upload pipeline share.
- `docs/` — `PRODUCT.md`, `PLANO-IMPLEMENTACAO.md`, `DEPLOY.md`, `DESIGN.md` (provisional direction), `ASAAS-GO-LIVE.md`, `BILLING-AUDIT.md` (historical), `SEO.md` and `TRACKING.md` (rewritten in phase 7).
- `attachments/` — input inbox: drop project material here; agents route each file to its canonical home per `attachments/README.md`.

## Golden rules

- **Platform, not product.** Never add CLI, harness or module logic here. The product exists in this repo only as the `/api/cli/*` contract and the module manifest schema.
- **Configurable data, never constants**: prices, plan limits, device ceilings, rate limits, grace windows, guarantee days and trial lengths live in `plans` and `platform_settings`.
- **Honest metrics**: `product_events` records usage, never content, through one allowlist of names and property values; segment, locale and AI tool are stamped from the profile on the server, never trusted from the client.
- Every mutation records an audit event (`recordAudit` in `apps/web/src/lib/audit.ts`). Every table has RLS, and every new migration states its grants explicitly.
- Visual identity changes ONLY in `packages/design-tokens/css/*.css`; run `npm run tokens:generate` and commit `tokens.generated.ts` with it.
- npm workspaces: install dependencies from the root (`npm install`), never inside an app.
- Icons: Phosphor through the tsconfig alias `@/icons/nexture/*` → `src/icons/phosphor/*` (fallback stubs re-export Nexture).
- Fonts: Mulish (`--font-body`) and Urbanist (`--font-heading`); `font-display` falls back to Urbanist until a licensed display face is chosen and wired as `--font-display` in the root layout.
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
- `npm run db:start` / `db:stop` / `test:db` — local Supabase and the pgTAP suite. The `db:*:remote` scripts are gated: see "Safety during the transition".
- `npm run tokens:generate` — regenerate the TS token mirror.

## Platform decisions

- Deploy: Vercel, only through GitHub Actions (`docs/DEPLOY.md`). Database, auth and storage: Supabase (Postgres + RLS). ORM: Drizzle. Email: Resend. Jobs and cron: Inngest. Billing: Asaas for BRL (PIX, card, Asaas issues the NFS-e) and Stripe for USD, routed by the purchase currency.
- Locales: pt-BR (default) and en. Today i18n is cookie-based and crawlers index only pt-BR. Phase 7.1 makes it hybrid: the public site moves under `app/[locale]` with next-intl `pathnames` (pt-BR at `/`, English at `/en` with translated paths), while dashboard, admin, auth and checkout keep the cookie and profile locale.
- Lessons are unlisted YouTube videos gated by the page and by RLS. Meetings use an external link (Zoom/Meet), with registration and click-through recorded on the platform.
- Do not introduce Cloudflare-specific services (Workers, D1, R2, Workers AI).

This repo stays **private**: the UI layer contains commercially licensed code (MUI X Premium license and the Nexture template components).
