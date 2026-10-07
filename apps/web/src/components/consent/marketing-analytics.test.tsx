import { beforeAll, describe, expect, it, vi } from "vitest";

import MarketingAnalytics from "@/components/consent/marketing-analytics";
import Faq from "@/components/marketing/faq";
import { trackSiteEvent } from "@/lib/site-events";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * The FAQ is a native <details> since the public shell (docs/PLANO-IMPLEMENTACAO.md,
 * "Casca pública"): the `faq_open` event is declared on its <summary> and reported
 * by the one listener of MarketingAnalytics, which must count the click that
 * opens a question and not the one that closes it.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/analytics", () => ({ trackPageView: vi.fn() }));
vi.mock("@/lib/site-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-events")>()),
  trackSiteEvent: vi.fn(),
}));

beforeAll(() => {
  // jsdom has no IntersectionObserver (Reveal and the section views use one).
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

describe("site events on the FAQ", () => {
  it("reports faq_open when a question opens, and nothing when it closes", () => {
    render(
      <>
        <MarketingAnalytics />
        <Faq
          title="Perguntas"
          items={[
            { id: "price", question: "Quanto custa?", answer: "O preço vem do plano." },
            { question: "Funciona no Codex?", answer: "Sim." },
          ]}
        />
      </>,
    );
    const summary = screen.getByText("Quanto custa?").closest("summary")!;
    const details = summary.closest("details")!;

    // The browser toggles <details> after the click; the listener runs before, in the capture phase.
    fireEvent.click(summary);
    details.open = true;
    expect(trackSiteEvent).toHaveBeenCalledTimes(1);
    expect(trackSiteEvent).toHaveBeenCalledWith("faq_open", expect.objectContaining({ question_id: "price" }));

    fireEvent.click(summary);
    details.open = false;
    expect(trackSiteEvent).toHaveBeenCalledTimes(1);

    // A question without an id is named by its position.
    fireEvent.click(screen.getByText("Funciona no Codex?").closest("summary")!);
    expect(trackSiteEvent).toHaveBeenLastCalledWith("faq_open", expect.objectContaining({ question_id: "2" }));
  });
});
