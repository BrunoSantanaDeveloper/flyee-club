# flyeeClub: PRD do negócio

Oct 10, 2026 · @Dev

## Resumo

O FlyeeClub é uma loja de apps para as IAs de terminal. O membro paga uma vez, recebe por um ano todos os apps do catálogo e as atualizações que os mantêm funcionando quando Claude Code, Codex, Gemini CLI ou Cursor mudam, e a IA dele instala e roda tudo sem que ele abra um terminal. A tese é que a atualização contínua é o produto: a cópia de quem para de atualizar envelhece.

O negócio tem duas peças, em dois repositórios que só se falam por um contrato (`CLI-CONTRACT.md` e o JSON Schema do manifesto):

| Peça | Repositório | O que é |
| --- | --- | --- |
| Plataforma flyee.club | `flyee-club` | Contas, cobrança em real (Asaas) e em dólar (Stripe), direito por versão, servidor de pacotes, área do membro, consoles do operador e site bilíngue |
| Produto flyee | `flyee` | A CLI pública `npx flyee`, o núcleo do harness que ela escreve no projeto do membro e os apps, pacotes ZIP versionados |

Onde as coisas estão em 10 de outubro de 2026:

| Item | Estado |
| --- | --- |
| Oferta à venda no site | FlyeeClub: pagamento único, 12 meses, R$ 97 ou US$ 29 (hipótese guardada em `plans`) |
| Assinatura | FlyeeClub Pro: R$ 67/mês ou R$ 597/ano, US$ 19/mês ou US$ 190/ano, oferecida só dentro da área do membro |
| Plataforma | Fases 0 a 8 e 12.1 a 12.6 construídas e testadas; falta a abertura (12.7) |
| Produto | CLI `1.0.0-alpha.1` e núcleo 1.2.0 prontos; nada publicado no npm |
| Catálogo | 4 apps de vídeo em 5 pacotes, aceitos pela inspeção de upload, nenhum publicado |
| O que segura a abertura | Contas novas dos serviços, razão social e CNPJ para os termos, CLI 1.0.0 no npm antes do domínio |

O próximo marco é a lista de espera no ar (Marco A). A loja abre depois de os apps subirem pelo console e de dois ensaios, o de instalação com a CLI real e o de compra (Marco B).

## Problema, oportunidade e tese

Quem trabalha com IA de terminal monta à mão o próprio conjunto de skills, regras e scripts, e esse conjunto quebra a cada mudança da IA. O mercado vende volume de material, não manutenção, e ninguém vende em dois idiomas.

**O problema, em três partes**

- **A ferramenta envelhece rápido.** Muda o formato das skills, o nome das ferramentas, os modelos e as APIs. Um pacote comprado há seis meses deixa de funcionar e ninguém o mantém.
- **O que se vende é arquivo estático ou comunidade.** Skills avulsas (R$ 57 cada), pastas com um `AGENTS.md` por um ano, cursos com centenas de aulas. "329 recursos" e "110+ blueprints" viraram commodity; ritmo de atualização não, porque exige alguém operando.
- **Instalar exige terminal, chaves e programas de sistema** (ffmpeg, yt-dlp, um navegador sem janela). Para quem é de negócio ou agência, essa barreira decide a compra.

**Onde está o vão**

| Oferta | Onde | Preço | O que entrega |
| --- | --- | --- | --- |
| Ratos OS | BR | R$ 97 único, 1 ano | `AGENTS.md` com pastas e skills, instalador guiado, 33 aulas; Claude Code, Codex e Hermes |
| Comunidade Ratos de IA | BR | R$ 597 único, 1 ano | 4 cursos, WhatsApp, calls; 350+ membros |
| Ratos de IA, skills avulsas | BR | R$ 57 cada | 24 skills para Claude Code |
| Maestros da IA | BR | R$ 97/mês | 147 aulas, 329 recursos, encontros semanais |
| Claude Economy | BR | R$ 297 único | 30 skills, 3 agentes, atualização vitalícia como bônus do pacote |
| Automators Club | BR | R$ 197 único | 14+ módulos, templates, calls |
| Comunidades do Skool | Skool, em inglês | US$ 9 a 97/mês | Cursos e templates de Claude Code, de 600 a 7 mil membros cada |

O Ratos OS é o espelho mais próximo: mesmo objeto, mesmo preço, mesmo público amplo, mesma exigência de que o usuário pague a própria IA. A diferença é o modelo: ele vende um ano de acesso a um conjunto de arquivos; o FlyeeClub vende apps versionados que continuam mudando quando a IA muda. Os brasileiros vendem só em português e os do Skool só em inglês.

**A tese**

> A IA muda toda semana; o FlyeeClub mantém suas ferramentas funcionando e melhorando, na IA que você já usa, em português e inglês.

Três mecanismos tornam a tese concreta:

1. **Atualizar exige um token válido**, revalidado no painel a cada 30 dias sem update. Todo membro volta ao painel, e é lá que vê o próximo degrau.
2. **A distância fica visível.** Versões imutáveis, changelog por versão e "quantas versões você está atrás" aparecem na CLI e no painel.
3. **O app instalado nunca para de funcionar** quando o acesso acaba; só as atualizações param. A cópia envelhece em vez de quebrar, o que mantém a promessa honesta e o motivo para renovar.

**Vantagem de origem.** Cada app nasce em uso real do operador: o app de edição de vídeo foi construído para produzir o próprio vídeo de lançamento. Nenhum concorrente da amostra prova uso real.

**O que ainda não está provado.** Ver concorrentes prova que existe mercado, não que ele compra daqui. A validação que conta é pagamento: o portão da fase de venda é 50 compradores.

## Público e segmentos

O FlyeeClub entra amplo, com uma promessa só e quatro portas por perfil, e deixa o uso medido escolher o foco. O único requisito é usar uma IA de terminal com o próprio plano ou a própria chave de API.

| Segmento | Código | Porta no site | Quem é | O que o catálogo de hoje entrega |
| --- | --- | --- | --- | --- |
| Negócio | `negocio` | "Seu negócio" | Dono ou operador que usa IA no dia a dia | Vídeos e carrosséis para as redes sem equipe (`video-studio`, `motion-carousel`) |
| Agência | `agencia` | "Sua agência" | Freelancer ou agência que entrega para clientes | As mesmas peças em volume; uso em projetos de cliente liberado em todo plano pago |
| Produto digital | `produto` | "Seu produto digital" | Quem opera SaaS, curso ou infoproduto | Vídeo com as telas reais do produto, capturadas do site |
| Dev | `dev` | "Seu trabalho de dev" | Dev que usa Claude Code ou Codex todo dia | Pouco: as etapas de engenharia ainda estão vazias no catálogo |
| Outro | `outro` | não aparece | Quem não se encaixa | Fica fora da regra de foco |

**Como o segmento é capturado.** Por link (`?segment=`) ou clique numa porta do site, e confirmado na lista de espera, no cadastro e no onboarding, junto com a IA usada, o idioma e a origem (cookie de 90 dias com `origem` e `utm_campaign`). O servidor carimba segmento, idioma e IA em cada evento a partir do perfil, nunca do cliente.

**O que o membro precisa ter**

- Uma IA de terminal: Claude Code, Codex, Gemini CLI ou Cursor. O clube nunca gasta crédito de IA pelo membro.
- Node.js 20 ou mais novo; a IA instala com o sim da pessoa quando falta.
- Windows, macOS ou Linux. O produto é feito Windows primeiro.

**Quem fica de fora na v1.** Quem usa só o app do Claude ou do ChatGPT, sem terminal. O FAQ responde "Ainda não", e a resposta só muda quando um app rodar de fato sem terminal; a porta MCP planejada lê catálogo e guias, mas não executa apps.

