# flyee.club · Home

**Documento de construção para o Claude montar a página.**
Versão 1, 1 de outubro de 2026. Fonte da copy: doc "flyeeClub, copy da Home", aba Português (revisão 285), com a aba em inglês sincronizada a partir dela.

## 1. O que é esta página

- O flyeeClub é uma loja de apps para a IA. Cada tarefa repetitiva vira um app (skill e workflow) que a pessoa instala no Claude Code ou no Codex com `npx flyee add <app>`. Os apps usam o plano de IA da própria pessoa.
- A Home vende **acesso**: 1 ano, pagamento único, R$ 97 à vista ou em 12x. Também apresenta o plano de assinatura **flyeeClub completo**.
- Não é curso. A página precisa ler como página de software (referência: home da Outseta), nunca como página de infoproduto.
- Objetivo principal: clique no checkout do Acesso.
- Objetivo secundário: saber de qual segmento o visitante é (negócio, agência, produto digital, dev). Esse dado decide o foco do produto depois, então a medição da seção 8 faz parte da entrega.

## 2. Regras que não se negociam

**Copy**

1. Use as frases dos apêndices como estão. Não reescreva, não resuma, não "melhore". Se uma frase não couber no layout, ajuste o layout.
2. Nenhum travessão (— ou –), ponto de exclamação ou emoji em texto visível. Onde a tabela de planos tem "não incluso", use um ícone com texto para leitor de tela.
3. Palavras proibidas. Em português: desbloqueie, potencialize, sem esforço, soluções inovadoras. Em inglês: unlock, elevate, empower, seamless, robust, supercharge, game-changing, "it's not just".
4. Nome da marca no texto: **flyeeClub**. Logo e domínio: **flyee.club**. Comando: `npx flyee`.

**Honestidade** (obrigatória por lei e pelo posicionamento)

5. Nenhum número inventado. Ficam fora da página:
   - estrelas, notas e contador de instalações;
   - "+X membros", contagem regressiva e "vagas";
   - preço riscado e "de/por".
6. Depoimentos ficam desligados (`flags.testimonials = false`) até existirem depoimentos reais e autorizados. Os textos do apêndice são modelos fictícios: publicar depoimento inventado é publicidade enganosa pelo CDC e pelo CONAR.
7. A linha de números da loja e a faixa "Próximos na loja" só aparecem com dado real vindo do config. Sem dado, o bloco some. Não mostre zero nem placeholder.
8. Nenhum texto com `[PENDENTE` ou `[FICTÍCIO` pode chegar ao build de produção (seção 11).

## 3. Stack e estrutura

- Se o repositório já tem stack, use o dele.
- Se o projeto for novo:
  - Next.js (App Router) com TypeScript e Tailwind CSS;
  - páginas estáticas (SSG), sem backend próprio.
- Rotas: `/` em português (pt-BR) e `/en` em inglês. É o mesmo componente lendo outro arquivo de conteúdo. Use um layout raiz por idioma (route groups no Next.js) para que `<html lang>` saia certo em cada um.
- Em inglês não há parcelamento: o preço em USD é pagamento único. Por isso o texto em inglês não fala em 12x. Isso é intencional.
- O conteúdo fica separado do código, em `content/home.pt.json` e `content/home.en.json`. São os apêndices A e B, copiados exatamente. Os componentes só leem esses arquivos.
- Convenções do conteúdo:
  - `{chave}` dentro de uma string é variável, preenchida pelo componente (preço, segmento, canal, ano, mês).
  - Trecho entre crases (por exemplo `npx flyee`) vira `<code>`.
  - Em `nav.links`, o campo `anchor` aponta para `anchors.<nome>` do mesmo arquivo.
  - `null` num campo de texto significa "não incluso" ou "não mostrar", conforme a seção.
- Variáveis e de onde vêm:

| Variável                                               | Origem                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `{price}` em `pricing.plans.access.price`           | `pricing.brl.access` (pt) ou `pricing.usd.access` (en)    |
| `{installment}`                                       | `pricing.brl.installment12x`                                |
| `{monthly}`, `{yearly}`                             | `pricing.<moeda>.fullMonthly`, `fullYearly`               |
| `{apps}`, `{updates}`, `{ais}` em `store.stats` | `store.stats.apps`, `updatesLast30d`, `testedAIs`       |
| `{service}` em `ui.usesAccount`                     | campo `account` do app                                      |
| `{date}` em `ui.updatedOn`                          | `store.updatedAt[slug]`, formatado no idioma                |
| `{month}` em `comingNext.status.mostVoted`          | `month` do item, formatado no idioma ("outubro", "October") |
| `{negocio}`, `{agencia}`, `{produto}`, `{dev}`  | `hero.segments`, como links                                 |
| `{contato}` em `faq.items[equipe].a`                | link com o texto `contactLink`                              |
| `{channel}` em `faq.contact`                        | `urls.contact.channel`                                      |
| `{year}` em `footer.copyright`                      | ano atual                                                     |

- Os valores de preço entram como número, sem símbolo de moeda, porque o texto já traz "R$" e "USD". Formate com `Intl.NumberFormat` em estilo decimal: sem casas decimais quando o valor for inteiro (97, 29) e com duas casas quando não for (uma parcela de 9,70, por exemplo).

Estrutura sugerida:

```text
config/site.ts
content/home.pt.json
content/home.en.json
app/page.tsx                 (pt)
app/en/page.tsx              (en)
components/home/
  Header.tsx  Hero.tsx  LogoStrip.tsx  ProductPreview.tsx
  AppStore.tsx  AppCard.tsx  InstallPopover.tsx  ComingNext.tsx
  InsideHub.tsx  Testimonials.tsx  HowItWorks.tsx  WhyStore.tsx
  WhoFor.tsx  Beyond.tsx  Origin.tsx  Pricing.tsx  Faq.tsx
  FinalCta.tsx  Footer.tsx
lib/content.ts               (carrega o JSON do idioma e interpola {chaves})
lib/analytics.ts             (track(), captura de UTM e segmento)
scripts/check-content.ts     (seção 11)
public/logo.svg             (logo do flyeeClub; sem arquivo, usar o texto "flyee.club")
public/logos/claude-code.svg  codex.svg  gemini-cli.svg  cursor.svg
             github-copilot.svg  heygen.svg  apify.svg
public/img/bruno.jpg
public/img/hub-loja.png
public/og.png
```

text## 4. Configuração (`config/site.ts`)

Tudo o que muda sem mexer em copy fica aqui. Valores `null` são pendências do Bruno (seção 14).

```ts
export const site = {
  domain: "flyee.club",
  brand: "flyeeClub",
  defaultLocale: "pt",
  locales: ["pt", "en"] as const,

  urls: {
    checkoutAccess: { pt: null, en: null } as Record<"pt" | "en", string | null>,
    checkoutFull:   { pt: null, en: null } as Record<"pt" | "en", string | null>,
    login: null as string | null,
    quiz: null as string | null,
    segments: { negocio: null, agencia: null, produto: null, dev: null } as Record<string, string | null>,
    compatibility: null as string | null,
    appPage: (slug: string): string | null => null,
    linkedin: null as string | null,
    terms: null as string | null,
    privacy: null as string | null,
    contact: { channel: null, href: null } as { channel: string | null; href: string | null },
  },

  pricing: {
    brl: { access: 97, installment12x: null, fullMonthly: null, fullYearly: null } as Record<string, number | null>,
    usd: { access: 29, fullMonthly: null, fullYearly: null } as Record<string, number | null>, // 29 ainda a confirmar
  },

  store: {
    featured: "roteiro-heygen",
    install: (slug: string) => `npx flyee add ${slug}`,      // confirmar o nome real de cada módulo
    updatedAt: {} as Record<string, string>,                  // ex.: { radar: "2026-10-01" }, vindo do changelog
    stats: { apps: null, updatesLast30d: null, testedAIs: null } as Record<string, number | null>,
    comingNext: [] as {
      name: { pt: string; en: string };
      status: "production" | "mostVoted" | "paid";
      month?: string;                                        // "2026-10", formatado por idioma
    }[],
  },

  flags: {
    testimonials: false,
    showProducts: false,   // ligar quando os quatro nomes estiverem autorizados
  },

  analytics: {
    provider: "posthog" as "posthog" | "supabase" | "none",
    key: null as string | null,
    host: null as string | null,
  },
};
```

ts**O que acontece enquanto um campo for `null`:**

