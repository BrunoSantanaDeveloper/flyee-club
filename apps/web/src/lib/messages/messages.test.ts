import { type BellCopy, bellCopyFor, type BellText, toBellLocale } from "./bell-copy";
import {
  dateLabel,
  dateTimeLabel,
  DEFAULT_TIME_ZONE,
  isoWeekKey,
  localizedText,
  memberUrl,
  moneyLabel,
  UNSUBSCRIBE_PATH,
  unsubscribeUrl,
  wholeDaysLeft,
} from "./format";
import { describe, expect, it } from "vitest";

/** Every notice of the bell, written with the arguments a real call would carry. */
const notices = (copy: BellCopy): Record<keyof BellCopy, BellText> => ({
  welcome: copy.welcome(),
  planActive: copy.planActive("Assinatura flyee"),
  accessGranted: copy.accessGranted("Acesso flyee", "6 de outubro de 2027"),
  accessEnded: copy.accessEnded("Acesso flyee", "6 de outubro de 2027"),
  paymentRecovered: copy.paymentRecovered(),
  paymentFailed: copy.paymentFailed(7),
  subscriptionEnded: copy.subscriptionEnded("Assinatura flyee", false),
  termEnding: copy.termEnding("Assinatura flyee", "17 de outubro de 2026"),
  tokenReminder: copy.tokenReminder("notebook", 5),
  updatesAvailable: copy.updatesAvailable(3),
  meetingDay: copy.meetingDay("Sessão de outubro", "sexta-feira, 9 de outubro, 19:00 BRT"),
  meetingHour: copy.meetingHour("Sessão de outubro"),
  meetingRecording: copy.meetingRecording("Sessão de outubro"),
  supportAccess: copy.supportAccess("Ana", "pagamento duplicado", 30),
});

describe("bell copy", () => {
  it("writes every notice in both languages, with a title and a body and no leftovers", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const written = notices(bellCopyFor(locale));
      // A notice added to one language and not listed here fails the build (the Record is exhaustive).
      expect(Object.keys(written).sort()).toEqual(Object.keys(bellCopyFor(locale)).sort());
      for (const [name, notice] of Object.entries(written)) {
        expect(notice.title.trim().length, `${name} (${locale})`).toBeGreaterThan(0);
        expect(notice.body.trim().length, `${name} (${locale})`).toBeGreaterThan(0);
        expect(`${notice.title} ${notice.body}`, `${name} (${locale})`).not.toMatch(/undefined|null|NaN|\[object/);
      }
    }
  });

  it("calls a plan by the name it has in the data", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const copy = bellCopyFor(locale);
      expect(copy.planActive("Plano Qualquer").body).toContain("Plano Qualquer");
      expect(copy.accessGranted("Plano Qualquer", null).body).toContain("Plano Qualquer");
      expect(copy.accessGranted("Plano Qualquer", "x").body).toContain("Plano Qualquer");
      expect(copy.accessEnded("Plano Qualquer", "x").body).toContain("Plano Qualquer");
      expect(copy.subscriptionEnded("Plano Qualquer", true).body).toContain("Plano Qualquer");
      expect(copy.termEnding("Plano Qualquer", "x").body).toContain("Plano Qualquer");
    }
  });

  it("states the end of an access only when it has one", () => {
    expect(bellCopyFor("pt-BR").accessGranted("Acesso", "6 de outubro de 2027").body).toContain(
      "até 6 de outubro de 2027",
    );
    expect(bellCopyFor("pt-BR").accessGranted("Acesso", null).body).not.toContain("até");
    expect(bellCopyFor("en").accessGranted("Access", "October 6, 2027").body).toContain("until October 6, 2027");
  });

  it("says updates stop only when nothing else unlocks the store", () => {
    const copy = bellCopyFor("pt-BR");
    expect(copy.subscriptionEnded("Assinatura", false).body).toContain("as versões novas deixam de chegar");
    expect(copy.subscriptionEnded("Assinatura", true).body).toContain("continua");
    expect(copy.subscriptionEnded("Assinatura", true).body).not.toContain("deixam de chegar");
  });

  it("never states a count that reads wrong", () => {
    const pt = bellCopyFor("pt-BR");
    const en = bellCopyFor("en");
    expect(pt.paymentFailed(1).body).toContain("em até 1 dia ");
    expect(pt.paymentFailed(3).body).toContain("em até 3 dias ");
    expect(pt.paymentFailed(0).body).not.toMatch(/\d/);
    expect(en.paymentFailed(1).body).toContain("within 1 day ");
    expect(pt.tokenReminder(null, 1).title).toContain("24 horas");
    expect(pt.tokenReminder(null, 4).title).toContain("4 dias");
    expect(pt.tokenReminder(null, 4).body).not.toContain("do computador");
    expect(pt.updatesAvailable(1).title).toBe("1 app seu tem versão nova");
    expect(en.updatesAvailable(2).title).toBe("2 of your apps have a new version");
  });

  it("names the operator of a support access, or the team when there is no name", () => {
    expect(bellCopyFor("pt-BR").supportAccess(null, "motivo", 30).body).toContain("A equipe de suporte");
    expect(bellCopyFor("en").supportAccess("Ana", "reason", 30).body).toContain("Ana opened your account");
  });

  it("reads anything that is not English as Portuguese", () => {
    expect(toBellLocale("en")).toBe("en");
    expect(toBellLocale("pt-BR")).toBe("pt-BR");
    expect(toBellLocale(null)).toBe("pt-BR");
    expect(toBellLocale("fr")).toBe("pt-BR");
  });
});