**Um limite que o lançamento precisa encarar.** Os quatro apps declaram só `claude_code` como IA testada. O site promete as quatro IAs e diz que a página de cada app mostra onde ele foi testado; na prática, o público do lançamento é quem usa Claude Code, até Codex, Gemini CLI e Cursor passarem pelos testes.

**Regra de foco (proposta, ainda não confirmada).** Um segmento lidera em compra do FlyeeClub, ativação em 7 dias e uso semanal por 4 semanas completas seguidas, com 30 ou mais contas em cada segmento comparado. Até lá o catálogo continua amplo e `/admin/metricas` usa a proposta como indicador.

## Proposta de valor e posicionamento

Para quem já trabalha com uma IA de terminal, o FlyeeClub é a loja de onde vêm apps prontos que continuam funcionando quando a IA muda, instalados e rodados pela própria IA, em português e em inglês. Ele vende manutenção e resultado, não volume de material.

> Para quem usa Claude Code, Codex, Gemini CLI ou Cursor no trabalho e perde tempo montando e consertando ferramentas, o FlyeeClub é uma loja de apps com atualização contínua que entrega o resultado pronto dentro da IA que a pessoa já paga. Diferente de pacotes de skills e de comunidades de curso, ele vende a versão que continua funcionando, não a quantidade de arquivos.

**O que o membro recebe, camada por camada**

| Camada | O que é | Onde vive |
| --- | --- | --- |
| Apps | Um resultado pronto por app (um vídeo para Reels, um carrossel, a análise de um vídeo), com prompt de exemplo e um modo que entrega algo sem chave externa | `.flyee/modules/<app>/` no projeto |
| Atualizações | Versões novas com changelog quando a IA ou uma API muda; uma versão publicada nunca é alterada | `npx flyee update`, rodado pela IA |
| Harness | `AGENTS.md` com bloco gerenciado, skills em `.agents/skills` e `.claude/skills`, o menu `/flyee` dentro da IA | O projeto do membro |
| Instalação pela IA | `/instalar.md`: a IA confere o Node.js, faz o login aprovado no navegador, instala os programas que o app usa e abre uma página local para a chave | A conversa com a IA e o navegador |
| Confiança | Permissões declaradas por app, SHA-256 conferido antes de extrair, página pública de verificação, telemetria só de uso | A CLI e `/verificar/<app>@<versão>` |
| Guias | Guia escrito por versão: "usar" para todos e "abrir o capô" no FlyeeClub Pro, com vídeo opcional | Painel e página de cada app |

**Os diferenciais e o que já está de pé**

| Diferencial | Estado em 10 de outubro |
| --- | --- |
| Atualização como produto: token de 30 dias, versões imutáveis, distância visível | Construído na plataforma e na CLI |
| A IA instala tudo e o membro nunca abre o terminal | Construído: `/instalar.md`, `need`, `key set` pelo navegador |
| Revisado e seguro: permissões, checksum, verificação | Construído |
| Bilíngue desde o primeiro dia | Construído na plataforma; os manifestos dos apps já levam português e inglês |
| Harness agnóstico de IA | Construído, mas os apps só foram testados no Claude Code |
| Nascido em produção | O app de vídeo foi feito para o próprio vídeo de lançamento |
| Catálogo pelas sete etapas do ciclo do produto | Construído; só Planejar e Divulgar têm apps |
| Duas profundidades: usar e abrir o capô | Estrutura pronta; nenhum guia avançado escrito |
| Receitas que encadeiam apps | Estrutura pronta; nenhuma receita no produto |
| Roadmap proposto e votado | Construído, no FlyeeClub Pro |

**O que o FlyeeClub não é.** Curso com começo e fim, comunidade de networking, marketplace de terceiros ou ferramenta que gasta crédito de IA pelo membro.

**Como a marca fala**

- Uma promessa só no site, com quatro portas por perfil. O botão de compra diz "Assinar FlyeeClub agora"; o do topo, "Quero montar meu sistema", leva aos preços.
- Sem travessão, ponto de exclamação ou emoji, e sem as palavras proibidas (desbloqueie, potencialize, sem esforço, soluções inovadoras; unlock, elevate, empower, seamless, robust, supercharge, game-changing), em tudo que visitante e membro leem, CLI incluída. Testes automáticos seguram a regra.
- Nenhum número que a plataforma não sustente: sem depoimento fabricado, contador de vagas, prazo de oferta, preço riscado ou "de/por".
- Identidade: o amarelo da logo como preenchimento, nunca como texto sobre fundo claro; Londrina Solid nos títulos, Mulish no texto, JetBrains Mono no código.

## Oferta e receita

A escada tem um plano à venda no site, uma assinatura vendida só por dentro e serviços sob demanda. O degrau sem compra existe para o funil de conteúdo, mas nunca é oferecido.

&#91;embedded content: A escada de oferta · 4 degraus e o gatilho de cada subida\]

Cada subida acontece num momento de uso, não numa data: o clique num recurso que o plano não tem, o uso amplo ou a revalidação de 30 dias.

**Os planos como estão no banco**

| Plano | `slug` | Tipo | Real | Dólar | Prazo | Computadores | Canal | Onde aparece |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Conta sem compra | `gratuito` | Piso de toda conta | Sem preço | Sem preço | Sem prazo | 1 | `free` | Em lugar nenhum |
| FlyeeClub | `kit`, `kit-usd` | Acesso único | R$ 97, até 12x no cartão | US$ 29 | 12 meses da fatura paga | 1 | `latest` | Site e painel |
| FlyeeClub Pro mensal | `club-mensal`, `club-mensal-usd` | Assinatura | R$ 67 | US$ 19 | Mensal | 3 | `latest` | Só no painel |
| FlyeeClub Pro anual | `club-anual`, `club-anual-usd` | Assinatura | R$ 597, parcelável | US$ 190 | Anual | 3 | `latest` | Só no painel |

Guardados inativos, para o histórico: os planos `pro-*` (migração 0025) e o `club-fundador-anual` (0038). Os preços são hipóteses de partida, guardados em `plans` e editados em `/admin/billing`, junto com as chaves `listed_on_site` (aparece no site) e `is_public` (aparece no painel).

**O que cada plano libera** (`plans.limits`)

| Direito | Sem compra | FlyeeClub | FlyeeClub Pro |
| --- | --- | --- | --- |
| Apps da loja | Só a versão de entrada | Todas as versões | Todas as versões |
| Atualizações | Nenhuma | Por 12 meses | Enquanto a assinatura vale |
| Computadores | 1 | 1 | 3 |
| Uso em projetos de clientes | Não | Sim | Sim |
| Guias avançados, "abrir o capô" | Não | Não | Sim |
| Receitas | Não | Não | Sim |
| Encontros ao vivo | Não | Não | Sim |
| Propor e votar apps no roadmap | Não | Não | Sim |

**Como a cobrança funciona**

