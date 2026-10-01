import type { HomeCopy } from "./pt-BR";

/** English copy of the home. Structure is pinned by `HomeCopy` (pt-BR.ts). */
export const homeCopy: HomeCopy = {
  meta: {
    title: "flyee.club | Your AI tools, always working",
    description:
      "A harness and tools for Claude Code, Codex, Gemini CLI and Cursor, updated whenever the AIs change. In English and Portuguese, in the AI you already use.",
  },

  hero: {
    eyebrow: "A tool club for AI",
    title: "AI changes every week.\n**Your tools keep working.**",
    subtitle:
      "flyee.club installs a harness in the AI you already use and keeps skills, workflows and rules up to date when Claude, Codex or the APIs change.",
    primaryCta: "Create account",
    secondaryCta: "See plans",
    note: "You use your own AI plan or API. The club never spends credits on your side.",
    highlights: [
      "Claude Code, Codex, Gemini CLI and Cursor",
      "English and Portuguese",
      "Checksums and declared permissions",
    ],
    mediaLabel: "flyee.club catalog",
  },

  steps: {
    eyebrow: "How it works",
    title: "From sign-up to a tool running in your AI",
    items: [
      {
        title: "Create your account and pick your access",
        body: "The starter kit unlocks the catalog and its updates. The subscription adds advanced lessons, recipes and meetings.",
      },
      {
        title: "Install with one command",
        body: "The installer puts the harness on your machine and links it to your account with a token.",
      },
      {
        title: "Use it in the AI you already use",
        body: "Skills, workflows and rules become available in Claude Code, Codex, Gemini CLI or Cursor.",
      },
      {
        title: "Update when the AI changes",
        body: "Every tool ships new versions with a changelog and a checksum. You update with one command.",
      },
    ],
  },

  cta: {
    title: "Start by creating your account",
    subtitle: "Then pick your access and install.",
    label: "Create account",
  },
};
