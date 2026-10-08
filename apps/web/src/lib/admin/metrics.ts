import { formatMoney, formatNumber, formatPercent, ratio, weekStartOf } from "@/lib/admin/format";
import { labelOf, SEGMENT_LABEL, SEGMENT_ORDER } from "@/lib/admin/labels";
import type { MemberRow } from "@/lib/admin/members";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The focus metrics (docs/PRODUCT.md, "Métricas e trackers"): one row per week
 * and segment from `admin_segment_weekly()` (migrations 0015 and 0021), the
 * entry doors from `admin_door_weekly()`, the rule that picks the focus
 * segment, and which feature of FlyeeClub Pro sells it (`admin_pro_features()`,
 * migration 0039).
 *
 * Every number here is a count the database made. This module only chooses
 * which ones to put side by side and divides a part by its whole; it never
 * fills a missing week with an estimate.
 */

/** One row of `admin_segment_weekly()`, as PostgREST names its columns. */
export type SegmentWeekRow = {
  week_start: string;
  segment: string;
  kit_buyers: number;
  page_views: number;
  page_conversion: number | null;
  access_cohort: number;
  activated_7d: number;
  weekly_active: number;
  kit_to_club_60d: number;
  payers_90d: number;
  revenue_90d_brl: number;
  revenue_90d_usd: number;
  payers_90d_brl: number;
  payers_90d_usd: number;
};

/** One row of `admin_door_weekly()`. */
export type DoorWeekRow = {
  week_start: string;
  origem: string | null;
  page_views: number;
  kit_buyers: number;
  page_conversion: number | null;
};

/** The segments the focus rule compares. `outro` and an unanswered segment never lead. */
export const FOCUS_SEGMENTS = ["negocio", "agencia", "produto", "dev"] as const;

/** The proposal in docs/PRODUCT.md, used as the indicator until the rule is decided. */
export const FOCUS_MIN_PEOPLE = 30;
export const FOCUS_WEEKS = 4;

/** How many weeks the console reads: the current one and seven before it. */
export const REPORT_WEEKS = 8;

const DAY = 86_400_000;

export type MetricKey = "kit" | "activation" | "weekly" | "conversion" | "revenue";

/** What one cell says. `display` is the figure; `detail` its x-of-y; `pending` marks a window still open. */
export type MetricCell = {
  value: number | null;
  display: string;
  detail?: string;
  pending: boolean;
};

export type MetricDefinition = {
  key: MetricKey;
  /** The tab label. */
  label: string;
  /** One sentence: what is counted, and over which window. */
  description: string;
  cell: (row: SegmentWeekRow, now: number) => MetricCell;
};

/** A window that started at `weekStart` and lasts `days` past the week's end is still open. */
const stillOpen = (weekStart: string, days: number, now: number) =>
  new Date(`${weekStart.slice(0, 10)}T03:00:00Z`).getTime() + (7 + days) * DAY > now;

function rateCell(part: number, whole: number, pending: boolean, unit: string): MetricCell {
  const value = ratio(part, whole);
  return {
    value,
    display: value === null ? "—" : formatPercent(value),
    detail: whole > 0 ? `${formatNumber(part)} de ${formatNumber(whole)} ${unit}` : undefined,
    pending,
  };
}

/** Revenue per member, each currency over its own payers: `R$ 97 · US$ 29`. */
function revenueCell(row: SegmentWeekRow): MetricCell {
  const parts: string[] = [];
  if (row.payers_90d_brl > 0) parts.push(formatMoney(Math.round(row.revenue_90d_brl / row.payers_90d_brl), "BRL"));
  if (row.payers_90d_usd > 0) parts.push(formatMoney(Math.round(row.revenue_90d_usd / row.payers_90d_usd), "USD"));
  return {
    value: row.payers_90d > 0 ? row.revenue_90d_brl + row.revenue_90d_usd : null,
    display: parts.length > 0 ? parts.join(" · ") : "—",
    detail:
      row.payers_90d > 0
        ? `${formatNumber(row.payers_90d)} ${row.payers_90d === 1 ? "pagante" : "pagantes"}`
        : undefined,
    pending: false,
  };
}

