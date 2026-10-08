// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BRAND } from "@/brand";
import { eventBatchSchema, isCliEvent, stringProperties } from "@/lib/cli/events";
import type { CliEntitlements } from "@/lib/cli/gates";
import { parseInstallReport, registerDeviceArgs } from "@/lib/cli/installs";
import { meBody, type MeFacts } from "@/lib/cli/me";
import { type CliLocale, tierName } from "@/lib/cli/messages";
import { cliVersionBody, DEFAULT_CLI_SETTINGS } from "@/lib/cli/settings";
import { TIER_LABEL } from "@/lib/member/labels";
import en from "@flyee/content/messages/en.json";
import ptBR from "@flyee/content/messages/pt-BR.json";

/**
 * The finished CLI against this platform (docs/PLANO-IMPLEMENTACAO.md, 12.1).
 * The bodies below are what the CLI of the product repository sends
 * (C:\AppsProjects\flyee, packages/cli, read at commit b62a020 on 2026-10-08:
 * `registration.ts`, `state/events.ts`), written out by hand because this
 * repository never imports the product's code; the paths are what it reads
 * (`api/types.ts`, `commands/login.ts`, `commands/status.ts`,
 * `commands/add.ts`). A change here that the CLI would trip on fails this
 * test before it fails a member.
 */

const DEVICE_ID = "3f1c2a9e-8b4d-4e6f-9a1b-2c3d4e5f6a7b";
const AUTH = { userId: "user-1", orgId: "org-1", familyId: "family-1" };

/** `buildInstallsPayload` on a machine where no tested AI is found and GitHub Copilot is. */
const STANDARD_TOOL_REPORT = {
  device_id: DEVICE_ID,
  name: "DESKTOP-FLYEE",
  os: "windows",
  os_version: "10.0.26200",
  ai_tool: "other",
  cli_version: "1.0.0",
  core_version: "1.2.0",
  installed_modules: [
    { slug: "motion-carousel", version: "1.0.0" },
    { slug: "video-render", version: "1.0.0" },
  ],
  ai_tool_detail: "copilot",
  project_kind: "own",
  updated: true,
};

/** The same machine once Claude Code is found: the CLI sends no detail. */
const TESTED_TOOL_REPORT: Record<string, unknown> = { ...STANDARD_TOOL_REPORT, ai_tool: "claude_code" };
delete TESTED_TOOL_REPORT.ai_tool_detail;

/** `PROPERTY_KEYS` of state/events.ts, with values the CLI writes. */
const CLI_PROPERTIES = {
  module: "motion-carousel",
  trail: "divulgar",
  version: "1.1.0",
  from_version: "1.0.0",
  to_version: "1.1.0",
  os: "windows",
  ai_tool: "claude_code",
  cli_version: "1.0.0",
  core_version: "1.2.0",
  project_kind: "client",
  reason: "member",
  origin: "cli",
  days_since_update: "8_14",
};

/** `EVENT_NAMES` of state/events.ts: everything the CLI may queue. */
const CLI_EVENT_NAMES = ["module.installed", "module.activated", "module.updated", "tool.executed", "recipe.installed"];

const queued = (name: string, index = 0) => ({
  name,
  properties: CLI_PROPERTIES,
  occurred_at: new Date(Date.UTC(2026, 9, 8, 12, index)).toISOString(),
});

