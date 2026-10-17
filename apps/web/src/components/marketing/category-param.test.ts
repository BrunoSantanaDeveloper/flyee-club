import { addressWithCategory, categoryFromSearch } from "./category-param";
import { describe, expect, it } from "vitest";

const SLUGS = ["sell", "promote", "video", "research", "build"];

describe("the store's category in the address", () => {
  it("reads a category the store shows, and nothing else", () => {
    expect(categoryFromSearch("?cat=video", SLUGS)).toBe("video");
    expect(categoryFromSearch("?segment=dev&cat=research", SLUGS)).toBe("research");
    expect(categoryFromSearch("?cat=unknown", SLUGS)).toBeNull();
    expect(categoryFromSearch("", SLUGS)).toBeNull();
  });

  it("writes the chosen category and keeps the rest of the address", () => {
    expect(addressWithCategory("https://flyee.club/?segment=dev#apps", "video")).toBe("/?segment=dev&cat=video#apps");
    expect(addressWithCategory("https://flyee.club/en/catalog?cat=video", "research")).toBe("/en/catalog?cat=research");
  });

  it("drops the parameter for All", () => {
    expect(addressWithCategory("https://flyee.club/catalogo?cat=video", null)).toBe("/catalogo");
    expect(addressWithCategory("https://flyee.club/?cat=video&segment=dev#apps", null)).toBe("/?segment=dev#apps");
  });
});
