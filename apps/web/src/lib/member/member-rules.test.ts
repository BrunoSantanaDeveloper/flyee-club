// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { type MemberMeeting, splitMeetings } from "@/lib/member/community";
import { daysUntil } from "@/lib/member/devices";
import { lessonsForLocale } from "@/lib/member/lessons";
import { mergeNews, type NewsItem } from "@/lib/member/news";
import { decideUpsell } from "@/lib/upsell";

describe("decideUpsell — an offer is earned by use", () => {
  it("offers the kit to an account that has bought nothing", () => {
    expect(decideUpsell({ tier: null, trailsUsed30d: 0, hasClientProject: false })).toEqual({
      offer: "kit",
      reason: "no_access",
    });
  });

  it("offers the membership to a kit owner using three or more trails", () => {
    expect(decideUpsell({ tier: "kit", trailsUsed30d: 2, hasClientProject: false })).toBeNull();
    expect(decideUpsell({ tier: "kit", trailsUsed30d: 3, hasClientProject: false })).toEqual({
      offer: "club",
      reason: "broad_use",
    });
  });

  it("offers Pro, from the kit or the membership, when a project is a client's", () => {
    expect(decideUpsell({ tier: "kit", trailsUsed30d: 5, hasClientProject: true })).toEqual({
      offer: "pro",
      reason: "client_project",
    });
    expect(decideUpsell({ tier: "club", trailsUsed30d: 0, hasClientProject: true })?.offer).toBe("pro");
  });

  it("offers nothing above Pro, and nothing to a member without a reason", () => {
    expect(decideUpsell({ tier: "pro", trailsUsed30d: 9, hasClientProject: true })).toBeNull();
    expect(decideUpsell({ tier: "club", trailsUsed30d: 9, hasClientProject: false })).toBeNull();
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