export const METRICS: MetricDefinition[] = [
  {
    key: "kit",
    label: "Compradores do kit",
    description: "Compras do kit feitas na semana e ainda pagas.",
    cell: (row) => ({ value: row.kit_buyers, display: formatNumber(row.kit_buyers), pending: false }),
  },
  {
    key: "activation",
    label: "Ativação em 7 dias",
    description:
      "De quem ganhou acesso (kit ou assinatura paga) na semana, quantos executaram uma ferramenta em até 7 dias.",
    cell: (row, now) =>
      rateCell(row.activated_7d, row.access_cohort, stillOpen(row.week_start, 7, now), "com acesso novo"),
  },
  {
    key: "weekly",
    label: "Uso semanal",
    description: "Contas que executaram ferramentas em pelo menos 3 das 4 semanas que terminam nesta.",
    cell: (row) => ({ value: row.weekly_active, display: formatNumber(row.weekly_active), pending: false }),
  },
  {
    key: "conversion",
    label: "Kit para assinatura em 60 dias",
    description: "Dos compradores do kit da semana, quantos começaram uma assinatura paga em até 60 dias.",
    cell: (row, now) =>
      rateCell(row.kit_to_club_60d, row.kit_buyers, stillOpen(row.week_start, 60, now), "compradores do kit"),
  },
  {
    key: "revenue",
    label: "Receita por integrante em 90 dias",
    description:
      "O que cada pagante pagou nos 90 dias que terminam na semana (kit, assinatura e upgrades), por moeda: as moedas nunca se somam.",
    cell: (row) => revenueCell(row),
  },
];

export const metricByKey = (key: MetricKey): MetricDefinition =>
  METRICS.find((metric) => metric.key === key) ?? METRICS[0];

/** The weeks of the report, oldest first, and which one is still running. */
export function reportWeeks(rows: SegmentWeekRow[], now: number): { weeks: string[]; current: string } {
  const weeks = [...new Set(rows.map((row) => row.week_start.slice(0, 10)))].sort();
  return { weeks, current: weekStartOf(now) };
}

export type MetricMatrix = {
  weeks: string[];
  current: string;
  rows: { segment: string; label: string; inRule: boolean; cells: MetricCell[] }[];
  /** The week's figure over every segment together, for the trend. */
  totals: { week: string; value: number | null; display: string }[];
};

/** Sums several rows into one: the whole club for a week. */
function sumRows(rows: SegmentWeekRow[], week: string): SegmentWeekRow {
  const sum = (key: keyof SegmentWeekRow) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return {
    week_start: week,
    segment: "all",
    kit_buyers: sum("kit_buyers"),
    page_views: rows[0]?.page_views ?? 0,
    page_conversion: null,
    access_cohort: sum("access_cohort"),
    activated_7d: sum("activated_7d"),
    weekly_active: sum("weekly_active"),
    kit_to_club_60d: sum("kit_to_club_60d"),
    payers_90d: sum("payers_90d"),
    revenue_90d_brl: sum("revenue_90d_brl"),
    revenue_90d_usd: sum("revenue_90d_usd"),
    payers_90d_brl: sum("payers_90d_brl"),
    payers_90d_usd: sum("payers_90d_usd"),
  };
}

/** One metric as a segment × week grid, segments in a fixed order, the two outside the rule last. */
export function buildMatrix(rows: SegmentWeekRow[], key: MetricKey, now: number): MetricMatrix {
  const metric = metricByKey(key);
  const { weeks, current } = reportWeeks(rows, now);
  const byCell = new Map(rows.map((row) => [`${row.segment}|${row.week_start.slice(0, 10)}`, row]));
  const segments = [...SEGMENT_ORDER, ...new Set(rows.map((row) => row.segment))].filter(
    (segment, index, all) => all.indexOf(segment) === index && rows.some((row) => row.segment === segment),
  );
  return {
    weeks,
    current,
    rows: segments.map((segment) => ({
      segment,
      label: labelOf(SEGMENT_LABEL, segment),
      inRule: (FOCUS_SEGMENTS as readonly string[]).includes(segment),
      cells: weeks.map((week) => {
        const row = byCell.get(`${segment}|${week}`);
        return row ? metric.cell(row, now) : { value: null, display: "—", pending: false };
      }),
    })),
    totals: weeks.map((week) => {
      const whole = sumRows(
        rows.filter((row) => row.week_start.slice(0, 10) === week),
        week,
      );
      const cell = metric.cell(whole, now);
      return { week, value: cell.value, display: cell.display };
    }),
  };
}

// ---------- The focus rule ----------

/** Accounts with access (kit, subscription or Pro), per segment: who the "30 people" are. */
export function segmentPopulation(members: MemberRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const member of members) {
    if (!member.tier) continue;
    const segment = member.segment ?? "unknown";
    counts[segment] = (counts[segment] ?? 0) + 1;
  }
  return counts;
}

export type FocusMetric = "kit" | "activation" | "weekly";

export const FOCUS_METRIC_LABEL: Record<FocusMetric, string> = {
  kit: "Compra do kit",
  activation: "Ativação em 7 dias",
  weekly: "Uso semanal",
};

