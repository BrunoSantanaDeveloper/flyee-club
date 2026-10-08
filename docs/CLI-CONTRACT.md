# Contrato da CLI — token, entrega e manifesto

Contrato entre a plataforma flyee.club (este repositório) e a CLI `npx flyee` (projeto separado). Escrito na fase 3 de `docs/PLANO-IMPLEMENTACAO.md` (2026-10-01). A CLI depende só do que está aqui; o resto da plataforma pode mudar sem aviso.

- **Base**: `https://flyee.club` (uma prévia anuncia o próprio endereço nos documentos de descoberta).
- **Formato**: JSON em UTF-8. Toda resposta da API leva `Cache-Control: no-store`.
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

A página `/ativar` mostra o mesmo código para o integrante conferir com o terminal antes de aprovar.

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
- A plataforma avisa por conta própria, porque um computador parado não roda a CLI: cerca de 5 dias antes de a conexão vencer, o integrante recebe um aviso no sino do painel e um e-mail com o comando `npx flyee update`, uma vez por vencimento (`lib/token-jobs.ts`). Renovar a conexão zera a contagem, e o aviso volta a valer para o vencimento seguinte.
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
  "access": { "active": true, "suspended": false, "tier": "kit", "limits": { "catalog_access": 1, "devices": 1 } },
  "token": { "family_id": "…", "refresh_expires_at": "2026-10-31T12:00:00Z", "days_until_revalidation": 30 },
  "device": { "device_id": "…", "name": "notebook", "registered": true, "last_update_at": "…" },
  "cli": { "min_cli_version": "0.1.0", "latest_core_version": null, "deprecations": [] },
  "revalidate_url": "https://flyee.club/revalidar?d=…",
  "links": { "billing": "…", "devices": "…" }
}
```

`tier` é `kit`, `club`, `pro` ou `null` (nada comprado).

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
- Só `device_id` é obrigatório. Um campo omitido mantém o valor anterior.
- 201 na primeira vez (é o evento `cli.installed`), 200 depois: `{ "status": "created", "device": {…}, "limit": 3, "live_devices": 2 }`.
- 409 `device_limit_reached` com `limit`, `live_devices` e `action_url` quando o plano não comporta mais um computador. Nada é gravado.
- Um computador desconectado pelo integrante só volta com um login novo; com a mesma família responde `device_revoked`.
- Um login feito sem `device_id` fica preso ao primeiro computador que se registrar.

Tetos por degrau, hoje: Gratuito 1, kit 1, assinatura 3, Pro 5 (`plans.limits.devices`, dado configurável).

### 4.3 `GET /api/cli/catalog?locale=&stable=`

Escopo `catalog:read`, computador obrigatório. `locale` é `pt-BR` ou `en` (padrão: o do integrante). `stable=1` restringe a última versão às marcadas como estáveis (reservado; um canal só na v1).

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
      "lessons": [{ "depth": "usar", "locale": "pt-BR", "title": "…", "duration_seconds": 240, "is_advanced": false }]
    }
  ],
  "recipes": [{ "slug": "lancar-mvp", "name": "…", "summary": "…", "icon": null, "modules": ["deploy-check"] }]
}
```

`entitled` diz se esta conta pode baixar o módulo. O vídeo das aulas nunca vem na API: fica no painel.

### 4.4 `GET /api/cli/modules/{slug}`

