import type { HomeCopy } from "./pt-BR";

/** English copy of the home. Structure is pinned by `HomeCopy` (pt-BR.ts); the text follows docs/HOME-COPY.md. */
export const homeCopy: HomeCopy = {
  meta: {
    title: "flyee.club: apps that automate your business in your AI",
    description:
      "Apps that automate sales, content, video and product work inside Claude Code, Codex or your favorite AI. Install with one command and update when AI changes.",
  },

  hero: {
    eyebrow: "An app store for your AI",
    newLabel: "New",
    title: "Apps that automate your company's work in **your favorite AI**.",
    subtitle:
      "Sales, content, video, research and product: every repetitive task becomes an app that runs in Claude Code, Codex or the AI you already use. For your business, your agency, your digital product or your dev work.",
    secondaryCta: "Is flyee for me?",
    note: "One year of access, one payment. You use your own AI plan.",
    stripLabel: "Works with the AI you already use",
    store: {
      label: "The flyee app store, with the published apps",
      allLabel: "All",
      installLabel: "Install",
      appsLabel: "apps in the store",
    },
    terminal: {
      title: "~/my-project",
      label: "A terminal updating the flyee apps installed in a project",
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
    title: "Need it? There's an app for it in flyee.",
    subtitle: "Each app automates one task. Open it, see what it does and install it in your Claude with one command.",
    categoriesLabel: "Store categories",
    allLabel: "All",
    featuredLabel: "Featured",
    newBadge: "New",
    updatedOn: "Updated on {date}",
    viewApp: "See the app",
    terminalLabel: "The command that installs the featured app",
    installed: "{app} {version} installed",
    verified: "sha256 checksum verified",
    request: {
      title: "Request an app",
      body: "Can't find it? Members vote on the next app that joins the store.",
      badge: "Membership",
      link: "See what the membership includes",
    },
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
        title: "Get your access",
        body: "You pick your access and the app store opens in your account.",
      },
      {
        kicker: "login",
        title: "Install it in your Claude",
        body: "In the terminal, run npx flyee login and approve in the browser. The dashboard shows every command ready to copy.",
      },
      {
        kicker: "add",
        title: "Install the apps you need",
        body: "Pick one in the store and run npx flyee add with the app's name. To get new versions, npx flyee update.",
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
        body: "The apps use your own AI plan and keep what they produce in files on your computer. flyee does not charge per use.",
      },
      {
        title: "Updated when AI changes",
        body: "AI changes every week. When it does, we update the app and you run one command.",
      },
    ],
  },

  origin: {
    eyebrow: "Where the apps come from",
    title: "Every app here has already run in a real product.",
    body: "Every flyee app was built for real work before it joined the store. They are built by Bruno Santana, a product engineer who maintains seven systems in production across health, credit and pharma. The flyee core is the same one that runs in two of those products.",
    facts: ["Seven systems in production", "Health", "Credit", "Pharma"],
  },

  access: {
    eyebrow: "Access",
    title: "Choose how to get in.",
    subtitle:
      "Access is a one-time payment, valid for 1 year, that unlocks every app in the store, with updates. The membership adds advanced guides, live sessions, a vote on what joins the store and more computers.",
    requirementsTitle: "What you need",
    requirements: [
      {
        title: "A terminal AI",
        body: "Claude Code, Codex, Gemini CLI or Cursor, on your own plan or API key.",
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
        answer:
          "With access, on one: one user, on one machine. The membership and Pro allow more computers connected at the same time.",
      },
      {
        question: "Do I need to know how to code?",
        answer:
          "Not to use it. To install, you copy and paste a few commands in the terminal, and the dashboard shows each one ready to copy.",
      },
      {
        question: "Does it work in the Claude or ChatGPT app, without a terminal?",
        answer: "Not yet. Today flyee runs in terminal AIs: Claude Code, Codex, Gemini CLI and Cursor.",
      },
      {
        question: "Is there an AI cost on top of the access?",
        answer:
          "Your own AI plan. flyee does not charge per use; some apps use your account on outside services, and each app's page says so.",
      },
      {
        question: "What happens if I go a while without updating?",
        answer:
          "Nothing is uninstalled; what is on your machine stays the same. After 30 days without updating, the installer asks you to confirm your access in the dashboard before it downloads the new version.",
      },
      {
        question: "Can I use it in client projects?",
        answer: "Yes. Access covers your own projects and your clients' projects.",
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
    subtitleOpen: "Get your access, install it in your Claude and use your first app today. You use your own AI plan.",
    subtitleWaitlist: "Join the waitlist and we will tell you when the store opens. You will use your own AI plan.",
  },
};
