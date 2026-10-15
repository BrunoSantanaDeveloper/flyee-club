# flyee.club — plataforma

Plataforma do flyee.club: contas, cobrança (Asaas em BRL, Stripe em USD), emissão e revalidação do token do integrante, API de entrega de pacotes para a CLI `npx flyee`, catálogo e releases de módulos, painel do integrante, consoles admin, métricas por segmento, lista de espera e site público bilíngue (pt-BR em `/`, inglês em `/en`).

O **produto** (a CLI, o core do harness e o conteúdo dos módulos) é um projeto separado que consome o contrato de API e o schema de manifesto definidos aqui.

## Documentos

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — PRD, decisões tomadas e decisões em aberto.
- [`docs/PLANO-IMPLEMENTACAO.md`](docs/PLANO-IMPLEMENTACAO.md) — plano por fases e estado de cada uma.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Vercel via GitHub Actions, variáveis e domínio.
- [`CLAUDE.md`](CLAUDE.md) — convenções do repositório para pessoas e agentes.

## Stack

Monorepo npm workspaces: `apps/web` (Next.js 15, MUI v9 + MUI X só nos pacotes gratuitos, Tailwind 4) e `packages/*` (auth, db, billing, audit, email, jobs, design-tokens, content e outros). Supabase (Postgres + RLS, Auth, Storage), Inngest, Resend, Vercel.

## Comandos (na raiz)

```bash
npm install          # sempre na raiz
npm run dev          # apps/web em modo desenvolvimento
npm run typecheck
npm test
npm run build
npm run db:start     # Supabase local (exige Docker)
npm run test:db      # testes pgTAP no banco local
```

> Antes de qualquer comando que toque serviços externos, confira `apps/web/.env.local` e `apps/web/.env`: o `.env` herdado da cópia do MedChina aponta para os serviços do MedChina. Ver `docs/DEPLOY.md`.

Repositório privado: contém código de UI licenciado comercialmente (os componentes do template Nexture).