- Real pelo Asaas (PIX e cartão, com a nota fiscal emitida no Asaas) e dólar pela Stripe, roteados pela moeda do plano.
- O FlyeeClub é uma cobrança avulsa. Os 12 meses contam da fatura paga (no parcelado, da primeira parcela confirmada), e renovar é comprar de novo. Doze parcelas concedem um prazo só.
- Parcelamento só em real, só no cartão, no FlyeeClub e no anual, até `billing.max_installments` (o Asaas aceita até 12). O anual parcelado é uma compra única e não renova sozinho; a tela diz isso antes do pagamento.
- Assinatura em atraso tem 7 dias de carência (`dunning.grace_days`), com o acesso mantido e aviso no sino.
- Arrependimento em 7 dias (`guarantee.days`, exigência do CDC). Reembolso ou estorno revoga o que a fatura comprou e derruba os tokens da CLI se o acesso acabou; os apps instalados continuam funcionando. Reembolso parcial é tratado como total.
- Cupom aparece nomeado ao lado do preço cobrado, nunca com preço riscado. Não há teste grátis (`trial_days` = 0): a versão de entrada cumpre esse papel.
- O fim do período pago tem dois e-mails, um antes e um no dia, lembrando que a compra única não renova sozinha.

**Conta de referência** (antes de taxas e impostos)

- 300 FlyeeClub a R$ 97 são R$ 29.100, uma vez.
- 100 assinantes do Pro a R$ 67 são R$ 6.700 por mês.
- O objetivo dos primeiros seis meses é dado, não receita: quem compra, por qual porta, quem ativa e quem volta.

**Dois pontos de que a receita depende e que ainda não têm meta**

1. **A renovação do FlyeeClub.** É a receita recorrente do degrau de entrada. Os e-mails de fim de período existem, mas nenhum documento define a taxa de renovação esperada.
2. **O valor do Pro no dia da abertura.** Receitas, guias avançados e encontros ainda não têm conteúdo e aparecem com o selo "Em breve". Sobram os 3 computadores e o voto no roadmap.

## Arquitetura

O produto chega ao membro por duas portas e nada mais: a CLI, publicada no npm, e os pacotes dos apps, entregues pelo servidor de pacotes da plataforma com o token do membro. A plataforma nunca executa nada; tudo roda na máquina do membro, pela IA dele.

&#91;embedded content: Arquitetura · produto, plataforma e máquina do membro\]

Os dois repositórios nunca importam código um do outro. O produto depende só de `CLI-CONTRACT.md` e do JSON Schema do manifesto, fixado em `schemas/flyee.module.schema.json`; a CI do produto falha quando o schema diverge do que a plataforma publica.

**Plataforma (`flyee-club`)**

| Camada | Tecnologia e regra |
| --- | --- |
| Web | Next.js 15 (App Router), React 19, Tailwind 4. MUI v9 e MUI X Premium só nas áreas logadas; o site público roda sem MUI, pela nota de desempenho no celular |
| Dados | Supabase: Postgres com RLS em toda tabela, auth e storage. Drizzle como espelho. Migrações 0000 a 0040, ainda não aplicadas num projeto hospedado |
| Cobrança | Asaas (real: PIX, cartão, nota fiscal) e Stripe (dólar) atrás de um `PaymentProvider` |
| E-mail e jobs | Resend com React Email nos dois idiomas; Inngest para o resumo de segunda, os avisos de fim de período e os backups noturnos |
| Deploy | Vercel, só pelo GitHub Actions |
| Medição | `product_events` para o uso do membro; GA4, Meta Pixel e CAPI no site; visitas por porta contadas no servidor; sem PostHog |
| Qualidade | 432 asserções pgTAP, 401 testes unitários, 51 testes de ponta a ponta; testes que seguram as regras de texto, de contraste e de "nunca oferecer o grátis" |

**Produto (`flyee`)**

| Parte | O que é |
| --- | --- |
| `packages/cli` | TypeScript ESM, Node 20+, empacotada pelo tsup num arquivo só, sem dependência em tempo de execução. Todo comando aceita `--json` e `--yes`, porque quem roda é a IA. Testada contra uma plataforma falsa (`test/fake-platform.ts`) |
| `packages/core` | O que a CLI escreve no projeto: versão do núcleo, o registro declarativo de IAs (`tools.json`), o bloco do `AGENTS.md` por idioma e a skill do menu `/flyee`. Nenhum código |
| `packages/module-tools` | Ferramentas do operador, nunca publicadas: `validate`, `pack` (ZIP determinístico que gera o `files` do manifesto), `index` e o console `apps` |
| `modules/<slug>` | Um diretório por app: manifesto, README (guia do membro e texto da página), skills, scripts, referências e `tests/eval.json`, que nunca vai ao membro |
| `recipes/` e `schemas/` | Receitas (nenhuma ainda) e o schema do manifesto |

**O que a CLI escreve na máquina do membro**

| Onde | O que |
| --- | --- |
| `.flyee/modules/<slug>/` | A única cópia dos arquivos de cada app |
| `.agents/skills/` e `.claude/skills/` | Uma ponte `SKILL.md` por skill, com o frontmatter original, apontando para o arquivo canônico. Sempre cópias, nunca symlinks, por causa do Windows |
| `AGENTS.md` | O arquivo canônico, com um bloco gerenciado entre `<!-- flyee:begin -->` e `<!-- flyee:end -->` |
| `CLAUDE.md` e `GEMINI.md` | Ponteiros de uma linha para o `AGENTS.md` |
| `.flyee/lock.json` | O que está instalado no projeto |
| `~/.flyee/` | Identidade do computador, credenciais, chaves externas (`keys.json`), fila de eventos, projetos conhecidos e programas instalados |

A CLI nunca sobrescreve um arquivo que o membro escreveu: anexa o bloco gerenciado ou pula e diz que pulou.

**O contrato da API**

- **Endpoints:** `GET /api/cli/me`, `POST /installs`, `GET /catalog`, `GET /modules/{slug}`, `GET /modules/{slug}/versions/{versão}/download`, `GET /recipes/{slug}`, `POST /events`, e os públicos `GET /schema/module` e `GET /version`.
- **Toda chamada** leva `Authorization: Bearer` e `X-Flyee-Device` e passa pelos portões na ordem: token, escopo, direito, máquina, limite.
- **Login:** OAuth 2.1 com PKCE pelo navegador ou por código de dispositivo em `/ativar`. O refresh token gira a cada uso e dois refreshes simultâneos revogam a família, por isso a CLI os serializa com um arquivo de trava.
- **Versão mínima:** antes de qualquer chamada a CLI compara a própria versão com `min_cli_version` e para abaixo dela.
- **Links:** a CLI nunca monta um endereço da plataforma; os links vêm do servidor (`action_url`, `links`).
- **Verificar antes de extrair:** tamanho e SHA-256 iguais aos da resposta de download, todo caminho seguro (relativo, sem `..`, sem letra de unidade) e a lista do ZIP igual ao `files` do manifesto, nos dois sentidos.

**O manifesto (`flyee.module.json` v1)** declara nome, versão, tipo (`skill`, `workflow`, `framework` ou `tool`), etapa, título e resumo em português e inglês, IAs testadas (`compatible_ais`), permissões (`shell`, `fs:read`, `fs:write`, `network`, `env`, cada uma com escopo e motivo nos dois idiomas), chaves externas, changelog e `files`, gerado pela ferramenta. A v2 está reservada para `automation`, `requires` e `example_prompt`.

## Jornada do membro

O membro passa pela plataforma em três momentos: para comprar, para aprovar o login e para revalidar a cada 30 dias sem atualizar. Todo o resto acontece dentro da conversa com a IA dele.

&#91;embedded content: Jornada do membro · da descoberta à renovação\]

A subida ao Pro e a renovação não são etapas em sequência: o aviso do Pro pode abrir em qualquer clique num recurso dele, e a renovação só chega no fim dos 12 meses.

