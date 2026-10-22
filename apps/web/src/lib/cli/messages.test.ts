// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CLI_ERROR_CODES, cliMessage } from "@/lib/cli/messages";

describe("the CLI's messages", () => {
  it("never tell the member to run a command", () => {
    // The AI shows them as they came, and the CLI handles each code itself (flyee-da, 2026-10-22).
    for (const code of CLI_ERROR_CODES) {
      for (const locale of ["pt-BR", "en"] as const) {
        const text = cliMessage(code, locale, { limit: 1 });
        expect(text, `${code} ${locale}`).not.toMatch(/npx|\bRode\b|\bRun\b|terminal/i);
      }
    }
  });

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