| Campo                                          | Comportamento                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `urls.checkoutAccess`, `urls.checkoutFull` | Botões levam para a seção de preços. O build de produção falha.                                                       |
| `urls.login`                                 | "Entrar" some.                                                                                                              |
| `urls.quiz`                                  | "O flyeeClub é pra mim?" leva para a seção Para quem é. A linha "Faça o teste" some.                                   |
| `urls.segments.*`                            | Os links de segmento levam para a seção Para quem é com `?segment=<id>`.                                               |
| `urls.compatibility`                         | "Ver todas →" some.                                                                                                        |
| `urls.appPage`                               | O card não abre página; só o botão Instalar funciona.                                                                   |
| `urls.linkedin`, `terms`, `privacy`      | O link some.                                                                                                                |
| `urls.contact`                               | A linha de contato do FAQ e o link Contato do rodapé somem. Na pergunta de equipe, "fale com a gente" vira texto sem link. |
| `pricing.*`                                  | Em desenvolvimento aparece `[PENDENTE]` no lugar do valor. O build de produção falha.                                   |
| `store.updatedAt[slug]`                      | O selo "Atualizado em" some daquele card.                                                                                   |
| `store.stats.*`                              | A linha de números some inteira. Ela também some se algum valor for 0.                                                    |
| `store.comingNext` vazio                     | A faixa Próximos na loja some.                                                                                             |

## 5. Direção visual

A referência é a home da Outseta (print anexado): página clara, conteúdo centralizado, cara de produto de software. Se o repositório já tem tokens de design, use os dele. Os tokens abaixo são provisórios.

```css
:root {
  --bg: #FFFFFF;
  --bg-soft: #F6F5F2;
  --text: #111111;
  --text-muted: #5C5B57;
  --border: #E6E4DF;
  --accent: #5B3DF5;            /* provisório: trocar pela cor da marca */
  --accent-contrast: #FFFFFF;
  --radius-card: 16px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
  --shadow-product: 0 24px 64px rgba(17,17,17,.14);
  /* fundo do ícone de app, por categoria; o símbolo vai em branco (contraste de 3:1 ou mais) */
  --cat-sell: #E8590C;
  --cat-promote: #D6336C;
  --cat-video: #0C8599;
  --cat-research: #1C7ED6;
  --cat-build: #2F9E44;
}
```

css- **Breakpoints:** celular abaixo de 768px, tablet de 768 a 1023px, desktop a partir de 1024px. No tablet, as grades de 3 e 4 colunas viram 2.
- **Destaque temporário** (quando um link leva a um card): anel de 2px em `--accent` e fundo levemente tingido por 2 segundos, sem animação se `prefers-reduced-motion`.
- **Ícones de app e de card** (Lucide), sugestão:

| Item                | Ícone               |
| ------------------- | -------------------- |
| Copy LP             | `file-text`        |
| Copy Social         | `megaphone`        |
| Radar               | `radar`            |
| Pauta               | `list-checks`      |
| Roteiro HeyGen      | `clapperboard`     |
| Takes               | `film`             |
| Pesquisa            | `search`           |
| SaaS Starter        | `boxes`            |
| Pedir um app        | `plus` com cadeado |
| Loja de apps        | `layout-grid`      |
| Guias               | `book-open`        |
| Novidades da semana | `newspaper`        |
| Dúvidas no app     | `message-circle`   |
| Encontros ao vivo   | `video`            |
| Pedidos e votação | `vote`             |

- O cadeado (`lock`) sempre leva `ui.lockedLabel` como `aria-label`.
- **Tipografia:** uma sans só (Inter ou Geist), carregada pelo framework.

  - Título do hero: 60 a 64px no desktop e 38 a 40px no celular, peso 700, entrelinha 1.05, tracking levemente negativo.
  - Títulos de seção: 40px no desktop e 30px no celular.
  - Texto: 18px no desktop e 16px no celular, entrelinha 1.6.
- **Grid:** container de 1200px e 24px de margem lateral no celular. Seções com 96px de respiro vertical no desktop e 64px no celular. O fundo alterna entre `--bg` e `--bg-soft` para separar seções sem linhas.
- **Botões:** primário cheio em `--accent`, secundário com borda. Altura de 48px, raio pill.
- **Links de segmento:** sublinhado em `--accent`, 2px de espessura, 4px de offset.
- **Ícones:** um conjunto só (Lucide ou o do repositório). O cadeado é `lock`.
- **Movimento:** só transições de 150 a 200ms em hover e abertura, respeitando `prefers-reduced-motion`.
- Só tema claro nesta versão.

## 6. Mapa da página

| #  | Seção                          | Componente       | Âncora pt        | Âncora en         | Chave no conteúdo |
| -- | -------------------------------- | ---------------- | ----------------- | ------------------ | ------------------ |
| 1  | Topo                             | `Header`       |                   |                    | `nav`            |
| 2  | Hero, logos e prévia do produto | `Hero`         |                   |                    | `hero`           |
| 3  | Loja de apps                     | `AppStore`     | `apps`          | `apps`           | `store`          |
| 4  | Dentro do hub                    | `InsideHub`    | `dentro-do-hub` | `inside-the-hub` | `hub`            |
| 5  | Depoimentos (desligado)          | `Testimonials` |                   |                    | `testimonials`   |
| 6  | Como funciona                    | `HowItWorks`   | `como-funciona` | `how-it-works`   | `howItWorks`     |
| 7  | Por que uma loja de apps         | `WhyStore`     |                   |                    | `whyStore`       |
| 8  | Para quem é                     | `WhoFor`       | `para-quem-e`   | `who-its-for`    | `whoFor`         |
| 9  | Quando o app não basta          | `Beyond`       |                   |                    | `beyond`         |
| 10 | De onde vêm os apps             | `Origin`       |                   |                    | `origin`         |
| 11 | Acesso (preços)                 | `Pricing`      | `precos`        | `pricing`        | `pricing`        |
| 12 | Perguntas                        | `Faq`          | `perguntas`     | `faq`            | `faq`            |
| 13 | CTA final                        | `FinalCta`     |                   |                    | `finalCta`       |
| 14 | Rodapé                          | `Footer`       |                   |                    | `footer`         |

## 7. Seções

### 7.1 Topo

- Fixo no topo. Fundo branco; ganha borda inferior quando a página rola.
- Esquerda: `nav.logo`.
- Centro: `nav.links`, como âncoras.
- Direita:
  - seletor de idioma (`ui.langSwitch`, com `ui.langSwitchLabel` como `aria-label`), que leva à mesma âncora no outro idioma, ou ao topo da outra versão quando não houver âncora na URL;
  - `nav.login`, para `urls.login`;
  - botão `nav.cta`, que leva à seção de preços (evento `cta_click`, `cta_id: "nav"`).
- No celular, ficam o logo e o botão `ui.menu`. O menu abre em tela cheia com os links, o login e o botão, e fecha com `ui.close`, com Esc ou ao tocar num link.
- O primeiro elemento focável é o link `ui.skipToContent`.
- O texto do botão do topo ("Quero montar meu sistema") é diferente dos outros CTAs de propósito. Não unifique.

### 7.2 Hero

Coluna centralizada de até 880px. Ordem dos elementos:

1. **Selo.** Pill clara com borda: `badge.tag` em destaque, depois " · ", `badge.text` e "→".
   - Leva para `urls.appPage(badge.appSlug)`.
   - Sem essa URL, rola até o card desse app na loja e destaca o card por 2 segundos.
2. **Título em duas linhas.** `title.line1`, quebra de linha, depois `title.line2Before` + `title.highlight` (em `--accent`) + `title.line2After`.
   - É o único `<h1>` da página.
   - A quebra é controlada no código; não dependa da quebra automática.
3. **Subtítulo.** Use `subtitle`, trocando os tokens `{negocio}`, `{agencia}`, `{produto}` e `{dev}` pelos textos de `segments`.
   - Cada segmento é um link sublinhado para `urls.segments.<id>`.
   - Evento `segment_click`, com `location: "hero"`.
4. **Botões.** Ficam lado a lado no desktop e empilhados no celular.
   - Primário `ctaPrimary`: checkout do Acesso (`cta_id: "hero"`).
   - Secundário `ctaSecondary`: `urls.quiz`, ou a seção Para quem é enquanto o quiz não existir (evento `quiz_click`, `location: "hero"`).
5. **Nota.** `note` em texto pequeno, na cor `--text-muted`.
6. **Faixa de logos.**
   - `logos.label` pequeno acima, com `logos.seeAll` ao lado, apontando para `urls.compatibility`.
   - Os 7 logos de `logos.items` ficam monocromáticos (cinza), com 24 a 28px de altura. No desktop ficam em linha; no celular, em rolagem horizontal sem animação automática.
   - Os arquivos ficam em `public/logos/` e são os oficiais, respeitando o guia de marca de cada empresa. O `alt` de cada um é o nome da ferramenta.