| Etapa | O que acontece | Onde | O que se mede |
| --- | --- | --- | --- |
| Descobre | Um vídeo leva a `/catalogo/<app>?origem=youtube&utm_campaign=<id do vídeo>`; a primeira visita grava a origem num cookie de 90 dias. Ou a home, com uma porta por perfil | Site | Visita por porta, no servidor; GA4 e Pixel |
| Compra | "Assinar FlyeeClub agora" leva ao cadastro e dele direto ao checkout, uma página sem menu nem rodapé. O onboarding vem depois. Antes da abertura, todo botão leva à lista de espera | Site e checkout | `account.created` com `origem`, `kit.purchased`, Purchase no GA4 e no Meta |
| Instala | O membro cola na IA "Instale o flyee seguindo flyee.club/instalar.md". A IA diz o que vai fazer e espera o sim, confere o Node.js 20, roda o login (o navegador abre e o membro aprova, com limite de 5 minutos), confere com `doctor`, mostra permissões, chaves e programas do app com `add --dry-run`, instala com `--yes` e pede uma conversa nova | IA e navegador | `module.installed` |
| Ativa | O membro pede o resultado ao app, como no "Peça assim" do README | IA | `module.activated`, `tool.executed` |
| Usa e atualiza | `update` traz as versões novas e renova o token por mais 30 dias | IA | `module.updated` |
| Revalida | Depois de 30 dias sem update, o membro aprova de novo no navegador (`/revalidar`), onde aparece a oferta do próximo degrau. Os apps instalados continuam funcionando enquanto isso | Painel | Revalidação, `upsell.viewed` |
| Sobe ao Pro | O clique num recurso do Pro abre o aviso de upgrade com o preço lido de `plans` | Painel | `upsell.clicked` com `feature`, assinatura em até 14 dias |
| Renova | Dois e-mails, um antes e um no fim do período, lembram que a compra única não renova sozinha | E-mail e painel | Nova compra do FlyeeClub |

**O caminho sem compra.** Quem chega pelo link de um vídeo pode criar a conta sem comprar; quem roda `npx flyee add <app>` sem login recebe da CLI a página do app com `origem=cli`, vinda do servidor. A conta sem compra instala só as versões de entrada. Pedir outra versão responde `denied_entitlement` com o link de upgrade e grava `update.denied_entitlement`. No painel ela vê as duas ofertas lado a lado, o FlyeeClub e o Pro, e as áreas do Pro continuam no menu, abrindo o aviso no clique.

**O que só o membro faz.** Confirmar na conversa o que a IA vai fazer, aprovar o login no navegador, colar uma chave externa na página de uso único que a CLI abre em `127.0.0.1`, e dar a senha de administrador quando o sistema pede (a CLI devolve isso como `needs_member`, com um passo só). Nenhum texto manda o membro ao terminal.

## Requisitos da plataforma

A plataforma está construída e testada até a fase 12.6; o que falta antes da loja é operacional (contas, dados da empresa, deploy). Os requisitos abaixo descrevem o que existe e marcam o que é plano.

| Área | Requisito | Estado |
| --- | --- | --- |
| Contas | Cadastro, login, 2FA com step-up, sessão paralela de suporte para impersonação, exclusão de conta, uma organização pessoal por membro | Construído |
| Consentimento | Termos e políticas versionados em `consent_terms`; texto publicado nunca muda, só ganha versão nova; aceite registrado | Construído; falta a razão social do operador |
| Cobrança | Escada em real e dólar, assinaturas com preço congelado, cupons, faturas, parcelamento, carência, webhooks idempotentes em `/api/webhooks/[provider]` | Construído |
| Direitos | `org_entitlements` soma o piso, as concessões, a assinatura e os add-ons, sem nunca reduzir um limite; canal `free` ou `latest`; uma versão de entrada por app (`is_entry`) | Construído |
| Conexão da CLI | Servidor OAuth 2.1 do cliente `flyee-cli`, código de dispositivo em `/ativar`, revalidação em `/revalidar`, teto de computadores por plano | Construído |
| Entrega | `/api/cli/*` com os portões token, escopo, direito, máquina e limite; mensagens no idioma do membro com `action_url` | Construído |
| Publicação | Upload de pacote pelo console com inspeção (schema, caminhos, `files`, checksum); rascunho, publicada, estável e retirada; uma versão de entrada não é retirada enquanto tiver a marca | Construído |
| Verificação | Página pública `/verificar/<app>@<versão>` com o checksum | Construído |
| Instalação pela IA | `/instalar.md` e `/en/install.md` em markdown puro, fora do índice, texto no código com testes | Construído |
| Catálogo | Sete etapas, categorias da loja (Vender, Divulgar, Vídeo, Pesquisa, Construir), perfis por app, selos "Novo" e "Usa sua conta X", guias por versão, "Em breve na loja" vindo do roadmap | Construído |
| Área do membro | `/inicio` (degrau, computadores, data da revalidação, checklist de ativação), `/modulos`, `/receitas`, `/novidades`, `/encontros`, `/roadmap`, `/settings`, onboarding de três passos | Construído |
| Pro no clique | Um aviso de upgrade por recurso do Pro; nenhum controle desligado; selo "Em breve" em área vazia | Construído |
| Roadmap | Proposta do membro Pro numa fila de análise, voto, o mais votado do mês, marca de app contratado | Construído |
| Consoles | Membros, métricas com a regra de foco, catálogo, roadmap, encontros, leads, cobrança, preços de IA, auditoria, insights, backups, avisos, ajuda, blog, site e suporte; resumo de segunda por sino e e-mail | Construído |
| Site público | Home, como funciona, catálogo e página de cada app, planos (um plano), sobre, contato, ajuda, blog, lista de espera com dupla confirmação, páginas legais; português em `/` e inglês em `/en` com endereços traduzidos; estágio `waitlist` ou `open` | Construído |
| E-mails e sino | Todo e-mail nos dois idiomas, jobs agendados, mensagens para a lista confirmada, descadastro | Construído |
| Medição | Eventos de uso por lista fechada, eventos do site por `data-track`, visitas por porta, GA4 e Pixel com opt-out | Construído |
| Auditoria e backup | Evento de auditoria em toda mutação, trilha de acesso, versionamento de linhas; backup noturno de toda tabela e sob demanda | Construído |
| Manifesto v2 | `automation`, `requires`, `example_prompt` e o evento `trigger`, para apps com pipeline e agendamento | Planejado (fase 9) |
| Token de serviço | A CI do produto envia rascunhos sozinha e a plataforma importa o índice de apps | Planejado, antes do segundo app |
| Compatibilidade | Página pública com os níveis "testado" e "compatível pelo padrão", promoção por dado | Planejado (fase 10) |
| Porta MCP | Servidor MCP remoto só de leitura: catálogo, guias, novidades e estado da conta | Planejado (fase 10.5) |
| Contra revenda | Licença assinada por download, marca opaca da conta nos arquivos gerados, alerta de download anômalo | Planejado (fase 10.6) |
| Suporte com IA | Agente de suporte integrado, com as perguntas por app | Planejado (fase 11, por último) |

**Regras que valem para todo requisito novo**

- Preços, limites, tetos, carências e prazos são dados em `plans` e `platform_settings`, nunca constantes no código.
- Toda tabela tem RLS e toda migração declara os grants. Toda mutação grava auditoria.
- O degrau sem compra nunca é oferecido e o Pro nunca aparece no site; testes falham quando uma palavra proibida volta.
- Nenhum texto manda visitante ou membro ao terminal: ele diz o que pedir à IA, e o comando aparece só como referência.
- O amarelo da marca é preenchimento; contraste WCAG 2.2 AA verificado por teste.

## Requisitos do produto

A CLI e o núcleo do harness estão prontos e testados contra uma plataforma falsa, e os quatro apps estão empacotados. Antes da abertura o produto precisa atender os pedidos que a plataforma registrou em 8 de outubro; os que dá para conferir no código continuam abertos.

