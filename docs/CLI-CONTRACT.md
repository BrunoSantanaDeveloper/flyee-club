# Contrato da CLI — token, entrega e manifesto

Contrato entre a plataforma flyee.club (este repositório) e a CLI `npx flyee` (projeto separado). Escrito na fase 3 de `docs/PLANO-IMPLEMENTACAO.md` (2026-10-01). A CLI depende só do que está aqui; o resto da plataforma pode mudar sem aviso.

- **Base**: `https://flyee.club` (uma prévia anuncia o próprio endereço nos documentos de descoberta).
- **Formato**: JSON em UTF-8. Toda resposta da API leva `Cache-Control: no-store`, menos a de `GET /api/cli/version` (4.9), pública e igual para todos, que pode vir de um cache de até 5 minutos.
- **Versão**: este é o contrato v1. Uma mudança incompatível ganha caminho novo; campos novos podem aparecer a qualquer momento e a CLI deve ignorar o que não conhece.

## 1. Identidade do computador

A CLI gera um `device_id` na primeira execução e o guarda na configuração local. Ele identifica a instalação, não o hardware.

- Formato: 8 a 64 caracteres de `A-Z a-z 0-9 _ -` (um UUID sem chaves serve).
- Vai no login (parâmetro `device_id`) e em toda chamada à API (header `X-Flyee-Device`).
- Um login com `device_id` cria uma família de tokens presa a esse computador: a mesma família recusada de outro `X-Flyee-Device` responde `device_mismatch`.

## 2. Autenticação (OAuth 2.1)

Cliente público `flyee-cli`, sem segredo, PKCE S256 obrigatório. Descoberta em `/.well-known/oauth-authorization-server` e `/.well-known/oauth-protected-resource`.

Escopos (a CLI pede os quatro):

| Escopo | Libera |
|---|---|
| `profile:read` | `GET /api/cli/me`, `POST /api/cli/installs` |
| `catalog:read` | catálogo, módulos e receitas |
| `modules:download` | download de pacotes |
| `telemetry:write` | `POST /api/cli/events` |

### 2.1 Login com navegador (`npx flyee login`)

1. Abrir um servidor em `127.0.0.1` numa porta livre qualquer.
2. Abrir no navegador:

```
/oauth/authorize?response_type=code&client_id=flyee-cli
  &redirect_uri=http://127.0.0.1:<porta>/callback
  &code_challenge=<S256 do verifier>&code_challenge_method=S256
  &state=<aleatório>&scope=profile:read%20catalog:read%20modules:download%20telemetry:write
  &device_id=<device_id>
```

   O endereço de retorno precisa ser `http://127.0.0.1:<porta>/callback` ou `http://localhost:<porta>/callback`: só a porta pode variar (RFC 8252 §7.3).
3. O integrante entra (se preciso) e aprova. Se esse computador já teve conexão, a tela é a de **revalidação**: há quantos dias está sem atualizar e quantas ferramentas instaladas têm versão nova.
4. O navegador volta com `code` e `state` (ou `error=access_denied`). Conferir o `state`.
5. Trocar o código:

```
POST /api/oauth/token
grant_type=authorization_code&client_id=flyee-cli&code=<code>
&code_verifier=<verifier>&redirect_uri=<o mesmo, com a porta>
```

### 2.2 Login sem navegador (`npx flyee login --device`, RFC 8628)

```
POST /api/oauth/device
client_id=flyee-cli&scope=<os quatro>&device_id=<device_id>
```

Resposta:

```json
{
  "device_code": "mcdc_…",
  "user_code": "ABCD-EFGH",
  "verification_uri": "https://flyee.club/ativar",
  "verification_uri_complete": "https://flyee.club/ativar?code=ABCD-EFGH",
  "expires_in": 600,
  "interval": 5
}
```

A CLI mostra o `user_code` e o endereço, e consulta o token a cada `interval` segundos:

```
POST /api/oauth/token
grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=flyee-cli&device_code=<device_code>
```

| Resposta (400) | O que fazer |
|---|---|
| `authorization_pending` | esperar `interval` e repetir |
| `slow_down` | somar 5 segundos ao intervalo e repetir |
| `access_denied` | o integrante recusou; parar |
| `expired_token` | o código expirou (10 minutos); recomeçar |
| `invalid_grant` | código desconhecido ou já usado; recomeçar |

A página `/ativar` mostra o mesmo código para o integrante conferir antes de aprovar, com o que a IA dele mostrou na conversa ou com o terminal, se foi ele quem rodou o comando.

### 2.3 Tokens e a regra dos 30 dias

Resposta de sucesso do endpoint de token:

```json
{
  "access_token": "mcat_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "mcrt_…",
  "refresh_token_expires_in": 2592000,
  "scope": "profile:read catalog:read modules:download telemetry:write"
}
```