7. **Prévia do produto.**
   - Imagem da loja dentro do hub (`public/img/hub-loja.png`), na largura do container, com cantos arredondados e `--shadow-product`.
   - Na primeira tela, a prévia aparece cortada pela dobra, como na Outseta.
   - Enquanto não houver print real, renderize `ProductPreview`: um mock em HTML e CSS de uma janela do hub. A barra lateral usa os nomes de `hub.cards`, e a grade mostra os 6 primeiros apps de `store.apps`, sem botões clicáveis.
   - Nunca use print com dado real de cliente.
8. **Botão flutuante.** `productImage.floatingCta` em pill escura, centralizado sobre a parte de baixo da prévia. Rola até a loja (evento `see_all_apps_click`).

### 7.3 Loja de apps (`#apps`)

- **Abertura:** título `store.title` e texto `store.lead`.
- **Barra de categorias:** chips de `store.categories`, com "Todos" ativo.
  - O filtro funciona no cliente, sem recarregar, e atualiza `?cat=` na URL sem rolar a página. Se a página abrir com `?cat=`, o filtro já vem aplicado.
  - Evento `store_filter`.
- **Linha de números:** `store.stats` interpolado com `site.store.stats`. Fica ao lado da barra no desktop e abaixo dela no celular. Só aparece se os três valores forem números maiores que zero.
- **Banner de destaque:** o app de `site.store.featured`.
  - Largo, com ícone grande, nome, selo `ui.new` (se `isNew`), linha do card, selo de conta externa e botão Instalar.
  - Fica acima da grade e não muda com o filtro.
  - O app em destaque também aparece na grade, no lugar normal dele. Os links "rola até o card do app" (selo do hero, chips de Para quem é) sempre miram o card da grade.
- **Grade:** 4 colunas no desktop e 2 no celular. Cada card tem:
  - ícone quadrado de cantos arredondados (48px) na cor da categoria;
  - nome e rótulo da categoria;
  - `line`;
  - selos:
    - `ui.usesAccount`, com `{service}` igual a `account`, quando houver;
    - `ui.new`, se `isNew`;
    - `ui.updatedOn`, com a data de `site.store.updatedAt[slug]` formatada no idioma;
  - botão `ui.install`, que abre um popover com o comando de `site.store.install(slug)` em fonte mono e o botão `ui.copy`.
    - Depois de copiar, o botão mostra `ui.copied` por 2 segundos.
    - Eventos `app_install_click` e `app_command_copy`.
  - Clicar no resto do card abre `urls.appPage(slug)`, quando existir (evento `app_card_click`).
- **Card Pedir um app:** `store.requestCard` é o último card da grade, em todas as categorias.
  - Tem cadeado, selo `requestCard.badge` e estilo um pouco mais apagado.
  - O clique rola até Preços e destaca o cartão do flyeeClub completo por 2 segundos (evento `locked_click`, `item: "request_app"`).
- **Abaixo da grade:** o texto `store.belowGrid`.
- **Próximos na loja:** só renderiza se `site.store.comingNext` tiver itens.
  - Mostra `comingNext.title` e `comingNext.lead`.
  - Abaixo, cards em linha com o nome do app e o selo de status (`comingNext.status.*`). O `{month}` sai de `month`, formatado por idioma.
- Nenhum card mostra estrelas, nota ou número de instalações.

### 7.4 Dentro do hub (`#dentro-do-hub`)

- Título `hub.title` e texto `hub.lead`.
- Grade de 6 cards: 3 colunas no desktop e 1 no celular. Cada card tem ícone, `name`, `line` e o selo do plano:
  - `planBadges.access`, em estilo neutro;
  - `planBadges.full`, com cadeado.
- Os cards com `plan: "full"` têm o mesmo comportamento do card Pedir um app (`locked_click`, com `item` igual ao `id` do card).
- `hub.below` vai em texto pequeno abaixo da grade.

### 7.5 Depoimentos (desligado)

- Só renderiza com `flags.testimonials = true`. O build de produção falha se a flag estiver ligada e `testimonials.placeholder` ainda for `true` ou algum texto da seção tiver `[FICTÍCIO`.
- Layout, como na Outseta:
  - título grande entre aspas, centralizado;
  - 3 cards com texto, foto redonda, nome e descrição;
  - link `seeAll` para `/depoimentos`, página que está fora do escopo.
- Quando os depoimentos reais chegarem: troque `items`, mude `testimonials.placeholder` para `false` e ligue a flag.

### 7.6 Como funciona (`#como-funciona`)

- Título e 3 passos numerados: em linha no desktop, empilhados no celular.
- Os comandos aparecem em `<code>`. Só os comandos completos (`npx flyee` e `npx flyee update`) ganham um botão discreto de copiar; `npx flyee add` precisa do nome do app, então fica sem botão.

### 7.7 Por que uma loja de apps

- Título e 3 blocos lado a lado, cada um com o título em negrito e o texto.

### 7.8 Para quem é (`#para-quem-e`)

- **Abertura:** título `whoFor.title`.
- **4 cards:** 2x2 no desktop e 1 coluna no celular. Cada card tem:
  - `name` e `text`;
  - o rótulo `appsLabel` e chips com os nomes dos apps, buscados pelo `slug` em `store.apps` do mesmo idioma.
    - O chip rola até a loja já filtrada pela categoria do app e destaca o card.
- **Clique no card:** sempre dispara `segment_click` (`location: "who_for"`) e grava o segmento em `sessionStorage`. Se `urls.segments.<segment>` existir, navega para lá; se não, só destaca o card.
- O mesmo vale para os links de segmento do hero: o evento e a gravação acontecem sempre, com ou sem página de segmento.
- Se a URL chegar com `?segment=<id>`, o card correspondente fica destacado.
- **Bloco `notForYou`:** título e 3 linhas, cada uma com um ícone neutro. Pode ser um x gráfico; não use o caractere de travessão.
- **Linha final:** `quiz.before` e o link `quiz.link`, que aponta para `urls.quiz` (evento `quiz_click`, `location: "who_for"`). A linha só aparece quando `urls.quiz` existir.

### 7.9 Quando o app não basta

- Título, 3 blocos lado a lado e o texto `below`.
- Sem preço e sem botão.

### 7.10 De onde vêm os apps

- Duas colunas: foto redonda (`public/img/bruno.jpg`, de 96 a 120px; sem foto, mostre as iniciais) ao lado do título e do texto.
- Abaixo, `productsLabel` e os 4 produtos em linha. Cada produto tem o nome em negrito e a descrição, separados entre si por " · ".
- Essa linha só aparece com `flags.showProducts = true`. O padrão é `false` até o Bruno confirmar a autorização dos quatro nomes.
- O link `linkedin` aponta para `urls.linkedin`.

### 7.11 Acesso (`#precos`)

- Título e dois cartões lado a lado, com a mesma altura. O cartão do flyeeClub completo tem borda em `--accent`.
- Cada cartão traz, de cima para baixo:
  - o nome;
  - o preço em destaque, com `rowLabels.price` como legenda pequena acima dele. O texto vem de `price`, interpolado conforme a seção 3;
  - a lista das outras linhas (`apps`, `updates`, `guides`, `voice`, `seats`), com o rótulo de `rowLabels` em texto pequeno e o valor ao lado;
  - o botão `cta`.
- Quando `voice` é `null`, a linha mostra um ícone de "não incluso", com `ui.notIncluded` para leitor de tela.
- Destinos dos botões:
  - Acesso: `urls.checkoutAccess[locale]` (`cta_id: "plan_access"`);
  - completo: `urls.checkoutFull[locale]` (`cta_id: "plan_full"`).
- O parcelamento fica em texto normal, do mesmo tamanho. Nada de preço riscado ou "de/por".
- Abaixo dos cartões: `below` e o bloco `requirements`, com título e texto.

### 7.12 Perguntas (`#perguntas`)

- Acordeão acessível (`<details>` e `<summary>` ou equivalente), com todas as perguntas fechadas. Evento `faq_open` com `question_id`.
- Na pergunta `equipe`, o token `{contato}` vira um link com o texto `contactLink`, apontando para `urls.contact.href`.
- **Linha final:** `faq.contact`, com `{channel}` igual a `urls.contact.channel` e link para `urls.contact.href` (evento `contact_click`).
- Gere o JSON-LD `FAQPage` com as perguntas do idioma. Nele, `{contato}` vira o texto de `contactLink`, sem link.

### 7.13 CTA final

- Faixa larga e centralizada, com fundo `--bg-soft` ou escuro.
- Título, texto, botão e nota pequena. O botão leva ao checkout do Acesso (`cta_id: "final"`).

### 7.14 Rodapé

- Logo; links `terms`, `privacy` e `contact`; seletor de idioma; `copyright`, com `{year}` igual ao ano atual.

## 8. Medição