**A CLI (`npx flyee`)**

| Comando | O que faz |
| --- | --- |
| `login [--device] [--name] [--kind own\|client]` | Conecta o computador pelo navegador (PKCE) ou por código de dispositivo e registra a máquina |
| `add <app>`, `add receita:<nome>` com `--dry-run` e `--yes` | Mostra permissões, chaves e programas; baixa, confere, extrai, escreve as pontes e instala os programas que o app declara |
| `update` | Atualiza os apps do projeto e renova o token por 30 dias |
| `status [--quiet]` | Apps, versões, distância até a mais nova, conexão e data da revalidação |
| `doctor` | Confere Node.js, login, máquina e arquivos do harness |
| `remove <app>` | Tira um app do projeto, só quando o membro pede |
| `need <programa…> [--upgrade]` | Instala ffmpeg, yt-dlp e outros por winget, Homebrew ou apt; o que só o membro pode dar volta como `needs_member` |
| `key set\|list\|remove` | Abre uma página de uso único em `127.0.0.1` para colar a chave e a guarda em `~/.flyee/keys.json`; uma variável de ambiente com o mesmo nome vence |
| `track <evento>` | Enfileira um evento da lista permitida; o envio sai em lotes de até 50 |
| `logout` | Revoga o token do computador |
| `dev link` | Instala um app do repositório num projeto de teste sem a plataforma; recusa rodar dentro do repositório |

Todo comando aceita `--json` e `--yes`, porque quem roda é a IA.

**O núcleo do harness (1.2.0)** escreve o bloco gerenciado do `AGENTS.md` por idioma, a skill `/flyee` (menu dentro da IA, que só roda a CLI com `--json` e nunca inventa estado) e lê o registro `tools.json`: quatro IAs testadas (Claude Code, Codex, Gemini CLI, Cursor) e seis compatíveis pelo padrão (GitHub Copilot, OpenCode, Antigravity, Kimi, Windsurf, Aider). Uma IA do segundo nível sobe ao primeiro com 30 máquinas vivas por 4 semanas seguidas.

**Regras de autoria de um app**

- Tipo `skill`, `workflow`, `framework` ou `tool`. Personas e subagentes, quando existem, são arquivos internos, invisíveis ao membro.
- Obrigatórios: manifesto, README (guia do membro e texto da página, com um "Peça assim"), ao menos uma skill nos tipos `skill` e `workflow`, `tests/eval.json` com ao menos um caso, changelog, título e resumo em português, permissões para tudo que o app toca e cada chave externa declarada.
- App com chave externa sempre tem um modo que entrega algo sem ela.
- A descrição de uma skill tem até 1.024 caracteres, de preferência menos de 400, porque entra no contexto de toda sessão.
- Nenhum texto do app manda o membro instalar, digitar ou rodar algo; `validate` recusa.
- Um app `tool` serve os outros pelo `references/interface.md`; quem usa quem é lido do que os apps carregam, nunca declarado.
- Versões são imutáveis. Nos apps principais, a 1.0 sai deliberadamente reduzida e a 1.1 completa no mesmo dia.
- Num `workflow` com agendamento, a metade automática não tem ponto de aprovação; as decisões ficam na metade sob demanda.

**O que o produto precisa fazer antes da abertura**

| Pedido | Por quê | Peso |
| --- | --- | --- |
| Publicar a CLI 1.0.0 no npm como `latest` (hoje ela está em `1.0.0-alpha.1`) | O site e `/instalar.md` mandam rodar `npx --yes flyee@latest`; o `latest` de hoje é a 0.7.9 de outro projeto | Bloqueia a lista de espera |
| Fazer commit do trabalho: três dos quatro apps estão fora do git e nove arquivos estão alterados desde 6 de outubro | Os pacotes aceitos pela plataforma não têm tag nem histórico; uma perda no disco perde a loja | Urgente |
| Pôr `guides/pt-BR/usar.md` e `guides/en/usar.md` em cada pacote; `abrir-o-capo.md` nos apps com profundidade | É o único caminho que a página do app lê; sem ele não há guia nem conteúdo para o Pro | Antes da abertura |
| Escrever os comandos do harness como `npx --yes flyee …` e a chave como `key set <NOME> --browser` | Num terminal o npx pergunta antes de baixar, e a IA fica esperando uma resposta que ninguém dá | Antes da abertura |
| Quando o `add` não tiver terminal para perguntar, dizer para rodar de novo com `--yes` | Hoje imprime só "Instalação cancelada." e a IA não sabe por quê | Antes da abertura |
| Deixar a IA ler o endereço e o código do login `--device` antes de o comando terminar | O comando espera até 10 minutos e a IA só lê a saída no fim | Antes da abertura |
| Rever os textos da CLI pela regra de texto | `add.credentials` ainda diz "salve cada uma no seu terminal" | Antes da abertura |
| Ler `access.tier_name` e `links.module_page_en` | A CLI imprime "kit" e mostra a página só em português | Antes da abertura |
| Testar os apps no Codex, no Gemini CLI e no Cursor | Todos declaram só `claude_code`, e o site promete quatro IAs | Antes de prometer as quatro |
| Cortar em 80 caracteres o nome de `login --name` | A plataforma corta; sem o corte na CLI, a máquina e o painel mostram nomes diferentes | Pequeno |
| Decidir o que `npx flyee` sem comando faz | Hoje imprime a ajuda; se virar a instalação guiada, `/instalar.md` fica mais curto | Decisão |
| Receitas e guias avançados | São o que o Pro soma; até lá aparecem com o selo "Em breve" | Depois da abertura, antes de empurrar o Pro |
| Não enviar campo da seção 9 do contrato antes de ele subir para o corpo | O `ai_tool_detail` enviado antes da hora derrubou o login até a 12.1 | Regra permanente |

**Fases seguintes do produto** (`docs/PLANO.md`): P4 pipelines (`flyee run` e `flyee schedule` no Agendador do Windows, no launchd ou no systemd), P5 painel local `flyee ui`, P6 licença, marcas e servidor MCP local, P7 executor de evals e canário noturno, P8 matriz de compatibilidade.

## Catálogo inicial

O catálogo de abertura é uma família de vídeo: dois apps que o membro usa direto e dois motores que outros apps chamam. Tudo cabe nas etapas Planejar e Divulgar, e nenhum app está publicado ainda.

| App | Nome na loja | Tipo · etapa | Versões | O que entrega | Chave externa | Usa | Evals |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `video-studio` | Estúdio de vídeo | workflow · Divulgar | 1.0.0 | Vídeos animados para Reels, TikTok e Shorts a partir do pedido: pergunta o que falta, usa logo, cores e telas reais da marca, compõe a trilha na batida, mostra uma prévia e entrega o vídeo conferido | Nenhuma | `video-render` | 9 casos |
| `motion-carousel` | Carrossel animado | skill · Divulgar | 1.0.0 (entrada) e 1.1.0 | Carrosséis do Instagram em que cada slide é um vídeo curto em loop, com som na batida, MP4 prontos e prévia do feed. A 1.1 soma slides com fotos, recorte automático e paralaxe | `GEMINI_API_KEY`, opcional | `video-render` | 8 casos |
| `video-render` | Motor de vídeo | tool · Divulgar | 1.0.0 | Transforma uma página animada em vídeo (9:16 a 16:9), com trilha original, efeitos na batida, captura da marca e conferência por rede: capa, texto, área segura, volume, formato e duração | Nenhuma | Ninguém; é usado pelos dois acima | 6 casos |
| `video-analysis` | Análise de vídeo | tool · Planejar | 1.0.0 | Assiste a vídeos do YouTube ou do computador e descreve com tempos o que aparece, o que é dito e como foi editado; modo local sem chave e modo Gemini | `GEMINI_API_KEY`, opcional | Ninguém; nenhum app o usa ainda | 8 casos |

