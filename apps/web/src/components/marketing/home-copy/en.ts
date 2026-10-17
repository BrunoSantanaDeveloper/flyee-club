import type { HomeCopy } from "./pt-BR";

/** English copy of the home. Structure is pinned by `HomeCopy` (pt-BR.ts); the text follows docs/HOME-COPY.md. */
export const homeCopy: HomeCopy = {
  meta: {
    title: "FlyeeClub: apps that automate your business in your AI",
    description:
      "Apps that automate sales, content, video and product work inside Claude Code, Codex or your favorite AI. Your AI installs each app and updates it when you ask.",
  },

  hero: {
    eyebrow: "An app store for your AI",
    newLabel: "New",
    title: "Apps that automate your company's work in **your favorite AI**.",
    subtitle:
      "Sales, content, video, research and product: every repetitive task becomes an app that runs in Claude Code, Codex or the AI you already use. For your business, your agency, your digital product or your dev work.",
    secondaryCta: "Is FlyeeClub for me?",
    note: "One year of access, one payment. You use your own AI plan.",
    stripLabel: "Works with the AI you already use",
    store: {
      title: "App store",
      label: "The apps published in the FlyeeClub store",
      allLabel: "All",
      appsLabel: "apps in the store",
      updatedLabel: "Last update",
    },
    terminal: {
      title: "~/my-project",
      label: "What your AI runs when it updates the FlyeeClub apps of a project",
      checking: "Checking 3 installed apps…",
      updated: "product-scope updated: 1.4.0 → 1.6.0",
      changelog: "Changelog: follows the new Claude Code skills format",
      verified: "sha256 checksum verified",
    },
    chips: {
      versions: "1.4.0 → 1.6.0",
      checksum: "sha256 verified",
    },
  },

  store: {
    eyebrow: "App store",
    title: "Need it? There's an app for it in FlyeeClub.",
    subtitle: "Each app automates one task. Open it, see what it does and ask your AI to install it.",
    categoriesLabel: "Store categories",
    allLabel: "All",
    featuredLabel: "Featured",
    newBadge: "New",
    usesAccount: "Uses your {service} account",
    updatedOn: "Updated on {date}",
    viewApp: "See the app",
    featured: {
      slug: "youtube-script",
      request:
        "I want to record a video of about 10 minutes on how to prep a week of lunches without getting tired of them. Can you help with the script?",
      reply: [
        { label: "Title", text: "A week of lunches in 1 hour, no repeats" },
        {
          label: "Hook · 0:00",
          text: "By Wednesday you can't face the same food again. The problem isn't the recipe, it's the order you cook in.",
        },
        { label: "Block 1 · 0:30", text: "Five bases that turn into ten different dishes" },
        { label: "Block 2 · 3:00", text: "The cooking order that fits in one hour" },
        { label: "Block 3 · 6:30", text: "How to store it so it lasts until Friday" },
        { label: "Close · 9:10", text: "What to try in your first week" },
      ],
      saved: "Saved to roteiros/meal-prep-week/estrutura.md",
    },
    showcase: {
      context: "In your AI",
      caption: "Example of {app} answering a request in your AI",
    },
    carouselLabel: "The apps in the store",
    previous: "Previous apps",
    next: "Next apps",
    footnote: "No modules to watch. You install the app and use it; each one comes with a short guide.",
    allApps: "See all apps",
    emptyTitle: "The first apps are on their way",
    emptyBody:
      "The store opens with apps that already run in production. This section shows each one as soon as it is published.",
    unavailableTitle: "The store did not load right now",
    unavailableBody: "Try again in a moment or open the app store.",
  },

  steps: {
    eyebrow: "How it works",
    title: "Three steps and you are in.",
    items: [
      {
        kicker: "access",
        title: "Join FlyeeClub",
        body: "One payment, valid for 1 year, and the app store opens in your account.",
      },
      {
        kicker: "login",
        title: "Install it in your Claude",
        body: "Ask your AI: install flyee by following flyee.club/en/install.md. It runs the installer and you only approve the connection in the browser.",
        bodyWaitlist:
          "You ask in the conversation, your AI runs the installer and you only approve the connection in the browser.",
      },
      {
        kicker: "add",
        title: "Install the apps you need",
        body: "Pick one in the store and ask your AI for the app, by name. To get new versions, ask it to update.",
      },
    ],
  },

  why: {
    eyebrow: "Why a store",
    title: "Why an app store, and not one more subscription?",
    items: [
      {
        title: "One place",
        body: "Instead of one service per task, the apps live together, in the same agent and the same project.",
      },
      {
        title: "Runs on what you have",
        body: "The apps use your own AI plan and keep what they produce in files on your computer. FlyeeClub does not charge per use.",
      },
      {
        title: "Updated when AI changes",
        body: "AI changes every week. When it does, we update the app and your AI installs the new version when you ask.",
      },
    ],
  },

  origin: {
    eyebrow: "Where the apps come from",
    title: "Every app here has already run in a real product.",
    body: "Every FlyeeClub app was built for real work before it joined the store. They are built by Bruno Santana, a product engineer who maintains seven systems in production across health, credit and pharma. The FlyeeClub core is the same one that runs in two of those products.",
    facts: ["Seven systems in production", "Health", "Credit", "Pharma"],
  },

  access: {
    eyebrow: "Access",
    title: "Get your access.",
    subtitle: "FlyeeClub is a one-time payment, valid for 1 year, that gives you every app in the store, with updates.",
    requirementsTitle: "What you need",
    requirements: [
      {
        title: "A terminal AI",
        body: "Claude Code, Codex, Gemini CLI or Cursor, on your own plan or API key. Each app's page says which ones it was tested on.",
      },
      {
        title: "A computer of your own",
        body: "A computer where you can install software. The installer runs on Node.js.",
      },
      {
        title: "Accounts on other services",
        body: "Some apps use your account on outside services, and each app's page says which one.",
      },
    ],
  },

  faq: {
    eyebrow: "Before you join",
    title: "Questions",
    items: [
      {
        question: "Is this a course?",
        answer:
          "No. It is an app store you install and use in your work. Each app comes with a short guide, made for you to start using it, not watching.",
      },
      {
        question: "On how many computers can I use it?",
        answer: "One. Each access is for one person, on one machine.",
      },
      {
        question: "Do I need to know how to code?",
        answer:
          "No. Your AI installs and updates for you: you ask in the conversation, confirm what it is about to do and approve the connection in the browser.",
      },
      {
        question: "Does it work in the Claude or ChatGPT app, without a terminal?",
        answer: "Not yet. Today FlyeeClub runs in terminal AIs: Claude Code, Codex, Gemini CLI and Cursor.",
      },
      {
        question: "Is there an AI cost on top of the access?",
        answer:
          "Your own AI plan. FlyeeClub does not charge per use; some apps use your account on outside services, and each app's page says so.",
      },
      {
        question: "What happens if I go a while without updating?",
        answer:
          "Nothing is uninstalled; what is on your machine stays the same. After 30 days without updating, the installer asks you to confirm your access in the dashboard before it downloads the new version.",
      },
      {
        question: "Can I use it in client projects?",
        answer: "Yes. FlyeeClub covers your own projects and your clients' projects.",
      },
      {
        question: "Which languages?",
        answer: "Apps, guides and the dashboard in Portuguese and English.",
      },
      {
        question: "What if it is not for me?",
        answer: "Within the guarantee period, you ask support for a full refund.",
      },
    ],
  },

  cta: {
    title: "Next time you need it, there will already be an app.",
    subtitleOpen: "Join FlyeeClub, install it in your Claude and use your first app today. You use your own AI plan.",
    subtitleWaitlist: "Join the waitlist and we will tell you when the store opens. You will use your own AI plan.",
  },
};