- O access token vale 1 hora. O refresh token vale 30 dias e **gira a cada uso**: a resposta traz um novo, e o anterior morre.
- `npx flyee update` renova primeiro (`grant_type=refresh_token&client_id=flyee-cli&refresh_token=<…>`). Por isso "30 dias sem atualizar" e "refresh expirado" são o mesmo fato.
- Refresh expirado ou revogado responde `invalid_grant` com `error_uri` apontando para `/revalidar?d=<device_id>`. A CLI mostra o link e recomeça o login (2.1), que abre a tela de revalidação.
- Reapresentar um refresh já girado revoga a família inteira daquele computador (reuso de token roubado). Duas renovações simultâneas com o mesmo refresh caem nesse caso: a CLI deve serializar a renovação.
- `GET /api/cli/me` devolve `token.days_until_revalidation`. A partir de 5 dias, a CLI avisa que é hora de atualizar.
- A plataforma avisa por conta própria, porque um computador parado não roda a CLI: cerca de 5 dias antes de a conexão vencer, o integrante recebe um aviso no sino do painel e um e-mail que pedem para a IA dele atualizar os apps, com o comando `npx flyee update` como referência, uma vez por vencimento (`lib/token-jobs.ts`). Renovar a conexão zera a contagem, e o aviso volta a valer para o vencimento seguinte.
- Um novo login no mesmo computador revoga a família anterior dele.

### 2.4 Logout

```
POST /api/oauth/revoke
client_id=flyee-cli&token=<access ou refresh>
```

Revoga a família inteira do computador. Responde 200 sempre, mesmo para token desconhecido.

## 3. Chamadas à API

Toda chamada a `/api/cli/*` (exceto as públicas da seção 4.8 e 4.9) leva:

```
Authorization: Bearer mcat_…
X-Flyee-Device: <device_id>
```

As barreiras rodam nesta ordem, e a primeira que recusa responde:

| Ordem | Barreira | Recusa |
|---|---|---|
| 1 | token válido | 401 `invalid_token`, com `WWW-Authenticate` |
| 2 | escopo | 403 `insufficient_scope` |
| 3 | conta ativa (lida a cada chamada) | 403 `suspended` ou `not_entitled` |
| 4 | computador | 403 `device_mismatch`, 400 `device_required`, 403 `device_unknown`, 403 `device_revoked` |
| 5 | limite de chamadas | 429 `rate_limited`, com `Retry-After: 60` |

Corpo de toda recusa:

```json
{ "error": "denied_entitlement", "message": "Esta ferramenta não faz parte do seu plano…", "action_url": "https://flyee.club/settings/billing?source=cli" }
```

- `message` vem no idioma do integrante e é para mostrar como está.
- `action_url`, quando existe, é o link a imprimir. A CLI não deve montar URLs da plataforma por conta própria.
- Um 401 pede renovação (2.3); se a renovação falhar, novo login.

| Código | Status | O que a CLI faz |
|---|---|---|
| `invalid_token` | 401 | renovar; se falhar, login |
| `insufficient_scope` | 403 | login de novo aprovando os quatro escopos |
| `suspended`, `not_entitled` | 403 | mostrar a mensagem e o link |
| `device_required` | 400 | mandar o header (bug da CLI) |
| `device_unknown` | 403 | `POST /api/cli/installs` e repetir |
| `device_revoked`, `device_mismatch` | 403 | login de novo |
| `device_limit_reached` | 409 | mostrar o limite e o link de gestão (`/settings/devices`) |
| `rate_limited` | 429 | esperar `Retry-After` |
| `download_limit` | 429 | parar até o dia seguinte |
| `denied_entitlement` | 403 | mostrar a mensagem e o link de upgrade |
| `not_found` | 404 | módulo, versão ou receita inexistente |
| `version_yanked` | 410 | versão retirada; `yank_reason` diz por quê |
| `invalid_request` | 400 | corpo fora do contrato (bug da CLI) |
| `unavailable` | 5xx | tentar de novo mais tarde |

## 4. Endpoints

### 4.1 `GET /api/cli/me`

Escopo `profile:read`. Header do computador opcional. Responde também para conta inativa.

```json
{
  "member": { "id": "…", "name": "Ana", "segment": "dev", "ai_tool": "claude_code", "locale": "pt-BR" },
  "workspace": { "id": "…", "name": "Ana" },
  "access": {
    "active": true,
    "suspended": false,
    "tier": "kit",
    "tier_name": "FlyeeClub",
    "limits": { "catalog_access": 1, "devices": 1 }
  },
  "token": { "family_id": "…", "refresh_expires_at": "2026-10-31T12:00:00Z", "days_until_revalidation": 30 },
  "device": { "device_id": "…", "name": "notebook", "registered": true, "last_update_at": "…" },
  "cli": { "min_cli_version": "0.1.0", "latest_core_version": null, "deprecations": [], "links": { "module_page": "…", "module_page_en": "…" } },
  "revalidate_url": "https://flyee.club/revalidar?d=…",
  "links": { "billing": "…", "devices": "…" }
}
```

`tier` é `kit`, `club`, `pro` ou `null` (nada comprado): o valor que o código usa para decidir. `tier_name` é o que a CLI mostra (desde 2026-10-08): o nome do degrau no idioma do integrante, o mesmo do painel ("FlyeeClub", "FlyeeClub Pro", "Pro (antigo)" ou "Pro (legacy)"), e `null` sem degrau. `cli` é a mesma resposta de 4.9.

### 4.2 `POST /api/cli/installs`

Escopo `profile:read`. Chamar logo depois do login e depois de todo `update` (com `"updated": true`).

```json
{
  "device_id": "…",
  "name": "notebook",
  "os": "macos",
  "os_version": "15.1",
  "ai_tool": "claude_code",
  "cli_version": "0.3.0",
  "core_version": "0.3.0",
  "installed_modules": [{ "slug": "deploy-check", "version": "1.2.0" }],
  "project_kind": "own",
  "updated": false
}
```

