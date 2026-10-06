// @vitest-environment node
import { describe, expect, it } from "vitest";

import { datasetToEventProps, isSiteEventName, trackAttributes } from "@/lib/site-events";

describe("site events declared as data attributes", () => {
  it("turns the attributes an element carries into the event's props", () => {
    expect(datasetToEventProps({ track: "cta_click", trackCtaId: "hero", section: "ignored" })).toEqual({
      cta_id: "hero",
    });
    expect(datasetToEventProps({ track: "segment_click", trackSegment: "agencia", trackLocation: "who_for" })).toEqual({
      segment: "agencia",
      location: "who_for",
    });
  });

  it("writes the attributes a server component declares an event with", () => {
    expect(trackAttributes({ event: "app_card_click", app: "copy-social" })).toEqual({
      "data-track": "app_card_click",
      "data-track-app": "copy-social",
    });
    expect(trackAttributes({ event: "cta_click", cta_id: "final" })).toEqual({
      "data-track": "cta_click",
      "data-track-cta-id": "final",
    });
  });

  it("knows the vocabulary of the brief and nothing else", () => {
    expect(isSiteEventName("faq_open")).toBe(true);
    expect(isSiteEventName("purchase")).toBe(false);
    expect(isSiteEventName(null)).toBe(false);
  });
});
