/**
 * Portuguese copy of every e-mail the platform sends to members and leads.
 *
 * The structural source of truth: `EmailCopy` is this object's type and
 * `en.ts` has to match it, so TypeScript refuses the build when one language
 * gains a line the other lacks.
 *
 * Three rules for whoever edits this:
 * - vocabulary follows the site (docs/HOME-COPY.md): app, guia, acesso;
 * - a plan is always called by the name it has in the data (`plans.name`),
 *   never by a word written here, and a sentence never depends on the
 *   grammatical gender of that name;
 * - a date, an amount or a duration arrives already formatted for the reader.
 */
export const emailCopy = {
  shell: {
    /** The line under every message. */
    signature: "flyee.club · apps que rodam na IA que você já usa",
  },

  memberWelcome: {
    subject: "Sua conta no flyee.club está criada",
    preview: "Três passos para instalar o primeiro app",
    heading: "Sua conta está criada",
    greeting: (name: string | null) =>
      name ? `${name}, a sua conta no flyee.club está pronta.` : "A sua conta no flyee.club está pronta.",
    body: "O flyee é uma loja de apps que rodam na IA que você já usa, como o Claude Code e o Codex. Para começar:",
    steps: [
      "Escolha o seu acesso em Cobrança, no painel.",
      "No terminal, rode npx flyee login e aprove a conexão no navegador.",
      "Instale o primeiro app com npx flyee add e o nome do app.",
    ],
    button: "Abrir o painel",
    reason: "Você recebe esta mensagem porque criou uma conta no flyee.club.",
  },

  accessReceipt: {
    subject: (plan: string) => `${plan}: pagamento confirmado`,
    preview: "Os apps da loja e as atualizações estão liberados na sua conta",
    heading: "O acesso é seu",
    greeting: (name: string | null) => (name ? `${name}, pagamento confirmado.` : "Pagamento confirmado."),
    body: (amount: string, plan: string) => `Recebemos ${amount}, referente a ${plan}.`,
    /** `until` is null for an access with no end date. */
    unlocked: (until: string | null) =>
      until
        ? `Todos os apps da loja e as atualizações estão liberados na sua conta até ${until}.`
        : "Todos os apps da loja e as atualizações estão liberados na sua conta, sem prazo para acabar.",
    next: "Para começar:",
    steps: [
      "Abra o painel e conecte o seu terminal com npx flyee login.",
      "Instale o primeiro app na IA que você usa.",
    ],
    button: "Abrir o painel",
    fiscal: "A nota fiscal é emitida pelo Asaas e chega em outro e-mail.",
    keep: "Guarde esta mensagem: ela é o seu recibo de compra.",
  },

  subscriptionActive: {
    subject: (plan: string) => `Pagamento confirmado: ${plan}`,
    preview: (plan: string) => `${plan} já vale na sua conta`,
    heading: "Pagamento confirmado",
    greeting: (name: string | null, plan: string) =>
      name ? `${name}, ${plan} já vale na sua conta.` : `${plan} já vale na sua conta.`,
    includes: "O que está liberado:",
    features: {
      catalog_access: "Todos os apps da loja, inclusive os próximos, com as atualizações",
      devices: (count: number) =>
        count === 1 ? "1 computador conectado" : `Até ${count} computadores conectados ao mesmo tempo`,
      advanced_lessons: "Guias avançados",
      recipes: "Receitas prontas",
      roadmap_vote: "Voto no que entra na loja",
      meetings: "Encontros ao vivo",
      commercial_license: "Licença comercial para projetos de cliente",
      open_the_hood: "A camada abrir o capô",
    },
    button: "Abrir o painel",
    manage: "As faturas e a assinatura ficam em Configurações, Cobrança.",
  },

  subscriptionCanceled: {
    subject: (plan: string) => `${plan}: assinatura encerrada`,
    preview: "O que continua e o que deixa de chegar",
    heading: "Sua assinatura foi encerrada",
    /** Why it ended: the member asked, a payment was not confirmed, a paid term ran out, or no reason is known. */
    cause: {
      requested: (plan: string, date: string) => `${plan} terminou em ${date}, como você pediu.`,
      payment: (plan: string, date: string) => `${plan} terminou em ${date} porque o pagamento não foi confirmado.`,
      term: (plan: string, date: string) => `${plan} terminou em ${date}: o período pago chegou ao fim.`,
      ended: (plan: string, date: string) => `${plan} terminou em ${date}.`,
    },
    keepsTitle: "O que continua:",
    keepsInstalled: "Os apps já instalados continuam funcionando no seu computador.",
    /** Shown when another purchase (the one-time access) still unlocks the store; named when the name is known. */
    keepsAccess: (plan: string | null) =>
      plan ? `O acesso à loja e às atualizações continua (${plan}).` : "O acesso à loja e às atualizações continua.",
    stopsTitle: "O que deixa de chegar:",
    stopsUpdates: "As versões novas dos apps e os apps novos.",
    stopsBenefits:
      "O que era da assinatura, como os guias avançados, os encontros ao vivo e o voto no que entra na loja.",
    button: "Ver os planos",
    back: "Para voltar, escolha um plano em Configurações, Cobrança.",
  },

  termEnding: {
    subject: (plan: string, date: string) => `${plan}: o período pago termina em ${date}`,
    preview: "Uma compra única não renova sozinha",
    heading: "O período pago está terminando",
    body: (plan: string, date: string) =>
      `${plan} foi uma compra única, que não renova sozinha. O período pago vai até ${date}.`,
    next: "Para continuar depois dessa data, faça uma nova compra em Cobrança. Os apps instalados continuam funcionando de qualquer forma.",
    button: "Abrir Cobrança",
  },

  tokenReminder: {
    /** `days` is the whole days left, rounded up: 1 means "within 24 hours". */
    subject: (days: number) =>
      days <= 1
        ? "A conexão do seu computador vence em até 24 horas"
        : `A conexão do seu computador vence em ${days} dias`,
    preview: "Uma atualização renova o prazo por mais 30 dias",
    heading: "Hora de atualizar",
    /** `device` is the name the member gave the machine, when there is one. */
    body: (device: string | null, days: number) => {
      const machine = device ? `do computador "${device}"` : "do seu computador";
      return days <= 1
        ? `A conexão ${machine} com o flyee vence em até 24 horas.`
        : `A conexão ${machine} com o flyee vence em ${days} dias.`;
    },
    how: "Rode este comando no terminal para renovar o prazo por mais 30 dias:",
    command: "npx flyee update",
    after:
      "Se o prazo vencer, nada é desinstalado: os apps continuam funcionando, e o instalador pede que você confirme o acesso no painel antes de baixar versões novas.",
    button: "Ver meus computadores",
    reason: "Este é um aviso sobre a sua conta. Ele é enviado também a quem não recebe as novidades.",
  },

  updatesDigest: {
    subject: (count: number) => (count === 1 ? "1 app seu tem versão nova" : `${count} apps seus têm versão nova`),
    preview: "Um comando atualiza todos",
    heading: "Versões novas dos seus apps",
    intro: "Saíram versões novas de apps que você tem instalados:",
    /** One line per app: its name and the versions it moves between. */
    item: (app: string, from: string, to: string) => `${app}: ${from} para ${to}`,
    how: "Para atualizar todos de uma vez, rode no terminal:",
    command: "npx flyee update",
    button: "Ver o que mudou",
    reason: "Você recebe este resumo semanal porque tem apps instalados.",
    unsubscribe: "Parar de receber o resumo",
  },

  leadConfirm: {
    subject: "Confirme sua inscrição na lista do flyee.club",
    preview: "Um clique para entrar na lista de espera do flyee.club",
    heading: "Confirme sua inscrição",
    body: "Recebemos um pedido para colocar este endereço na lista de espera do flyee.club. Confirme com o botão abaixo e avisaremos quando abrir.",
    button: "Confirmar inscrição",
    expiry: "O link vale por 7 dias.",
    ignore:
      "Não foi você? Ignore esta mensagem: endereços não confirmados são apagados em 7 dias e não recebem mais nada.",
  },

  newsletter: {
    reason: "Você recebe este e-mail porque entrou na lista do flyee.club.",
    unsubscribe: "Sair da lista",
  },

  meeting: {
    confirmation: {
      subject: (title: string) => `Inscrição confirmada: ${title}`,
      heading: "Sua inscrição está feita",
      body: (title: string) => `A sua inscrição em ${title} está confirmada.`,
      button: "Abrir o encontro",
    },
    /** Sent from 24 hours before the start: the wording is true anywhere in that window. */
    day: {
      subject: (title: string) => `Lembrete: ${title}`,
      heading: "O encontro é nas próximas 24 horas",
      body: (title: string) => `${title} acontece nas próximas 24 horas.`,
      button: "Abrir o encontro",
    },
    /** Sent in the last 60 minutes before the start. */
    hour: {
      subject: (title: string) => `Começa em menos de uma hora: ${title}`,
      heading: "Começa em menos de uma hora",
      body: (title: string) => `${title} começa em menos de uma hora. A sala abre 15 minutos antes.`,
      button: "Abrir o encontro",
    },
    recording: {
      subject: (title: string) => `A gravação está disponível: ${title}`,
      heading: "A gravação está disponível",
      body: (title: string) => `${title} terminou e a gravação já está no painel.`,
      button: "Assistir à gravação",
    },
    when: "Quando:",
    reason:
      "Você recebe este aviso porque se inscreveu neste encontro. Para deixar de receber, cancele a inscrição na página do encontro.",
  },
};

export type EmailCopy = typeof emailCopy;