describe("POST /api/cli/installs takes the machine report the CLI sends", () => {
  it("with a tool of the standard tier beside other, and passes the name to the database", () => {
    const parsed = parseInstallReport(STANDARD_TOOL_REPORT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const args = registerDeviceArgs(AUTH, parsed.report);
    expect(args).toMatchObject({
      target_device_id: DEVICE_ID,
      target_ai_tool: "other",
      target_ai_tool_detail: "copilot",
      target_installed_modules: STANDARD_TOOL_REPORT.installed_modules,
      target_updated: true,
    });
  });

  it("with a tested AI and no name beside it", () => {
    const parsed = parseInstallReport(TESTED_TOOL_REPORT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(registerDeviceArgs(AUTH, parsed.report)).toMatchObject({
      target_ai_tool: "claude_code",
      target_ai_tool_detail: null,
    });
  });

  it("and never refuses a login for what only describes the machine", () => {
    // `flyee login --name` keeps whatever the member typed; the column holds 80.
    for (const detail of ["GitHub Copilot", "x".repeat(40), 42, { tool: "copilot" }, ""]) {
      const parsed = parseInstallReport({
        ...STANDARD_TOOL_REPORT,
        name: `  ${"m".repeat(120)}  `,
        os_version: "5".repeat(60),
        ai_tool_detail: detail,
      });
      expect(parsed.ok, JSON.stringify(detail)).toBe(true);
      if (!parsed.ok) continue;
      const args = registerDeviceArgs(AUTH, parsed.report);
      expect(args.target_name).toHaveLength(80);
      expect(args.target_os_version).toHaveLength(40);
      expect(args.target_ai_tool_detail).toBeNull();
    }
    const spaced = parseInstallReport({ ...STANDARD_TOOL_REPORT, ai_tool_detail: " Windsurf " });
    expect(spaced.ok && spaced.report.ai_tool_detail).toBe("windsurf");
  });

  it("while it still refuses what the ceiling and the updates depend on, and a field the contract does not serve", () => {
    expect(parseInstallReport({ ...STANDARD_TOOL_REPORT, device_id: "x" }).ok).toBe(false);
    expect(
      parseInstallReport({ ...STANDARD_TOOL_REPORT, installed_modules: [{ slug: "video-render", version: "latest" }] })
        .ok,
    ).toBe(false);
    expect(parseInstallReport({ ...STANDARD_TOOL_REPORT, ai_tool: "copilot" }).ok).toBe(false);
    // Section 9 of the contract is not served until it moves into the body: the
    // CLI must not send such a field early (the request to the product).
    expect(parseInstallReport({ ...STANDARD_TOOL_REPORT, trigger: "scheduled" }).ok).toBe(false);
  });
});

describe("POST /api/cli/events takes the batch the CLI sends", () => {
  it("with each of the five events the CLI may queue and every property key it writes", () => {
    const batch = { events: CLI_EVENT_NAMES.map((name, index) => queued(name, index)) };
    const parsed = eventBatchSchema.safeParse(batch);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    for (const event of parsed.data.events) {
      expect(isCliEvent(event.name), event.name).toBe(true);
      expect(stringProperties(event.properties)).toEqual(CLI_PROPERTIES);
    }
  });

  it("in batches of up to 50, the size the CLI sends", () => {
    const events = Array.from({ length: 51 }, (_, index) => queued("tool.executed", index % 60));
    expect(eventBatchSchema.safeParse({ events: events.slice(0, 50) }).success).toBe(true);
    expect(eventBatchSchema.safeParse({ events }).success).toBe(false);
  });
});

describe("GET /api/cli/version answers what the CLI reads", () => {
  const body = cliVersionBody(DEFAULT_CLI_SETTINGS);

  it("the oldest CLI served, the newest core and the notices", () => {
    expect(typeof body.min_cli_version).toBe("string");
    expect(body.latest_core_version === null || typeof body.latest_core_version === "string").toBe(true);
    expect(Array.isArray(body.deprecations)).toBe(true);
  });

  it("and the page of an app, which the CLI fills with the slug for someone who runs add without a connection", () => {
    // commands/add.ts: links.module_page.replace("{slug}", encodeURIComponent(slug))
    const fill = (template: string) => template.replace("{slug}", encodeURIComponent("motion-carousel"));
    expect(fill(body.links.module_page)).toBe(`${BRAND.siteUrl}/catalogo/motion-carousel?origem=cli`);
    expect(fill(body.links.module_page_en)).toBe(`${BRAND.siteUrl}/en/catalog/motion-carousel?origem=cli`);
  });
});

describe("GET /api/cli/me answers what the CLI reads", () => {
  const now = Date.UTC(2026, 9, 8, 12);
  const facts = (entitlements: CliEntitlements, locale = "pt-BR"): MeFacts => ({
    auth: { ...AUTH, refreshExpiresAt: new Date(now + 30 * 86_400_000).toISOString() },
    profile: { display_name: "Ana", segment: "dev", ai_tool: "other", locale },
    workspaceName: "Ana",
    entitlements,
    device: null,
    deviceId: DEVICE_ID,
    settings: DEFAULT_CLI_SETTINGS,
    revalidateUrl: "https://flyee.club/revalidar?d=x",
    links: {
      billing: "https://flyee.club/settings/billing?source=cli",
      devices: "https://flyee.club/settings/devices",
    },
    now,
  });

  it("every field login, status, add and update read, and the rung's name to print", () => {
    const body = meBody(facts({ active: true, suspended: false, tier: "kit", limits: { catalog_access: 1 } }));
    expect(body.member).toMatchObject({ name: "Ana", locale: "pt-BR" });
    expect(body.workspace.name).toBe("Ana");
    expect(body.token.days_until_revalidation).toBe(30);
    expect(body.access).toMatchObject({ active: true, suspended: false, tier: "kit", tier_name: "FlyeeClub" });
    expect(body.links.billing).toMatch(/^https?:\/\//);
    expect(Array.isArray(body.cli.deprecations)).toBe(true);
    expect(body.cli.links.module_page).toContain("{slug}");
    expect(body.device).toMatchObject({ device_id: DEVICE_ID, registered: false });
    expect(body.revalidate_url).toMatch(/^https?:\/\//);
  });

  it("no rung and no name for an account with no purchase, so the CLI prints its no-access line", () => {
    const body = meBody(facts({ active: true, suspended: false, tier: null, limits: {} }, "en"));
    expect(body.access).toMatchObject({ tier: null, tier_name: null });
    expect(body.member.locale).toBe("en");
  });

  it("the rung named as the member screens name it, in both languages", () => {
    const catalogs: Record<CliLocale, Record<string, string>> = {
      "pt-BR": ptBR.product as Record<string, string>,
      en: en.product as Record<string, string>,
    };
    for (const tier of ["kit", "club", "pro"] as const) {
      for (const locale of ["pt-BR", "en"] as const) {
        expect(tierName(tier, locale), `${tier} ${locale}`).toBe(catalogs[locale][TIER_LABEL[tier]]);
      }
    }
  });
});
