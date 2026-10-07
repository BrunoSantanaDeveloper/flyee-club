import { describe, expect, it } from "vitest";

import { accountServices, isNewApp, servicesPhrase } from "@/lib/catalog/store-badges";

const NOW = Date.parse("2026-10-07T12:00:00Z");

describe("the store card badges, from data", () => {
  it("is Novo for the configured days after the first publication, and not after", () => {
    expect(isNewApp("2026-09-20T12:00:00Z", 30, NOW)).toBe(true);
    expect(isNewApp("2026-09-07T12:00:00Z", 30, NOW)).toBe(true);
    expect(isNewApp("2026-09-06T11:00:00Z", 30, NOW)).toBe(false);
    expect(isNewApp("2026-10-06T12:00:00Z", 0, NOW)).toBe(false);
    expect(isNewApp(null, 30, NOW)).toBe(false);
    expect(isNewApp("2026-10-30T12:00:00Z", 30, NOW)).toBe(false);
  });

  it("names the services of the required credentials only, each once", () => {
    expect(
      accountServices([
        { name: "HeyGen", required: true },
        { name: "ElevenLabs", required: false },
        { name: " HeyGen ", required: true },
        { name: "Apify", required: true },
      ]),
    ).toEqual(["HeyGen", "Apify"]);
    expect(accountServices(null)).toEqual([]);
  });

  it("joins them in the language of the page", () => {
    expect(servicesPhrase(["HeyGen", "Apify"], "pt-BR")).toBe("HeyGen e Apify");
    expect(servicesPhrase(["HeyGen", "Apify", "Make"], "en")).toBe("HeyGen, Apify, and Make");
  });
});
