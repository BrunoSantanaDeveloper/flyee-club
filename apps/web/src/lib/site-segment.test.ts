import { describe, expect, it } from "vitest";

import { normalizeSegment, PERSONA_SEGMENTS, SEGMENTS } from "@/lib/site-segment";

describe("the segment a visitor declares before signing up", () => {
  it("keeps the site's personas and outro, nothing else", () => {
    expect(normalizeSegment("agencia")).toBe("agencia");
    expect(normalizeSegment(" Negocio ")).toBe("negocio");
    expect(normalizeSegment("outro")).toBe("outro");
    expect(normalizeSegment("marketing")).toBeNull();
    expect(normalizeSegment("")).toBeNull();
    expect(normalizeSegment(null)).toBeNull();
  });

  it("refuses the names retired by migration 0028", () => {
    expect(normalizeSegment("produto_proprio")).toBeNull();
    expect(normalizeSegment("freelancer_agencia")).toBeNull();
    expect(normalizeSegment("profissional_ia")).toBeNull();
  });

  it("offers four personas and keeps outro as an answer only", () => {
    expect(PERSONA_SEGMENTS).toEqual(["negocio", "agencia", "produto", "dev"]);
    expect(SEGMENTS).toEqual([...PERSONA_SEGMENTS, "outro"]);
  });
});