- `lib/analytics.ts` expõe `track(event, props)`.
  - Use a ferramenta que o repositório já tiver.
  - Se não houver nenhuma, use PostHog com `persistence: "memory"` (sem cookie e sem banner de consentimento).
  - Gravar numa tabela `events` do Supabase só faz sentido se o projeto já tiver backend; nesse caso, use uma rota de API. A página continua estática.
- Todo evento leva `locale`, `utm_source`, `utm_medium`, `utm_campaign` e, quando houver, `segment`.
- Na chegada, leia as UTMs da URL e guarde em `sessionStorage`. Um clique de segmento, ou `?segment=` na URL, grava `segment` no mesmo lugar.
- Todo link de checkout recebe esses valores na query string (`utm_*`, `segment` e `locale`). Assim, o cadastro grava origem e segmento no evento "conta criada" do plano de métricas.

| Evento                 | Quando                                                 | Propriedades                                                                                                                 |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `page_view`          | a página carregou                                     | `referrer`                                                                                                                 |
| `section_view`       | 50% de uma seção ficou visível (uma vez por carga)  | `section`: a chave da seção no mapa (`hero`, `store`, `hub`...); toda seção leva `data-section` com essa chave |
| `cta_click`          | clique em botão de compra ou no botão do topo        | `cta_id`: `nav`, `hero`, `plan_access`, `plan_full`, `final`                                                     |
| `segment_click`      | clique em segmento do hero ou em card de Para quem é  | `segment`, `location`: `hero` ou `who_for`                                                                           |
| `quiz_click`         | clique em "O flyeeClub é pra mim?" ou "Faça o teste" | `location`                                                                                                                 |
| `store_filter`       | troca de categoria                                     | `category`                                                                                                                 |
| `app_install_click`  | clique em Instalar                                     | `app`                                                                                                                      |
| `app_command_copy`   | cópia do comando                                      | `app`                                                                                                                      |
| `app_card_click`     | abertura da página do app                             | `app`                                                                                                                      |
| `locked_click`       | clique em card com cadeado                             | `item`                                                                                                                     |
| `see_all_apps_click` | clique no botão flutuante da prévia                  |                                                                                                                              |
| `compat_click`       | clique em "Ver todas →"                               |                                                                                                                              |
| `faq_open`           | abertura de uma pergunta                               | `question_id`                                                                                                              |
| `contact_click`      | clique em link de contato                              | `location`: `faq_team`, `faq_footer` ou `footer`                                                                     |
| `lang_switch`        | troca de idioma                                        | `from`, `to`                                                                                                             |

## 9. SEO e idiomas

- `<title>` e `meta description` vêm de `meta`; `<html lang>` vem de `meta.lang`.
- `hreflang` liga pt-BR e en, com `x-default` apontando para `/`, e cada idioma tem canonical próprio.
- Open Graph e Twitter card usam `public/og.png`, em 1200x630.
- JSON-LD: `Organization` (nome flyeeClub, url e logo) e `FAQPage`. Não inclua `Offer` nem preço enquanto os valores não estiverem confirmados.
- O seletor de idioma mantém a âncora atual.
- Não redirecione automaticamente pelo idioma do navegador.

## 10. Acessibilidade e performance

- **WCAG 2.2 AA:** contraste e foco visível em toda a página.
  - Menu, filtros, popover e acordeão funcionam por teclado.
  - Esc fecha o popover e o foco volta ao botão que o abriu.
- **Hierarquia de títulos:** um `h1` (título do hero), `h2` nas seções e `h3` nos cards.
- **Imagens:** `alt` vindo do conteúdo; nos logos, o nome da ferramenta.
- **Lighthouse no celular:**
  - Performance de 90 ou mais;
  - Acessibilidade e Boas práticas de 95 ou mais;
  - SEO 100.
- **LCP** abaixo de 2,5s em 4G. O elemento de LCP provavelmente será a prévia do produto:
  - carregue a imagem com prioridade, em AVIF ou WebP, com largura e altura fixas para não deslocar o layout;
  - se for o mock em HTML, ele já é leve; mantenha sem imagens externas;
  - as fontes usam `display: swap`.
- **JavaScript no cliente** só para menu, filtro, popover, acordeão, destaques e analytics.

## 11. Checagem de conteúdo (`scripts/check-content.ts`)

Roda antes do build e no CI. Em modo estrito (`NODE_ENV=production` ou `CONTENT_STRICT=1`), falha (exit 1) se:

1. algum texto dos dois JSON tiver `[PENDENTE`, `[FICTÍCIO`, `[CONFIRM`, `[N]`, `—`, `–`, `!` ou emoji. A seção `testimonials` só entra na conta quando `flags.testimonials` está ligado;
2. aparecer alguma palavra proibida da regra 3;
3. `flags.testimonials` estiver ligado e `testimonials.placeholder` for `true`;
4. faltar preço ou URL de checkout;
5. as chaves de `home.pt.json` e `home.en.json` não baterem (os dois arquivos precisam ter a mesma estrutura).

Para emoji, use `/\p{Extended_Pictographic}/u`, liberando `©` e `→`, que são usados de propósito.

Fora do modo estrito, a checagem só avisa e lista as pendências. Enquanto a seção 14 tiver itens abertos, o modo estrito falha de propósito.

## 12. Critérios de aceite

- [ ] As seções aparecem na ordem do mapa, em `/` e em `/en`, com os depoimentos ocultos.
- [ ] Todo texto visível vem dos JSON. Com um config de teste preenchido (todas as URLs, preços, números, um item em Próximos na loja e `showProducts` ligado), cada frase do apêndice A aparece na página em português, menos a seção de depoimentos.
- [ ] `check-content` passa quando as pendências estão preenchidas e falha quando alguém coloca `[PENDENTE` num texto.
- [ ] O layout foi conferido em 360, 768, 1280 e 1440px, sem rolagem horizontal.
- [ ] Menu, âncoras (compensando a altura do topo fixo), filtro, popover de instalar, cópia do comando e acordeão funcionam com mouse, toque e teclado.
- [ ] Os segmentos do hero e os cards de Para quem é disparam `segment_click`, e o segmento chega na URL do checkout.
- [ ] Os cards com cadeado levam para Preços e destacam o flyeeClub completo.
- [ ] A linha de números e a faixa Próximos na loja somem quando não há dado.
- [ ] O Lighthouse no celular fica dentro das metas da seção 10.
- [ ] O texto visível do HTML final (os nós de texto, não o código) não tem `—`, `!` nem emoji.

## 13. Fora do escopo

Ficam fora desta entrega:

- hub e login;
- página de cada app;
- questionário e páginas de segmento;
- página de compatibilidade e página de depoimentos;
- checkout;
- conteúdo de termos e de privacidade.

A Home só aponta para essas páginas pelo config.

## 14. Pendências de conteúdo (Bruno)

| O que falta                                                    | Onde entra                                     | Enquanto não chega               |
| -------------------------------------------------------------- | ---------------------------------------------- | --------------------------------- |
| Valor da parcela em 12x                                        | `pricing.brl.installment12x`                 | build de produção falha         |
| Preço do flyeeClub completo, por mês e por ano, em BRL e USD | `pricing.*.fullMonthly`, `fullYearly`      | build de produção falha         |
| Confirmação do preço do Acesso em USD (hoje 29)             | `pricing.usd.access`                         | aparece 29                        |
| Links de checkout dos dois planos, nos dois idiomas            | `urls.checkoutAccess`, `urls.checkoutFull` | build de produção falha         |
| Fim da frase do app Pesquisa ("e entrega...")                  | `store.apps` no JSON pt e en                 | build de produção falha         |
| Quantos acessos o completo libera                              | `pricing.plans.full.seats` no JSON           | fica "Mais de um"                 |
| Nome real de cada módulo no `npx flyee add`                 | `store.install` e `slug`                   | usa o slug do JSON                |
| Login do hub, LinkedIn, termos e privacidade                   | `urls.*`                                     | o link some                       |
| Canal de contato antes da compra                               | `urls.contact`                               | a linha some                      |
| Data de atualização de cada app                              | `store.updatedAt`                            | o selo some                       |
| Números da loja                                               | `store.stats`                                | a linha some                      |
| Apps reais para Próximos na loja                              | `store.comingNext`                           | a faixa some                      |
| Logos oficiais em SVG                                          | `public/logos/`                              | nome em texto, em cinza           |
| Print da loja dentro do hub                                    | `public/img/hub-loja.png`                    | mock em HTML (`ProductPreview`) |
| Sua foto                                                       | `public/img/bruno.jpg`                       | iniciais                          |
| Autorização para MedChina, Seenaly, Splash e Perspec         | `flags.showProducts`                         | a linha fica escondida            |
| Logo do flyeeClub                                              | `public/logo.svg`                            | o texto "flyee.club" no lugar     |
| Depoimentos reais e autorizados                                | `testimonials` no JSON                       | a seção fica desligada          |
| Imagem de compartilhamento                                     | `public/og.png`                              | sem imagem no compartilhamento    |
| Quiz e páginas de segmento                                    | `urls.quiz`, `urls.segments`               | os links levam para Para quem é  |

