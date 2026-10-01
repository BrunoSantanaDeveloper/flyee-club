import { z } from "zod/v4";

/**
 * `flyee.module.json`, version 1: the manifest at the root of every module
 * package. The platform validates it when a package is uploaded, copies what
 * members must be able to check (permissions, compatible AIs, changelog) into
 * the catalog, and publishes this same schema as JSON Schema at
 * `/api/cli/schema/module` for the CLI and for module authors
 * (docs/CLI-CONTRACT.md).
 *
 * The shape is strict on purpose: an unknown key is a typo until a new
 * `manifest_version` says otherwise.
 */

export const MANIFEST_FILE = "flyee.module.json";
export const MANIFEST_VERSION = 1;
export const MANIFEST_SCHEMA_ID = "https://flyee.club/api/cli/schema/module";

export const MODULE_TYPES = ["skill", "workflow", "framework", "tool"] as const;
/** The `ai_tool` enum of the database (migration 0000). */
export const AI_TOOLS = ["claude_code", "codex", "gemini_cli", "cursor", "other"] as const;
export const PERMISSION_KINDS = ["fs:read", "fs:write", "network", "shell", "env"] as const;
export const LESSON_DEPTHS = ["usar", "abrir_o_capo"] as const;
export const LICENSES = ["member", "commercial"] as const;

// The same rules as the database checks (migration 0008) and semver.ts.
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const TRAIL = /^[a-z][a-z0-9-]{1,29}$/;
const SEMVER = /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-[0-9A-Za-z][0-9A-Za-z.-]{0,19})?$/;
const CORE_RANGE = /^(?:\^|~|>=|=)?\s*(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-[0-9A-Za-z][0-9A-Za-z.-]{0,19})?$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * A path inside the package: relative, forward slashes, no `.` or `..`
 * segments, no drive letter, no control characters. The ZIP reader applies the
 * same rule to every entry, so a package can never write outside its folder.
 */
export function isSafePackagePath(value: string): boolean {
  if (!value || value.length > 240) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes(":")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** A text in the two site languages; Portuguese is required. */
const localized = (max: number) =>
  z
    .object({
      "pt-BR": z.string().trim().min(1).max(max),
      en: z.string().trim().min(1).max(max).optional(),
    })
    .strict();

const packagePath = z.string().refine(isSafePackagePath, { message: "must be a relative path inside the package" });

const lessonList = z
  .array(
    z
      .object({
        depth: z.enum(LESSON_DEPTHS),
        provider: z.literal("youtube"),
        id: z.string().regex(YOUTUBE_ID),
        duration_s: z.number().int().positive().max(36_000),
      })
      .strict(),
  )
  .max(2);

export const moduleManifestSchema = z
  .object({
    manifest_version: z.literal(MANIFEST_VERSION),
    /** The module's slug in the catalog. */
    name: z.string().regex(SLUG),
    version: z.string().regex(SEMVER),
    type: z.enum(MODULE_TYPES),
    /** One of the catalog trails (planejar, construir, publicar, divulgar, vender, escalar, manter). */
    trail: z.string().regex(TRAIL),
    title: localized(80),
    summary: localized(280),
    compatible_ais: z.array(z.enum(AI_TOOLS)).min(1).max(AI_TOOLS.length),
    /** The core versions this module runs on, as one comparator: `>=0.3.0`, `^0.3.0`, `~0.3.0` or `0.3.0`. */
    min_core: z.string().regex(CORE_RANGE).optional(),
    /** The file the harness loads first. */
    entry: packagePath,
    /** Every file of the package, the manifest excluded. */
    files: z.array(packagePath).min(1).max(2000),
    /** Keys the member provides themself; the module never ships one. */
    external_credentials: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            env: z.string().regex(ENV_NAME),
            url: z.string().max(500).refine(isHttpsUrl, { message: "must be an https URL" }).optional(),
            required: z.boolean(),
            purpose: localized(280),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    /** What the module may touch on the member's machine, each with a reason. */
    permissions: z
      .array(
        z
          .object({
            kind: z.enum(PERMISSION_KINDS),
            scope: z.string().trim().min(1).max(200),
            reason: localized(280),
          })
          .strict(),
      )
      .max(50)
      .default([]),
    lessons: z.object({ "pt-BR": lessonList.optional(), en: lessonList.optional() }).strict().optional(),
    changelog: localized(4000).optional(),
    license: z.enum(LICENSES).default("member"),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (!manifest.files.includes(manifest.entry)) {
      context.addIssue({ code: "custom", path: ["entry"], message: "must be one of `files`" });
    }
    if (new Set(manifest.files).size !== manifest.files.length) {
      context.addIssue({ code: "custom", path: ["files"], message: "must not repeat a path" });
    }
    if (manifest.files.includes(MANIFEST_FILE)) {
      context.addIssue({ code: "custom", path: ["files"], message: `must not list ${MANIFEST_FILE} itself` });
    }
    if (new Set(manifest.compatible_ais).size !== manifest.compatible_ais.length) {
      context.addIssue({ code: "custom", path: ["compatible_ais"], message: "must not repeat a tool" });
    }
    const envs = manifest.external_credentials.map((credential) => credential.env);
    if (new Set(envs).size !== envs.length) {
      context.addIssue({ code: "custom", path: ["external_credentials"], message: "must not repeat an env name" });
    }
  });

export type ModuleManifest = z.output<typeof moduleManifestSchema>;
export type ModulePermission = ModuleManifest["permissions"][number];
export type ModuleCredential = ModuleManifest["external_credentials"][number];

export type ManifestResult = { ok: true; manifest: ModuleManifest } | { ok: false; errors: string[] };

/** Reads a manifest from its bytes or text: JSON first, then the schema. Errors are `path: message` lines. */
export function parseManifest(input: string | Uint8Array): ManifestResult {
  const text = (typeof input === "string" ? input : new TextDecoder("utf-8").decode(input)).replace(/^﻿/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [`${MANIFEST_FILE} is not valid JSON`] };
  }
  const parsed = moduleManifestSchema.safeParse(raw);
  if (parsed.success) return { ok: true, manifest: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

/**
 * The manifest as JSON Schema (draft 2020-12), served to the CLI and to
 * module authors' editors. Cross-field rules (`entry` among `files`, no
 * repeats) are checked by the upload, not expressible here.
 */
export function manifestJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(moduleManifestSchema, { io: "input" }) as Record<string, unknown>;
  return {
    ...schema,
    $id: MANIFEST_SCHEMA_ID,
    title: MANIFEST_FILE,
    description: "The manifest at the root of a flyee.club module package (manifest_version 1).",
  };
}