Os programas que os apps usam (ffmpeg e ffprobe em todos, yt-dlp na análise, um navegador sem janela no motor, no estúdio e no carrossel) são instalados pela CLI. No Windows o Microsoft Edge já serve de navegador.

**Como o catálogo aparece**

- Na loja pública, pela categoria (o vídeo cai em "Vídeo"); no painel, na CLI e no roadmap, pela etapa.
- Os perfis de cada app são marcados no console; o bloco "Para quem é" da home mostra até três apps publicados por perfil.
- O selo "Novo" vale por 30 dias depois da primeira publicação; "Usa sua conta X" sai das chaves obrigatórias (nenhum app de hoje tem chave obrigatória).
- Ideias planejadas e em construção no roadmap aparecem em "Em breve na loja".

**O que falta no catálogo**

- **Cinco etapas vazias:** Construir, Publicar, Vender, Escalar e Manter. O segmento dev, em especial, não tem app.
- **Nenhum guia no pacote** e nenhuma receita, então a página de cada app abre sem guia e as áreas do Pro abrem com "Em breve".
- **Testado só no Claude Code.**
- **A versão de entrada dos três apps de versão única.** A primeira versão publicada leva a marca de entrada. Para `video-studio`, `video-render` e `video-analysis`, que só têm a 1.0.0, a conta sem compra receberia o app inteiro até sair uma 1.1. Isso contraria a regra dos apps principais para o `video-studio`. O `video-render` precisa manter uma versão de entrada, porque o carrossel 1.0.0 depende dele.

**Próximos candidatos.** O app de edição de gravações, que o operador constrói para o vídeo de lançamento, será o primeiro a usar o `video-analysis`; a 1.1 do estúdio depende de um app de transcrição. A lista antiga do PRD (radar de conteúdo, pauta e roteiro, copy de redes, copy de LP, saas-starter) fica como referência, não como compromisso; o saas-starter só entra depois da checagem de licença do MUI X e do template.

## Requisitos não funcionais

O produto escreve no computador de outra pessoa e a plataforma cobra dela, então segurança, privacidade e honestidade são requisitos de primeira ordem. Quase todos já têm um teste ou uma regra de código segurando.

| Categoria | Requisito | Como é garantido |
| --- | --- | --- |
| Integridade da entrega | Nada é extraído sem tamanho e SHA-256 iguais aos da resposta, caminhos seguros e lista do ZIP igual ao `files` do manifesto | Instalador da CLI e inspeção no upload, com testes dos dois lados |
| Confiança | Permissões declaradas para tudo que o app toca, mostradas antes da instalação; checksum público | Manifesto, `add --dry-run`, `/verificar` |
| Privacidade | Telemetria só com os nomes e propriedades da lista permitida, valores curtos, nunca conteúdo, caminho, prompt ou nome de projeto; fila local que o membro pode ler; lotes de até 50 | `product_events` com lista fechada, CLI, política de privacidade v2 |
| Chaves | Nenhuma chave no chat, num comando ou num projeto; guardada uma vez por máquina | `key set` com página local de uso único, `~/.flyee/keys.json` |
| Promessa de uso | Nenhum comando apaga ou desliga um app porque o acesso acabou; só as atualizações param | Regra de ouro do produto; a licença planejada nunca expira para uso |
| Plataformas | Windows primeiro, depois macOS e Linux; cópias em vez de symlinks; Node.js 20 ou mais novo; CLI sem dependência em tempo de execução | Bundle único pelo tsup; `check:tarball` falha se algo além de `dist`, README e LICENSE entrar no pacote |
| Desempenho | Site público sem MUI; meta de 90 no celular. Medido em build local: 90 a 95, LCP de 2,9 a 3,4 s | Teste do grafo de imports e lint do site |
| Acessibilidade | WCAG 2.2 AA: o amarelo só como preenchimento, contraste medido | `palette-contrast.test.ts`, testes de a11y |
| Idiomas | Português primeiro, inglês desde o início; endereços traduzidos; conteúdo de um idioma nunca cai no outro | `next-intl`, testes de catálogo de mensagens |
| Texto | Sem travessão, exclamação, emoji ou palavra proibida; sem grátis oferecido; sem Pro no site; sem terminal para o membro | `copy-rules.test.ts`, pgTAP `0033`, checagem de texto de ponta a ponta |
| Limites de uso | 60 chamadas por minuto, 600 por hora, 200 downloads por dia e 600 eventos por hora por padrão, editáveis | `platform_settings.cli` |
| Contrato | Versão mínima da CLI e avisos de descontinuação servidos pela plataforma; campos novos lidos só quando presentes | `GET /api/cli/version`, seção 9 do contrato |
| Auditoria e backup | Toda mutação auditada; trilha de acesso; backup lógico noturno | `recordAudit`, `audit_events`, `packages/backup` |
| Credenciais da transição | O `apps/web/.env` herdado tem credenciais de produção do MedChina; o `.env.local` as anula. Nenhum `db:*:remote` roda antes de o `.env.local` apontar para o projeto novo; nenhum arquivo de ambiente vai ao git nem ao Vercel | `.gitignore`, `.vercelignore`, portão `remote-db-gate.mjs`, `npm run preflight` |
| Licenças | O repositório da plataforma fica privado por causa do MUI X Premium e do template Nexture; nada desse código vai para um app | Regra do repositório; checagem antes do saas-starter |
| Suporte | Assíncrono e coletivo; aviso de versão dentro do harness; FAQ que cresce das perguntas | Painel, `status`, fase 11 |

## Go-to-market

O lançamento acontece em dois tempos, lista de espera e loja aberta, e o canal principal é conteúdo no YouTube feito com apps reais do catálogo. O site vende um produto só; o resto da escada é vendido por dentro.

**Os dois marcos da abertura** (`docs/DEPLOY.md`, "Roteiro da abertura")

| Marco | O que acontece | O que só o operador traz | Botões do site |
| --- | --- | --- | --- |
| A · Lista de espera no ar | Banco novo, Vercel, CLI 1.0.0 no npm antes do domínio, domínio, deploy, login, jobs, conta de operador, dados da empresa, estágio `waitlist`, `min_cli_version` 1.0.0, prova com o próprio e-mail | Projeto Supabase, licença do MUI X Premium, projeto e token da Vercel, domínio, Resend com o domínio verificado, Inngest, razão social, CNPJ, cidade e UF | "Entrar na lista de espera" |
| B · Loja aberta | Asaas e Stripe em produção, preços conferidos, `preflight --stage open` limpo, apps criados e pacotes enviados no console com categorias, perfis e versões de entrada, ensaio sem dinheiro (instalação com a CLI real e compra num preview com sandbox), uma compra real, estágio `open` | Conta Asaas aprovada, conta Stripe, os cinco ZIPs, um segundo projeto Supabase para o ensaio | "Assinar FlyeeClub agora" |

**O funil de conteúdo**

