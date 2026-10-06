import type { EmailCopy } from "./pt-BR";

/** English copy of every e-mail. The structure is pinned by `EmailCopy` (pt-BR.ts). */
export const emailCopy: EmailCopy = {
  shell: {
    signature: "FlyeeClub · apps that run in the AI you already use",
  },

  memberWelcome: {
    subject: "Your FlyeeClub account is ready",
    preview: "Three steps to install your first app",
    heading: "Your account is ready",
    greeting: (name) => (name ? `${name}, your FlyeeClub account is ready.` : "Your FlyeeClub account is ready."),
    body: "FlyeeClub is a store of apps that run in the AI you already use, such as Claude Code and Codex. To get started:",
    steps: [
      "Choose your access under Billing, in the dashboard.",
      "In the terminal, run npx flyee login and approve the connection in the browser.",
      "Install your first app with npx flyee add and the name of the app.",
    ],
    button: "Open the dashboard",
    reason: "You are receiving this message because you created a FlyeeClub account.",
  },

  accessReceipt: {
    subject: (plan) => `${plan}: payment confirmed`,
    preview: "The apps in the store and their updates are on your account",
    heading: "Access is yours",
    greeting: (name) => (name ? `${name}, your payment is confirmed.` : "Your payment is confirmed."),
    body: (amount, plan) => `We received ${amount} for ${plan}.`,
    unlocked: (until) =>
      until
        ? `Every app in the store and its updates are on your account until ${until}.`
        : "Every app in the store and its updates are on your account, with no expiry date.",
    next: "To get started:",
    steps: [
      "Open the dashboard and connect your terminal with npx flyee login.",
      "Install your first app in the AI you use.",
    ],
    button: "Open the dashboard",
    fiscal: "The tax invoice is issued by Asaas and arrives in a separate email.",
    keep: "Keep this message: it is your purchase receipt.",
  },

  subscriptionActive: {
    subject: (plan) => `Payment confirmed: ${plan}`,
    preview: (plan) => `${plan} is live on your account`,
    heading: "Payment confirmed",
    greeting: (name, plan) => (name ? `${name}, ${plan} is live on your account.` : `${plan} is live on your account.`),
    includes: "What it unlocks:",
    features: {
      catalog_access: "Every app in the store, upcoming ones included, with updates",
      devices: (count) =>
        count === 1 ? "1 connected computer" : `Up to ${count} computers connected at the same time`,
      advanced_lessons: "Advanced guides",
      recipes: "Ready-made recipes",
      roadmap_vote: "A vote on what joins the store",
      meetings: "Live sessions",
      commercial_license: "Commercial license for client projects",
      open_the_hood: "The open-the-hood depth",
    },
    button: "Open the dashboard",
    manage: "Invoices and the subscription are under Settings, Billing.",
  },

  subscriptionCanceled: {
    subject: (plan) => `${plan}: subscription ended`,
    preview: "What stays and what stops arriving",
    heading: "Your subscription has ended",
    cause: {
      requested: (plan, date) => `${plan} ended on ${date}, as you asked.`,
      payment: (plan, date) => `${plan} ended on ${date} because the payment was not confirmed.`,
      term: (plan, date) => `${plan} ended on ${date}: the paid period is over.`,
      ended: (plan, date) => `${plan} ended on ${date}.`,
    },
    keepsTitle: "What stays:",
    keepsInstalled: "The apps you installed keep working on your computer.",
    keepsAccess: (plan) =>
      plan
        ? `Access to the store and its updates continues (${plan}).`
        : "Access to the store and its updates continues.",
    stopsTitle: "What stops arriving:",
    stopsUpdates: "New versions of the apps, and new apps.",
    stopsBenefits:
      "What came with the subscription, such as advanced guides, live sessions and the vote on what joins the store.",
    button: "See the plans",
    back: "To come back, choose a plan under Settings, Billing.",
  },

  accessEnded: {
    subject: (plan) => `${plan}: your access has ended`,
    preview: "What stays and what stops arriving",
    heading: "Your access has ended",
    body: (plan, date) => `${plan} ended on ${date}. Access does not renew by itself.`,
    keepsTitle: "What stays:",
    keepsInstalled: "The apps you installed keep working on your computer.",
    stopsTitle: "What stops arriving:",
    stopsUpdates: "New versions of the apps, and new apps.",
    button: "Renew access",
    back: "To receive updates again, buy the access again under Settings, Billing.",
  },

  termEnding: {
    subject: (plan, date) => `${plan}: the paid period ends on ${date}`,
    preview: "A one-time purchase does not renew by itself",
    heading: "The paid period is ending",
    body: (plan, date) =>
      `${plan} was a one-time purchase, which does not renew by itself. The paid period runs until ${date}.`,
    next: "To continue after that date, make a new purchase under Billing. The apps you installed keep working either way.",
    button: "Open Billing",
  },

  tokenReminder: {
    subject: (days) =>
      days <= 1
        ? "Your computer's connection expires within 24 hours"
        : `Your computer's connection expires in ${days} days`,
    preview: "One update renews it for another 30 days",
    heading: "Time to update",
    body: (device, days) => {
      const machine = device ? `The connection of your computer "${device}"` : "Your computer's connection";
      return days <= 1
        ? `${machine} to FlyeeClub expires within 24 hours.`
        : `${machine} to FlyeeClub expires in ${days} days.`;
    },
    how: "Run this command in the terminal to renew it for another 30 days:",
    command: "npx flyee update",
    after:
      "If it expires, nothing is uninstalled: the apps keep working, and the installer asks you to confirm your access in the dashboard before it downloads new versions.",
    button: "See my computers",
    reason: "This is a notice about your account. It is sent even to people who do not receive news.",
  },

  updatesDigest: {
    subject: (count) => (count === 1 ? "1 of your apps has a new version" : `${count} of your apps have a new version`),
    preview: "One command updates them all",
    heading: "New versions of your apps",
    intro: "New versions are out for apps you have installed:",
    item: (app, from, to) => `${app}: ${from} to ${to}`,
    how: "To update them all at once, run in the terminal:",
    command: "npx flyee update",
    button: "See what changed",
    reason: "You receive this weekly summary because you have apps installed.",
    unsubscribe: "Stop receiving the summary",
  },

  leadConfirm: {
    subject: "Confirm your spot on the FlyeeClub waitlist",
    preview: "One click to join the FlyeeClub waitlist",
    heading: "Confirm your spot",
    body: "We received a request to add this address to the FlyeeClub waitlist. Confirm with the button below and we will let you know when it opens.",
    button: "Confirm my spot",
    expiry: "The link is valid for 7 days.",
    ignore: "Not you? Ignore this message: unconfirmed addresses are deleted after 7 days and receive nothing else.",
  },

  newsletter: {
    reason: "You receive this email because you joined the FlyeeClub list.",
    unsubscribe: "Leave the list",
  },

  meeting: {
    confirmation: {
      subject: (title) => `You are registered: ${title}`,
      heading: "You are registered",
      body: (title) => `Your registration for ${title} is confirmed.`,
      button: "Open the session",
    },
    day: {
      subject: (title) => `Reminder: ${title}`,
      heading: "The session is within 24 hours",
      body: (title) => `${title} takes place within the next 24 hours.`,
      button: "Open the session",
    },
    hour: {
      subject: (title) => `Starting in less than an hour: ${title}`,
      heading: "Starting in less than an hour",
      body: (title) => `${title} starts in less than an hour. The room opens 15 minutes before.`,
      button: "Open the session",
    },
    recording: {
      subject: (title) => `The recording is available: ${title}`,
      heading: "The recording is available",
      body: (title) => `${title} has ended and the recording is now in the dashboard.`,
      button: "Watch the recording",
    },
    when: "When:",
    reason:
      "You receive this notice because you registered for this session. To stop receiving them, cancel your registration on the session page.",
  },
};