- `os`: `windows`, `macos`, `linux` ou `other`. `ai_tool`: `claude_code`, `codex`, `gemini_cli`, `cursor` ou `other`. `project_kind`: `own` ou `client`.
- `ai_tool_detail` (desde 2026-10-08): só com `ai_tool` `other`, o nome curto da ferramenta do nível "compatível pelo padrão" que a CLI achou (`copilot`, `opencode`, `antigravity`, `kimi`, `windsurf` ou `aider`). O computador guarda o nome só quando ele está em `platform_settings.cli.known_tools`, editada na aba Entrega de `/admin/catalogo`. Um nome fora da lista, ou que não seja um texto curto em minúsculas, é descartado, e o registro segue.
- Só `device_id` é obrigatório. Um campo omitido mantém o valor anterior; um relato que traz `ai_tool` decide também o `ai_tool_detail`, que se apaga quando não vem junto.
- O que só descreve o computador nunca recusa o registro: `name` acima de 80 caracteres e `os_version` acima de 40 são cortados. O resto continua recusando com 400 `invalid_request`: `device_id`, versões e `installed_modules` fora do formato, um valor fora das listas de `os`, `ai_tool` e `project_kind`, e um campo que este contrato não serve (a seção 9 descreve campos que ainda não são aceitos).
- 201 na primeira vez (é o evento `cli.installed`), 200 depois: `{ "status": "created", "device": {…}, "limit": 3, "live_devices": 2 }`.
- 409 `device_limit_reached` com `limit`, `live_devices` e `action_url` quando o plano não comporta mais um computador. Nada é gravado.
- Um computador desconectado pelo integrante só volta com um login novo; com a mesma família responde `device_revoked`.
- Um login feito sem `device_id` fica preso ao primeiro computador que se registrar.

Tetos por degrau, hoje: Gratuito 1, kit 1, assinatura 3, Pro 5 (`plans.limits.devices`, dado configurável).

### 4.3 `GET /api/cli/catalog?locale=&stable=`

Escopo `catalog:read`, computador obrigatório. `locale` é `pt-BR` ou `en` (padrão: o do integrante). O canal vem do plano da conta e volta em `channel`: `free` para a conta sem compra, `latest` para o FlyeeClub e o FlyeeClub Pro. `stable=1` restringe `latest` às versões marcadas como estáveis (reservado).

```json
{
  "locale": "pt-BR",
  "channel": "latest",
  "trails": [{ "slug": "publicar", "name": "Publicar", "description": "…", "icon": "NiRocket" }],
  "modules": [
    {
      "slug": "deploy-check",
      "type": "skill",
      "trail": "publicar",
      "icon": null,
      "name": "Checagem de deploy",
      "summary": "…",
      "compatible_ais": ["claude_code", "codex"],
      "external_credentials": [],
      "is_free_sample": false,
      "entitlement_key": "catalog_access",
      "entitled": true,
      "latest": {
        "version": "1.2.0",
        "is_stable": false,
        "sha256": "…",
        "size_bytes": 18234,
        "published_at": "…",
        "min_core_version": "0.3.0",
        "permissions": [{ "kind": "fs:read", "scope": "./", "reason": { "pt-BR": "…" } }]
      },
      "newest": { "version": "1.2.0", "…": "…" },
      "lessons": [{ "depth": "usar", "locale": "pt-BR", "title": "…", "duration_seconds": 240, "is_advanced": false }]
    }
  ],
  "recipes": [{ "slug": "lancar-mvp", "name": "…", "summary": "…", "icon": null, "modules": ["deploy-check"] }]
}
```

`latest` é a versão mais nova que esta conta pode baixar no seu canal: para a conta sem compra, a versão de entrada do app, que nunca muda por atualização. Sem nenhuma versão liberada para a conta, `latest` é a mais nova publicada e `entitled` vem `false`, como sempre: a CLI distingue "sem acesso" de "não existe" por `entitled`. `newest` é a versão mais nova publicada, a mesma para todas as contas: a distância entre `latest` e `newest` é o que a conta não tem. `entitled` diz se a conta pode baixar alguma versão do módulo. `is_free_sample` vem sempre `false` desde 2026-10-08 (12.5): o app inteiro de entrada saiu da plataforma, e o campo fica porque a CLI 1.x o declara. O vídeo das aulas nunca vem na API: fica no painel.

### 4.4 `GET /api/cli/modules/{slug}`

Escopo `catalog:read`. O módulo, com `description` e todas as versões lançadas, da mais nova para a mais antiga. Cada versão traz `status` (`published` ou `yanked`), `yanked_at`, `yank_reason`, `changelog` no idioma, `compatible_ais`, `permissions`, `verify_url` e `entitled`: se esta conta pode baixá-la. Uma versão retirada nunca é. O changelog de uma versão com `entitled: false` é o que a conta ganharia com o FlyeeClub.

### 4.5 `GET /api/cli/modules/{slug}/versions/{version}/download`

Escopo `modules:download`, computador obrigatório.

```json
{
  "slug": "deploy-check",
  "version": "1.2.0",
  "url": "https://…/storage/v1/object/sign/modules/…",
  "expires_in": 300,
  "sha256": "…",
  "size_bytes": 18234,
  "manifest": { "manifest_version": 1, "name": "deploy-check", "…": "…" },
  "verify_url": "https://flyee.club/verificar/deploy-check%401.2.0"
}
```

