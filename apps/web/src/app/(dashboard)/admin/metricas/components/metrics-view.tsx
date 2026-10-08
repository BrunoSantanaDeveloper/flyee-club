"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Grid, Tab, Tabs, Typography } from "@mui/material";

import ComparisonTable, { type ComparisonRow } from "@/components/product/comparison-table";
import EmptyState from "@/components/product/empty-state";
import MetricBars from "@/components/product/metric-bars";
import PageHeader from "@/components/product/page-header";
import StatusChip, { type StatusTone } from "@/components/product/status-chip";
import TrendSparkline from "@/components/product/trend-sparkline";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiRefresh from "@/icons/nexture/ni-refresh";
import { formatDateTime, formatNumber, formatPercent, formatWeek } from "@/lib/admin/format";
import { labelOf, SEGMENT_LABEL } from "@/lib/admin/labels";
import {
  buildMatrix,
  type DoorTotal,
  FOCUS_METRIC_LABEL,
  FOCUS_MIN_PEOPLE,
  FOCUS_SEGMENTS,
  FOCUS_WEEKS,
  type FocusMetric,
  type FocusRuleResult,
  focusSentence,
  type Lead,
  type MetricKey,
  METRICS,
  PRO_FEATURE_DAYS,
  PRO_FEATURE_LABEL,
  type ProFeatureTotal,
  type SegmentWeekRow,
} from "@/lib/admin/metrics";
import type { ConsoleState } from "@/lib/admin/session";

export type MetricsState = ConsoleState<{
  weekly: SegmentWeekRow[];
  doors: DoorTotal[];
  focus: FocusRuleResult;
  /** Per feature of FlyeeClub Pro, the prompts opened, the clicks and the purchases that followed. */
  proFeatures: ProFeatureTotal[];
  generatedAt: string;
}>;

const CRUMBS = [{ label: "Início", href: "/inicio" }, { label: "Admin", href: "/admin" }, { label: "Métricas" }];

const STATUS_CHIP: Record<FocusRuleResult["status"], { label: string; tone: StatusTone }> = {
  not_enough_people: { label: "poucos integrantes", tone: "neutral" },
  not_enough_weeks: { label: "poucas semanas", tone: "neutral" },
  no_leader: { label: "sem líder", tone: "neutral" },
  leading: { label: "em andamento", tone: "attention" },
  met: { label: "regra cumprida", tone: "positive" },
};

const leadLabel = (lead: Lead) =>
  lead.segment !== null ? labelOf(SEGMENT_LABEL, lead.segment) : lead.reason === "tie" ? "empate" : "sem dados";

/**
 * Which segment the club should focus on, decided by data and not by a date
 * (docs/PRODUCT.md, "Métricas e trackers"). The operator comes here weekly to
 * answer one question: is any segment leading purchase, activation and weekly
 * use for four weeks in a row? The rest of the screen shows the five metrics
 * behind that answer, week by week, so a leader can be checked by eye, the
 * entry doors, and which feature of FlyeeClub Pro sells it, since Pro is
 * offered only on the click of one of them (docs/PRODUCT.md, 2026-10-08).
 */