1. **O vídeo entrega o método completo**, feito com um app real do catálogo. Vídeo que para no problema é teaser; o que se vende é o app pronto, as atualizações e a loja.
2. **Um link por vídeo:** `/catalogo/<app>?origem=youtube&utm_campaign=<id do vídeo>`. A origem fica num cookie de 90 dias e vai para o cadastro; é o que diz qual vídeo vende.
3. **A página do app vende o FlyeeClub.** Quem cria conta sem comprar vira um lead com segmento, IA, idioma, máquina e instalação registrados, mais rico que um e-mail de lista. A newsletter continua para quem não quer conta.
4. **A versão de entrada envelhece à vista:** a conta sem compra vê na CLI e no painel quantas versões está atrás, e a cada revalidação vê a oferta.
5. **Lançamento de um app principal:** no dia do vídeo, a 1.0 reduzida é a versão de entrada e a 1.1 completa sai junto.

O que não existe no funil: cupom ou desconto por vídeo, teste grátis do acesso completo, duas versões completas de um mesmo app e qualquer texto público que ofereça uma conta grátis.

**O site**

- **Mensagem central:** "Apps que automatizam o trabalho da sua empresa na sua IA favorita", com o selo "Loja de apps para a sua IA".
- **Quatro portas por perfil** (negócio, agência, produto digital, dev) e o botão "O FlyeeClub é pra mim?", que gravam o segmento.
- **A loja em formato de app store**, filtrada por categoria, com cards que levam à página de cada app (guia, versões, permissões, checksum).
- **Um plano em `/planos`**, com parcelamento em real. Equipes e serviços vão para o contato.
- **Bilíngue e indexado:** português em `/`, inglês em `/en`, hreflang e sitemap; `/instalar.md` fica fora do índice.
- **Instalação pela IA:** o site diz o que pedir à IA ("Peça à sua IA: instale o flyee seguindo flyee.club/instalar.md") e mostra o comando só como referência.

**Dentro da plataforma**, o painel vende o FlyeeClub à conta sem compra e o Pro no clique de um recurso dele, no início de quem usa três ou mais etapas em 30 dias e na revalidação. Mentoria, consultoria e app sob medida aparecem a quem já paga e levam ao contato.

**Canais pagos.** O Pixel do Meta, a CAPI e o GA4 já estão instrumentados (cadastro, início de checkout, compra, assinatura), com opt-out. Nenhum documento planeja verba de mídia antes da regra de foco.

## Métricas

O foco não tem data: ele é escolhido quando uma regra combinada antes for cumprida. Cinco métricas, uma linha por segmento e por semana, alimentam essa regra em `/admin/metricas`.

| Métrica | Definição | O que responde |
| --- | --- | --- |
| 1 · Compradores por porta | Compras do FlyeeClub e conversão da página, por porta de entrada e origem | Qual perfil e qual vídeo vendem |
| 2 · Ativação em 7 dias | Instalou e executou ao menos um app nos primeiros 7 dias | Quem passa da instalação ao uso |
| 3 · Uso semanal | Executou em 3 das últimas 4 semanas | Quem tem motivo para renovar |
| 4 · FlyeeClub para Pro em 60 dias | Assinou o Pro em até 60 dias da compra do FlyeeClub | Se a camada de profundidade vale o preço |
| 5 · Receita por membro em 90 dias | FlyeeClub, Pro e serviços somados | Quanto vale cada porta |

**Portões** (`PRODUCT.md`, "Etapas")

- **Vender o FlyeeClub:** 50 compradores. Abaixo disso, a fase de venda continua.
- **Medir:** eventos registrados e lidos por segmento antes de investir na camada do Pro.
- **Foco (proposta, ainda não confirmada):** um segmento lidera em compra, ativação e uso semanal por 4 semanas completas seguidas, com 30 ou mais contas em cada segmento comparado. Se nenhum se destacar, revisam-se as portas de entrada, não o produto.

**O que é registrado**

| Fonte | Eventos | Regra |
| --- | --- | --- |
| CLI, por `POST /api/cli/events` | `module.installed`, `module.activated`, `module.updated`, `tool.executed`, `recipe.installed` | Lista fechada de nomes e chaves; valores curtos; nunca conteúdo |
| Servidor da plataforma | `account.created` com `origem`, `kit.purchased`, `update.denied_entitlement`, `upsell.viewed` e `upsell.clicked` com o recurso clicado | Segmento, idioma e IA carimbados a partir do perfil |
| Site | `section_view`, `cta_click`, `quiz_click`, `segment_click`, `store_filter`, `app_card_click`, `see_all_apps_click`, `faq_open`, `contact_click` | Declarados com `data-track`, enviados ao GA4 e ao Meta com opt-out; nunca gravados no banco |
| Visitas | Uma por página e por porta de entrada, contada no servidor, sem cookie | `/instalar.md` não conta |
| Anúncios | `CompleteRegistration`, `InitiateCheckout`, `Purchase` e `Subscribe` pela CAPI, deduplicados com o navegador | `Purchase` conta toda fatura paga; `Subscribe`, só a primeira |

**O que vende o Pro.** `/admin/metricas` mostra, por recurso (receitas, encontros, guias avançados, roadmap, computadores), quantos avisos de upgrade abriram, quantos clicaram em assinar e quantas assinaturas vieram em até 14 dias.

**Ritual.** Um resumo toda segunda-feira, por sino e e-mail, para os operadores.

**Metas que ainda faltam.** Os documentos definem o portão de 50 compradores e a regra de foco, mas não têm alvo para a ativação em 7 dias, para a conversão ao Pro nem para a renovação do FlyeeClub. Sugestão deste PRD: tratar o uso semanal como a métrica principal, porque é o que antecede a renovação e a subida ao Pro, e fixar os alvos depois das primeiras quatro semanas de dados.

## Estado e roadmap

A plataforma está construída e testada até a fase 12.6; o que falta para abrir é operação (contas, dados da empresa, deploy) e a CLI 1.0.0 no npm. Depois da abertura, o plano é vender até o portão de 50 compradores antes de aprofundar o Pro.

&#91;embedded content: Roadmap · quatro fases e três portões\]

A ordem depois da abertura é uma proposta deste PRD, montada com as dependências que os dois planos registram; as fases de cada repositório não têm datas.

**Estado em 10 de outubro de 2026**

| Frente | Pronto | Falta |
| --- | --- | --- |
| Plataforma | Fases 0 a 8 e 12.1 a 12.6; último commit em 8 de outubro (`1f2aa7d`), árvore limpa | A abertura (12.7): serviços novos, dados da empresa, deploy, ensaios |
| Banco | Baseline e migrações até a 0040, testadas num Postgres embutido | Aplicar num projeto Supabase novo, pelo portão `db:gate:remote` |
| Testes | 432 asserções pgTAP, 401 testes unitários, 51 de ponta a ponta; site com 90 a 95 no celular em build local | Medir em produção |
| Produto | CLI `1.0.0-alpha.1`, núcleo 1.2.0, console do operador, instalação sem terminal; último commit em 6 de outubro (`b62a020`) | Commit do trabalho em aberto, CLI 1.0.0 no npm, pedidos da plataforma |
| Apps | 4 apps em 5 pacotes aceitos pela inspeção de upload | Guias, testes nas outras IAs, decisão das versões de entrada, envio pelo console |
| Negócio | Escada, preços-hipótese, termos de uso em vigor, funil de conteúdo desenhado | Razão social e CNPJ, contas Asaas e Stripe, preços conferidos |

**Depois da abertura**

| Fase | Plataforma | Produto | Portão |
| --- | --- | --- | --- |
| Vender | Token de serviço e importação do índice antes do segundo app | Guias nos pacotes, testes no Codex, no Gemini CLI e no Cursor, 1.1 do estúdio, app de edição de gravações | 50 compradores |
| Medir e aprofundar | Manifesto v2 (fase 9), página de compatibilidade (fase 10) | Receitas e guias avançados, pipelines (P4), painel local (P5), matriz de compatibilidade (P8) | Leitura por segmento |
| Proteger e focar | Porta MCP só de leitura (10.5), licença e marcas contra revenda (10.6), suporte com IA (fase 11) | Licença e MCP local (P6), canário noturno (P7) | Regra de foco cumprida |