- A URL vale 5 minutos e não leva token: baixar sem o header `Authorization`.
- **Antes de extrair**, conferir o tamanho e o SHA-256 dos bytes baixados. Diferente: descartar e não instalar.
- Recusas: 404 versão inexistente ou em rascunho, 410 `version_yanked`, 403 `denied_entitlement` (com o link de upgrade), 429 `download_limit`. `denied_entitlement` vale para um módulo que o plano não inclui e para uma versão fora do canal da conta: para a conta sem compra, qualquer versão que não seja a de entrada. A CLI nunca precisa pedir essa versão, porque baixa o `latest` do catálogo.
- Cada download vira uma linha de `module_downloads`. A CLI reporta a instalação em si como evento (4.7).

### 4.6 `GET /api/cli/recipes/{slug}`

Escopo `catalog:read`. A receita, com os módulos na última versão (cada um com seu `entitled`). `workflow` traz o texto que liga os módulos quando o plano inclui receitas; sem isso, vem `null`, com `entitled: false` e `upgrade_url`.

### 4.7 `POST /api/cli/events`

Escopo `telemetry:write`, computador obrigatório. Lote de 1 a 50:

```json
{
  "events": [
    { "name": "tool.executed", "properties": { "module": "deploy-check", "version": "1.2.0" }, "occurred_at": "2026-10-01T12:00:00Z" }
  ]
}
```

- Nomes aceitos: `module.installed`, `module.activated`, `module.updated`, `tool.executed`, `recipe.installed`. Login, registro, recusas e revalidação o servidor registra sozinho.
- Propriedades: só texto curto. O banco guarda apenas chaves e valores da lista fechada (`module` e `trail` que existem no catálogo, `version`, `from_version`, `to_version`, `os`, `ai_tool`, `cli_version`, `core_version`, `project_kind`, `reason`, `origin`, `days_since_update`) e descarta o resto.
- **Nunca conteúdo**: nada de código, prompt, caminho de arquivo, nome de projeto ou texto livre.
- `occurred_at` fora da janela (até 7 dias atrás, até 5 minutos no futuro) vira o horário de chegada.
- Resposta: `{ "accepted": 1, "dropped": 0 }`. Acima de 600 eventos por hora por integrante, o excedente é descartado.

### 4.8 `GET /api/cli/schema/module` (público)

O JSON Schema do `flyee.module.json` (draft 2020-12), `$id` `https://flyee.club/api/cli/schema/module`.

### 4.9 `GET /api/cli/version` (público)

```json
{
  "min_cli_version": "0.1.0",
  "latest_core_version": null,
  "deprecations": [],
  "links": {
    "module_page": "https://flyee.club/catalogo/{slug}?origem=cli",
    "module_page_en": "https://flyee.club/en/catalog/{slug}?origem=cli"
  }
}
```

Uma CLI abaixo de `min_cli_version` deve pedir atualização antes de qualquer outra chamada. O piso em vigor é `1.0.2`, desde 2026-10-20; o exemplo acima mostra só o formato. A resposta leva `Cache-Control: public, max-age=300`: um piso novo chega a toda CLI em até 5 minutos. `deprecations` é uma lista de até 10 avisos em texto, que a CLI imprime como estão. Os valores vêm de `platform_settings.cli`, editados na aba Entrega de `/admin/catalogo`.

`links` (desde 2026-10-08) traz o endereço da página pública de um app como modelo, em português (`module_page`) e em inglês (`module_page_en`): a CLI troca `{slug}` pelo slug do app, e `origem=cli` faz a visita e um cadastro que venha dela contarem na porta do instalador. É o link que a CLI mostra a quem roda `npx flyee add <slug>` sem conexão, com a frase "este app faz parte do acesso flyee.club"; a CLI nunca monta endereço da plataforma por conta própria.

## 5. Limites

Configuráveis em `platform_settings.cli`:

| Limite | Padrão |
|---|---|
| chamadas por minuto, por conta | 60 |
| chamadas por hora, por conta | 600 |
| downloads por dia, por conta | 200 |
| eventos por hora, por integrante | 600 |

Na mesma chave fica `known_tools`, a lista dos nomes que um computador guarda ao lado de `other` (4.2). Começa com os seis do registro do core.

## 6. O manifesto `flyee.module.json` (v1)

Fica na raiz de todo pacote. O esquema está em `packages/catalog/src/manifest.ts` e publicado em 4.8.

| Campo | Regra |
|---|---|
| `manifest_version` | `1` |
| `name` | o slug do módulo no catálogo: `^[a-z0-9][a-z0-9-]{1,59}$` |
| `version` | `MAJOR.MINOR.PATCH`, sem zero à esquerda, até 5 dígitos cada, prerelease opcional de até 20 caracteres, sem build |
| `type` | `skill`, `workflow`, `framework` ou `tool` (igual ao do módulo) |
| `trail` | a trilha do módulo (igual à do catálogo) |
| `title`, `summary` | `{ "pt-BR": "…", "en": "…" }`, português obrigatório; até 80 e 280 caracteres |
| `compatible_ais` | 1 a 5 de `claude_code`, `codex`, `gemini_cli`, `cursor`, `other`, sem repetir |
| `min_core` | opcional, um comparador: `>=0.3.0`, `^0.3.0`, `~0.3.0` ou `0.3.0` |
| `entry` | o arquivo que o harness carrega primeiro; precisa estar em `files` |
| `files` | todos os arquivos do pacote menos o manifesto, sem repetir, até 2.000 |
| `external_credentials` | `[{ name, env, url?, required, purpose }]`: chaves que o integrante fornece; `env` em `^[A-Z][A-Z0-9_]{1,63}$`, `url` só https |
| `permissions` | `[{ kind, scope, reason }]`, `kind` em `fs:read`, `fs:write`, `network`, `shell`, `env` |
| `lessons` | opcional; `{ "pt-BR": [{ depth, provider: "youtube", id, duration_s }] }` |
| `changelog` | opcional, `{ "pt-BR": "…", "en": "…" }` |
| `license` | `member` (padrão) ou `commercial` |

