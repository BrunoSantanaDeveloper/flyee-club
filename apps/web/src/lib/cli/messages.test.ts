// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cliMessage } from "@/lib/cli/messages";

describe("the CLI's messages", () => {
  it("make the device limit agree with its number, in both languages", () => {
    // The product's request of 2026-10-21, item 7.7: "1 computador(es)" read as a form, not a sentence.
    expect(cliMessage("device_limit_reached", "pt-BR", { limit: 1 })).toContain("limite de 1 computador do seu plano");
    expect(cliMessage("device_limit_reached", "pt-BR", { limit: 3 })).toContain(
      "limite de 3 computadores do seu plano",
    );
    expect(cliMessage("device_limit_reached", "en", { limit: 1 })).toContain("limit of 1 machine.");
    expect(cliMessage("device_limit_reached", "en", { limit: 3 })).toContain("limit of 3 machines.");
    expect(cliMessage("device_limit_reached", "pt-BR", { limit: 1 })).not.toMatch(/\(es\)|\(s\)/);
  });

  it("leaves a placeholder with no value as it is", () => {
    expect(cliMessage("device_limit_reached", "pt-BR")).toContain("{limit} {limit|computador|computadores}");
  });
});
