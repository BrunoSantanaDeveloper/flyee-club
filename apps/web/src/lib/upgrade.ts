import { type EntitlementKey, hasEntitlement, limitOf } from "@flyee/billing/entitlements";

/**
 * The upgrade prompt of FlyeeClub Pro (docs/PRODUCT.md, decided 2026-10-08):
 * the site never advertises Pro, so the member area offers it where one of its
 * features is clicked. Pure, so the rules are tested without a screen.
 */

/**
 * The features a member can click. Each opens the prompt and is the `feature`
 * of the offer events it records (migration 0039), so /admin/metricas can say
 * which one sells FlyeeClub Pro.
 */
export const PRO_FEATURES = [
  "roadmap_propose",
  "roadmap_vote",
  "recipe_install",
  "recipe_workflow",
  "meeting_register",
  "advanced_guide",
  "more_devices",
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

/** The screen each feature lives on: the `origin` its offer events report. */
export const FEATURE_ORIGIN = {
  roadmap_propose: "roadmap",
  roadmap_vote: "roadmap",
  recipe_install: "recipes",
  recipe_workflow: "recipes",
  meeting_register: "meetings",
  advanced_guide: "module",
  more_devices: "devices",
} as const satisfies Record<ProFeature, string>;

/** What FlyeeClub Pro has published in each of its areas (the "Em breve" rule). */
export type ProAvailability = { recipes: boolean; meetings: boolean; advancedGuides: boolean };

/** One line of what FlyeeClub Pro adds, in the words of the billing grid. */
export type ProAddition = {
  key: EntitlementKey;
  /** A `product` key, the same the plans grid of /settings/billing shows. */
  labelKey: string;
  values?: { count: number };
  /** Its area has nothing published yet: the line says "Em breve". */
  soon: boolean;
};

const LABEL: Record<Exclude<EntitlementKey, "devices">, string> = {
  catalog_access: "billing-feature-catalog_access",
  advanced_lessons: "billing-feature-advanced_lessons",
  recipes: "billing-feature-recipes",
  roadmap_vote: "billing-feature-roadmap_vote",
  meetings: "billing-feature-meetings",
  commercial_license: "billing-feature-commercial_license",
  open_the_hood: "billing-feature-open_the_hood",
};

const ORDER: Exclude<EntitlementKey, "devices">[] = [
  "catalog_access",
  "advanced_lessons",
  "open_the_hood",
  "recipes",
  "meetings",
  "roadmap_vote",
  "commercial_license",
];

/** The area a right belongs to, when it can be empty. */
const SOON: Partial<Record<EntitlementKey, keyof ProAvailability>> = {
  advanced_lessons: "advancedGuides",
  open_the_hood: "advancedGuides",
  recipes: "recipes",
  meetings: "meetings",
};

/**
 * What FlyeeClub Pro adds to what the account already has: each right the Pro
 * plan grants and the account lacks, then the computers when Pro allows more.
 * An area with nothing published yet keeps its line, marked "Em breve": hiding
 * it would hide what the subscription is for, and promising it without the
 * mark would sell what is not there yet.
 */
export function proAdditions(
  current: Record<string, unknown>,
  pro: Record<string, unknown>,
  available: ProAvailability,
): ProAddition[] {
  const lines: ProAddition[] = ORDER.filter((key) => hasEntitlement(pro, key) && !hasEntitlement(current, key)).map(
    (key) => {
      const area = SOON[key];
      return { key, labelKey: LABEL[key], soon: area ? !available[area] : false };
    },
  );
  const devices = limitOf(pro, "devices");
  if (devices > limitOf(current, "devices")) {
    lines.push({ key: "devices", labelKey: "billing-feature-devices", values: { count: devices }, soon: false });
  }
  return lines;
}