Chave desconhecida é erro: um campo novo exige um `manifest_version` novo. Caminhos são relativos, com `/`, sem `.` nem `..`, sem letra de unidade.

## 7. O pacote

- Um ZIP com `flyee.module.json` na raiz. A lista de arquivos do ZIP e `files` precisam bater nos dois sentidos.
- Até 2.001 entradas e 200 MB descompactado; o arquivo enviado até `MODULE_UPLOAD_MAX_MB` (20 MB).
- **Guias** (desde 2026-10-06, migração `0030`): o pacote pode trazer o guia escrito do app, um arquivo Markdown por idioma e profundidade, em caminho fixo: `guides/pt-BR/usar.md`, `guides/pt-BR/abrir-o-capo.md`, `guides/en/usar.md` e `guides/en/abrir-o-capo.md`. São arquivos como os outros (listados em `files`), não uma chave do manifesto, então a v1 do manifesto não muda. Qualquer outro nome dentro de `guides/` recusa o pacote (422), e cada guia tem até 200 KB de texto UTF-8, não vazio. A plataforma guarda o texto da versão e o mostra no painel, para a versão que o integrante tem instalada; links e imagens relativos ao pacote não são resolvidos no painel, então use endereços absolutos. O vídeo de cada profundidade (`lessons`) continua opcional e é cadastrado no console. A convenção está em `@flyee/catalog/guides` (`guideOf`, `guidePath`).
- Guardado no bucket privado `modules` em `<slug>/<versão>/<slug>-<versão>.zip`. O SHA-256 publicado é o dos bytes guardados.
- Uma versão lançada é imutável: correção é versão nova, e a versão errada é retirada (`yanked`) com motivo. Retirada continua verificável e nunca mais é servida.

### Publicação (superadmin)

1. `POST /api/admin/catalog/uploads` devolve `{ staging_path, signed_url, token, max_bytes }`. O console envia o ZIP direto para o armazenamento (sem o limite de 4,5 MB de uma função).
2. `POST /api/admin/catalog/versions` com `{ "module": "<slug>", "staging_path": "…" }` inspeciona o pacote e grava a versão como rascunho. Responde 422 com todos os problemas encontrados, 409 se a versão já existe e 201 com o checksum. Um pacote pequeno também pode ir direto em multipart (`module` + `file`).
3. Publicar, marcar como estável, marcar a versão de entrada e retirar são ações do console (`lib/catalog/version-actions.ts`), todas auditadas. A primeira versão publicada de um app vira a versão de entrada; o operador move a marca para outra versão publicada ou a tira, e a versão marcada não é retirada enquanto tiver a marca (migração `0040`).

## 8. Páginas públicas da CLI

Duas páginas fora da API, sem sessão e fora do índice dos buscadores.

### 8.1 Verificação (`/verificar/<slug>@<versão>`)

`/verificar/<slug>@<versão>` (inglês: `/en/verify/…`) mostra para qualquer pessoa o SHA-256, o tamanho, as IAs compatíveis, as permissões declaradas e se a versão foi retirada. É o `verify_url` das respostas.

### 8.2 Instalação pela IA (`/instalar.md`)

`/instalar.md` (inglês: `/en/install.md`) é a porta de entrada da CLI desde 2026-10-08 (12.6 do plano). O integrante não usa o terminal: ele cola na conversa com a IA dele uma frase que termina com o endereço da página ("Instale o flyee seguindo https://flyee.club/instalar.md"), e a IA lê a página e roda os comandos. O painel e o e-mail de boas-vindas dão essa frase pronta para copiar, e a página de cada app, a de cada receita e a de computadores dão as frases de instalar um app e de conectar de novo, todas com o mesmo endereço. O site público só cita a página com a loja aberta: enquanto o estágio é "Lista de espera", a home e `/como-funciona` dizem o que a IA faz sem o endereço, porque a lista pode ir ao ar antes de a CLI estar no npm (decisão de 2026-10-12, `invitesToInstall` em `apps/web/src/lib/launch.ts`).

- Resposta: `200`, `Content-Type: text/markdown; charset=utf-8`, `Content-Language` com o idioma do endereço, `X-Robots-Tag: noindex` e cache público de 5 minutos. `/install.md`, sem o prefixo, redireciona para `/en/install.md`. Ler a página não conta como visita do site.
- O texto vive no código (`apps/web/src/lib/install-guide.ts`), nos dois idiomas, e muda com um deploy. Os testes das regras de texto o leem.
- A página pede a confirmação do integrante antes de qualquer comando, dizendo a pasta, e confere o Node.js, que a CLI 1.x exige na versão 20 ou mais nova. Sem nenhum Node.js, a IA instala a versão LTS com o sim do integrante; um Node.js mais antigo ela só atualiza depois de dizer que outro projeto pode depender dele e de ouvir o sim.
- Ela só nomeia comandos que a CLI 1.x tem, escritos como uma IA precisa rodá-los. Mudar um deles na CLI pede mudar a página. Todo comando é `npx --yes flyee@latest …`: o `--yes` é do npx, que num terminal pergunta antes de baixar um pacote, e algumas IAs rodam os comandos num terminal; `flyee@latest` em todos evita que a IA rode duas cópias do instalador. A página manda rodá-los como ela os escreve, mesmo quando uma mensagem da CLI escreve `npx flyee login`. A exceção é o PowerShell do Windows com a execução de scripts desativada, em que a IA escreve `npx.cmd` em vez de mudar a configuração. `npx flyee` sem comando só imprime a ajuda.