---

## Apêndice A · `content/home.pt.json`

```json
{
  "meta": {
    "lang": "pt-BR",
    "title": "flyee.club: apps que automatizam sua empresa na sua IA",
    "description": "Apps que automatizam vendas, conteúdo, vídeo e produto dentro do Claude Code, do Codex ou da sua IA favorita. Um ano de acesso, à vista ou em 12x."
  },
  "anchors": {
    "apps": "apps",
    "hub": "dentro-do-hub",
    "howItWorks": "como-funciona",
    "whoFor": "para-quem-e",
    "pricing": "precos",
    "faq": "perguntas"
  },
  "ui": {
    "skipToContent": "Pular para o conteúdo",
    "menu": "Menu",
    "close": "Fechar",
    "langSwitch": "EN",
    "langSwitchLabel": "Read in English",
    "install": "Instalar",
    "copy": "Copiar",
    "copied": "Copiado",
    "lockedLabel": "Faz parte do flyeeClub completo",
    "notIncluded": "Não incluso",
    "usesAccount": "Usa sua conta {service}",
    "new": "Novo",
    "updatedOn": "Atualizado em {date}"
  },
  "nav": {
    "logo": "flyee.club",
    "links": [
      {
        "label": "Apps",
        "anchor": "apps"
      },
      {
        "label": "Como funciona",
        "anchor": "howItWorks"
      },
      {
        "label": "Preços",
        "anchor": "pricing"
      },
      {
        "label": "Para quem é",
        "anchor": "whoFor"
      }
    ],
    "login": "Entrar",
    "cta": "Quero montar meu sistema"
  },
  "hero": {
    "badge": {
      "tag": "NOVO",
      "text": "App Roteiro HeyGen: roteiro por cena para vídeo com avatar",
      "appSlug": "roteiro-heygen"
    },
    "title": {
      "line1": "Apps que automatizam o trabalho da sua empresa",
      "line2Before": "na ",
      "highlight": "sua IA favorita",
      "line2After": "."
    },
    "subtitle": "Vendas, conteúdo, vídeo, pesquisa e produto: cada tarefa repetitiva vira um app que roda no Claude Code, no Codex ou na IA que você já usa. Para o {negocio}, a {agencia}, o {produto} ou o {dev}.",
    "segments": {
      "negocio": "seu negócio",
      "agencia": "sua agência",
      "produto": "seu produto digital",
      "dev": "seu trabalho de dev"
    },
    "ctaPrimary": "Quero garantir meu acesso",
    "ctaSecondary": "O flyeeClub é pra mim?",
    "note": "Acesso de 1 ano, à vista ou em 12x.",
    "logos": {
      "label": "Funciona com a IA e as ferramentas que você já usa",
      "seeAll": "Ver todas →",
      "items": [
        "Claude Code",
        "Codex",
        "Gemini CLI",
        "Cursor",
        "GitHub Copilot",
        "HeyGen",
        "Apify"
      ]
    },
    "productImage": {
      "alt": "A loja de apps do flyeeClub aberta",
      "floatingCta": "Ver todos os apps →"
    }
  },
  "store": {
    "title": "Precisou? Tem app no flyeeClub.",
    "lead": "Cada app automatiza uma tarefa. Abra, veja o que ele faz e instale no seu Claude com um comando.",
    "categories": [
      {
        "id": "all",
        "label": "Todos"
      },
      {
        "id": "sell",
        "label": "Vender"
      },
      {
        "id": "promote",
        "label": "Divulgar"
      },
      {
        "id": "video",
        "label": "Vídeo"
      },
      {
        "id": "research",
        "label": "Pesquisa"
      },
      {
        "id": "build",
        "label": "Construir"
      }
    ],
    "stats": "{apps} apps na loja · {updates} atualizações nos últimos 30 dias · testado em {ais} IAs",
    "apps": [
      {
        "slug": "copy-lp",
        "name": "Copy LP",
        "category": "sell",
        "line": "Página de vendas ou site, do briefing ao texto final.",
        "account": null
      },
      {
        "slug": "copy-social",
        "name": "Copy Social",
        "category": "promote",
        "line": "Posts da semana para LinkedIn, Instagram, YouTube e X.",
        "account": null
      },
      {
        "slug": "radar",
        "name": "Radar",
        "category": "research",
        "line": "Mostra o que está funcionando no seu nicho, medido contra a média de cada perfil.",
        "account": "Apify"
      },
      {
        "slug": "pauta",
        "name": "Pauta",
        "category": "promote",
        "line": "Transforma o que o Radar achou em pauta, títulos e roteiro.",
        "account": null
      },
      {
        "slug": "roteiro-heygen",
        "name": "Roteiro HeyGen",
        "category": "video",
        "line": "Roteiro por cena com fala, gesto e prompt para vídeo com avatar.",
        "account": "HeyGen",
        "isNew": true
      },
      {
        "slug": "takes",
        "name": "Takes",
        "category": "video",
        "line": "Takes de vídeo com mockups das telas do seu app.",
        "account": null
      },
      {
        "slug": "pesquisa",
        "name": "Pesquisa",
        "category": "research",
        "line": "Um agente pesquisa o tema a fundo e entrega [PENDENTE: completar o que o app entrega]",
        "account": null
      },
      {
        "slug": "saas-starter",
        "name": "SaaS Starter",
        "category": "build",
        "line": "A base para começar um produto com padrão desde o primeiro dia.",
        "account": null
      }
    ],
    "requestCard": {
      "name": "Pedir um app",
      "line": "Não achou? No flyeeClub completo, você pede um app sob medida.",
      "badge": "flyeeClub completo"
    },
    "belowGrid": "Nada de módulo para assistir. Você instala o app e usa; cada um tem um guia curto.",
    "comingNext": {
      "title": "Próximos na loja.",
      "lead": "Entram no seu acesso sem custo extra.",
      "status": {
        "production": "Em produção",
        "mostVoted": "Mais votado de {month}",
        "paid": "Em desenvolvimento, sai para todos"
      }
    }
  },
  "hub": {
    "title": "O que vem junto com os apps.",
    "lead": "Um login só. Os apps e os guias ficam liberados desde o primeiro dia.",
    "cards": [
      {
        "id": "store",
        "name": "Loja de apps",
        "plan": "access",
        "line": "Todos os apps, e os próximos que entrarem enquanto durar o seu acesso."
      },
      {
        "id": "guides",
        "name": "Guias",
        "plan": "access",
        "line": "Um guia curto por app, com o passo a passo e exemplos de uso."
      },
      {
        "id": "weekly",
        "name": "Novidades da semana",
        "plan": "access",
        "line": "Um resumo do que mudou em cada app, com link para o changelog. No hub e no seu e-mail."
      },
      {
        "id": "questions",
        "name": "Dúvidas no app",
        "plan": "access",
        "line": "Pergunte na página do próprio app. Quem responde é quem fez o app."
      },
      {
        "id": "live",
        "name": "Encontros ao vivo",
        "plan": "full",
        "line": "Sessões com o Bruno sobre os apps novos e o que mudou na IA."
      },
      {
        "id": "requests",
        "name": "Pedidos e votação",
        "plan": "full",
        "line": "Proponha um app, vote nos pedidos e acompanhe o que está em produção."
      }
    ],
    "planBadges": {
      "access": "Acesso",
      "full": "flyeeClub completo"
    },
    "below": "O que tem cadeado faz parte do flyeeClub completo."
  },
  "testimonials": {
    "title": "“Tudo o que eu precisava, num lugar só.”",
    "placeholder": true,
    "items": [
      {
        "quote": "Eu pagava uma ferramenta para cada coisa: post, roteiro, página. Hoje faço isso dentro do Claude, e quando alguma coisa muda, o app chega atualizado.",
        "name": "[FICTÍCIO: Nome]",
        "role": "dona de [tipo de negócio]",
        "photo": null
      },
      {
        "quote": "Uso os apps nos projetos dos meus clientes. O Copy LP me dá a estrutura e a revisão; eu entro com o que só eu sei do cliente.",
        "name": "[FICTÍCIO: Nome]",
        "role": "freelancer de marketing",
        "photo": null
      },
      {
        "quote": "Instalei com um comando e o SaaS Starter virou o ponto de partida dos meus projetos novos. O agente segue as regras sem eu repetir toda vez.",
        "name": "[FICTÍCIO: Nome]",
        "role": "dev",
        "photo": null
      }
    ],
    "seeAll": "Ver todos os depoimentos"
  },
  "howItWorks": {
    "title": "Três passos e você está dentro.",
    "steps": [
      {
        "title": "Garanta seu acesso.",
        "text": "Você entra na loja de apps e recebe um token pessoal."
      },
      {
        "title": "Instale no seu Claude.",
        "text": "No terminal, rode `npx flyee` e cole o token. Nunca abriu um terminal? O guia de primeiros passos mostra cada clique."
      },
      {
        "title": "Instale os apps que precisar.",
        "text": "Escolha na loja e rode `npx flyee add` com o nome do app. Para receber as versões novas, `npx flyee update`."
      }
    ]
  },
  "whyStore": {
    "title": "Por que uma loja de apps, e não mais uma assinatura?",
    "blocks": [
      {
        "title": "Um lugar só.",
        "text": "Em vez de um serviço para cada tarefa, os apps ficam juntos, no mesmo agente e no mesmo projeto."
      },
      {
        "title": "Roda no que você já tem.",
        "text": "Os apps usam o seu plano de IA e guardam o que produzem em arquivos no seu computador. O flyeeClub não cobra por uso. Se um dia trocar de IA, o que eles produziram continua com você."
      },
      {
        "title": "Sempre atualizado.",
        "text": "A IA muda toda semana. Quando muda, a gente atualiza o app e você roda um comando."
      }
    ]
  },
  "whoFor": {
    "title": "Se você repete as mesmas tarefas toda semana, tem app para você.",
    "appsLabel": "Apps para começar",
    "cards": [
      {
        "segment": "negocio",
        "name": "Seu negócio",
        "text": "Você toca a empresa com pouca gente e quer parar de assinar uma ferramenta para cada tarefa.",
        "apps": [
          "copy-social",
          "pauta",
          "copy-lp"
        ]
      },
      {
        "segment": "agencia",
        "name": "Sua agência",
        "text": "Você atende clientes, sozinho ou com time, e precisa entregar mais sem perder o tom de cada um.",
        "apps": [
          "copy-lp",
          "radar",
          "copy-social"
        ]
      },
      {
        "segment": "produto",
        "name": "Seu produto digital",
        "text": "Você vende online e precisa de página, conteúdo e vídeo saindo toda semana.",
        "apps": [
          "copy-lp",
          "roteiro-heygen",
          "takes"
        ]
      },
      {
        "segment": "dev",
        "name": "Seu trabalho de dev",
        "text": "Você constrói produto e quer começar cada projeto com padrão, sem repetir as regras para o agente.",
        "apps": [
          "saas-starter",
          "pesquisa"
        ]
      }
    ],
    "notForYou": {
      "title": "Não é para você se",
      "items": [
        "Você quer assistir aulas. Aqui você instala e usa.",
        "Você não quer instalar nada no computador. Hoje os apps rodam no Claude Code e no Codex.",
        "Você não tem um plano de IA e não pretende ter. O flyeeClub usa o seu."
      ]
    },
    "quiz": {
      "before": "Ainda em dúvida?",
      "link": "Faça o teste de três perguntas."
    }
  },
  "beyond": {
    "title": "Quando precisar de mais do que um app, também tem no flyeeClub.",
    "blocks": [
      {
        "title": "App sob medida.",
        "text": "Precisa de algo que ainda não está na loja? No flyeeClub completo, há dois caminhos. Proponha o app para votação: o mais votado de cada mês entra em produção. Ou contrate o desenvolvimento direto: você descreve o que precisa, vê a faixa de valor na hora e, com o escopo confirmado, paga e acompanha o andamento no painel até a liberação. Pronto, o app entra na loja para todos."
      },
      {
        "title": "Mentoria remota.",
        "text": "Uma sessão com o Bruno para resolver um ponto específico da sua operação com IA."
      },
      {
        "title": "Consultoria completa.",
        "text": "O Bruno monta com você o sistema da sua empresa dentro do Claude, do diagnóstico à entrega."
      }
    ],
    "below": "Dentro do hub, esses recursos aparecem com um cadeado. Quando você clica, o flyeeClub mostra como liberar."
  },
  "origin": {
    "title": "Todo app aqui já rodou em produto de verdade.",
    "text": "Cada app do flyeeClub foi construído para um trabalho real antes de entrar na loja. Quem constrói é Bruno Santana, product engineer, que mantém sete sistemas em produção, em saúde, crédito e farmacêutico. O núcleo do flyeeClub é o mesmo que roda em dois desses produtos. Quando a IA muda, a atualização passa primeiro por esses produtos e só depois chega na loja.",
    "photoAlt": "Bruno Santana",
    "productsLabel": "Em produção:",
    "products": [
      {
        "name": "MedChina",
        "desc": "prontuário com IA para acupunturistas"
      },
      {
        "name": "Seenaly",
        "desc": "decisões para Meta Ads"
      },
      {
        "name": "Splash",
        "desc": "app de campo que sincroniza sem sinal"
      },
      {
        "name": "Perspec",
        "desc": "crédito imobiliário"
      }
    ],
    "linkedin": "Bruno no LinkedIn"
  },
  "pricing": {
    "title": "Escolha como entrar.",
    "rowLabels": {
      "price": "Preço",
      "apps": "Apps",
      "updates": "Atualizações",
      "guides": "Guias",
      "voice": "Voz na loja",
      "seats": "Acessos"
    },
    "plans": {
      "access": {
        "name": "Acesso flyeeClub",
        "price": "R$ {price} à vista ou em 12x de R$ {installment}, válido por 1 ano",
        "apps": "Todos os apps da loja, liberados no primeiro dia, inclusive os próximos",
        "updates": "Contínuas durante o ano de acesso, com resumo semanal do que mudou",
        "guides": "Guia de uso de cada app, em português e inglês",
        "voice": null,
        "seats": "1: um usuário, em uma máquina",
        "cta": "Quero garantir meu acesso"
      },
      "full": {
        "name": "flyeeClub completo",
        "price": "Assinatura: R$ {monthly}/mês ou R$ {yearly}/ano",
        "apps": "Tudo do Acesso",
        "updates": "Contínuas enquanto assinar",
        "guides": "Mais guias avançados e encontros ao vivo",
        "voice": "Voto no que entra na loja e pedido de app sob medida",
        "seats": "Mais de um",
        "cta": "Quero o flyeeClub completo"
      }
    },
    "below": "O Acesso é pagamento único. Mentoria remota e consultoria completa são contratadas à parte, dentro do hub.",
    "requirements": {
      "title": "O que você precisa ter",
      "text": "Um plano pago do Claude com Claude Code, ou do ChatGPT com Codex. Um computador onde você possa instalar programas. Alguns apps usam a sua conta em serviços externos, e o card de cada um avisa qual."
    }
  },
  "faq": {
    "title": "Perguntas",
    "items": [
      {
        "id": "curso",
        "q": "Isso é um curso?",
        "a": "Não. É uma loja de apps que você instala e usa no seu trabalho. Cada app vem com um guia curto, feito para você sair usando, e não assistindo."
      },
      {
        "id": "duracao",
        "q": "Quanto tempo dura o acesso?",
        "a": "Um ano a partir da compra, pago à vista ou em 12x, sem renovação automática. Depois disso, você renova para continuar recebendo atualizações e apps novos; o que já está instalado continua na sua máquina."
      },
      {
        "id": "computadores",
        "q": "Em quantos computadores posso usar?",
        "a": "Em um. Cada acesso é de um usuário, em uma máquina. O flyeeClub completo libera mais acessos."
      },
      {
        "id": "pedido-pago",
        "q": "Se outra pessoa pagar por um app, eu recebo também?",
        "a": "Recebe. Todo app que fica pronto entra na loja para todos os integrantes, tenha vindo de votação ou de um pedido pago."
      },
      {
        "id": "programar",
        "q": "Preciso saber programar?",
        "a": "Não. Para instalar, você copia e cola alguns comandos no terminal, e o guia de primeiros passos mostra cada um."
      },
      {
        "id": "sem-terminal",
        "q": "Funciona no app do Claude ou do ChatGPT, sem terminal?",
        "a": "Sim, mas o flyeeClub roda melhor no Claude Code e no Codex."
      },
      {
        "id": "custo-ia",
        "q": "Tem custo de IA além do acesso?",
        "a": "O seu plano de IA (Claude, ChatGPT etc.). O flyeeClub não cobra por uso; alguns apps usam a sua conta em serviços como HeyGen, e o card de cada um avisa."
      },
      {
        "id": "sem-atualizar",
        "q": "O que acontece se eu ficar um tempo sem atualizar?",
        "a": "Nada é desinstalado; o que está na sua máquina continua igual. Se passar 30 dias sem atualizar, o instalador pede para você confirmar o acesso no painel antes de baixar a versão nova."
      },
      {
        "id": "clientes",
        "q": "Posso usar em projetos de clientes?",
        "a": "Pode."
      },
      {
        "id": "duvidas",
        "q": "Onde tiro dúvidas sobre um app?",
        "a": "Na página do próprio app, dentro do hub."
      },
      {
        "id": "equipe",
        "q": "Tenho uma equipe. Como faço?",
        "a": "Cada pessoa precisa do próprio acesso, porque cada um vale para um usuário em uma máquina. O flyeeClub completo libera mais acessos; para uma equipe maior, {contato}.",
        "contactLink": "fale com a gente"
      },
      {
        "id": "idiomas",
        "q": "Em que idiomas?",
        "a": "Apps, guias e painel em português e inglês."
      },
      {
        "id": "reembolso",
        "q": "E se não servir para mim?",
        "a": "Você pede o reembolso em até 7 dias, pelo próprio painel."
      }
    ],
    "contact": "Ficou com alguma dúvida antes de entrar? Fale com a gente pelo {channel}. Quem responde é o Bruno."
  },
  "finalCta": {
    "title": "Da próxima vez que você precisar, já vai ter um app.",
    "text": "Garanta seu acesso, instale no seu Claude e use o primeiro app hoje.",
    "cta": "Quero garantir meu acesso",
    "note": "Acesso de 1 ano, à vista ou em 12x, sem renovação automática. Você usa o seu próprio plano de IA."
  },
  "footer": {
    "terms": "Termos de uso",
    "privacy": "Política de privacidade",
    "contact": "Contato",
    "copyright": "© {year} flyee.club"
  }
}
```

