/**
 * Labels the member screens share. AI tools are product names and are not
 * translated (only "other" is); the rest are `product` i18n keys, listed
 * literally so the message pruner sees every key in use.
 */

const AI_TOOL_NAMES: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  gemini_cli: "Gemini CLI",
  cursor: "Cursor",
};

/** "Claude Code"; `otherLabel` (translated by the caller) for `other` and anything unknown. */
export function aiToolName(tool: string, otherLabel: string): string {
  return AI_TOOL_NAMES[tool] ?? otherLabel;
}

export const AI_TOOL_OPTIONS = ["claude_code", "codex", "gemini_cli", "cursor", "other"] as const;

export const MODULE_TYPES = [
  { value: "skill", label: "module-type-skill" },
  { value: "workflow", label: "module-type-workflow" },
  { value: "framework", label: "module-type-framework" },
  { value: "tool", label: "module-type-tool" },
] as const;

export const MODULE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  MODULE_TYPES.map((type) => [type.value, type.label]),
);

/** The `member_segment` enum (migration 0000), in the order the onboarding asks it. */
export const SEGMENT_OPTIONS = [
  { value: "produto_proprio", label: "segment-produto-proprio" },
  { value: "freelancer_agencia", label: "segment-freelancer-agencia" },
  { value: "profissional_ia", label: "segment-profissional-ia" },
  { value: "dev", label: "segment-dev" },
  { value: "outro", label: "segment-outro" },
] as const;

export const PERMISSION_LABEL: Record<string, string> = {
  "fs:read": "permission-fs-read",
  "fs:write": "permission-fs-write",
  network: "permission-network",
  shell: "permission-shell",
  env: "permission-env",
};

/** A localized text stored as `{ "pt-BR": …, "en": … }`, or a plain string. */
export function pickLocalized(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = record[locale] ?? record["pt-BR"];
    return typeof text === "string" ? text : "";
  }
  return "";
}

/** What each right is called on the member screens (the billing grid uses the same keys). */
export const FEATURE_LABEL: Record<string, string> = {
  catalog_access: "billing-feature-catalog_access",
  advanced_lessons: "billing-feature-advanced_lessons",
  recipes: "billing-feature-recipes",
  roadmap_vote: "billing-feature-roadmap_vote",
  meetings: "billing-feature-meetings",
  commercial_license: "billing-feature-commercial_license",
  open_the_hood: "billing-feature-open_the_hood",
};

/** The rung's name on the member screens. */
export const TIER_LABEL: Record<string, string> = {
  kit: "tier-kit",
  club: "tier-club",
  pro: "tier-pro",
};