Escopo `catalog:read`. O módulo, com `description` e todas as versões lançadas, da mais nova para a mais antiga. Cada versão traz `status` (`published` ou `yanked`), `yanked_at`, `yank_reason`, `changelog` no idioma, `compatible_ais`, `permissions` e `verify_url`.

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
- Recusas: 404 versão inexistente ou em rascunho, 410 `version_yanked`, 403 `denied_entitlement` (com o link de upgrade), 429 `download_limit`.
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
{ "min_cli_version": "0.1.0", "latest_core_version": null, "deprecations": [] }
```

Uma CLI abaixo de `min_cli_version` deve pedir atualização antes de qualquer outra chamada. `deprecations` é uma lista de até 10 avisos em texto, que a CLI imprime como estão. Os valores vêm de `platform_settings.cli`, editados na aba Entrega de `/admin/catalogo`.

## 5. Limites

Configuráveis em `platform_settings.cli`:

| Limite | Padrão |
|---|---|
| chamadas por minuto, por conta | 60 |
| chamadas por hora, por conta | 600 |
| downloads por dia, por conta | 200 |
| eventos por hora, por integrante | 600 |

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
3. Publicar, marcar como estável e retirar são ações do console (`lib/catalog/version-actions.ts`), todas auditadas.

## 8. Verificação pública

`/verificar/<slug>@<versão>` (inglês: `/en/verify/…`) mostra para qualquer pessoa o SHA-256, o tamanho, as IAs compatíveis, as permissões declaradas e se a versão foi retirada. É o `verify_url` das respostas. Fora do índice dos buscadores.

## 9. Mudanças planejadas (fases 9, 10 e 12 do plano, ainda não servidas)

Decididas em 2026-10-06 (`docs/PRODUCT.md`, "Decisões tomadas 2026-10-06"; `docs/PLANO-IMPLEMENTACAO.md`, fases 9 e 10), mais `access.tier_name` e `links.module_page_en`, de 2026-10-08 (fase 12). Nenhuma está no ar: a CLI não deve depender delas até cada item ser movido para o corpo deste contrato. Todas são compatíveis com a v1, porque só acrescentam campos e recusas que a CLI já sabe tratar.

Desde 2026-10-08 a ordem é a da fase 12 do plano, antes da abertura da loja: primeiro `ai_tool_detail`, `links.module_page` e `access.tier_name` (12.1), depois os canais com `newest` e `entitled` por versão (12.5) e `/instalar.md` (12.6). Licença, `trigger`, manifesto v2 e a porta MCP ficam para depois da abertura.

| Onde | Mudança |
|---|---|
| Canais | O plano da conta define o canal: `free` (conta sem compra) e `latest` (kit, assinatura, Pro); `stable` continua reservado. `channel` em 4.3 passa a dizer o canal da conta. |
| 4.1 `GET /api/cli/me` | Campo novo `access.tier_name`: o nome do degrau no idioma do integrante ("FlyeeClub", "FlyeeClub Pro"), `null` para a conta sem compra. `access.tier` continua com o valor interno (`kit`, `club`), que a CLI não deve mostrar a ninguém (fase 12.1). |
| 4.3 `GET /api/cli/catalog` | `latest` passa a ser a versão mais nova **que a conta pode baixar** no seu canal. Campo novo `newest` por módulo, com a versão mais nova publicada para qualquer conta, para a CLI dizer quantas versões a conta está atrás. `entitled` continua dizendo se a conta pode baixar algo do módulo. |
| 4.4 `GET /api/cli/modules/{slug}` | Cada versão ganha `entitled` (booleano), para a CLI imprimir com o cadeado o changelog do que a conta não tem. |
| 4.5 download | Versão fora do canal da conta: 403 `denied_entitlement`, com `action_url` de upgrade, igual ao módulo sem direito. Uma versão marcada como grátis é baixável por qualquer conta ativa. |
| 4.9 `GET /api/cli/version` | Campo novo `links.module_page`, um modelo de URL da página pública de um app com a origem `cli` (por exemplo `https://flyee.club/catalogo/{slug}?origem=cli`). É o link que a CLI mostra a quem roda `npx flyee add <slug>` sem conexão: "este app faz parte do acesso flyee.club", mais o link. A CLI continua sem montar URL da plataforma por conta própria. Junto vem `links.module_page_en`, o mesmo modelo no endereço em inglês (`https://flyee.club/en/catalog/{slug}?origem=cli`), para a CLI escolher pelo idioma de quem lê (fase 12.1). |
| 4.9 `min_cli_version` | Sobe para `1.0.0` quando a CLI `flyee@1.0.0` for publicada no npm: a linha 0.x do pacote `flyee` é de outro projeto e não fala este contrato. |
| Regra operacional | A versão grátis de um módulo é marcada no console, uma por módulo, com a primeira publicada pré-marcada. Não há bloqueio técnico de atualização para a conta sem compra: ela não recebe nada porque o canal `free` não ganha versão nova. |
| 4.2 `POST /api/cli/installs` | Campo opcional `ai_tool_detail`: nome curto da ferramenta detectada quando `ai_tool` é `other`; aceito só se estiver em `platform_settings.cli.known_tools`, descartado fora disso, nunca recusado. Adiantado para a fase 12.1: a CLI 1.x já envia o campo (`copilot`, `opencode`, `antigravity`, `kimi`, `windsurf` ou `aider`), e a rota de hoje, que recusa campo desconhecido, responde 400 `invalid_request` a esse registro. Até 12.1 entrar, esse login não se completa. |
| 4.5 download | Campo novo `license`: um JWT assinado pela plataforma, verificável offline pela chave pública em `/.well-known/jwks.json`, com identificador opaco da conta, `device_id`, módulo, versão e data, sem expiração. A CLI o guarda em `.flyee/licenses/<slug>.jwt` e só executa pipelines, agendamentos e ações do painel de um app cuja licença seja desta máquina (fase 10.6, confirmada em 2026-10-06). |
| 4.7 `POST /api/cli/events` | Propriedade nova `trigger`, com `scheduled` ou `manual`, na lista fechada (fase 10.1). |
| 6. Manifesto | `manifest_version: 2` acrescenta `automation`, `requires` e `example_prompt`; a v1 continua aceita; o JSON Schema de 4.8 publica as duas versões (fase 10.1). |
| Porta MCP | Servidor MCP remoto em `/api/mcp`, só leitura, atrás do mesmo servidor OAuth e das mesmas barreiras: catálogo, guia de um app, novidades, estado da conta e instruções de instalação (fase 10.5). O servidor MCP local da CLI fica fora deste contrato. |
| `/instalar.md` | Página pública em markdown para uma IA ler e instalar a CLI com confirmação do usuário (fase 10.3, na ordem da fase 12.6). Fora da API, citada aqui por ser a porta de entrada da CLI. Ela usa os comandos que a CLI tem: `npx flyee@latest login` e `npx flyee doctor --json`; `npx flyee` sem comando só imprime a ajuda. |
| 7. Guias no pacote | Sem mudança no contrato, registrado aqui porque os pacotes de 2026-10-08 não o seguem: a página do app lê só os quatro caminhos da seção 7 (`guides/pt-BR/usar.md`, `guides/pt-BR/abrir-o-capo.md`, `guides/en/usar.md` e `guides/en/abrir-o-capo.md`). Um pacote que traga só `README.md` é aceito e fica sem guia na página. |