| Comando na página | O que a página manda, e por quê |
|---|---|
| `doctor --json` | Antes de tudo, sem mudar nada. Dos campos do resultado saem três caminhos: `connected` e todos os `adapters` em `true`, o flyee já está no projeto e a IA faz só o que foi pedido; `connected` em `true` e um `adapters` em `false`, o computador está conectado e o projeto é novo, e um pedido de app vai direto ao `add`, que escreve os arquivos; `connected` em `false`, a IA segue para o login. Depois do login a página confere de novo, com `platform.reachable`. Depois de instalar um app, `programs` e `credentials` dizem, pelo `slug`, o programa (`present`) e a chave (`set`) que ainda faltam àquele app. |
| `login`, com tempo limite de 5 minutos | A IA avisa ANTES que o navegador vai abrir e roda sem esperar resposta: um comando em primeiro plano prende a vez dela, e o aviso depois chegaria tarde. O tempo limite é o que a CLI 1.x espera pela aprovação (2.1): 5 minutos. É o login que escreve os arquivos do flyee no projeto. Sem `--json`, porque ele mostra o endereço enquanto espera. |
| `login --device`, lendo a saída enquanto espera, por até 10 minutos | Para o computador sem navegador ou com a pessoa longe da tela (SSH, servidor, contêiner); na dúvida, a IA pergunta. O código vale 10 minutos (2.2). A IA passa o endereço e o código e segue lendo até o comando terminar. |
| `add <app> --dry-run --json`, depois `add <app> --yes --json`, com tempo limite de 10 minutos | Sem um terminal, a CLI responde "não" à própria pergunta de confirmação e não instala nada. A IA lê o que o app declara (permissões, chaves e, em `programs`, o que já está no computador), diz ao integrante quais programas serão instalados, espera o sim e só então confirma com `--yes`, que instala também os programas que faltam. O nome vai como o integrante deu: um prefixo com dois pontos faz parte dele. Depois vêm o `doctor` e o pedido de uma conversa nova. |
| `key set <NOME> --browser --json`, depois `key list --json` | A chave de um serviço externo é colada numa página que a CLI abre no navegador. Com `--browser` ela nunca é pedida no terminal, que é onde a IA lê; o comando volta na hora e a página vale 15 minutos. Uma chave de cada vez, só as do app pedido. A IA nunca pede a chave na conversa e não usa uma que o integrante cole ali: manda trocá-la e colar a nova na página. |
| `need <programa> --yes --json`, com tempo limite de 10 minutos | Para um programa que continua faltando depois da instalação, com o sim do integrante. `needs_member` no resultado traz o único passo que cabe a ele. |
| `update --json`, com tempo limite de 10 minutos, e `status --json` | Atualizar e ver o estado. No `status`, `connected` diz se a plataforma ainda aceita a conexão; no `doctor`, só se o computador guarda uma. |

- Conectar de novo é o mesmo login, feito quando o integrante pede, mesmo com `connected` em `true`: o login novo revoga a família anterior do computador (2.3). A IA confere com o `status`.
- Erros: um resultado com `ok: false` cuja mensagem pede um novo login (`relogin`, `not_logged`) leva a IA a fazer o login e repetir o que fazia, sem mostrar o `action_url`; qualquer outro, a mostrar `message` e `action_url` como vieram, que é a forma de erro da seção 3, e parar. O login que não termina é repetido uma vez só, depois de a IA perguntar se o navegador abriu, e outro comando que passa do tempo limite também. A IA nunca escreve à mão os arquivos que o flyee escreve.
- Fica fora da página o que só o FlyeeClub Pro tem (ela é pública) e a conta sem compra, de que as mensagens da própria CLI falam. Na frase da receita, o painel dá o nome que o comando usa (`receita:<slug>`).
- A página foi dada a IAs sem outro contexto, uma em cada idioma, em 2026-10-08. A primeira leitura acertou os fluxos principais e apontou o que a página deixava para o palpite: o aviso do login pedido para depois do comando, o projeto novo num computador já conectado, chaves e programas soltos em volta do `add`, as duas grafias do comando. A segunda, sobre a página reescrita, apontou a atualização do Node.js, os dois caminhos para instalar um programa e a chave colada na conversa. A terceira, com treze situações, respondeu sem palpite 10 delas num idioma e 11 no outro, todas as dos fluxos centrais, e apontou o que restava: a instalação do Node.js, que a página não tem como escrever para cada sistema, e o `npx` recusado pelo PowerShell. O que as leituras apontaram sobre a CLI foi conferido no código dela antes de entrar na página; o que diz respeito ao Node.js e ao PowerShell vem do comportamento conhecido desses sistemas, sem teste aqui. Nenhuma dessas leituras rodou um comando: a página seguida com a CLI de verdade é do ensaio da abertura.

## 9. Mudanças planejadas (fases 9, 10 e 12 do plano, ainda não servidas)

