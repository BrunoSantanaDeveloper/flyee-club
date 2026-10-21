import { z } from "zod";

import { DEVICE_ID_PATTERN, type VerifiedAccess } from "@/lib/oauth/server";
import { AI_TOOLS } from "@flyee/catalog/manifest";
import { isSemver } from "@flyee/catalog/semver";

/**
 * What the CLI reports about the machine it runs on, after a login and after
 * every update (POST /api/cli/installs, docs/CLI-CONTRACT.md 4.2), and how the
 * report becomes the arguments of `register_member_device` (migrations 0011
 * and 0036).
 *
 * A login depends on this report, so what only describes the machine never
 * refuses it: a long name is cut to the column, and a tool name the platform
 * does not take is dropped. The identity and the versions still must be
 * right, because the device ceiling and the update checks read them.
 */

const semver = z.string().refine(isSemver, { message: "must be a version like 1.2.3" });

/** Cut to the size of its column, as the database would cut it. */
const clipped = (max: number) => z.string().transform((value) => value.trim().slice(0, max));

/** The short name of a tool of the "compatible by the standard" tier (`copilot`, `windsurf`). */
export const AI_TOOL_DETAIL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/**
 * The tool name in the form the database compares, or null. Any other value,
 * of any type, becomes null: the name is a measurement, never a reason to
 * stop a member at the door. Whether it is kept (beside `other`, and only
 * when `platform_settings.cli.known_tools` lists it) is the database's call.
 */
export function normalizeAiToolDetail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toLowerCase();
  return AI_TOOL_DETAIL_PATTERN.test(clean) ? clean : null;
}

export const installSchema = z
  .object({
    device_id: z.string().regex(DEVICE_ID_PATTERN),
    name: clipped(80).optional(),
    os: z.enum(["windows", "macos", "linux", "other"]).optional(),
    os_version: clipped(40).optional(),
    ai_tool: z.enum(AI_TOOLS).optional(),
    ai_tool_detail: z.unknown().optional().transform(normalizeAiToolDetail),
    cli_version: semver.optional(),
    core_version: semver.optional(),
    installed_modules: z
      .array(z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/), version: semver }).strict())
      .max(500)
      .optional(),
    project_kind: z.enum(["own", "client"]).optional(),
    /** True right after `npx flyee update` ran: stamps the machine's last update. */
    updated: z.boolean().optional(),
    /**
     * A Claude Code session in the cloud (`CLAUDE_CODE_REMOTE=true`): it takes the account's cloud place
     * instead of a computer's (migration 0044, docs/CLI-CONTRACT.md 4.2). Fixed when the row is created.
     */
    cloud: z.literal("claude_code").optional(),
  })
  .strict();

export type InstallReport = z.output<typeof installSchema>;

/** The report, or the reasons it was refused (in the 400 body the CLI receives). */
export function parseInstallReport(
  payload: unknown,
): { ok: true; report: InstallReport } | { ok: false; issues: string[] } {
  const parsed = installSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  return { ok: true, report: parsed.data };
}

/** The arguments of `register_member_device` for one report of the signed-in machine. */
export function registerDeviceArgs(auth: Pick<VerifiedAccess, "userId" | "orgId" | "familyId">, report: InstallReport) {
  return {
    target_user: auth.userId,
    target_org: auth.orgId,
    target_device_id: report.device_id,
    target_token_family: auth.familyId,
    target_name: report.name ?? null,
    target_os: report.os ?? null,
    target_os_version: report.os_version ?? null,
    target_ai_tool: report.ai_tool ?? null,
    target_ai_tool_detail: report.ai_tool_detail,
    target_cli_version: report.cli_version ?? null,
    target_core_version: report.core_version ?? null,
    target_installed_modules: report.installed_modules ?? null,
    target_project_kind: report.project_kind ?? null,
    target_updated: report.updated ?? false,
    target_cloud: report.cloud ?? null,
  };
}
