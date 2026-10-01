/**
 * pt-BR is the STRUCTURAL source of truth for the home's copy: `HomeCopy` is
 * `typeof homeCopyPtBR`, so a missing or extra key in English is a compile
 * error — stronger than the runtime key-parity test that guards the next-intl
 * catalogs.
 *
 * Inline markers (see ./rich.tsx): **accent** -> <em>, __lead__ -> <strong>,
 * ==term== -> <mark>, \n -> <br />. Each language chooses its OWN line breaks.
 *
 * Interim content (phase 1 of docs/PLANO-IMPLEMENTACAO.md): the full home,
 * with the catalog by trail and the update moment, is built in phase 7.
 */
export const homeCopyPtBR = {
  meta: {
    title: "flyee.club | Suas ferramentas de IA sempre funcionando",
    description:
      "Harness e ferramentas para Claude Code, Codex, Gemini CLI e Cursor, atualizados quando as IAs mudam. Em português e inglês, na IA que você já usa.",
  },

  hero: {
    eyebrow: "Clube de ferramentas para IA",
    title: "A IA muda toda semana.\n**Suas ferramentas continuam funcionando.**",
    subtitle:
      "O flyee.club instala um harness na IA que você já usa e mantém skills, workflows e regras atualizados quando o Claude, o Codex ou as APIs mudam.",
    primaryCta: "Criar conta",
    secondaryCta: "Ver planos",
    note: "Você usa o seu próprio plano ou API de IA. O clube não gasta crédito do seu lado.",
    highlights: ["Claude Code, Codex, Gemini CLI e Cursor", "Português e inglês", "Checksum e permissões declaradas"],
    mediaLabel: "Catálogo do flyee.club",
  },

  steps: {
    eyebrow: "Como funciona",
    title: "Do cadastro à ferramenta rodando na sua IA",
    items: [
      {
        title: "Crie sua conta e escolha o acesso",
        body: "O kit de entrada libera o catálogo e as atualizações. A assinatura soma aulas avançadas, receitas e encontros.",
      },
      {
        title: "Instale com um comando",
        body: "O instalador coloca o harness na sua máquina e conecta à sua conta com um token.",
      },
      {
        title: "Use na IA que você já usa",
        body: "Skills, workflows e regras ficam disponíveis no Claude Code, no Codex, no Gemini CLI ou no Cursor.",
      },
      {
        title: "Atualize quando a IA mudar",
        body: "Cada ferramenta ganha versão nova com changelog e checksum. Você atualiza com um comando.",
      },
    ],
  },

  cta: {
    title: "Comece criando sua conta",
    subtitle: "Depois é só escolher o acesso e instalar.",
    label: "Criar conta",
  },
};

export type HomeCopy = typeof homeCopyPtBR;