Decididas em 2026-10-06 (`docs/PRODUCT.md`, "Decisões tomadas 2026-10-06"; `docs/PLANO-IMPLEMENTACAO.md`, fases 9 e 10). Nenhuma está no ar: a CLI não deve depender delas até cada item ser movido para o corpo deste contrato. Todas são compatíveis com a v1, porque só acrescentam campos e recusas que a CLI já sabe tratar.

Desde 2026-10-08 a ordem é a da fase 12 do plano, antes da abertura da loja. `ai_tool_detail`, `links.module_page` (com `links.module_page_en`) e `access.tier_name` entraram no corpo em 2026-10-08 (12.1: seções 4.1, 4.2 e 4.9). Os canais, com `newest` e `entitled` por versão, entraram no corpo no mesmo dia (12.5: seções 4.3, 4.4 e 4.5), e `/instalar.md` também (12.6: seção 8.2). Licença, `trigger`, manifesto v2 e a porta MCP ficam para depois da abertura. O token de serviço e a importação do índice (fase 10.2) entraram no corpo em 2026-10-14, na seção 10.

| Onde | Mudança |
|---|---|
| 4.5 download | Campo novo `license`: um JWT assinado pela plataforma, verificável offline pela chave pública em `/.well-known/jwks.json`, com identificador opaco da conta, `device_id`, módulo, versão e data, sem expiração. A CLI o guarda em `.flyee/licenses/<slug>.jwt` e só executa pipelines, agendamentos e ações do painel de um app cuja licença seja desta máquina (fase 10.6, confirmada em 2026-10-06). |
| 4.7 `POST /api/cli/events` | Propriedade nova `trigger`, com `scheduled` ou `manual`, na lista fechada (fase 10.1). |
| 6. Manifesto | `manifest_version: 2` acrescenta `automation`, `requires` e `example_prompt`; a v1 continua aceita; o JSON Schema de 4.8 publica as duas versões (fase 10.1). |
| Porta MCP | Servidor MCP remoto em `/api/mcp`, só leitura, atrás do mesmo servidor OAuth e das mesmas barreiras: catálogo, guia de um app, novidades, estado da conta e instruções de instalação (fase 10.5). O servidor MCP local da CLI fica fora deste contrato. |
| 7. Guias no pacote | Sem mudança no contrato, registrado aqui porque os pacotes de 2026-10-08 não o seguem: a página do app lê só os quatro caminhos da seção 7 (`guides/pt-BR/usar.md`, `guides/pt-BR/abrir-o-capo.md`, `guides/en/usar.md` e `guides/en/abrir-o-capo.md`). Um pacote que traga só `README.md` é aceito e fica sem guia na página. |

## 10. Envio de apps pela CI do produto (token de serviço)

Servido desde 2026-10-14 (fase 10.2 do plano). A CI do repositório do produto cria e atualiza os apps e envia as versões como rascunho, sem uma pessoa logada. Publicar continua sendo um clique do operador em `/admin/catalogo`: nada desta seção publica, retira ou arquiva uma versão ou um app.

**Autenticação.** Um segredo só, com o mesmo nome dos dois lados: `FLYEE_SERVICE_TOKEN`, nas variáveis da Vercel da plataforma e nos segredos do GitHub do produto. Pelo menos 32 caracteres; gere com `openssl rand -hex 32`. Cada chamada leva `Authorization: Bearer <token>`. Sem o token configurado na plataforma, ou com um mais curto que 32 caracteres, as três rotas respondem `503 service_token_not_configured`. Toda escrita grava um evento de auditoria sem autor, com `via: "service_token"`.

### 10.1 `POST /api/service/catalog/import`

Corpo: o `dist/index.json` que o `npm run index` do produto escreve, `{ "generated_at": …, "apps": [ … ] }`, até 200 apps e 2 MB. Cada app cria o módulo, se ele não existe, ou o atualiza.

| Campo do índice | No catálogo | Quando |
|---|---|---|
| `slug` | o endereço do app | identifica; nunca muda |
| `title` | o nome, por idioma | a cada importação; um idioma ausente no índice mantém o texto do catálogo |
| `summary` | o resumo, por idioma | a cada importação, com a mesma regra |
| `trail`, `type` | a etapa e o tipo | a cada importação; a etapa precisa existir no catálogo |
| `compatible_ais`, `external_credentials` | as IAs testadas e as chaves | a cada importação |
| `description_md` | a descrição em português | só quando o app ainda não tem uma; sai sem o `# Título` do topo, que a página já mostra |
| `showcase` (opcional, desde 2026-10-17) | o exemplo do app respondendo a um pedido, por idioma | a cada importação, idioma por idioma; um idioma ausente no índice mantém o do catálogo, e um idioma com `null` sai dele (desde 2026-10-20) |
| `version`, `sha256`, `size_bytes`, `package`, `permissions`, `lessons`, `changelog`, `license` | nada | chegam com o pacote, em 10.3 |

**O exemplo do app (`showcase`).** A loja mostra o que o app devolve, nunca o comando que o instala: a home, `/catalogo` e a página de cada app mostram o app respondendo a um pedido. Cada app manda o seu, nos dois idiomas quando puder:

```json
"showcase": {
  "pt-BR": {
    "request": "Quero gravar um vídeo de uns 10 minutos sobre marmita da semana. Me ajuda com o roteiro?",
    "reply": [
      { "label": "Título", "text": "Marmita da semana em 1 hora, sem repetir prato" },
      { "label": "Gancho · 0:00", "text": "Na quarta você já não aguenta a mesma comida." }
    ],
    "saved": "Salvo em roteiros/marmita-da-semana/estrutura.md"
  },
  "en": { "request": "…", "reply": [{ "text": "…" }] }
}
```

