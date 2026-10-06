import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { emailCopyFor } from "./copy";
import type { EmailLocale } from "./locale";
import AccessEndedEmail from "./templates/access-ended";
import ContactFormEmail from "./templates/contact-form";
import KitReceiptEmail from "./templates/kit-receipt";
import LeadConfirmEmail from "./templates/lead-confirm";
import MeetingEmail, { type MeetingEmailKind } from "./templates/meeting";
import MemberWelcomeEmail from "./templates/member-welcome";
import NewsletterEmail from "./templates/newsletter";
import SubscriptionActiveEmail, { unlockedLines } from "./templates/subscription-active";
import SubscriptionCanceledEmail from "./templates/subscription-canceled";
import TermEndingEmail from "./templates/term-ending";
import TokenReminderEmail from "./templates/token-reminder";
import UpdatesDigestEmail, { DIGEST_LIMIT } from "./templates/updates-digest";

const LOCALES: EmailLocale[] = ["pt-BR", "en"];
const APP = "https://flyee.club/inicio";
const UNSUBSCRIBE = "https://flyee.club/api/public/email/unsubscribe?k=m&t=00000000-0000-4000-8000-000000000000";

/**
 * The text a reader sees, on one line: the plain-text rendering wraps at 80
 * columns, so a sentence would otherwise be cut wherever the wrap falls.
 */
async function textOf(element: ReactElement): Promise<string> {
  return (await render(element, { plainText: true })).replace(/\s+/g, " ");
}

/** The address as it is written inside an HTML attribute. */
const inHtml = (url: string) => url.replaceAll("&", "&amp;");

/** The blocks of a message in order (paragraphs, links, headings, rules): its shape, whatever the words. */
const shapeOf = (html: string): string => (html.match(/<(p|a|h[1-6]|li|ul|ol|hr)\b/g) ?? []).join(" ");

/** Every template in every language, with the props a real send would carry. */
function every(locale: EmailLocale): Record<string, ReactElement> {
  const kinds: MeetingEmailKind[] = ["confirmation", "day", "hour", "recording"];
  return {
    "member-welcome": createElement(MemberWelcomeEmail, { locale, name: "Ana", appUrl: APP }),
    "kit-receipt": createElement(KitReceiptEmail, {
      locale,
      name: "Ana",
      planName: "Kit flyee",
      amountLabel: "R$ 97",
      untilLabel: null,
      fiscalNote: true,
      appUrl: APP,
    }),
    "subscription-active": createElement(SubscriptionActiveEmail, {
      locale,
      name: null,
      planName: "Assinatura flyee",
      limits: { catalog_access: 1, devices: 3, advanced_lessons: 1, recipes: 1, roadmap_vote: 1, meetings: 1 },
      appUrl: APP,
    }),
    "subscription-canceled": createElement(SubscriptionCanceledEmail, {
      locale,
      planName: "Assinatura flyee",
      cause: "requested",
      endedLabel: "2026-10-02",
      keptAccess: null,
      billingUrl: APP,
    }),
    "access-ended": createElement(AccessEndedEmail, {
      locale,
      planName: "Acesso flyee",
      endedLabel: "2026-10-02",
      billingUrl: APP,
    }),
    "term-ending": createElement(TermEndingEmail, {
      locale,
      planName: "Assinatura flyee",
      endsLabel: "2026-10-17",
      billingUrl: APP,
    }),
    "token-reminder": createElement(TokenReminderEmail, {
      locale,
      deviceName: "notebook",
      daysLeft: 5,
      devicesUrl: APP,
    }),
    "updates-digest": createElement(UpdatesDigestEmail, {
      locale,
      items: [{ name: "Deploy check", from: "1.1.0", to: "1.2.0" }],
      newsUrl: APP,
      unsubscribeUrl: UNSUBSCRIBE,
    }),
    "lead-confirm": createElement(LeadConfirmEmail, { locale, confirmUrl: APP }),
    newsletter: createElement(NewsletterEmail, {
      locale,
      heading: "The store is open",
      bodyMarkdown: "The store **opened** today.\n\n- one\n- two\n\n[Open it](https://flyee.club)",
      unsubscribeUrl: UNSUBSCRIBE,
    }),
    ...Object.fromEntries(
      kinds.map((kind) => [
        `meeting-${kind}`,
        createElement(MeetingEmail, {
          locale,
          kind,
          title: "Sessão de outubro",
          whenLabel: "2026-10-09 19:00",
          meetingUrl: APP,
        }),
      ]),
    ),
  };
}

describe("e-mail templates", () => {
  for (const locale of LOCALES) {
    it(`render in ${locale} with the language on the document and no template leftovers`, async () => {
      for (const [name, element] of Object.entries(every(locale))) {
        const html = await render(element);
        expect(html, name).toContain(`lang="${locale}"`);
        // A function of the copy that reached the page unrendered, or a missing value.
        expect(html, name).not.toMatch(/undefined|\[object Object\]|=&gt;|NaN/);
        expect(html, name).toContain(emailCopyFor(locale).shell.signature.split(" · ")[0]);
      }
    });
  }

  it("has the same blocks in the same order in both languages", async () => {
    const pt = every("pt-BR");
    const en = every("en");
    for (const name of Object.keys(pt)) {
      const [ptHtml, enHtml] = await Promise.all([render(pt[name]), render(en[name])]);
      expect(shapeOf(ptHtml).length, name).toBeGreaterThan(0);
      expect(shapeOf(enHtml), name).toBe(shapeOf(ptHtml));
    }
  });

  it("only the messages a reader may stop carry an unsubscribe link", async () => {
    for (const locale of LOCALES) {
      for (const [name, element] of Object.entries(every(locale))) {
        const html = await render(element);
        const stoppable = name === "updates-digest" || name === "newsletter";
        expect(html.includes(inHtml(UNSUBSCRIBE)), `${name} (${locale})`).toBe(stoppable);
      }
    }
  });
});

