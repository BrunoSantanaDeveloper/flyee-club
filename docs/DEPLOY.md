# Deploy — Vercel via GitHub Actions

O `apps/web` é publicado na Vercel **exclusivamente pelo pipeline do GitHub**
(`.github/workflows/deploy.yml`), usando a Vercel CLI com token. O projeto na
Vercel fica **sem conexão Git** — a integração Git da Vercel nunca é ligada
(ela força um vínculo de conta GitHub e conflita quando há várias contas GitHub
na mesma máquina/organização).

- `push` na `main` (ou execução manual do workflow) → deploy de **produção**
- `pull_request` → deploy de **preview** (URL no summary da execução)

O workflow roda `vercel deploy` (com `--prod` na produção): o pipeline **envia
o código-fonte e a Vercel compila na nuvem**. Isso é deliberado — o fluxo
alternativo (`vercel build --prebuilt`, compilando no runner) isola o build no
Root Directory (`apps/web`) e quebra os symlinks de workspace para
`../../packages/*` (`Module not found: Can't resolve '@flyee/content'`). O build
da nuvem resolve os pacotes `@flyee/*` nativamente. Continua tudo por token, sem
a integração Git da Vercel.

## Setup único

### 1. Criar/vincular o projeto na Vercel (local, uma vez)

Na raiz do repositório (o login é na conta **Vercel**, independente das contas
GitHub da máquina):

```bash
npx vercel login
npx vercel link
```

No `link`, escolha o escopo (team/conta) e crie o projeto novo (ex.:
`flyee-club`). Isso gera `.vercel/project.json` (gitignored) com o `orgId` e o
`projectId` — são os valores dos secrets do passo 4. O `.vercel/` herdado da
cópia do MedChina foi apagado em 2026-09-30: ele apontava para o projeto do
MedChina, e um `vercel deploy` daqui publicaria o flyee.club lá.

### 2. Configurar o projeto no dashboard da Vercel

Em **Settings → General**:

- **Root Directory**: `apps/web` (obrigatório — monorepo npm workspaces; a
  Vercel detecta os workspaces e instala a partir da raiz do repo)
- **Include files outside of the Root Directory in the Build Step**: **LIGADO**
  (checkbox logo abaixo do Root Directory). Sem isso, o build da nuvem fica
  confinado a `apps/web` e os pacotes compartilhados (`@flyee/content`,
  `@flyee/design-tokens`, etc., que vivem em `../../packages/*`) não resolvem —
  o build quebra com `Module not found: Can't resolve '@flyee/content'`.
- **Framework Preset**: Next.js.
- **Node.js Version**: 22.x (ou 24.x — o build da nuvem usa a versão do projeto).
- **Build/Install/Output Command (Override)**: deixe os toggles **DESLIGADOS**.
  O `apps/web/vercel.json` (versionado) já define o install e o build — ele tem
  precedência e é a fonte de verdade (ver abaixo). Não duplique no dashboard.

> O deploy é build na nuvem: essa config vale no ato do build. Ligue o checkbox
> no dashboard e reexecute o workflow.

Em **Settings → Git**: **não conectar** nenhum repositório. É isso que evita o
conflito de contas — todo deploy entra pela CLI do pipeline.

#### `apps/web/vercel.json` — duas correções que NÃO podem sumir

```json
{ "installCommand": "cd ../.. && npm ci", "buildCommand": "next build" }
```

1. **`installCommand: "cd ../.. && npm ci"`** — o install padrão da Vercel
   (rodado dentro de `apps/web`) NÃO cria os symlinks de workspace
   `node_modules/@flyee/*`, mesmo com o checkbox de "include files outside"
   ligado. Resultado: `Module not found: Can't resolve '@flyee/content'`
   (compila localmente porque o `node_modules` local já tem os links). Forçar
   `npm ci` na RAIZ do monorepo instala com os workspaces linkados corretamente.
2. Memória do build (ver `apps/web/next.config.mjs`): o container de build (8 GB)
   dava **OOM/SIGKILL** na fase "Linting and checking validity of types". O
   `next.config.mjs` desliga lint+typecheck no `next build`
   (`eslint.ignoreDuringBuilds` + `typescript.ignoreBuildErrors` — ambos já são
   cobertos pelas etapas dedicadas do CI) e limita a paralelização
   (`experimental.cpus: 1` + `webpackMemoryOptimizations`). Se o build voltar a
   dar OOM ao crescer, o passo seguinte é aumentar o build machine (plano Pro).

#### `.vercelignore`: o que nunca sobe

A CLI da Vercel não lê o `.gitignore`. Ela pula uma lista fixa (nela estão
`.env.local` e `.env.*.local`, mas não o `.env`) e o que estiver no
`.vercelignore` da pasta de onde o comando roda. Por isso há um `.vercelignore`
na raiz e outro em `apps/web`, os dois com `.env` e `.env.*`: um `vercel deploy`
digitado na sua máquina subiria o `apps/web/.env`, o build o leria, e toda
variável que faltasse no projeto da Vercel tomaria o valor desse arquivo.
Enquanto ele for a cópia herdada do MedChina, são credenciais de produção de
outro produto.

O deploy continua saindo só pelo pipeline, onde esse arquivo nem existe. As duas
linhas valem para o dia em que alguém esquecer disso, e
`scripts/preflight-env.test.mjs` reprova se elas saírem de um dos dois arquivos.
Conferido em 2026-10-08 no código das versões 54.6.1 e 63.1.0 da CLI, e com a
mesma biblioteca que ela usa para decidir o que sobe.

### 3. Variáveis de ambiente (Settings → Environment Variables)