- `request`: o pedido que o integrante faz à IA, de 1 a 400 caracteres.
- `reply`: de 1 a 8 linhas da resposta; cada uma tem `text` (até 280) e, se quiser, `label` (até 40: uma cena e o tempo, um passo, um número). A primeira linha aparece com mais destaque.
- `saved`: opcional, a linha final com o que o app gravou (até 160).
- Tem de ser um resultado que o app realmente produz, como no guia "usar". A página o chama de exemplo.
- Todo texto passa pela regra de texto. Um idioma que quebra a regra ou o formato fica de fora, com um aviso em `warnings`, e o app entra mesmo assim.
- Para tirar um idioma da loja, mande-o como `null`: `"showcase": { "pt-BR": { … }, "en": null }` apaga o exemplo em inglês do catálogo na importação seguinte e mantém o português. Um idioma que o índice não traz continua como está no catálogo, e um idioma com problema fica de fora com aviso, também mantendo o do catálogo.
- Uma página em inglês só mostra o exemplo em inglês. Sem exemplo no idioma, a página do app fica só com o ícone e o texto, e a home e `/catalogo` mostram o resumo do app no lugar da resposta.
- O campo vive só no índice, ao lado do nome e do resumo. Fica fora do `flyee.module.json`: o manifesto v1 não tem esse campo, e a CLI 1.x e a inspeção da plataforma leem o manifesto.
O que a importação nunca escreve: a categoria da loja, os perfis, o ícone, a ordem, a chave de acesso, o estado do app e o estado e a marca de entrada de cada versão. Isso é do console.

Todo texto que a loja mostra passa pela regra de texto da plataforma (sem travessão, sem ponto de exclamação, sem emoji, sem as palavras proibidas, sem "grátis" ou "free" e sem o nome do FlyeeClub Pro). Um nome que quebra a regra recusa o app. Um resumo ou uma descrição que quebra fica de fora, com um aviso, e o operador escreve no console.

Resposta `200`, uma linha por app, mais a contagem:

```json
{
  "apps": [
    { "slug": "video-render", "result": "created" },
    { "slug": "youtube-research", "result": "updated", "fields": ["summary"], "warnings": ["description_md: breaks the copy rules (free), left out"] },
    { "slug": "motion-carousel", "result": "unchanged" },
    { "slug": "Bad_Slug", "result": "refused", "errors": ["slug: lowercase letters, digits and hyphens, 2 to 60"] }
  ],
  "summary": { "created": 1, "updated": 1, "unchanged": 1, "refused": 1 }
}
```

Um app recusado não impede os outros. Um arquivo que não é um índice responde `422 invalid_index`, e nada é escrito.

### 10.2 `POST /api/service/catalog/uploads`

Sem corpo. Responde `{ staging_path, signed_url, token, max_bytes }`: um endereço assinado para mandar o ZIP a um armazenamento privado de passagem, igual ao que o console usa. Envie o arquivo com `PUT` no `signed_url`, com `Content-Type: application/zip`. O limite é `max_bytes`, de `MODULE_UPLOAD_MAX_MB`.

### 10.3 `POST /api/service/catalog/versions`

Corpo JSON `{ "module": "<slug>", "staging_path": "<o de 10.2>" }`. A plataforma lê o pacote, faz a mesma inspeção do console (seção 7), confere `name`, `trail` e `type` contra o módulo, recalcula o SHA-256 e grava a versão como rascunho, com os guias que o pacote traz. Um pacote pequeno, até o limite de corpo da Vercel (4,5 MB), também pode ir direto, em multipart, com `module` e `file`.

| Resposta | O que quer dizer |
|---|---|
| `201 { version }` | rascunho criado; `version.sha256` tem de ser igual ao que o `pack` imprimiu |
| `404 module_not_found` | o app não existe: rode a importação de 10.1 antes |
| `409 version_exists` | essa versão já está no catálogo; uma nova execução da CI é inofensiva |
| `422 invalid_package` ou `manifest_mismatch` | `errors` lista cada problema do pacote |
| `401` ou `503` | o token (veja o começo desta seção) |

### 10.4 A ordem numa tag `<slug>@<versão>`

```bash
set -euo pipefail
base="https://flyee.club"
auth="Authorization: Bearer ${FLYEE_SERVICE_TOKEN}"
zip="dist/modules/${slug}-${version}.zip"

npm run index
curl -fsS -X POST "$base/api/service/catalog/import" -H "$auth" \
  -H "Content-Type: application/json" --data-binary @dist/index.json

slot="$(curl -fsS -X POST "$base/api/service/catalog/uploads" -H "$auth")"
curl -fsS -X PUT "$(jq -r .signed_url <<<"$slot")" \
  -H "Content-Type: application/zip" --data-binary @"$zip"

status="$(curl -sS -o finalize.json -w '%{http_code}' -X POST "$base/api/service/catalog/versions" -H "$auth" \
  -H "Content-Type: application/json" \
  --data "$(jq -n --arg m "$slug" --arg p "$(jq -r .staging_path <<<"$slot")" '{module: $m, staging_path: $p}')")"
[ "$status" = 201 ] || [ "$status" = 409 ] || { cat finalize.json; exit 1; }
```

Depois disso a versão aparece como rascunho em `/admin/catalogo/<slug>`, e o operador a publica. A primeira versão publicada de um app recebe a marca de entrada sozinha (seção 4.3).
