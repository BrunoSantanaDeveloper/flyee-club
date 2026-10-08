// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { type MemberMeeting, splitMeetings } from "@/lib/member/community";
import { daysUntil } from "@/lib/member/devices";
import { lessonsForLocale } from "@/lib/member/lessons";
import { mergeNews, type NewsItem } from "@/lib/member/news";
import { decideOffers, decideServiceOffers } from "@/lib/upsell";

describe("decideOffers: what a screen offers on its own, without a click", () => {
  it("shows an account that bought nothing both offers: FlyeeClub and FlyeeClub Pro", () => {
    const expected = [
      { offer: "kit", reason: "no_access" },
      { offer: "club", reason: "beyond_apps" },
    ];
    expect(decideOffers({ tier: null, trailsUsed30d: 0 }, "home")).toEqual(expected);
    expect(decideOffers({ tier: null, trailsUsed30d: 0 }, "revalidation")).toEqual(expected);
  });

  it("offers FlyeeClub Pro on the home only when use earned it, and always at the revalidation", () => {
    expect(decideOffers({ tier: "kit", trailsUsed30d: 2 }, "home")).toEqual([]);
    expect(decideOffers({ tier: "kit", trailsUsed30d: 2 }, "revalidation")).toEqual([
      { offer: "club", reason: "member" },
    ]);
    for (const surface of ["home", "revalidation"] as const) {
      expect(decideOffers({ tier: "kit", trailsUsed30d: 3 }, surface)).toEqual([
        { offer: "club", reason: "broad_use" },
      ]);
    }
  });

  it("offers no plan above FlyeeClub Pro, the retired Pro included", () => {
    expect(decideOffers({ tier: "club", trailsUsed30d: 9 }, "revalidation")).toEqual([]);
    expect(decideOffers({ tier: "pro", trailsUsed30d: 9 }, "home")).toEqual([]);
  });
});

describe("decideServiceOffers — services sold on demand, never as plans", () => {
  it("shows them to every paying member and to nobody without a purchase", () => {
    expect(decideServiceOffers(null)).toEqual([]);
    expect(decideServiceOffers("kit")).toEqual(["custom_app", "mentoring", "consulting"]);
    expect(decideServiceOffers("club")).toEqual(["custom_app", "mentoring", "consulting"]);
  });
});

describe("the news feed", () => {
  const release = (id: string, date: string): NewsItem => ({
    kind: "release",
    id,
    date,
    module: { slug: "deploy-check", name: "Deploy check", icon: null, trail: "publicar" },
    version: "1.0.0",
    changelog: null,
    verifyUrl: "https://flyee.club/verificar/deploy-check%401.0.0",
  });
  const post = (id: string, date: string): NewsItem => ({
    kind: "post",
    id,
    date,
    title: "t",
    excerpt: null,
    bodyMd: "",
  });

  it("merges releases and posts, newest first, up to the limit", () => {
    const merged = mergeNews(
      [release("r1", "2026-09-28T00:00:00Z"), release("r2", "2026-09-30T00:00:00Z")],
      [post("p1", "2026-09-29T00:00:00Z")],
      2,
    );
    expect(merged.map((item) => item.id)).toEqual(["r2", "p1"]);
  });
});

describe("lessons in the member's language", () => {
  const lesson = (depth: string, locale: string) => ({ depth, locale, id: `${depth}-${locale}` });

  it("prefers the member's language and falls back to the other one per depth", () => {
    const picked = lessonsForLocale(
      [lesson("usar", "pt-BR"), lesson("usar", "en"), lesson("abrir_o_capo", "pt-BR")],
      "en",
    );
    expect(picked.map((item) => item.id)).toEqual(["usar-en", "abrir_o_capo-pt-BR"]);
  });

  it("keeps the order usar, then abrir o capô", () => {
    const picked = lessonsForLocale([lesson("abrir_o_capo", "pt-BR"), lesson("usar", "pt-BR")], "pt-BR");
    expect(picked.map((item) => item.depth)).toEqual(["usar", "abrir_o_capo"]);
  });
});

describe("meetings", () => {
  const meeting = (slug: string, state: MemberMeeting["state"], startsAt: string | null): MemberMeeting => ({
    id: slug,
    slug,
    title: slug,
    description: null,
    startsAt,
    durationMinutes: 60,
    state,
    provider: "zoom",
    registered: false,
  });

  it("lists upcoming soonest first and past newest first", () => {
    const { upcoming, past } = splitMeetings([
      meeting("later", "inscricoes", "2026-11-10T22:00:00Z"),
      meeting("old", "encerrado", "2026-08-01T22:00:00Z"),
      meeting("live", "ao_vivo", "2026-10-01T22:00:00Z"),
      meeting("recent", "encerrado", "2026-09-20T22:00:00Z"),
      meeting("undated", "inscricoes", null),
    ]);
    expect(upcoming.map((item) => item.slug)).toEqual(["live", "later", "undated"]);
    expect(past.map((item) => item.slug)).toEqual(["recent", "old"]);
  });
});

describe("revalidation countdown", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");

  it("counts whole days, never negative, and nothing without a date", () => {
    expect(daysUntil("2026-10-31T12:00:00Z", now)).toBe(30);
    expect(daysUntil("2026-10-02T00:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-09-01T00:00:00Z", now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });
});