## Riscos, premissas e decisões em aberto

Os dois riscos mais próximos são do produto, não da plataforma: a CLI fora do npm, com um `latest` de outro projeto no nome, e o trabalho dos apps fora do git. Os maiores riscos de negócio são um catálogo estreito e um Pro sem conteúdo no dia da abertura.

**Riscos**

| Risco | O que acontece | Resposta |
| --- | --- | --- |
| A CLI não está no npm e o `latest` é a 0.7.9 de outro projeto | A IA de quem seguir o site roda código que não é o flyee | Publicar a 1.0.0 antes do domínio, como manda o passo 4 do roteiro |
| Três dos quatro apps fora do git | Uma falha no disco apaga a loja; nenhum pacote tem tag | Commit e tag por versão antes de enviar os ZIPs |
| Quatro IAs prometidas, uma testada | Membro de Codex, Gemini CLI ou Cursor encontra um app que falha; reembolso e reputação | Testar nas três antes da abertura ou dizer, no site, que o lançamento é testado no Claude Code |
| O Pro abre sem receitas, guias avançados nem encontros | A métrica 4 não tem sinal e o Pro parece vazio | Selo "Em breve" honesto; produzir esse conteúdo logo depois da abertura |
| Versão de entrada completa nos apps de versão única | A conta sem compra recebe o estúdio de vídeo inteiro | Decidir antes de publicar (ver abaixo) |
| Catálogo só de vídeo, em duas etapas | A promessa "automatize sua empresa" fica maior que a loja; o perfil dev não tem app | Conteúdo e portas puxados pelo vídeo no começo; próximos apps fora de vídeo |
| O FlyeeClub entrega a camada mais forte por R$ 97, uma vez | Renovação e Pro precisam pagar a operação | Medir a conversão ao Pro em 60 dias e a renovação antes de mexer em preço ou canal |
| Cópia e revenda | Os arquivos ficam em texto na máquina do membro | A cópia envelhece; licença e marcas planejadas; cláusula nos termos; registro da marca |
| Arrependimento de 7 dias usado como teste | Baixar tudo e pedir reembolso | Risco aceito pela tese da cópia que envelhece |
| Manutenção cresce com apps vezes IAs | Cada mudança de IA pode quebrar vários apps ao mesmo tempo | Evals em todo app, canário noturno (P7), changelog curto |
| Suporte cresce com membros | A energia do operador vai para atendimento | Suporte assíncrono e coletivo, aviso de versão no harness, FAQ, agente depois |
| Credenciais do MedChina no `.env` herdado | Vazamento ou escrita no banco errado | `.env.local` em branco, portão do banco remoto, `preflight`, nunca rodar `db:*:remote` antes do projeto novo |
| Fiscal e jurídico em dois países | Nota, impostos e LGPD | Nota fiscal pelo Asaas, termos revisados, contador antes do primeiro pagamento |

**Premissas**

- O membro já paga uma IA de terminal e aceita que o clube não gaste crédito por ele.
- As IAs continuam mudando rápido; a tese depende disso.
- Quem não usa terminal fica de fora na v1, e isso é medido, não resolvido.
- Os preços são hipóteses ancoradas no Ratos OS (R$ 97 por um ano) e na comunidade Ratos (R$ 597 por ano).
- O YouTube traz tráfego que compra; o vídeo com o método completo vende mais do que esconde.
- O operador mantém o ritmo de atualização sem meta de renda no curto prazo; os seis primeiros meses buscam dado.

**Decisões em aberto**

| Decisão | Opções | Bloqueia |
| --- | --- | --- |
| Razão social, CNPJ, cidade e UF do operador | Dado a preencher em `/admin/support` | Marco A |
| Preços finais | Confirmar R$ 97, US$ 29, R$ 67 e R$ 597 ou trocar em `/admin/billing` | Marco B |
| Preço anual do Pro em dólar | US$ 190 (10 vezes o mensal, a hipótese) ou outro | Marco B |
| Versão de entrada do `video-studio` | Lançar uma 1.0 reduzida e a 1.1 no mesmo dia, ou tirar a marca de entrada e deixar o app fora da conta sem compra | Publicação no console |
| Promessa de quatro IAs no site | Testar Codex, Gemini CLI e Cursor antes, ou ajustar o texto até os testes | Abertura honesta |
| Regra de foco | Aceitar a proposta (4 semanas, 30 contas por segmento) ou outra | Leitura das métricas |
| O que `npx flyee` sem comando faz | Continuar como ajuda ou virar a instalação guiada | Texto de `/instalar.md` |
| Metas de ativação, renovação e conversão ao Pro | Fixar depois de quatro semanas de dados | Portões depois de 50 compradores |
| A palavra "Assinar" num pagamento único | Manter "Assinar FlyeeClub agora" ou trocar por um verbo de compra, já que o checkout e o recibo dizem que não renova sozinho | Nada; sugestão deste PRD |
| Licença do saas-starter | Checar MUI X, template e fontes antes de redistribuir | Entrada desse app |
| Painel local `flyee ui` | Depende de publicar os design tokens como pacote público | Fase P5 |

## Fontes

Este PRD foi montado em 10 de outubro de 2026 a partir dos dois repositórios, lidos sem edição. Onde os documentos divergem, valem as decisões mais recentes (as de 8 de outubro) e o código.

**Plataforma (`C:\AppsProjects\flyee-club`, commit `1f2aa7d` de 8 de outubro)**

- `CLAUDE.md`, `.claude/rules/marketing.md`: estrutura, regras de ouro e regras do site
- `docs/PRODUCT.md`: tese, mercado, escada, métricas, etapas e as decisões de 30 de setembro, 6 e 8 de outubro
- `docs/PLANO-IMPLEMENTACAO.md`: fases 0 a 12, andamento, pedidos ao produto, números dos testes
- `docs/DEPLOY.md`: roteiro da abertura, Marcos A e B
- `docs/BILLING.md`: cobrança, parcelamento, carência, reembolso
- `docs/CLI-CONTRACT.md`: autenticação, endpoints, limites, manifesto, `/instalar.md`
- `docs/TRACKING.md`: eventos do site, CAPI e consentimento
- `packages/db/migrations/0018_seed.sql`, `0024`, `0025`, `0037`, `0038`, `0040`: planos, preços, direitos e canais
- `packages/email/src/copy/pt-BR.ts` e `apps/web/src/components/marketing/home-copy/pt-BR.ts`: e-mails de fim de período e a copy da home

**Produto (`C:\AppsProjects\flyee`, commit `b62a020` de 6 de outubro, com trabalho fora do git)**

- `CLAUDE.md`, `.claude/rules/apps.md`, `fronteira.md`, `contrato.md`, `catalogo.md`: fronteira, regras de autoria e catálogo
- `docs/PLANO.md` e `docs/ARQUITETURA.md`: fases P0 a P8 e a arquitetura da CLI
- `packages/cli/src/main.ts` e `src/i18n.ts`: comandos e textos da CLI
- `packages/core/assets/core.json` e `tools.json`: versão do núcleo e registro de IAs
- `modules/*/flyee.module.json`, `README.md` e `tests/eval.json`: os quatro apps
- `git status`: três apps não rastreados e nove arquivos alterados

**Mercado:** tabela "Mercado: onde está o vão" do `PRODUCT.md`, com os links de cada concorrente; os preços são os do levantamento de 30 de setembro e podem ter mudado.
