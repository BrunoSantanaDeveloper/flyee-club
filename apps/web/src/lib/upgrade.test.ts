import { describe, expect, it } from "vitest";

import { offerLines } from "@/lib/member/offer-copy";
import { FEATURE_ORIGIN, PRO_FEATURES, proAdditions } from "@/lib/upgrade";

// The rights as the seed and the later migrations leave them (0018, 0024, 0025).
const FREE = { catalog_access: 0, devices: 1 };
const KIT = {
  catalog_access: 1,
  devices: 1,
  advanced_lessons: 0,
  recipes: 0,
  roadmap_vote: 0,
  meetings: 0,
  commercial_license: 1,
  open_the_hood: 0,
};
const PRO = {
  catalog_access: 1,
  devices: 3,
  advanced_lessons: 1,
  recipes: 1,
  roadmap_vote: 1,
  meetings: 1,
  commercial_license: 1,
  open_the_hood: 1,
};
const EVERYTHING = { recipes: true, meetings: true, advancedGuides: true };

describe("proAdditions: what the upgrade prompt says FlyeeClub Pro adds", () => {
  it("lists for a FlyeeClub member only what Pro adds, then the computers", () => {
    expect(proAdditions(KIT, PRO, EVERYTHING).map((line) => line.key)).toEqual([
      "advanced_lessons",
      "open_the_hood",
      "recipes",
      "meetings",
      "roadmap_vote",
      "devices",
    ]);
    expect(proAdditions(KIT, PRO, EVERYTHING).at(-1)).toEqual({
      key: "devices",
      labelKey: "billing-feature-devices",
      values: { count: 3 },
      soon: false,
    });
  });

  it("starts with the whole catalog for an account that bought nothing", () => {
    const keys = proAdditions(FREE, PRO, EVERYTHING).map((line) => line.key);
    expect(keys[0]).toBe("catalog_access");
    expect(keys).toContain("commercial_license");
    expect(keys).toContain("devices");
  });

  it("keeps an empty area in the list, marked Em breve", () => {
    const lines = proAdditions(KIT, PRO, { recipes: false, meetings: false, advancedGuides: true });
    const soon = lines.filter((line) => line.soon).map((line) => line.key);
    expect(soon).toEqual(["recipes", "meetings"]);
    expect(lines.find((line) => line.key === "roadmap_vote")?.soon).toBe(false);
  });

  it("marks both depths of the guide when no advanced guide is published", () => {
    const lines = proAdditions(KIT, PRO, { recipes: true, meetings: true, advancedGuides: false });
    expect(lines.filter((line) => line.soon).map((line) => line.key)).toEqual(["advanced_lessons", "open_the_hood"]);
  });

  it("adds nothing to an account already on FlyeeClub Pro", () => {
    expect(proAdditions(PRO, PRO, EVERYTHING)).toEqual([]);
  });

  it("names the screen of every feature, the origin its offer events report", () => {
    for (const feature of PRO_FEATURES) expect(FEATURE_ORIGIN[feature]).toBeTruthy();
  });
});

describe("offerLines: the lines of an offer card", () => {
  const t = (key: string) => key;

  it("marks a line of FlyeeClub Pro whose area has nothing published", () => {
    const lines = offerLines("club", t, { recipes: false, meetings: true, advancedGuides: true });
    expect(lines.filter((line) => line.soon).map((line) => line.label)).toEqual(["home-offer-club-feature-2"]);
  });

  it("marks nothing when the areas could not be read, and never a line of FlyeeClub", () => {
    expect(offerLines("club", t, null).some((line) => line.soon)).toBe(false);
    expect(
      offerLines("kit", t, { recipes: false, meetings: false, advancedGuides: false }).some((line) => line.soon),
    ).toBe(false);
  });
});