/** Who led one metric in one week, or why nobody did. */
export type Lead = { segment: string } | { segment: null; reason: "tie" | "no_data" };

export type FocusWeek = { week: string; leads: Record<FocusMetric, Lead>; leader: string | null };

export type FocusRuleResult = {
  /** Focus segments with at least FOCUS_MIN_PEOPLE accounts with access: the ones compared. */
  comparable: string[];
  population: Record<string, number>;
  /** The complete weeks read, oldest first. */
  weeks: FocusWeek[];
  /** The segment leading all three metrics in the most recent complete weeks, and for how many in a row. */
  streak: { segment: string; weeks: number } | null;
  status: "not_enough_people" | "not_enough_weeks" | "no_leader" | "leading" | "met";
};

const focusValue = (row: SegmentWeekRow | undefined, metric: FocusMetric): number | null => {
  if (!row) return null;
  if (metric === "kit") return row.kit_buyers;
  if (metric === "weekly") return row.weekly_active;
  return ratio(row.activated_7d, row.access_cohort);
};

/** The one segment with the strictly highest value above zero; a tie or a blank week leads nobody. */
export function leaderOf(values: { segment: string; value: number | null }[]): Lead {
  const known = values.filter((entry): entry is { segment: string; value: number } => entry.value !== null);
  const top = Math.max(0, ...known.map((entry) => entry.value));
  if (top <= 0) return { segment: null, reason: "no_data" };
  const leaders = known.filter((entry) => entry.value === top);
  return leaders.length === 1 ? { segment: leaders[0].segment } : { segment: null, reason: "tie" };
}

/**
 * The proposal of docs/PRODUCT.md, read as an indicator: a segment leads the
 * purchase of the kit, the 7-day activation AND the weekly use for 4 complete
 * weeks in a row, comparing only segments with at least 30 accounts with
 * access. The running week is left out: a leader that flips on a Tuesday
 * afternoon is not a signal.
 */
export function focusRule(rows: SegmentWeekRow[], population: Record<string, number>, now: number): FocusRuleResult {
  const comparable = FOCUS_SEGMENTS.filter((segment) => (population[segment] ?? 0) >= FOCUS_MIN_PEOPLE);
  const current = weekStartOf(now);
  const complete = [...new Set(rows.map((row) => row.week_start.slice(0, 10)))]
    .filter((week) => week < current)
    .sort()
    .slice(-FOCUS_WEEKS);
  const byCell = new Map(rows.map((row) => [`${row.segment}|${row.week_start.slice(0, 10)}`, row]));

  const weeks: FocusWeek[] = complete.map((week) => {
    const leads = Object.fromEntries(
      (["kit", "activation", "weekly"] as FocusMetric[]).map((metric) => [
        metric,
        leaderOf(
          comparable.map((segment) => ({ segment, value: focusValue(byCell.get(`${segment}|${week}`), metric) })),
        ),
      ]),
    ) as Record<FocusMetric, Lead>;
    const names = Object.values(leads).map((lead) => lead.segment);
    const leader = names[0] && names.every((name) => name === names[0]) ? names[0] : null;
    return { week, leads, leader };
  });

  let streak: FocusRuleResult["streak"] = null;
  const newest = weeks[weeks.length - 1]?.leader ?? null;
  if (newest) {
    let count = 0;
    for (let index = weeks.length - 1; index >= 0 && weeks[index].leader === newest; index -= 1) count += 1;
    streak = { segment: newest, weeks: count };
  }

  const status: FocusRuleResult["status"] =
    comparable.length < 2
      ? "not_enough_people"
      : weeks.length < FOCUS_WEEKS
        ? streak
          ? "leading"
          : "not_enough_weeks"
        : streak && streak.weeks >= FOCUS_WEEKS
          ? "met"
          : streak
            ? "leading"
            : "no_leader";

  return { comparable: [...comparable], population, weeks, streak, status };
}

/** The rule's state in one sentence, for the console and for the weekly digest. */
export function focusSentence(result: FocusRuleResult): string {
  const name = (segment: string) => labelOf(SEGMENT_LABEL, segment);
  if (result.status === "not_enough_people") {
    return result.comparable.length === 1
      ? `Só ${name(result.comparable[0])} tem ${FOCUS_MIN_PEOPLE} contas com acesso: ainda não há com quem comparar.`
      : `Nenhum segmento chegou a ${FOCUS_MIN_PEOPLE} contas com acesso: a comparação começa quando dois chegarem.`;
  }
  if (result.status === "met" && result.streak) {
    return `Regra cumprida: ${name(result.streak.segment)} lidera compra do kit, ativação e uso semanal há ${result.streak.weeks} semanas seguidas.`;
  }
  if (result.streak) {
    return `${name(result.streak.segment)} lidera as três métricas há ${result.streak.weeks} de ${FOCUS_WEEKS} semanas seguidas.`;
  }
  if (result.status === "not_enough_weeks") return "Ainda não há semanas completas suficientes para ler a regra.";
  return "Nenhum segmento liderou as três métricas na última semana completa.";
}

