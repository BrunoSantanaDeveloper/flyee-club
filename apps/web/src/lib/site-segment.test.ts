import { describe, expect, it } from "vitest";

import { normalizeSiteSegment, profileSegmentFor } from "@/lib/site-segment";

describe("the segment a visitor declares before signing up", () => {
  it("keeps the brief's personas and the profile's own values, nothing else", () => {
    expect(normalizeSiteSegment("agencia")).toBe("agencia");
    expect(normalizeSiteSegment(" Dev ")).toBe("dev");
    expect(normalizeSiteSegment("freelancer_agencia")).toBe("freelancer_agencia");
    expect(normalizeSiteSegment("marketing")).toBeNull();
    expect(normalizeSiteSegment("")).toBeNull();
    expect(normalizeSiteSegment(null)).toBeNull();
  });

  it("pre-fills the profile only where the two vocabularies mean the same", () => {
    expect(profileSegmentFor("agencia")).toBe("freelancer_agencia");
    expect(profileSegmentFor("produto")).toBe("produto_proprio");
    expect(profileSegmentFor("dev")).toBe("dev");
    expect(profileSegmentFor("profissional_ia")).toBe("profissional_ia");
  });

  it("guesses nothing for a persona without a counterpart or for an unknown value", () => {
    expect(profileSegmentFor("negocio")).toBeNull();
    expect(profileSegmentFor("bogus")).toBeNull();
    expect(profileSegmentFor(undefined)).toBeNull();
  });
});