export default function MetricsView({ state }: { state: MetricsState }) {
  const router = useRouter();
  const [metric, setMetric] = useState<MetricKey>("kit");
  const now = state.kind === "ready" ? new Date(state.generatedAt).getTime() : 0;
  const matrix = useMemo(
    () => (state.kind === "ready" ? buildMatrix(state.weekly, metric, now) : null),
    [state, metric, now],
  );

  const header = (
    <PageHeader
      title="Métricas por segmento"
      crumbs={CRUMBS}
      description="As cinco métricas que decidem o segmento de foco, semana a semana, e a regra que diz quando um segmento lidera."
      action={
        <Button
          variant="outlined"
          color="grey"
          startIcon={<NiRefresh size="medium" />}
          onClick={() => router.refresh()}
        >
          Atualizar
        </Button>
      }
    />
  );

  if (state.kind !== "ready" || !matrix) {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>{header}</Grid>
        <Grid size={12}>
          {state.kind === "unavailable" ? (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Este console precisa do Supabase configurado e de uma sessão com o papel de superadmin.
            </Alert>
          ) : (
            // A failed read is an error, never a week with nothing in it.
            <Alert
              severity="error"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" onClick={() => router.refresh()}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler as métricas agora.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  const { focus, doors, proFeatures } = state;
  const anyPrompt = proFeatures.some((row) => row.viewed > 0 || row.clicked > 0);
  const definition = METRICS.find((entry) => entry.key === metric) ?? METRICS[0];
  const anyActivity = state.weekly.some(
    (row) => row.kit_buyers > 0 || row.access_cohort > 0 || row.weekly_active > 0 || row.payers_90d > 0,
  );
  const weekColumns = matrix.weeks.map((week) => ({
    key: week,
    label: formatWeek(week),
    note: week === matrix.current ? "em andamento" : undefined,
    highlight: week === matrix.current,
  }));
  const pendingLegend = matrix.rows.some((row) => row.cells.some((cell) => cell.pending))
    ? "† Janela ainda aberta: o número pode crescer até ela fechar."
    : undefined;
  const toRow = (row: (typeof matrix.rows)[number]): ComparisonRow => ({
    key: row.segment,
    label: row.label,
    note: row.inRule ? undefined : "fora da regra de foco",
    muted: !row.inRule,
    cells: row.cells.map((cell) => ({
      primary: cell.display,
      secondary: cell.detail,
      mark: cell.pending ? "†" : undefined,
    })),
  });
  const trend =
    definition.key === "kit" || definition.key === "weekly" ? matrix.totals.map((total) => total.value ?? 0) : null;
  const focusMetrics: FocusMetric[] = ["kit", "activation", "weekly"];

  return (
    <Grid container spacing={5}>
      <Grid size={12}>{header}</Grid>

      <Grid size={12}>
        <Card component="section" aria-labelledby="focus-title">
          <CardContent className="flex flex-col gap-6">
            {/* The rule and who is eligible sit side by side; the leaders table
                below takes the full width, since four weeks of segment names do
                not fit in a column on a desktop screen. */}
            <Grid container spacing={5}>
              <Grid size={{ xs: 12, lg: 7 }} className="flex flex-col gap-2">
                <Box className="flex flex-row flex-wrap items-center gap-2">
                  <Typography id="focus-title" variant="h5" component="h2" className="mb-0">
                    Regra de foco
                  </Typography>
                  <StatusChip label={STATUS_CHIP[focus.status].label} tone={STATUS_CHIP[focus.status].tone} />
                </Box>
                <Typography variant="body1">{focusSentence(focus)}</Typography>
                <Typography variant="body2" className="text-text-secondary">
                  Proposta do documento de produto, usada como indicador até a regra ser decidida: um segmento lidera
                  compra do kit, ativação em 7 dias e uso semanal por {FOCUS_WEEKS} semanas completas seguidas,
                  comparando só segmentos com pelo menos {FOCUS_MIN_PEOPLE} contas com acesso. “Outro” e quem não
                  respondeu ficam de fora. A semana em andamento não entra.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Typography variant="subtitle2" component="h3" className="mb-3">
                  Contas com acesso por segmento
                </Typography>
                <MetricBars
                  items={FOCUS_SEGMENTS.map((segment) => {
                    const people = focus.population[segment] ?? 0;
                    return {
                      key: segment,
                      label: labelOf(SEGMENT_LABEL, segment),
                      value: people,
                      tone: people >= FOCUS_MIN_PEOPLE ? "primary" : "empty",
                      hint:
                        people >= FOCUS_MIN_PEOPLE
                          ? "entra na comparação"
                          : `faltam ${formatNumber(FOCUS_MIN_PEOPLE - people)} para entrar na comparação`,
                    };
                  })}
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" component="h3" className="mb-3">
                Quem liderou cada métrica
              </Typography>
              {focus.weeks.length === 0 ? (
                <Typography variant="body1" className="text-text-secondary">
                  Nenhuma semana completa ainda.
                </Typography>
              ) : (
                <ComparisonTable
                  caption="Líder de cada métrica da regra de foco nas últimas semanas completas"
                  rowHeader="Métrica"
                  columns={focus.weeks.map((week) => ({
                    key: week.week,
                    label: `semana de ${formatWeek(week.week)}`,
                  }))}
                  rows={focusMetrics.map((key) => ({
                    key,
                    label: FOCUS_METRIC_LABEL[key],
                    cells: focus.weeks.map((week) => ({ primary: leadLabel(week.leads[key]) })),
                  }))}
                  footer={{
                    key: "all",
                    label: "As três",
                    cells: focus.weeks.map((week) => ({
                      primary: week.leader ? labelOf(SEGMENT_LABEL, week.leader) : "—",
                    })),
                  }}
                  legend={
                    focus.comparable.length < 2
                      ? `Com menos de dois segmentos na comparação, ninguém lidera: as células dizem “sem dados”.`
                      : undefined
                  }
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card component="section" aria-labelledby="weekly-title">
          <CardContent className="flex flex-col gap-5">
            <Box className="flex flex-col gap-1">
              <Typography id="weekly-title" variant="h5" component="h2" className="mb-0">
                Semana a semana
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                Semanas de segunda a domingo, no horário de Brasília. Gerado em {formatDateTime(state.generatedAt)}.
              </Typography>
            </Box>

            <Tabs
              value={metric}
              onChange={(_, value) => setMetric(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Métrica exibida"
            >
              {METRICS.map((entry) => (
                <Tab key={entry.key} value={entry.key} label={entry.label} />
              ))}
            </Tabs>

            <Typography variant="body1" className="text-text-secondary max-w-3xl">
              {definition.description}
            </Typography>

            {!anyActivity ? (
              <EmptyState
                icon={<NiChartLine size="large" />}
                title="Nenhuma compra, acesso ou uso nestas semanas"
                description="As linhas se enchem a partir da primeira venda do kit e da primeira ferramenta executada pela CLI. Até lá, a lista de espera é o que há para acompanhar."
                action={{ label: "Ver a lista de espera", href: "/admin/leads" }}
              />
            ) : (
              <>
                {trend ? (
                  <Box className="max-w-md">
                    <TrendSparkline
                      label={`${definition.label}, todos os segmentos`}
                      data={trend}
                      formatValue={(value) => formatNumber(value)}
                      caption={`De ${formatWeek(matrix.weeks[0])} a ${formatWeek(matrix.weeks[matrix.weeks.length - 1])}`}
                    />
                  </Box>
                ) : null}
                <ComparisonTable
                  caption={`${definition.label} por segmento e semana`}
                  rowHeader="Segmento"
                  columns={weekColumns}
                  rows={matrix.rows.map(toRow)}
                  footer={{
                    key: "all",
                    label: "Todos os segmentos",
                    cells: matrix.totals.map((total) => ({ primary: total.display })),
                  }}
                  legend={pendingLegend}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card component="section" aria-labelledby="doors-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-col gap-1">
              <Typography id="doors-title" variant="h5" component="h2" className="mb-0">
                Portas de entrada
              </Typography>
              <Typography variant="body2" className="text-text-secondary max-w-3xl">
                Visitas às páginas públicas e compras do kit nas últimas {matrix.weeks.length} semanas, por porta. Uma
                compra conta para a porta do primeiro contato da conta; quem chegou sem marcação entra como “direto”.
              </Typography>
            </Box>
            {doors.length === 0 ? (
              <EmptyState
                icon={<NiChartLine size="large" />}
                title="Nenhuma visita registrada"
                description="As visitas às páginas públicas são contadas por dia e por porta de entrada. Elas aparecem aqui assim que o site estiver no ar."
              />
            ) : (
              <ComparisonTable
                caption="Visitas, compras do kit e conversão por porta de entrada"
                rowHeader="Porta"
                columns={[
                  { key: "views", label: "Visitas" },
                  { key: "buyers", label: "Compradores do kit" },
                  { key: "conversion", label: "Conversão" },
                ]}
                rows={doors.map((door) => ({
                  key: door.door,
                  label: door.door,
                  cells: [
                    { primary: formatNumber(door.views) },
                    { primary: formatNumber(door.buyers) },
                    { primary: formatPercent(door.conversion, 2) },
                  ],
                }))}
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card component="section" aria-labelledby="pro-features-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-col gap-1">
              <Typography id="pro-features-title" variant="h5" component="h2" className="mb-0">
                Qual recurso vende o FlyeeClub Pro
              </Typography>
              <Typography variant="body2" className="text-text-secondary max-w-3xl">
                O Pro é oferecido no clique num recurso dele. Nos últimos {PRO_FEATURE_DAYS} dias, por recurso: as
                contas que abriram o aviso, as que clicaram para assinar o Pro e as que assinaram em até 14 dias depois
                desse clique. Cada conta conta uma vez por coluna.
              </Typography>
            </Box>
            {!anyPrompt ? (
              <EmptyState
                icon={<NiChartLine size="large" />}
                title="Nenhum aviso aberto ainda"
                description="O aviso abre quando um integrante sem o FlyeeClub Pro clica num recurso dele. Os números aparecem aqui a partir do primeiro."
              />
            ) : (
              <ComparisonTable
                caption="Avisos abertos, cliques e assinaturas do FlyeeClub Pro por recurso"
                rowHeader="Recurso"
                columns={[
                  { key: "viewed", label: "Avisos abertos" },
                  { key: "clicked", label: "Cliques para assinar" },
                  { key: "purchased", label: "Assinaturas em 14 dias" },
                  { key: "conversion", label: "Conversão" },
                ]}
                rows={proFeatures.map((row) => ({
                  key: row.feature,
                  label: PRO_FEATURE_LABEL[row.feature] ?? row.feature,
                  muted: row.viewed === 0 && row.clicked === 0,
                  cells: [
                    { primary: formatNumber(row.viewed) },
                    { primary: formatNumber(row.clicked) },
                    { primary: formatNumber(row.purchased) },
                    { primary: formatPercent(row.conversion, 1) },
                  ],
                }))}
              />
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