describe("dates and amounts in a message", () => {
  it("writes a date on the reader's own calendar day", () => {
    // 01:30 UTC on October 3 is still October 2 in São Paulo, and already October 3 in Lisbon.
    const moment = "2026-10-03T01:30:00Z";
    expect(dateLabel(moment, "pt-BR")).toBe("2 de outubro de 2026");
    expect(dateLabel(moment, "pt-BR", "Europe/Lisbon")).toBe("3 de outubro de 2026");
    expect(dateLabel(moment, "en", "America/Sao_Paulo")).toBe("October 2, 2026");
  });

  it("falls back to the home clock for a time zone the runtime does not know", () => {
    const moment = "2026-10-03T01:30:00Z";
    expect(dateLabel(moment, "en", "Mars/Olympus")).toBe(dateLabel(moment, "en", DEFAULT_TIME_ZONE));
    expect(dateLabel(moment, "en", null)).toBe(dateLabel(moment, "en", DEFAULT_TIME_ZONE));
  });

  it("writes when a session starts with the weekday, the hour and the zone", () => {
    const start = "2026-10-09T22:00:00Z";
    const brasilia = dateTimeLabel(start, "pt-BR", "America/Sao_Paulo");
    expect(brasilia).toContain("sexta-feira");
    expect(brasilia).toContain("9 de outubro");
    expect(brasilia).toContain("19:00");
    const newYork = dateTimeLabel(start, "en", "America/New_York");
    expect(newYork).toContain("Friday");
    expect(newYork).toContain("October 9");
    expect(newYork).toMatch(/0?6:00\sPM/);
  });

  it("writes an amount in its own currency, without decimals it does not have", () => {
    expect(moneyLabel(9700, "BRL", "pt-BR").replace(/\s/g, " ")).toBe("R$ 97");
    expect(moneyLabel(2950, "USD", "en")).toBe("$29.5");
    expect(moneyLabel(2900, "USD", "en")).toBe("$29");
  });

  it("rounds the days left up, and never below one", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    expect(wholeDaysLeft("2026-10-07T11:00:00Z", now)).toBe(5);
    expect(wholeDaysLeft("2026-10-02T18:00:00Z", now)).toBe(1);
    expect(wholeDaysLeft("2026-10-01T00:00:00Z", now)).toBe(1);
  });

  it("names the ISO week a moment falls in", () => {
    expect(isoWeekKey(Date.parse("2026-10-02T12:00:00Z"))).toBe("2026-W40");
    // January 1st 2027 is a Friday: it still belongs to the last week of 2026.
    expect(isoWeekKey(Date.parse("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeekKey(Date.parse("2026-01-01T12:00:00Z"))).toBe("2026-W01");
    // Sunday and the Monday after it are in different weeks.
    expect(isoWeekKey(Date.parse("2026-10-04T23:00:00Z"))).toBe("2026-W40");
    expect(isoWeekKey(Date.parse("2026-10-05T01:00:00Z"))).toBe("2026-W41");
  });
});

describe("texts stored per language", () => {
  it("prefers the reader's language, then the other one, then the fallback", () => {
    const both = { "pt-BR": "Checagem de deploy", en: "Deploy check" };
    expect(localizedText(both, "deploy-check", "en")).toBe("Deploy check");
    expect(localizedText(both, "deploy-check", "pt-BR")).toBe("Checagem de deploy");
    expect(localizedText({ "pt-BR": "Só em português" }, "slug", "en")).toBe("Só em português");
    expect(localizedText({ en: "  " }, "slug", "en")).toBe("slug");
    expect(localizedText(null, "slug", "pt-BR")).toBe("slug");
  });
});

describe("links inside a message", () => {
  it("builds absolute addresses on the canonical host", () => {
    expect(memberUrl("/settings/devices")).toMatch(/^https?:\/\/[^/]+\/settings\/devices$/);
  });

  it("builds the unsubscribe address of a member and of a contact", () => {
    const token = "00000000-0000-4000-8000-000000000000";
    const member = new URL(unsubscribeUrl("member", token, "pt-BR"));
    expect(member.pathname).toBe(UNSUBSCRIBE_PATH);
    expect(member.searchParams.get("k")).toBe("m");
    expect(member.searchParams.get("t")).toBe(token);
    expect(member.searchParams.has("l")).toBe(false);

    const lead = new URL(unsubscribeUrl("lead", token, "en"));
    expect(lead.searchParams.get("k")).toBe("l");
    expect(lead.searchParams.get("l")).toBe("en");
  });
});
