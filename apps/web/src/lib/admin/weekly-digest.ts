import { formatNumber, formatWeek, plural, weekStartOf } from "@/lib/admin/format";
import { labelOf, SEGMENT_LABEL, SEGMENT_ORDER } from "@/lib/admin/labels";
import type { MemberTotals } from "@/lib/admin/members";
import { focusRule, focusSentence, metricByKey, type SegmentWeekRow } from "@/lib/admin/metrics";

/**
 * What the Monday digest says (lib/admin-jobs.ts): the last COMPLETE week of
 * the five focus metrics per segment, the focus rule, and the accounts that
 * need a person. Pure, so the job and its test agree on every line.
 *
 * It reads the same reports the consoles render, so the e-mail can never
 * describe a state the screen would contradict.
 */

export type DigestRow = {
  segment: string;
  kit: string;
  activation: string;
  weekly: string;
  conversion: string;
  revenue: string;
};

export type WeeklyDigest = {
  /** The Monday of the week reported, `YYYY-MM-DD`: the digest's idempotency key. */
  week: string;
  headline: string;
  focus: string;
  rows: DigestRow[];
  attention: { label: string; count: number }[];
};

/** The flags worth a person's time, in the order they are acted on. */
const ATTENTION: { key: keyof MemberTotals; label: string }[] = [
  { key: "pastDue", label: "inadimplentes" },
  { key: "cancelScheduled", label: "com cancelamento marcado" },
  { key: "staleUpdate", label: "sem atualizar há 25 dias ou mais" },
  { key: "noDevice", label: "com acesso e nenhum computador conectado" },
];

/**
 * The digest of the week before `now`, or null when there is nothing to say:
 * no purchase, no new access, no weekly use, no revenue and no account that
 * needs anyone. An alert that arrives every week with nothing in it stops
 * being read.
 */
export function buildWeeklyDigest(
  weekly: SegmentWeekRow[],
  population: Record<string, number>,
  totals: MemberTotals,
  now: number,
): WeeklyDigest | null {
  const current = weekStartOf(now);
  const complete = [...new Set(weekly.map((row) => row.week_start.slice(0, 10)))]
    .filter((week) => week < current)
    .sort();
  const week = complete[complete.length - 1];
  if (!week) return null;

  const rows = weekly.filter((row) => row.week_start.slice(0, 10) === week);
  const sum = (key: keyof SegmentWeekRow) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const buyers = sum("kit_buyers");
  const activated = sum("activated_7d");
  const active = sum("weekly_active");
  const payers = sum("payers_90d");
  const attention = ATTENTION.map((entry) => ({ label: entry.label, count: totals[entry.key] })).filter(
    (entry) => entry.count > 0,
  );

  if (buyers === 0 && sum("access_cohort") === 0 && active === 0 && payers === 0 && attention.length === 0) return null;

  const cell = (row: SegmentWeekRow, key: Parameters<typeof metricByKey>[0]) => {
    const value = metricByKey(key).cell(row, now);
    return value.pending && value.display !== "—" ? `${value.display}†` : value.display;
  };

  return {
    week,
    headline: `Semana de ${formatWeek(week)}: ${plural(buyers, "compra do kit", "compras do kit")}, ${plural(activated, "ativação", "ativações")}, ${formatNumber(active)} com uso semanal`,
    focus: focusSentence(focusRule(weekly, population, now)),
    rows: SEGMENT_ORDER.filter((segment) => rows.some((row) => row.segment === segment)).map((segment) => {
      const row = rows.find((entry) => entry.segment === segment) as SegmentWeekRow;
      return {
        segment: labelOf(SEGMENT_LABEL, segment),
        kit: cell(row, "kit"),
        activation: cell(row, "activation"),
        weekly: cell(row, "weekly"),
        conversion: cell(row, "conversion"),
        revenue: cell(row, "revenue"),
      };
    }),
    attention,
  };
}