Cadastre em **Production** (e repita em **Preview** as que quiser testar em
PRs — no mínimo as de Supabase). Referência completa:
`apps/web/.env.example`.

> **Atenção, ambiente local:** o `apps/web/.env` veio da cópia do MedChina e
> aponta para o Supabase de produção, a chave Asaas, Meta/GA4 e chaves de IA do
> MedChina. O `apps/web/.env.local` criado em 2026-09-30 deixa essas variáveis
> vazias (o Next lê `.env.local` antes de `.env`, e o script de migração remota
> segue a mesma ordem). Ponha os valores dos projetos do flyee.club no
> `.env.local`, ou troque o `.env` e apague o `.env.local`. Nunca rode
> `db:*:remote` antes disso.

Antes de cadastrar qualquer valor, rode `npm run preflight` ("Roteiro da
abertura", abaixo). Ele diz o que falta para cada estágio e acusa, pelo nome, um
valor que ainda venha do `.env` herdado.

Obrigatórias para produção:

| Variável | Observação |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `DATABASE_URL` | connection string **pooled** (porta 6543) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only (admin, backups, billing público) |
| `NEXT_PUBLIC_SITE_URL` | domínio canônico, sem barra final (sitemap/robots/OG/JSON-LD caem para `http://localhost:3000` sem ela) |

Operação:

| Variável | Observação |
| --- | --- |
| `BILLING_BRL_PROVIDER` | quem cobra em real: vazio ou `asaas` é o Asaas; `stripe` manda o real para a Stripe (decidido em 2026-10-12: a Stripe cobra tudo até o Asaas existir). Qualquer outro valor tira o real de venda |
| `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` / `ASAAS_BASE_URL` | cobrança em BRL pelo Asaas (produção: `https://api.asaas.com/v3`); dispensáveis enquanto `BILLING_BRL_PROVIDER=stripe` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | cobrança em USD, e em BRL enquanto `BILLING_BRL_PROVIDER=stripe` |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | jobs em background. Sem elas o que parte de uma ação roda no próprio pedido, mas nada agendado roda (lembretes, resumos, encerramento de assinaturas, limpeza): obrigatórias em produção |
| `RESEND_API_KEY` / `EMAIL_FROM` | e-mails do app (sem elas os avisos ficam só no sino do painel). **Obrigatórias para a lista de espera**: sem o e-mail de confirmação ninguém confirma, e o formulário responde que a lista está fora do ar. Ver "E-mails e jobs" |
| `CONTACT_FORM_TO` | destino do formulário de contato |
| `PUBLIC_FORMS_IP_SALT` | segredo da janela por rede da lista de espera (HMAC do IP). Sem ele não há limite por rede |
| `ANTHROPIC_API_KEY` ou `GEMINI_API_KEY` ou `OPENROUTER_API_KEY` | opcional: provedor do `/admin/insights`, custo do operador |
| `BACKUP_RETENTION_DAYS` | opcional (default 30) |

### 4. Token e secrets do GitHub

1. Vercel → **Account Settings → Tokens** → criar um token com escopo no
   team/conta do projeto.
2. GitHub → repositório → **Settings → Secrets and variables → Actions**:
   - `VERCEL_TOKEN` — o token criado
   - `VERCEL_ORG_ID` — `orgId` do `.vercel/project.json`
   - `VERCEL_PROJECT_ID` — `projectId` do `.vercel/project.json`
3. **Autor dos commits.** No plano Hobby a Vercel só aceita o deploy de um
   commit cujo autor é o dono do time, mesmo vindo da CLI. Sem o GitHub
   conectado à conta da Vercel (e ele fica desconectado, pelo conflito de
   contas acima), ela reconhece o dono pelo e-mail: o e-mail do commit tem de
   ser o da conta da Vercel. Por isso o repositório tem a identidade própria,
   como no MedChina:

   ```bash
   git config --local user.email <e-mail da conta da Vercel>
   ```

   A alternativa, sem mexer no git, é cadastrar e verificar o e-mail dos commits
   como e-mail secundário da conta (Vercel → Account Settings → Emails). Vale
   para todo clone e toda máquina que commita: um commit de outro autor no
   topo da `main` é bloqueado (ver "Troubleshooting").

### 5. Domínio

**Settings → Domains** → adicionar o domínio de produção e apontar o DNS.
`NEXT_PUBLIC_SITE_URL` deve ser exatamente esse domínio (com `https://`, sem
barra final).

## O que o deploy NÃO faz

- **Migrações de banco**: o pipeline não toca no Postgres. Quando houver
  migração nova em `packages/db/migrations`, rode antes do merge:
  `npm run db:plan:remote` (dry-run) e `npm run db:gate:remote`
  (aplica + testa) — ver `scripts/remote-db-gate.mjs`.
- **Storage/RLS/seeds**: idem — tudo entra pelas migrações.

## Roteiro da abertura

Do repositório como está até a loja vendendo, em dois marcos. No **marco A** o
site sobe com a lista de espera: nada está à venda, e o que se prova é o caminho
inteiro de um deploy (banco, variáveis, e-mail, jobs, login). No **marco B** a
loja abre: cobrança, apps publicados, o ensaio com a CLI de verdade e a virada
do estágio. A ordem importa, porque cada passo usa o que o anterior deixou
pronto.

Este roteiro substitui o antigo "Primeiro deploy". O andamento está em
`docs/PLANO-IMPLEMENTACAO.md`, item 12.7.

### O que só você pode trazer

| O quê | Para quê | Marco |
| --- | --- | --- |
| Projeto novo no Supabase | banco, login e arquivos | A |
| Projeto na Vercel e um token | o deploy pelo pipeline ("Setup único", passos 1, 2 e 4) | A |
| O domínio `flyee.club` no registrador | site, remetente dos e-mails, endereços de login | A |
| Conta no Resend com o domínio verificado | todo e-mail, inclusive os de login | A |
| App no Inngest | tudo que é agendado | A |
| Razão social, CNPJ, cidade e UF | os termos identificam a operadora pelo rodapé | A |
| Conta Stripe (Stripe Brasil, da empresa) | vender em dólar e, enquanto o Asaas não existe, em real; sem ela a loja não vende nada | B |
| Conta Asaas aprovada para produção | vender em real pelo Asaas, com Pix na página, parcelamento e a NFS-e; dispensável enquanto a Stripe cobra o real | depois da abertura |
| Os cinco pacotes `.zip` | vêm do repositório do produto | B |
| A CLI 1.0.0 publicada no npm como `latest`, do lado do produto | `/instalar.md` manda a IA rodar `npx --yes flyee@latest`; tem de existir antes do ensaio (passo 16, abaixo) | B |
| Preços conferidos | os de `plans` são hipóteses | B |
| Um segundo projeto no Supabase, o sandbox do Asaas e o modo de teste do Stripe | o ensaio das compras sem dinheiro de verdade (passo 17, abaixo) | B |

### Onde você está: a conferência do ambiente

`npm run preflight` lê as variáveis e diz, uma por uma, o que falta para um
estágio. Não usa rede, banco nem conta, e nunca imprime um valor que possa ser
credencial: só nomes e o que há de errado com cada um.

```bash
npm run preflight -- --stage waitlist     # marco A
npm run preflight -- --stage open         # marco B
```

Sem `--file`, ele lê o que o Next e o gate do banco leem nesta máquina:
`apps/web/.env.local` por cima de `apps/web/.env`, em que o primeiro arquivo
que define uma chave decide, mesmo com valor vazio. `✘` impede o estágio, `!`
pede o seu julgamento e `·` é só informação. O comando sai com código 1 quando
há `✘`. O `?` só aparece num arquivo puxado da Vercel: a variável está
cadastrada e o valor não foi lido (abaixo).

O que ele confere além de "está preenchida":

- **A chave do Supabase pelo que ela é**, não pela variável em que está. Uma
  chave de serviço numa variável `NEXT_PUBLIC_` vai para todo navegador.
- **O endereço do banco**: o do pool, na porta 6543, do mesmo projeto das
  chaves e com a senha preenchida. O painel do Supabase entrega o texto com
  `[YOUR-PASSWORD]` no lugar dela.
- **O Asaas**: endereço de produção e chave de produção juntos. O endereço
  vazio é o sandbox, e ali ninguém paga.
- **Chave de teste do Stripe com a loja aberta**, e chave de produção num
  preview, onde uma compra de teste cobraria de verdade.
- **O remetente**: sem `EMAIL_FROM`, as mensagens saem de
  `onboarding@resend.dev`, que só entrega ao dono da conta do Resend.
- **Um `$` antes de um nome.** Num arquivo que o Next lê, `$nome` é trocado
  pelo valor de outra variável, e por nada quando ela não existe, com ou sem
  aspas. A chave do Asaas escrita `$aact_…` chega vazia à aplicação, e uma
  senha com `$` no endereço do banco chega cortada. Nos arquivos locais é erro.
- **Sobras**: variável que nenhum código lê.
- **Valores herdados do MedChina.** Enquanto o `apps/web/.env` for a cópia (o
  script a reconhece pelas variáveis que só o MedChina lia), nenhum valor dele
  pode estar em vigor. Uma chave que o `.env.local` esqueceu de definir é erro,
  pelo nome. Um valor copiado do `.env` para o `.env.local` também, sob
  qualquer nome: é o que sobra quando se começa copiando o arquivo inteiro. O
  endereço do formulário de contato pode ser o mesmo nos dois produtos, e
  aparece só como informação.

Para conferir o que está cadastrado na Vercel, puxe as variáveis para um
arquivo e passe o arquivo ao script:

```bash
npx vercel@latest env pull .vercel/.env.production.local --environment=production
npm run preflight -- --stage open --file .vercel/.env.production.local
```

Três coisas a saber sobre esse arquivo:

- **Um segredo não volta.** A Vercel guarda cada variável como _Config_ ou como
  _Secret_, e o valor de uma _Secret_ só pode ser escrito, nunca lido. No
  arquivo, a CLI põe `[SENSITIVE]` no lugar. O script marca essas com `?`: o
  nome está cadastrado, o conteúdo não foi conferido. Para elas vale a
  conferência do arquivo local de onde você copiou os valores. Por isso,
  cadastre como _Config_ o que não é segredo (os endereços, o remetente, os IDs
  dos rastreadores) e como _Secret_ as chaves: o que é _Config_ o script confere
  de volta. O nome que não está cadastrado continua aparecendo como `✘`.
- **Use `vercel@latest`.** As versões antigas da CLI (a 54, por exemplo)
  escrevem a _Secret_ com o valor vazio, e não há como separar isso de uma
  variável salva sem valor. O script avisa quando acontece.
- **Apague o arquivo antes de puxar de novo.** A CLI nova mantém no arquivo o
  que já estava nele, e uma variável apagada na Vercel continuaria aparecendo.
  Nunca puxe para o `apps/web/.env.local`: é ele que anula a cópia herdada.

`.vercel/` não vai para o git nem para a Vercel. Para o ambiente de ensaio,
`--target preview` inverte o que se espera das chaves de cobrança.

O que o script não tem como ver, porque pede uma conta: o DNS, os webhooks, os
endereços do Supabase Auth, a sincronização do Inngest e o próprio banco. Cada
um é um passo abaixo.

### Marco A: a lista de espera no ar

A lista de espera não espera a CLI. Enquanto o estágio é "Lista de espera", a
home e `/como-funciona` descrevem a instalação sem dar o endereço de
`/instalar.md` (decisão de 2026-10-12, `docs/PRODUCT.md`). Duas coisas sobram
até a CLI 1.0.0 ir para o npm (passo 16), porque até lá o `flyee@latest` é a
0.7.9, um agente de código de outro projeto: quem cria conta pelo "Entrar" do
site recebe a frase da instalação no painel e no e-mail de boas-vindas, e as
ilustrações de terminal do site mostram comandos `npx flyee`. Antes do passo
16, não divulgue `/instalar.md` nem convide ninguém a criar conta.

1. **Variáveis locais.** Preencha o `apps/web/.env.local` com os valores do
   projeto novo, a partir do `apps/web/.env.example`. Toda chave que o
   `apps/web/.env` herdado define precisa aparecer no `.env.local`, vazia se
   não for usada. Nesse arquivo um `$` se escreve `\$` (a chave do Asaas fica
   `\$aact_…`) e, dentro de um endereço, `%24`; na Vercel o valor vai como ele
   é. Rode `npm run preflight -- --stage waitlist` até não sobrar `✘`. O
   `NEXT_PUBLIC_SITE_URL` fica para a Vercel (passo 3): nesta máquina ele é o
   endereço local, e o script só o anota.
2. **Banco.** Com o `DATABASE_URL` do `.env.local` apontando para o projeto
   novo:

   ```bash
   npm run db:plan:remote     # só lê: lista o que falta aplicar
   npm run db:gate:remote     # aplica e roda o pgTAP
   ```

   Num projeto vazio, o plano responde `Remote migrations: 0 applied, 42
   pending.` e lista de `0000_init.sql` a `0041_payment_processors.sql`. O gate
   termina com `Remote pgTAP: 436 assertions passed.` Ele recusa um banco que
   não construiu: se o plano falar em arquivos desconhecidos ou em esquema sem
   histórico, pare e não aplique.
3. **Vercel.** Crie o projeto e os secrets do GitHub ("Setup único"). Cadastre
   em **Production** as variáveis do `.env.local`, mais
   `NEXT_PUBLIC_SITE_URL=https://flyee.club`: as chaves como _Secret_, o resto
   como _Config_. Confira com o `vercel env pull` e o `preflight --file` da
   seção acima. Não pode sobrar `✘`, e cada `?` tem de ser uma chave que você já
   conferiu no arquivo local.
4. **Domínio.** `flyee.club` na Vercel e no registrador ("Domínio"), e o mesmo
   domínio verificado no Resend antes de definir `EMAIL_FROM`.
5. **Deploy.** Rode o workflow `Deploy` ou faça o push na `main`. As variáveis
   `NEXT_PUBLIC_` entram no build: mudou uma, faça outro deploy.
6. **Login.** No Supabase, em Authentication: o Site URL e as Redirect URLs
   (`https://flyee.club/auth/callback` e `https://flyee.club/**`), o SMTP do
   Resend, "Confirm email" ligado e os três modelos de e-mail ("E-mails de
   autenticação", abaixo).
7. **Jobs.** No Inngest, sincronize o app em `https://flyee.club/api/inngest`.
   As funções da tabela de "Jobs" devem aparecer.
8. **Sua conta de operador.** Crie a conta em `/auth/sign-up` e promova-a no SQL
   Editor do Supabase. A sessão do editor não tem JWT, e a trava de superadmin
   permite:

   ```sql
   update public.profiles set is_superadmin = true
   where id = (select id from auth.users where email = 'seu@email');
   ```

9. **Empresa e estágio.** Em `/admin/support`, preencha "Razão social", "CNPJ" e
   "Cidade e UF". Os termos de uso e a política de privacidade identificam a
   operadora pelo rodapé, então isso precisa estar no ar antes de divulgar
   qualquer página. Deixe "Lançamento do site" em "Lista de espera".
10. **Prova.** Inscreva o seu e-mail em `/espera`, abra o link que chega,
    confirme no botão e veja "Pronto, você está na lista". Repita em
    `/en/waitlist`. Confira `/legal/termos` com a versão e a data, a empresa no
    rodapé, e `/sitemap.xml` com `/espera` e `/en/waitlist`. A inscrição aparece
    em `/admin/leads`. Busque `https://flyee.club/instalar.md`: a frase do
    primeiro parágrafo tem de terminar com esse mesmo endereço. Na home e em
    `/como-funciona`, o passo da instalação não cita esse endereço enquanto o
    estágio for "Lista de espera".

### Marco B: a loja aberta

11. **Cobrança em real.** Até o Asaas existir, quem cobra o real é a Stripe
    (decidido em 2026-10-12): `BILLING_BRL_PROVIDER=stripe` na Vercel, e o
    passo 12 vale para as duas moedas. Em real pela Stripe não há parcelamento
    (a Stripe não parcela no Brasil), o Pix aparece na página da Stripe se
    estiver ligado lá e só no FlyeeClub, e a NFS-e é emitida fora da
    plataforma: o checkout continua pedindo o CPF ou CNPJ e o guarda na conta
    de quem compra. O resto deste passo fica para quando o Asaas chegar.

    Quando a conta Asaas de **produção** estiver aprovada:
    - gere a chave de produção, que começa com `$aact_prod_`;
    - cadastre `flyee.club` em _Minha Conta → Informações_. Sem um site
      cadastrado, quem paga não é devolvido ao painel;
    - crie o webhook em `https://flyee.club/api/webhooks/asaas`, com um token
      que você inventa e os nove eventos: `PAYMENT_CONFIRMED`,
      `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
      `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_REFUNDED`,
      `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`,
      `PAYMENT_CHARGEBACK_DISPUTE` e `SUBSCRIPTION_DELETED`.

    Na Vercel, as três juntas, no mesmo deploy: `ASAAS_API_KEY`,
    `ASAAS_WEBHOOK_TOKEN` e `ASAAS_BASE_URL=https://api.asaas.com/v3`. Com a
    chave de produção e o endereço vazio, toda cobrança é recusada. No mesmo
    deploy, apague `BILLING_BRL_PROVIDER` (ou ponha `asaas`): as compras novas
    em real passam ao Asaas, e as assinaturas do FlyeeClub Pro já vendidas em
    real continuam na Stripe até acabarem, porque cada uma guarda o provedor
    que a cobra. O `docs/ASAAS-GO-LIVE.md` guarda o que cada um desses itens
    custou quando faltou; os nomes e valores dele são do MedChina.
12. **Stripe**: dólar, e real enquanto `BILLING_BRL_PROVIDER=stripe`. Na conta
    da Stripe Brasil, no modo de produção:
    - o webhook em `https://flyee.club/api/webhooks/stripe`, criado na versão
      de API **`2025-08-27.basil`**, a da biblioteca `stripe` 18.5 que o código
      usa: os eventos chegam no formato da versão do endpoint, e o código lê
      campos que só existem nesse formato (a assinatura de uma fatura vem em
      `invoice.parent`). Os nove eventos: `checkout.session.completed`,
      `checkout.session.async_payment_succeeded` (o Pix confirmado depois do
      checkout; sem ele um Pix pago nunca libera o acesso),
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
      `charge.refunded` e `charge.dispute.created`;
    - em _Settings → Payment methods_, deixe ligado só o que quer oferecer: o
      cartão, e o Pix se quiser (ele só aparece no FlyeeClub, porque assinatura
      com Pix não existe numa conta brasileira). Um método que confirma depois,
      como o boleto, também libera pelo mesmo evento, mas leva dias;
    - em _Settings → Billing → Customer portal_, ative o portal: é por ele que
      um assinante do FlyeeClub Pro troca o cartão recusado. Sem ele, o botão
      leva à fatura;
    - na Vercel, `STRIPE_SECRET_KEY` (a de produção, `sk_live_`) e
      `STRIPE_WEBHOOK_SECRET`.

    Sem a Stripe e com o real no Asaas, os planos em dólar não ficam à venda e
    `/en` não vende nada: é uma decisão, não um erro. Com o real na Stripe, sem
    ela a loja não vende nada, e o `npm run preflight` diz isso.
13. **Preços.** Em `/admin/billing`, aba "Planos", confira o preço do FlyeeClub
    em real e em dólar, o prazo de acesso e que só ele tem "Aparece no site
    público". O teto de parcelas é dado de `platform_settings.billing` e só
    vale com o real no Asaas. Os
    valores do seed são hipóteses.
14. **Conferência.** `npm run preflight -- --stage open` sem `✘`, no arquivo
    local e no que a Vercel devolve.
15. **Catálogo.** Em `/admin/catalogo`:
    - aba "Categorias da loja": as cinco do brief já vêm do banco (Vender,
      Divulgar, Vídeo, Pesquisa, Construir);
    - aba "Ferramentas": cadastre os quatro apps. Em cada um, o slug (é o nome
      no `npx flyee add`), a trilha, o tipo, a categoria da loja, nome e resumo
      nos dois idiomas, "Funciona com" e "Bom começo para". Um app sem nome em
      inglês fica fora das páginas em inglês;
    - na página de cada app, "Enviar uma versão": escolha o `.zip` e "Enviar e
      conferir". O pacote entra como rascunho. "Publicar" na versão, depois
      "Publicar no catálogo" no app;
    - **a versão de entrada é uma decisão por app.** A primeira versão publicada
      de um app recebe a marca sozinha, e a conta sem compra instala a versão
      marcada. No `motion-carousel`, publique a 1.0.0 antes da 1.1.0: a 1.0.0
      fica como a de entrada e a 1.1.0 como a completa. Nos três apps que só têm
      a 1.0.0, a marca entrega o app inteiro a quem não comprou. Se não é isso
      que você quer, use "Tirar a marca de entrada" neles. Vale desde a
      publicação, mesmo com o site na lista de espera: com a CLI no npm (passo
      16), quem seguir `/instalar.md` cria a conta e instala a versão marcada.

    Confira `/catalogo` e `/en/catalog` deslogado, e `/modulos` logado.
16. **A CLI no npm e a versão mínima.** `/instalar.md`, o painel e o e-mail de
    boas-vindas mandam a IA rodar `npx --yes flyee@latest`. Em 2026-10-12 o
    `latest` do pacote `flyee` no npm era a 0.7.9, de outro projeto: uma IA que
    seguisse a página rodaria esse código. A CLI 1.0.0 vai para o npm do lado
    do produto, e `npm view flyee dist-tags` tem de mostrar a 1.0.0 como
    `latest` antes do ensaio. Depois, em `/admin/catalogo`, aba "Entrega",
    "Versão mínima da CLI atendida" passa de `0.1.0` a `1.0.0`: a linha 0.x não
    fala este contrato.
17. **Ensaio.** Antes de abrir, sem dinheiro de verdade, em duas partes.

    **A CLI e a IA, na produção.** O site continua na lista de espera, e nada
    leva ninguém às contas de teste. Crie três contas suas e, em
    `/admin/billing`, aba "Kits e cortesias", dê a duas delas uma cortesia
    ("Plano da cortesia", "Conceder cortesia"): uma fica sem compra, outra com
    o FlyeeClub, outra com o FlyeeClub Pro. Em cada uma:
    - `node scripts/cli-flow.mjs --base https://flyee.club`, que percorre o
      contrato inteiro e pede a aprovação de um código em `/ativar`;
    - a frase do painel colada numa IA de verdade, que segue
      `flyee.club/instalar.md` do login ao primeiro app. Pelo menos no Claude
      Code e numa IA que roda os comandos num terminal (Gemini CLI ou Cursor);
    - o que cada degrau vê: a conta sem compra instala a versão de entrada e
      vê a distância até a mais nova; a do FlyeeClub instala a mais nova e
      recebe o aviso do Pro no clique de um recurso dele; a do Pro abre esses
      recursos, com "Em breve" onde ainda não há nada publicado.

    No fim, "Excluir conta e todos os dados", em `/admin/membros`, apaga cada
    conta de teste com a sua cortesia. Os eventos de uso ficam, sem a conta,
    como em toda exclusão.

    **As compras, num preview.** Um segundo projeto no Supabase, as variáveis
    de **Preview** da Vercel apontando para ele, o Asaas de sandbox e a chave
    de teste do Stripe:

    ```bash
    FLYEE_ENV_FILE=apps/web/.env.ensaio npm run db:gate:remote
    npm run preflight -- --stage open --target preview --file apps/web/.env.ensaio
    ```

    No PowerShell, a primeira linha é
    `$env:FLYEE_ENV_FILE = "apps/web/.env.ensaio"; npm run db:gate:remote`. O git
    ignora todo arquivo `.env.*`, menos o `.env.example`, e a Vercel também não
    os recebe. Antes do deploy do preview, que o workflow faz a cada pull
    request:
    - escolha um endereço fixo, como `https://ensaio.flyee.club`, e use-o no
      `NEXT_PUBLIC_SITE_URL` do Preview, no Site URL e nas Redirect URLs do
      Supabase Auth do projeto de ensaio e nos dois webhooks. Depois do deploy,
      `npx vercel alias set <endereço que o workflow mostrou> ensaio.flyee.club`,
      com o registro `ensaio` do DNS apontando para a Vercel;
    - os previews nascem protegidos pela Vercel Authentication, e um webhook,
      que não tem login na Vercel, é barrado. Em _Settings → Deployment
      Protection_, crie um segredo em "Protection Bypass for Automation" e ponha
      `?x-vercel-protection-bypass=<segredo>` no fim dos dois endereços de
      webhook;
    - deixe vazias, no Preview, as chaves do Inngest: com as da produção, o que
      o ensaio enviasse rodaria nos jobs da produção. Sem elas o que é agendado
      não roda, e o ensaio não precisa disso.

    No preview, compre o FlyeeClub em real (pela Stripe de teste enquanto
    `BILLING_BRL_PROVIDER=stripe`, uma vez no cartão e uma no Pix de teste; ou
    pelo sandbox do Asaas) e em dólar com um cartão de teste da Stripe, veja o
    acesso chegar a `/inicio` pelo webhook, reembolse e veja o acesso cair.
    Assine o FlyeeClub Pro e cancele. Sem esta parte, a primeira compra é uma
    de verdade. Com o real na Stripe, o Asaas de sandbox não é preciso.
18. **Abrir.** No mesmo dia, nesta ordem:
    1. uma compra de verdade do FlyeeClub, com um CPF real, ainda na lista de
       espera: logado, em `/assinatura`. O checkout não depende do estágio, só
       os botões do site. A fatura abre, o pagamento volta para o painel,
       `/inicio` mostra o acesso e o recibo chega por e-mail. Reembolse pelo
       painel de quem cobrou (a Stripe, enquanto ela cobra o real) e confira
       que o acesso cai;
    2. em `/admin/support`, "Lançamento do site" passa a "Aberto". Os botões do
       site deixam de levar à lista e passam a levar ao cadastro e ao checkout,
       e o passo da instalação, na home e em `/como-funciona`, passa a dar o
       endereço de `/instalar.md`. Confira os dois deslogado.
19. **O primeiro dia.** `/admin/membros` para as contas novas e quem ficou sem
    computador conectado; `/admin/metricas` para as portas de entrada; os
    webhooks da Stripe (_Developers → Webhooks_, as entregas com falha) e, com o
    Asaas, a fila dele, que é interrompida depois de 15 falhas seguidas; as
    execuções no Inngest; os envios no Resend.

## E-mails e jobs

A plataforma escreve para as pessoas por três caminhos, e cada um tem a sua
configuração.

### E-mails do app (Resend)

Enviados pelo próprio app com `RESEND_API_KEY` e `EMAIL_FROM`: boas-vindas,
recibo, confirmação e fim de assinatura, aviso de período pago terminando,
lembrete de conexão, resumo semanal de versões novas, mensagens dos encontros,
confirmação da lista de espera e mensagens para a lista. Os modelos e o texto
nos dois idiomas ficam em `packages/email`; cada pessoa recebe no idioma do
perfil (`profiles.locale`) ou da inscrição (`leads.locale`).

- Sem `RESEND_API_KEY` nada quebra: os avisos continuam chegando pelo sino do
  painel, e as telas que dependem de e-mail (lista de espera, "escrever para a
  lista") dizem que o envio está fora do ar.
- Os links dos e-mails usam `NEXT_PUBLIC_SITE_URL`. Sem ela, apontam para
  `http://localhost:3000`. O logo do cabeçalho também: é lido de
  `<NEXT_PUBLIC_SITE_URL>/images/email/logo.png`, então só aparece quando o
  site está no ar nesse endereço.
- Todo e-mail usa a mesma moldura (`packages/email/src/templates/shell.tsx`):
  o logo na faixa escura, o título, o botão amarelo com o rótulo grafite, as
  notas e a assinatura. Cada mensagem vai com a versão em HTML e a versão em
  texto puro, gerada do mesmo modelo.
- O resumo semanal e as mensagens para a lista levam o link de descadastro no
  corpo e no cabeçalho `List-Unsubscribe` (um clique). O endereço é
  `/api/public/email/unsubscribe`, público por definição; quem clica no link
  cai em `/descadastro` (ou `/en/unsubscribe`) e confirma em um botão.

### E-mails de autenticação (Supabase Auth)

Confirmação de cadastro, troca de senha e troca de e-mail são enviados pelo
Supabase, não pelo app. Os modelos em `supabase/templates/` são gerados de
`packages/email` (`templates/auth.tsx`, com a mesma moldura dos e-mails do app
e o texto em `copy/pt-BR.ts` e `copy/en.ts`) por
`npm run supabase:templates -w @flyee/email`. Nunca edite os arquivos à mão: o
teste do pacote falha quando um deles não é o que o código gera. Cada arquivo
tem os dois idiomas e escolhe pelo `locale` gravado no cadastro
(`{{ .Data.locale }}`; conta sem ele lê em português). O assunto também é um
modelo e segue o mesmo idioma.

Sem SMTP próprio, o Supabase envia pelo servidor dele: o remetente é "Supabase
Auth <noreply@mail.app.supabase.io>", o rodapé diz "powered by Supabase", o
painel não deixa trocar os modelos e os envios param em poucos por hora. Por
isso o passo 1 vem antes de todos.

1. **Authentication → Emails → SMTP Settings**: ligar o SMTP próprio com o
   Resend (host `smtp.resend.com`, porta `465`, usuário `resend`, senha a
   `RESEND_API_KEY`). O remetente é o mesmo de `EMAIL_FROM`: o endereço do
   domínio verificado no Resend (por exemplo `oi@flyee.club`) no campo do
   endereço e `FlyeeClub` no campo do nome.
2. **Authentication → Sign In / Providers → Email**: ligar "Confirm email". É o
   link de confirmação que leva a conta nova a `/auth/callback`, de onde saem o
   aviso e o e-mail de boas-vindas.
3. **Authentication → URL Configuration**: o Site URL é `https://flyee.club`,
   sem barra no fim. Os modelos leem o logo de
   `{{ .SiteURL }}/images/email/logo.png`.
4. **Authentication → Emails → Templates**: colar o arquivo inteiro de cada
   modelo (a nota no topo é um comentário do modelo e não sai no e-mail) e o
   assunto correspondente, cada um numa linha só:

   | Modelo no painel | Arquivo | Assunto |
   | --- | --- | --- |
   | Confirm signup | `supabase/templates/confirmation.html` | `{{ if eq (printf "%v" .Data.locale) "en" }}Confirm your email at FlyeeClub{{ else }}Confirme seu e-mail no FlyeeClub{{ end }}` |
   | Reset password | `supabase/templates/recovery.html` | `{{ if eq (printf "%v" .Data.locale) "en" }}Reset your FlyeeClub password{{ else }}Redefina sua senha do FlyeeClub{{ end }}` |
   | Change email address | `supabase/templates/email_change.html` | `{{ if eq (printf "%v" .Data.locale) "en" }}Confirm your new email at FlyeeClub{{ else }}Confirme seu novo e-mail no FlyeeClub{{ end }}` |

   Os assuntos são os de `supabase/config.toml`, que o mesmo teste confere. Os
   outros modelos do painel (convite, link mágico, reautenticação) não são
   usados pelo app e ficam como estão.
5. **Teste**: criar uma conta em `/auth/sign-up` com o site em português e outra
   em `/en`, e conferir que cada confirmação chega no idioma certo, com o
   assunto no mesmo idioma, o logo no topo e o remetente do FlyeeClub. Pedir
   "Esqueci minha senha" para uma das contas confere o segundo modelo. O
   repositório confere o que os arquivos dizem; o que o Supabase faz com eles
   só este teste confere.

O `supabase/config.toml` aponta para os mesmos arquivos, para quem ligar a
confirmação por e-mail no Supabase local.

### Jobs (Inngest)

Depois de sincronizar o app em `https://<domínio>/api/inngest`, estas funções
devem aparecer na lista:

| Função | Quando | O que faz |
| --- | --- | --- |
| `flyee-meeting-emails-sweep` | a cada 10 minutos | lembretes dos encontros (24 horas e última hora) e aviso da gravação |
| `flyee-meeting-email` | evento | confirmação de uma inscrição; botões "Enviar agora" de `/admin/encontros` |
| `flyee-token-reminders` | todo dia, 10:00 de Brasília | lembrete da conexão que vence em até 5 dias |
| `flyee-term-end-notices` | todo dia, 10:15 de Brasília | aviso de período pago (compra parcelada) ou de kit que termina em até 15 dias, e liquidação dos kits que terminaram (aviso e tokens revogados quando nada mais mantém o acesso) |
| `flyee-updates-digest` | terças, 10:00 de Brasília | resumo semanal de versões novas dos apps instalados |
| `flyee-newsletter-send` | evento | entrega de uma mensagem para a lista, em lotes de 100 |
| `flyee-maintenance` | todo dia, 01:30 de Brasília | consolida os eventos de uso do dia anterior e apaga o que venceu (eventos, trilha da CLI, sobras de login, uploads não concluídos) |
| `flyee-settle-billing-cancellations` | a cada 15 minutos | encerra assinaturas cujo período acabou e avisa o integrante |
| `flyee-billing-maintenance` | todo dia | reservas e checkouts abandonados |
| `flyee-purge-expired-leads` | todo dia | apaga contatos não confirmados (7 dias) e descadastrados (6 meses) |
| `admin-weekly-digest` | segundas, 08:30 de Brasília | resumo do operador |
| `backup-run-cron` / `backup-run-manual` | todo dia / evento | backup lógico |

`flyee-token-reminders-manual` e `flyee-updates-digest-manual` rodam as mesmas
rotinas quando alguém dispara os eventos `flyee/token.reminder` e
`flyee/updates.digest` pelo painel do Inngest.

**Sem as chaves do Inngest**, o que parte de uma ação continua funcionando no
próprio pedido (confirmação de inscrição em encontro, "Enviar agora", mensagem
para a lista), mas **nada agendado roda**: lembretes, resumos, avisos de fim de
período, encerramento de assinaturas e limpeza param. O Inngest é obrigatório
em produção.

Cada mensagem agendada é reservada no banco antes de ser enviada (migração
`0023`), então uma função que roda duas vezes não escreve duas vezes para a
mesma pessoa.

## Domínio — `flyee.club`

O app inteiro (site público bilíngue, painel, admin, API da CLI e webhooks)
roda no domínio `flyee.club`. O código não tem URL fixa: canonical, OG e
sitemap vêm de `NEXT_PUBLIC_SITE_URL`, e auth e webhooks derivam do host da
requisição.

### Configurar

1. **Vercel → Settings → Domains** → adicionar `flyee.club` (e `www.flyee.club`
   redirecionando para o apex). O Vercel mostra os registros a criar.
2. **DNS do registrador** → criar os registros indicados pelo Vercel. SSL é
   emitido automaticamente. Se o domínio também recebe e-mail, não mexer nos
   registros MX.
3. **Vercel → `NEXT_PUBLIC_SITE_URL=https://flyee.club`** (Production) e
   **redeploy** — é build-time.
4. **Supabase → Authentication → URL Configuration**: Site URL
   `https://flyee.club` e Redirect URLs `https://flyee.club/auth/callback` e
   `https://flyee.club/**`.
5. **OAuth Google** (se usado): adicionar `https://flyee.club/auth/callback`.
6. **Webhooks**: Asaas em `https://flyee.club/api/webhooks/asaas`, Stripe em
   `https://flyee.club/api/webhooks/stripe`; sync do Inngest em
   `https://flyee.club/api/inngest`.
7. **Resend**: verificar o domínio `flyee.club` (DKIM/SPF) antes de definir
   `EMAIL_FROM`; o mesmo SMTP serve aos e-mails de auth do Supabase.
8. **Meta/GA4**: os IDs não dependem de domínio. Opcional: verificar o domínio
   no Meta Business e atualizar a URL do stream do GA4.

### Smoke test pós-configuração

Home pública em `https://flyee.club` e `https://flyee.club/en` → aviso de
cookies (aparece quando há Pixel ou GA4) → `/auth/sign-up` → `/inicio`. Os
eventos `InitiateCheckout` e `Purchase` se conferem no Gerenciador de Eventos
(Meta) e no GA4 durante as compras do roteiro: as de teste no ensaio e a de verdade na
abertura ("Roteiro da abertura", passos 17 e 18).

## Troubleshooting

- `Module not found: Can't resolve '@flyee/content'` (ou qualquer `@flyee/*`)
  no build → o checkbox **"Include files outside of the Root Directory in the
  Build Step"** está desligado. Ligue-o (Settings → Build and Deployment →
  Root Directory) e reexecute o workflow. O código resolve os pacotes por
  symlink de workspace (`node_modules/@flyee/* → packages/*`); confinar o build
  a `apps/web` quebra esses symlinks.
- `husky: not found` / `npm install exited with 127` → já corrigido: o script
  `prepare` da raiz é `husky || true`, tolerante à ausência do husky no CI.
- `Project not found` / erro de escopo no `vercel deploy` →
  `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` não batem com o token (token criado em
  outro team). Recrie o token no escopo certo.
- Job de deploy parado em "Building…" até o limite de 60 minutos, e a Vercel
  mostra o deploy como **Blocked** ("the commit author doesn't have permission
  to create deployments for this project") → o autor do commit no topo da
  `main` não é o dono do time Hobby. Confira com `git log -1 --format=%ae`, que
  tem de ser o e-mail da conta da Vercel ("Setup único", passo 4.3), e faça um
  commit novo com esse autor: reexecutar o workflow manda o mesmo commit e é
  bloqueado de novo. O build nunca começa; quem espera é o `vercel deploy`.
- Build da nuvem falha por variável faltando → cadastre-a no ambiente
  correspondente da Vercel (o build de PR usa **Preview**, o de `main`/manual
  usa **Production**).
- Deploy de produção "preso" → o job usa concurrency `vercel-production` sem
  cancelamento: deploys enfileiram na ordem dos pushes.
- `The job has exceeded the maximum execution time` / `The operation was
  canceled` durante o "Building…" → **quem foi cancelado foi o runner do
  GitHub, não o build da Vercel**. Como o deploy é build na nuvem, o
  `vercel deploy` fica BLOQUEADO esperando a Vercel terminar; o
  `timeout-minutes` do job é, na prática, "quanto tempo o build pode levar".
  O que segura isso hoje é o `timeout-minutes: 60` do workflow (era 30). A
  vitrine de componentes do template, que sozinha era mais da metade das rotas
  e dominava o tempo do build, saiu do repositório na fase 1.

  Antes de mexer em timeout, **confira o build na Vercel** (link "Inspect" do
  log): se ele concluiu, o deploy foi para produção mesmo com o job vermelho.