describe("what a plan unlocks", () => {
  it("lists only what the limits grant, and the plan's own number of computers", () => {
    expect(unlockedLines("en", { catalog_access: 1, devices: 1 })).toEqual([
      "Every app in the store, upcoming ones included, with updates",
      "1 connected computer",
    ]);
    const pro = unlockedLines("pt-BR", {
      catalog_access: 1,
      devices: 5,
      advanced_lessons: 1,
      recipes: 1,
      roadmap_vote: 1,
      meetings: 1,
      commercial_license: 1,
      open_the_hood: 1,
    });
    expect(pro).toHaveLength(8);
    expect(pro.at(-1)).toBe("Até 5 computadores conectados ao mesmo tempo");
  });

  it("mentions nothing for a flag that is off, missing or not a number", () => {
    expect(unlockedLines("pt-BR", { catalog_access: 0, devices: 0, meetings: "1" })).toEqual([]);
    expect(unlockedLines("en", {})).toEqual([]);
  });
});

describe("the receipt", () => {
  it("states the end date the grant has, or that it has none", async () => {
    const base = {
      locale: "pt-BR" as const,
      name: null,
      planName: "Kit flyee",
      amountLabel: "R$ 97",
      fiscalNote: false,
      appUrl: APP,
    };
    expect(await textOf(createElement(KitReceiptEmail, { ...base, untilLabel: null }))).toContain(
      "sem prazo para acabar",
    );
    const dated = await textOf(createElement(KitReceiptEmail, { ...base, untilLabel: "2 de outubro de 2027" }));
    expect(dated).toContain("até 2 de outubro de 2027");
    expect(dated).not.toContain("sem prazo");
  });

  it("mentions the tax invoice only for a purchase that has one", async () => {
    const base = {
      locale: "en" as const,
      name: "Ana",
      planName: "Kit",
      amountLabel: "$29",
      untilLabel: null,
      appUrl: APP,
    };
    expect(await textOf(createElement(KitReceiptEmail, { ...base, fiscalNote: false }))).not.toContain("Asaas");
    expect(await textOf(createElement(KitReceiptEmail, { ...base, fiscalNote: true }))).toContain("Asaas");
  });
});

describe("the end of a subscription", () => {
  const base = { locale: "en" as const, planName: "Club", endedLabel: "October 2, 2026", billingUrl: APP };

  it("says updates stop only when nothing else unlocks the store", async () => {
    const without = await textOf(
      createElement(SubscriptionCanceledEmail, { ...base, cause: "requested", keptAccess: null }),
    );
    expect(without).toContain("New versions of the apps");
    const withKit = await textOf(
      createElement(SubscriptionCanceledEmail, { ...base, cause: "requested", keptAccess: { by: "Kit flyee" } }),
    );
    expect(withKit).not.toContain("New versions of the apps");
    expect(withKit).toContain("continues (Kit flyee)");
    const unnamed = await textOf(
      createElement(SubscriptionCanceledEmail, { ...base, cause: "requested", keptAccess: { by: null } }),
    );
    expect(unnamed).toContain("Access to the store and its updates continues.");
    expect(unnamed).not.toContain("New versions of the apps");
  });

  it("gives the reason it ended", async () => {
    const text = (cause: "requested" | "payment" | "term" | "ended") =>
      textOf(createElement(SubscriptionCanceledEmail, { ...base, cause, keptAccess: null }));
    expect(await text("requested")).toContain("as you asked");
    expect(await text("payment")).toContain("payment was not confirmed");
    expect(await text("term")).toContain("paid period is over");
    expect(await text("ended")).toContain("Club ended on October 2, 2026.");
  });
});

describe("the weekly summary", () => {
  it("lists at most the limit by name and counts every app in the subject", async () => {
    const items = Array.from({ length: DIGEST_LIMIT + 3 }, (_, index) => ({
      name: `app-${index}`,
      from: "1.0.0",
      to: "1.1.0",
    }));
    const text = await textOf(
      createElement(UpdatesDigestEmail, { locale: "en", items, newsUrl: APP, unsubscribeUrl: UNSUBSCRIBE }),
    );
    expect(text).toContain(`app-${DIGEST_LIMIT - 1}:`);
    expect(text).not.toContain(`app-${DIGEST_LIMIT}:`);
    expect(emailCopyFor("en").updatesDigest.subject(items.length)).toBe(
      `${DIGEST_LIMIT + 3} of your apps have a new version`,
    );
    expect(emailCopyFor("pt-BR").updatesDigest.subject(1)).toBe("1 app seu tem versão nova");
  });
});

describe("the connection reminder", () => {
  it("never says a number of days that reads wrong", () => {
    const { subject, body } = emailCopyFor("pt-BR").tokenReminder;
    expect(subject(5)).toContain("5 dias");
    expect(subject(1)).toContain("24 horas");
    expect(body(null, 1)).toContain("do seu computador");
    expect(body("notebook", 3)).toContain('do computador "notebook"');
  });
});

describe("the internal contact notice", () => {
  it("keeps the visitor's line breaks and is written for the operator", async () => {
    const html = await render(
      createElement(ContactFormEmail, { name: "Ana", email: "ana@example.com", message: "one\ntwo" }),
    );
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain("pre-wrap");
    expect(html).toContain("ana@example.com");
  });
});