// ---------- Entry doors ----------

export type DoorTotal = { door: string; views: number; buyers: number; conversion: number | null };

/** The doors over the whole report window, most visited first. An untracked arrival is "direto". */
export function doorTotals(rows: DoorWeekRow[]): DoorTotal[] {
  const totals = new Map<string, { views: number; buyers: number }>();
  for (const row of rows) {
    const door = row.origem || "direto";
    const entry = totals.get(door) ?? { views: 0, buyers: 0 };
    entry.views += Number(row.page_views ?? 0);
    entry.buyers += Number(row.kit_buyers ?? 0);
    totals.set(door, entry);
  }
  return [...totals.entries()]
    .map(([door, entry]) => ({ door, ...entry, conversion: ratio(entry.buyers, entry.views) }))
    .sort((a, b) => b.views - a.views || b.buyers - a.buyers || a.door.localeCompare(b.door));
}

// ---------- What sells FlyeeClub Pro ----------

/** One row of `admin_pro_features()` (migration 0039): workspaces per column, each counted once. */
export type ProFeatureRow = { feature: string; viewed: number; clicked: number; purchased: number };

/** The days the report looks back. */
export const PRO_FEATURE_DAYS = 90;

/** The features whose click opens the upgrade prompt (lib/upgrade.ts), as the operator reads them. */
export const PRO_FEATURE_LABEL: Record<string, string> = {
  roadmap_propose: "Propor um app",
  roadmap_vote: "Votar no roadmap",
  recipe_install: "Instalar a receita inteira",
  recipe_workflow: "Passo a passo da receita",
  meeting_register: "Encontros ao vivo",
  advanced_guide: "Guia abrir o capô",
  more_devices: "Mais computadores",
};

export type ProFeatureTotal = ProFeatureRow & { conversion: number | null };

/**
 * The features that sold the most first: purchases, then clicks, then
 * prompts opened; a tie keeps the order of the database. Conversion is
 * purchases over prompts opened, null before the first prompt.
 */
export function proFeatureTotals(rows: ProFeatureRow[]): ProFeatureTotal[] {
  return rows
    .map((row, position) => ({ row, position }))
    .sort(
      (a, b) =>
        b.row.purchased - a.row.purchased ||
        b.row.clicked - a.row.clicked ||
        b.row.viewed - a.row.viewed ||
        a.position - b.position,
    )
    .map(({ row }) => ({ ...row, conversion: ratio(row.purchased, row.viewed) }));
}

// ---------- Reads ----------

export async function loadSegmentWeekly(supabase: SupabaseClient, weeks = REPORT_WEEKS): Promise<SegmentWeekRow[]> {
  const { data, error } = await supabase.rpc("admin_segment_weekly", { target_weeks: weeks });
  if (error) throw new Error("segment_weekly_failed");
  return ((data ?? []) as SegmentWeekRow[]).map((row) => ({
    ...row,
    page_views: Number(row.page_views ?? 0),
    revenue_90d_brl: Number(row.revenue_90d_brl ?? 0),
    revenue_90d_usd: Number(row.revenue_90d_usd ?? 0),
    page_conversion: row.page_conversion === null ? null : Number(row.page_conversion),
  }));
}

export async function loadDoorWeekly(supabase: SupabaseClient, weeks = REPORT_WEEKS): Promise<DoorWeekRow[]> {
  const { data, error } = await supabase.rpc("admin_door_weekly", { target_weeks: weeks });
  if (error) throw new Error("door_weekly_failed");
  return ((data ?? []) as DoorWeekRow[]).map((row) => ({ ...row, page_views: Number(row.page_views ?? 0) }));
}

export async function loadProFeatures(supabase: SupabaseClient, days = PRO_FEATURE_DAYS): Promise<ProFeatureRow[]> {
  const { data, error } = await supabase.rpc("admin_pro_features", { target_days: days });
  if (error) throw new Error("pro_features_failed");
  return ((data ?? []) as ProFeatureRow[]).map((row) => ({
    feature: row.feature,
    viewed: Number(row.viewed ?? 0),
    clicked: Number(row.clicked ?? 0),
    purchased: Number(row.purchased ?? 0),
  }));
}