json## Apêndice B · `content/home.en.json`

```json
{
  "meta": {
    "lang": "en",
    "title": "flyee.club: apps that automate your business in your AI",
    "description": "Apps that automate sales, content, video and product work inside Claude Code, Codex or your favorite AI. One year of access, one payment."
  },
  "anchors": {
    "apps": "apps",
    "hub": "inside-the-hub",
    "howItWorks": "how-it-works",
    "whoFor": "who-its-for",
    "pricing": "pricing",
    "faq": "faq"
  },
  "ui": {
    "skipToContent": "Skip to content",
    "menu": "Menu",
    "close": "Close",
    "langSwitch": "PT",
    "langSwitchLabel": "Ler em português",
    "install": "Install",
    "copy": "Copy",
    "copied": "Copied",
    "lockedLabel": "Part of flyeeClub complete",
    "notIncluded": "Not included",
    "usesAccount": "Uses your {service} account",
    "new": "New",
    "updatedOn": "Updated {date}"
  },
  "nav": {
    "logo": "flyee.club",
    "links": [
      {
        "label": "Apps",
        "anchor": "apps"
      },
      {
        "label": "How it works",
        "anchor": "howItWorks"
      },
      {
        "label": "Pricing",
        "anchor": "pricing"
      },
      {
        "label": "Who it's for",
        "anchor": "whoFor"
      }
    ],
    "login": "Log in",
    "cta": "Build my system"
  },
  "hero": {
    "badge": {
      "tag": "NEW",
      "text": "HeyGen Script app: scene-by-scene scripts for avatar video",
      "appSlug": "roteiro-heygen"
    },
    "title": {
      "line1": "Apps that automate your business's work",
      "line2Before": "in ",
      "highlight": "your favorite AI",
      "line2After": "."
    },
    "subtitle": "Sales, content, video, research and product: every repetitive task becomes an app that runs in Claude Code, Codex or the AI you already use. For {negocio}, {agencia}, {produto} or {dev}.",
    "segments": {
      "negocio": "your business",
      "agencia": "your agency",
      "produto": "your digital product",
      "dev": "your dev work"
    },
    "ctaPrimary": "Get my access",
    "ctaSecondary": "Is flyeeClub for me?",
    "note": "One year of access, one payment.",
    "logos": {
      "label": "Works with the AI and tools you already use",
      "seeAll": "See all →",
      "items": [
        "Claude Code",
        "Codex",
        "Gemini CLI",
        "Cursor",
        "GitHub Copilot",
        "HeyGen",
        "Apify"
      ]
    },
    "productImage": {
      "alt": "The flyeeClub app store, open",
      "floatingCta": "See all apps →"
    }
  },
  "store": {
    "title": "Need it? There's an app on flyeeClub.",
    "lead": "Every app automates one task. Open it, see what it does, and install it in Claude with one command.",
    "categories": [
      {
        "id": "all",
        "label": "All"
      },
      {
        "id": "sell",
        "label": "Sell"
      },
      {
        "id": "promote",
        "label": "Promote"
      },
      {
        "id": "video",
        "label": "Video"
      },
      {
        "id": "research",
        "label": "Research"
      },
      {
        "id": "build",
        "label": "Build"
      }
    ],
    "stats": "{apps} apps in the store · {updates} updates in the last 30 days · tested on {ais} AIs",
    "apps": [
      {
        "slug": "copy-lp",
        "name": "Landing Copy",
        "category": "sell",
        "line": "A sales page or website, from brief to final copy.",
        "account": null
      },
      {
        "slug": "copy-social",
        "name": "Social Copy",
        "category": "promote",
        "line": "This week's posts for LinkedIn, Instagram, YouTube and X.",
        "account": null
      },
      {
        "slug": "radar",
        "name": "Radar",
        "category": "research",
        "line": "Shows what's working in your niche, measured against each profile's own average.",
        "account": "Apify"
      },
      {
        "slug": "pauta",
        "name": "Briefs",
        "category": "promote",
        "line": "Turns what Radar found into briefs, titles and scripts.",
        "account": null
      },
      {
        "slug": "roteiro-heygen",
        "name": "HeyGen Script",
        "category": "video",
        "line": "Scene-by-scene scripts with lines, gestures and the prompt for avatar video.",
        "account": "HeyGen",
        "isNew": true
      },
      {
        "slug": "takes",
        "name": "Takes",
        "category": "video",
        "line": "Video takes with mockups of your app's screens.",
        "account": null
      },
      {
        "slug": "pesquisa",
        "name": "Research",
        "category": "research",
        "line": "An agent researches a topic in depth and delivers [PENDENTE: complete what the app delivers]",
        "account": null
      },
      {
        "slug": "saas-starter",
        "name": "SaaS Starter",
        "category": "build",
        "line": "The foundation to start a product with a standard from day one.",
        "account": null
      }
    ],
    "requestCard": {
      "name": "Request an app",
      "line": "Can't find it? On flyeeClub complete, you can request a custom app.",
      "badge": "flyeeClub complete"
    },
    "belowGrid": "No modules to sit through. You install the app and use it; each one has a short guide.",
    "comingNext": {
      "title": "Coming next.",
      "lead": "They join your access at no extra cost.",
      "status": {
        "production": "In production",
        "mostVoted": "Most voted in {month}",
        "paid": "In development, ships to everyone"
      }
    }
  },
  "hub": {
    "title": "What comes with the apps.",
    "lead": "One login. The apps and their guides are open from day one.",
    "cards": [
      {
        "id": "store",
        "name": "App store",
        "plan": "access",
        "line": "Every app, plus the next ones that ship while your access lasts."
      },
      {
        "id": "guides",
        "name": "Guides",
        "plan": "access",
        "line": "A short guide for each app, with the steps and examples."
      },
      {
        "id": "weekly",
        "name": "This week's changes",
        "plan": "access",
        "line": "A summary of what changed in each app, linked to its changelog. In the hub and in your inbox."
      },
      {
        "id": "questions",
        "name": "Questions on the app",
        "plan": "access",
        "line": "Ask on the app's own page. Whoever built the app answers."
      },
      {
        "id": "live",
        "name": "Live sessions",
        "plan": "full",
        "line": "Sessions with Bruno on new apps and what changed in AI."
      },
      {
        "id": "requests",
        "name": "Requests and votes",
        "plan": "full",
        "line": "Propose an app, vote on requests and follow what's in production."
      }
    ],
    "planBadges": {
      "access": "Access",
      "full": "flyeeClub complete"
    },
    "below": "Anything with a lock is part of flyeeClub complete."
  },
  "testimonials": {
    "title": "“Everything I needed, in one place.”",
    "placeholder": true,
    "items": [
      {
        "quote": "I used to pay for a separate tool for everything: posts, scripts, pages. Now I do it inside Claude, and when something changes, the app arrives updated.",
        "name": "[FICTÍCIO: Name]",
        "role": "owner of [type of business]",
        "photo": null
      },
      {
        "quote": "I use the apps on client projects. Landing Copy gives me the structure and the review; I bring what only I know about the client.",
        "name": "[FICTÍCIO: Name]",
        "role": "marketing freelancer",
        "photo": null
      },
      {
        "quote": "One command to install, and SaaS Starter became the starting point for my new projects. The agent follows the rules without me repeating them.",
        "name": "[FICTÍCIO: Name]",
        "role": "developer",
        "photo": null
      }
    ],
    "seeAll": "See all testimonials"
  },
  "howItWorks": {
    "title": "Three steps and you're in.",
    "steps": [
      {
        "title": "Get your access.",
        "text": "You enter the app store and get a personal token."
      },
      {
        "title": "Install it in Claude.",
        "text": "In your terminal, run `npx flyee` and paste your token. Never opened a terminal? The getting-started guide shows every click."
      },
      {
        "title": "Install the apps you need.",
        "text": "Pick one in the store and run `npx flyee add` with its name. To get new versions, run `npx flyee update`."
      }
    ]
  },
  "whyStore": {
    "title": "Why an app store, and not one more subscription?",
    "blocks": [
      {
        "title": "One place.",
        "text": "Instead of a service for every task, your apps live together, in the same agent and the same project."
      },
      {
        "title": "Runs on what you already have.",
        "text": "The apps use your own AI plan and save what they produce as files on your computer. flyeeClub doesn't charge for usage. If you ever switch AIs, what they produced stays with you."
      },
      {
        "title": "Always current.",
        "text": "AI changes every week. When it does, we update the app and you run one command."
      }
    ]
  },
  "whoFor": {
    "title": "If you repeat the same tasks every week, there's an app for you.",
    "appsLabel": "Apps to start with",
    "cards": [
      {
        "segment": "negocio",
        "name": "Your business",
        "text": "You run the company with a small team and want to stop paying for a separate tool for every task.",
        "apps": [
          "copy-social",
          "pauta",
          "copy-lp"
        ]
      },
      {
        "segment": "agencia",
        "name": "Your agency",
        "text": "You serve clients, solo or with a team, and need to deliver more without losing each client's voice.",
        "apps": [
          "copy-lp",
          "radar",
          "copy-social"
        ]
      },
      {
        "segment": "produto",
        "name": "Your digital product",
        "text": "You sell online and need pages, content and video going out every week.",
        "apps": [
          "copy-lp",
          "roteiro-heygen",
          "takes"
        ]
      },
      {
        "segment": "dev",
        "name": "Your dev work",
        "text": "You build products and want every project to start with a standard, without repeating the rules to the agent.",
        "apps": [
          "saas-starter",
          "pesquisa"
        ]
      }
    ],
    "notForYou": {
      "title": "Not for you if",
      "items": [
        "You want to watch lessons. Here you install and use.",
        "You don't want to install anything on your computer. Today the apps run on Claude Code and Codex.",
        "You don't have an AI plan and don't plan to get one. flyeeClub uses yours."
      ]
    },
    "quiz": {
      "before": "Still not sure?",
      "link": "Take the three-question quiz."
    }
  },
  "beyond": {
    "title": "When you need more than an app, that's on flyeeClub too.",
    "blocks": [
      {
        "title": "A custom app.",
        "text": "Need something the store doesn't have yet? On flyeeClub complete there are two routes. Put it up for a vote: the most-voted request each month goes into production. Or commission it directly: describe what you need, see the price range on the spot and, once the scope is confirmed, pay and track progress in the dashboard until it ships. Once it's ready, it joins the store for everyone."
      },
      {
        "title": "Remote mentoring.",
        "text": "A session with Bruno to work through a specific part of your AI operation."
      },
      {
        "title": "Full consulting.",
        "text": "Bruno builds your company's system inside Claude with you, from diagnosis to delivery."
      }
    ],
    "below": "Inside the hub, these show up with a lock. Click one and flyeeClub shows you how to get it."
  },
  "origin": {
    "title": "Every app here has run on a real product.",
    "text": "Every flyeeClub app was built for real work before it joined the store. They're built by Bruno Santana, a product engineer who runs seven systems in production across healthcare, lending and pharma. flyeeClub's core is the same one running in two of those products. When AI changes, updates run through those products first and only then reach the store.",
    "photoAlt": "Bruno Santana",
    "productsLabel": "In production:",
    "products": [
      {
        "name": "MedChina",
        "desc": "AI medical records for acupuncturists"
      },
      {
        "name": "Seenaly",
        "desc": "decision support for Meta Ads"
      },
      {
        "name": "Splash",
        "desc": "a field app that syncs without signal"
      },
      {
        "name": "Perspec",
        "desc": "real estate lending"
      }
    ],
    "linkedin": "Bruno on LinkedIn"
  },
  "pricing": {
    "title": "Choose how to get in.",
    "rowLabels": {
      "price": "Price",
      "apps": "Apps",
      "updates": "Updates",
      "guides": "Guides",
      "voice": "Say in the store",
      "seats": "Seats"
    },
    "plans": {
      "access": {
        "name": "flyeeClub Access",
        "price": "USD {price} one-time, valid for 1 year",
        "apps": "Every app in the store, available from day one, including the next ones",
        "updates": "Ongoing throughout your year of access, with a weekly summary of what changed",
        "guides": "A how-to guide for every app, in English and Portuguese",
        "voice": null,
        "seats": "1: one person, on one machine",
        "cta": "Get my access"
      },
      "full": {
        "name": "flyeeClub complete",
        "price": "Subscription: USD {monthly}/month or USD {yearly}/year",
        "apps": "Everything in Access",
        "updates": "Ongoing while you subscribe",
        "guides": "Plus advanced guides and live sessions",
        "voice": "Vote on what joins the store and request custom apps",
        "seats": "More than one",
        "cta": "Get flyeeClub complete"
      }
    },
    "below": "Access is a single payment. Remote mentoring and full consulting are booked separately, inside the hub.",
    "requirements": {
      "title": "What you need",
      "text": "A paid Claude plan with Claude Code, or a ChatGPT plan with Codex. A computer where you can install software. Some apps use your own account on outside services, and each app's card says which."
    }
  },
  "faq": {
    "title": "Questions",
    "items": [
      {
        "id": "curso",
        "q": "Is this a course?",
        "a": "No. It's an app store you install and use in your work. Each app comes with a short guide so you get to using it instead of watching."
      },
      {
        "id": "duracao",
        "q": "How long does access last?",
        "a": "One year from purchase, with no automatic renewal. After that, you renew to keep getting updates and new apps; what's already installed stays on your machine."
      },
      {
        "id": "computadores",
        "q": "How many computers?",
        "a": "One. Each access is for one person, on one machine. flyeeClub complete includes more seats."
      },
      {
        "id": "pedido-pago",
        "q": "If someone else pays for an app, do I get it too?",
        "a": "Yes. Every app that ships joins the store for every member, whether it came from a vote or a paid request."
      },
      {
        "id": "programar",
        "q": "Do I need to know how to code?",
        "a": "No. To install, you copy and paste a few terminal commands, and the getting-started guide walks through each one."
      },
      {
        "id": "sem-terminal",
        "q": "Does it work in the Claude or ChatGPT apps, without a terminal?",
        "a": "Yes, but flyeeClub runs best on Claude Code and Codex."
      },
      {
        "id": "custo-ia",
        "q": "Any AI costs on top of access?",
        "a": "Your AI plan (Claude, ChatGPT, etc.). flyeeClub doesn't charge for usage; some apps use your account on services like HeyGen, and each card tells you which."
      },
      {
        "id": "sem-atualizar",
        "q": "What if I don't update for a while?",
        "a": "Nothing gets uninstalled; what's on your machine stays as it is. After 30 days without an update, the installer asks you to confirm access in the dashboard before pulling the new version."
      },
      {
        "id": "clientes",
        "q": "Can I use it on client projects?",
        "a": "Yes."
      },
      {
        "id": "duvidas",
        "q": "Where do I ask questions about an app?",
        "a": "On the app's own page, inside the hub."
      },
      {
        "id": "equipe",
        "q": "I have a team. How does that work?",
        "a": "Each person needs their own access, since each one covers one person on one machine. flyeeClub complete includes more seats; for a larger team, {contato}.",
        "contactLink": "get in touch"
      },
      {
        "id": "idiomas",
        "q": "Which languages?",
        "a": "Apps, guides and dashboard in English and Portuguese."
      },
      {
        "id": "reembolso",
        "q": "What if it's not for me?",
        "a": "Ask for a refund within 7 days, right from the dashboard."
      }
    ],
    "contact": "Still have a question before you join? Talk to us on {channel}. Bruno answers."
  },
  "finalCta": {
    "title": "Next time you need something, there'll already be an app.",
    "text": "Get your access, install it in Claude and use your first app today.",
    "cta": "Get my access",
    "note": "One year of access, one payment, no automatic renewal. You use your own AI plan."
  },
  "footer": {
    "terms": "Terms of use",
    "privacy": "Privacy policy",
    "contact": "Contact",
    "copyright": "© {year} flyee.club"
  }
}
```

json
