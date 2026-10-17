/**
 * pt-BR is the STRUCTURAL source of truth for the home's copy: `HomeCopy` is
 * `typeof homeCopyPtBR`, so a missing or extra key in English is a compile
 * error — stronger than the runtime key-parity test that guards the next-intl
 * catalogs.
 *
 * Inline markers (see ./rich.tsx): **accent** -> <em>, __lead__ -> <strong>,
 * ==term== -> <mark>, \n -> <br />. Each language chooses its OWN line breaks.
 *
 * The text follows docs/HOME-COPY.md (the app-store home, delivered
 * 2026-10-01). Where that draft states something the platform does not do yet
 * (a self-service refund, custom apps, mentoring) or marks it [CONFIRMAR] /
 * [FICTÍCIO], the page says what the platform does instead, or leaves the
 * section out until it exists. The commercial rules it states (a year of
 * access, installments, client projects) are the platform's since migration
 * 0024. The guardrails of docs/DESIGN.md apply to every
 * line, and every NUMBER on the home comes from the database.
 */
export const homeCopyPtBR = {
  meta: {
    title: "FlyeeClub: apps que automatizam sua empresa na sua IA",
    description:
      "Apps que automatizam vendas, conteúdo, vídeo e produto no Claude Code, no Codex ou na sua IA favorita. A sua IA instala cada app e atualiza quando você pede.",
  },

  hero: {
    eyebrow: "Loja de apps para a sua IA",
    newLabel: "Novo",
    title: "Apps que automatizam o trabalho da sua empresa na **sua IA favorita**.",
    subtitle:
      "Vendas, conteúdo, vídeo, pesquisa e produto: cada tarefa repetitiva vira um app que roda no Claude Code, no Codex ou na IA que você já usa. Para o seu negócio, a sua agência, o seu produto digital ou o seu trabalho de dev.",
    secondaryCta: "O FlyeeClub é pra mim?",
    note: "Acesso de 1 ano, pagamento único. Você usa o seu próprio plano de IA.",
    stripLabel: "Funciona com a IA que você já usa",
    store: {
      title: "Loja de apps",
      label: "Os apps publicados na loja do FlyeeClub",
      allLabel: "Todos",
      appsLabel: "apps na loja",
      updatedLabel: "Última atualização",
    },
    terminal: {
      title: "~/meu-projeto",
      label: "O que a sua IA roda ao atualizar os apps do FlyeeClub de um projeto",
      checking: "Conferindo 3 apps instalados…",
      updated: "product-scope atualizado: 1.4.0 → 1.6.0",
      changelog: "Changelog: segue o novo formato de skills do Claude Code",
      verified: "Checksum sha256 conferido",
    },
    chips: {
      versions: "1.4.0 → 1.6.0",
      checksum: "sha256 conferido",
    },
  },

  store: {
    eyebrow: "Loja de apps",
    title: "Precisou? Tem app no FlyeeClub.",
    subtitle: "Cada app automatiza uma tarefa. Abra, veja o que ele faz e peça à sua IA para instalar.",
    categoriesLabel: "Categorias da loja",
    allLabel: "Todos",
    featuredLabel: "Em destaque",
    newBadge: "Novo",
    usesAccount: "Usa sua conta {service}",
    updatedOn: "Atualizado em {date}",
    viewApp: "Ver o app",
    /**
     * The featured app and its example (lib/catalog/featured.ts): the slot
     * shows this app answering the request below, the result and not the
     * command. Swap the slug and the example together at a launch. When the
     * app is not in the catalog, the slot goes to the app updated last and
     * shows what it does.
     */
    featured: {
      slug: "youtube-script",
      request:
        "Quero gravar um vídeo de uns 10 minutos sobre como montar a marmita da semana sem enjoar. Me ajuda com o roteiro?",
      reply: [
        { label: "Título", text: "Marmita da semana em 1 hora, sem repetir prato" },
        {
          label: "Gancho · 0:00",
          text: "Na quarta você já não aguenta a mesma comida. O problema não é a receita, é a ordem do preparo.",
        },
        { label: "Bloco 1 · 0:30", text: "Cinco bases que viram dez pratos diferentes" },
        { label: "Bloco 2 · 3:00", text: "A ordem do preparo para caber em uma hora" },
        { label: "Bloco 3 · 6:30", text: "Como guardar para durar até sexta" },
        { label: "Fechamento · 9:10", text: "O que testar na primeira semana" },
      ],
      saved: "Salvo em roteiros/marmita-da-semana/estrutura.md",
    },
    showcase: {
      context: "Na sua IA",
      caption: "Exemplo do {app} respondendo a um pedido na sua IA",
    },
    carouselLabel: "Os apps da loja",
    previous: "Apps anteriores",
    next: "Próximos apps",
    footnote: "Nada de módulo para assistir. Você instala o app e usa; cada um tem um guia curto.",
    allApps: "Ver todos os apps",
    emptyTitle: "Os primeiros apps estão chegando",
    emptyBody: "A loja abre com apps que já rodam em produção. Esta seção mostra cada um assim que ele é publicado.",
    unavailableTitle: "A loja não carregou agora",
    unavailableBody: "Tente de novo em alguns instantes ou abra a loja de apps.",
  },

  steps: {
    eyebrow: "Como funciona",
    title: "Três passos e você está dentro.",
    items: [
      {
        kicker: "acesso",
        title: "Assine o FlyeeClub",
        body: "Um pagamento, válido por 1 ano, e a loja de apps fica liberada na sua conta.",
      },
      {
        kicker: "login",
        title: "Instale no seu Claude",
        body: "Peça à sua IA: instale o flyee seguindo flyee.club/instalar.md. Ela roda o instalador e você só aprova a conexão no navegador.",
        // Until the store opens the page gives no address to follow (lib/launch.ts, `invitesToInstall`).
        bodyWaitlist: "Você pede na conversa, a sua IA roda o instalador e você só aprova a conexão no navegador.",
      },
      {
        kicker: "add",
        title: "Instale os apps que precisar",
        body: "Escolha na loja e peça o app à sua IA, pelo nome. Para receber as versões novas, peça para ela atualizar.",
      },
    ],
  },

  why: {
    eyebrow: "Por que uma loja",
    title: "Por que uma loja de apps, e não mais uma assinatura?",
    items: [
      {
        title: "Um lugar só",
        body: "Em vez de um serviço para cada tarefa, os apps ficam juntos, no mesmo agente e no mesmo projeto.",
      },
      {
        title: "Roda no que você já tem",
        body: "Os apps usam o seu plano de IA e guardam o que produzem em arquivos no seu computador. O FlyeeClub não cobra por uso.",
      },
      {
        title: "Atualizado quando a IA muda",
        body: "A IA muda toda semana. Quando muda, a gente atualiza o app e a sua IA instala a versão nova quando você pede.",
      },
    ],
  },

  origin: {
    eyebrow: "De onde vêm os apps",
    title: "Todo app aqui já rodou em produto de verdade.",
    body: "Cada app do FlyeeClub foi construído para um trabalho real antes de entrar na loja. Quem constrói é Bruno Santana, product engineer, que mantém sete sistemas em produção, em saúde, crédito e farmacêutico. O núcleo do FlyeeClub é o mesmo que roda em dois desses produtos.",
    facts: ["Sete sistemas em produção", "Saúde", "Crédito", "Farmacêutico"],
  },

  access: {
    eyebrow: "Acesso",
    title: "Garanta seu acesso.",
    subtitle:
      "O FlyeeClub é um pagamento único, válido por 1 ano, e libera todos os apps da loja, com as atualizações.",
    requirementsTitle: "O que você precisa ter",
    requirements: [
      {
        title: "Uma IA de terminal",
        body: "Claude Code, Codex, Gemini CLI ou Cursor, com o seu plano ou a sua chave de API. A página de cada app diz em quais ele foi testado.",
      },
      {
        title: "Um computador seu",
        body: "Um computador onde você possa instalar programas. O instalador roda com o Node.js.",
      },
      {
        title: "Contas de outros serviços",
        body: "Alguns apps usam a sua conta em serviços externos, e a página de cada um avisa qual.",
      },
    ],
  },

  faq: {
    eyebrow: "Antes de entrar",
    title: "Perguntas",
    items: [
      {
        question: "Isso é um curso?",
        answer:
          "Não. É uma loja de apps que você instala e usa no seu trabalho. Cada app vem com um guia curto, feito para você sair usando, e não assistindo.",
      },
      {
        question: "Em quantos computadores posso usar?",
        answer: "Em um. Cada acesso é de um usuário, em uma máquina.",
      },
      {
        question: "Preciso saber programar?",
        answer:
          "Não. A sua IA instala e atualiza por você: você pede na conversa, confirma o que ela vai fazer e aprova a conexão no navegador.",
      },
      {
        question: "Funciona no app do Claude ou do ChatGPT, sem terminal?",
        answer: "Ainda não. Hoje o FlyeeClub roda nas IAs de terminal: Claude Code, Codex, Gemini CLI e Cursor.",
      },
      {
        question: "Tem custo de IA além do acesso?",
        answer:
          "O seu plano de IA. O FlyeeClub não cobra por uso; alguns apps usam a sua conta em serviços externos, e a página de cada um avisa.",
      },
      {
        question: "O que acontece se eu ficar um tempo sem atualizar?",
        answer:
          "Nada é desinstalado; o que está na sua máquina continua igual. Se passar 30 dias sem atualizar, o instalador pede para você confirmar o acesso no painel antes de baixar a versão nova.",
      },
      {
        question: "Posso usar em projetos de clientes?",
        answer: "Pode. O FlyeeClub cobre os seus projetos e os projetos dos seus clientes.",
      },
      {
        question: "Em que idiomas?",
        answer: "Apps, guias e painel em português e inglês.",
      },
      {
        question: "E se não servir para mim?",
        answer: "Dentro do prazo de garantia, você pede o reembolso integral pelo suporte.",
      },
    ],
  },

  cta: {
    title: "Da próxima vez que você precisar, já vai ter um app.",
    subtitleOpen:
      "Assine o FlyeeClub, instale no seu Claude e use o primeiro app hoje. Você usa o seu próprio plano de IA.",
    subtitleWaitlist:
      "Entre na lista de espera e avisamos quando a loja abrir. Você vai usar o seu próprio plano de IA.",
  },
};

export type HomeCopy = typeof homeCopyPtBR;
