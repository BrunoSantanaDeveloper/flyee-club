"use client";

import { loadMemberDossier } from "../actions";
import type { PersonTarget } from "./person-actions";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Typography } from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import MetricBars from "@/components/product/metric-bars";
import StatusChip from "@/components/product/status-chip";
import TrendSparkline from "@/components/product/trend-sparkline";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyByCurrency,
  formatNumber,
  formatWeek,
  sinceLabel,
} from "@/lib/admin/format";
import {
  AI_TOOL_LABEL,
  CANCEL_REASON_LABEL,
  CONSENT_SLUG_LABEL,
  DEVICE_OS_LABEL,
  GRANT_KIND_LABEL,
  GRANT_SOURCE_LABEL,
  INVOICE_STATUS_LABEL,
  labelOf,
  LOCALE_LABEL,
  PERIOD_LABEL,
  PROJECT_KIND_LABEL,
  PROVIDER_LABEL,
  SEGMENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  TIER_LABEL,
} from "@/lib/admin/labels";
import { executionWeeks, isBanned, type MemberDossier } from "@/lib/admin/members";

/** What each limit of `org_entitlements` means, in the operator's words. */
const LIMIT_LABEL: Record<string, string> = {
  catalog_access: "Catálogo e atualizações",
  devices: "Computadores",
  advanced_lessons: "Aulas avançadas",
  recipes: "Receitas",
  roadmap_vote: "Voto no roadmap",
  meetings: "Encontros ao vivo",
  commercial_license: "Licença comercial",
  open_the_hood: "Camada abrir o capô",
};

const SOURCE_LABEL: Record<string, string> = {
  free: "plano gratuito",
  grant: "kit ou cortesia",
  subscription: "assinatura",
  provisional: "Pix em confirmação",
};

/** The first touch of the account (`signup_attribution`, migration 0005). */
const ATTRIBUTION_LABEL: Record<string, string> = {
  origem: "Porta de entrada",
  onda: "Onda",
  utm_source: "Fonte (utm_source)",
  utm_medium: "Meio (utm_medium)",
  utm_campaign: "Campanha (utm_campaign)",
  utm_content: "Conteúdo (utm_content)",
  utm_term: "Termo (utm_term)",
  referrer: "Página de origem",
  landing_path: "Primeira página visitada",
  captured_at: "Registrado em",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" className="flex flex-col gap-3">
      <Typography variant="h6" component="h3" className="mb-0">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** A labelled fact. The grid keeps the labels aligned without a table. */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <Box component="dl" className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <Box key={label} className="flex min-w-0 flex-col">
          <Typography component="dt" variant="body2" className="text-text-secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="body1" className="m-0 break-words">
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** A list row with one line of facts under its title. */
function Line({ title, detail, trailing }: { title: string; detail: string; trailing?: React.ReactNode }) {
  return (
    <Box className="border-grey-100 flex flex-row items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
      <Box className="flex min-w-0 flex-col">
        <Typography variant="subtitle2" component="p" className="break-words">
          {title}
        </Typography>
        <Typography variant="body2" className="text-text-secondary break-words">
          {detail}
        </Typography>
      </Box>
      {trailing ? <Box className="flex-none">{trailing}</Box> : null}
    </Box>
  );
}

const Nothing = ({ children }: { children: string }) => (
  <Typography variant="body1" className="text-text-secondary">
    {children}
  </Typography>
);

const limitValue = (key: string, value: unknown): string => {
  if (key === "devices") return formatNumber(Number(value ?? 0));
  if (typeof value === "number") return value > 0 ? "sim" : "não";
  return value === null || value === undefined ? "não" : String(value);
};

/**
 * Everything the platform knows about one account, in the order a support call
 * asks for it: who this is, what they have, what they paid, where it is
 * installed and whether it is used.
 */
export function MemberDossierBody({ dossier }: { dossier: MemberDossier }) {
  const { account, money, usage, tokens } = dossier;
  const entitlements = dossier.entitlements;
  const weeks = executionWeeks(usage.weeks, dossier.generatedAt);
  const limits = Object.entries(entitlements?.limits ?? {}).filter(([key]) => key in LIMIT_LABEL);
  const liveDevices = dossier.devices.filter((device) => !device.revokedAt);
  const attribution = Object.entries(dossier.attribution ?? {}).filter(([, value]) => value);

  return (
    <Box className="flex flex-col gap-8">
      <Section title="Conta">
        <Facts
          rows={[
            ["E-mail", account.email ?? "sem e-mail"],
            ["Conta criada em", formatDate(account.createdAt)],
            ["Último acesso", account.lastSignInAt ? formatDateTime(account.lastSignInAt) : "nunca entrou"],
            ["Entra com", account.authProvider === "google" ? "Google" : "e-mail e senha"],
            ["E-mail confirmado", account.confirmed ? "sim" : "não"],
            ["Verificação em duas etapas", account.twoFactor ? "ativa" : "não cadastrada"],
            ["Segmento", labelOf(SEGMENT_LABEL, account.segment, "não respondeu")],
            ["IA que usa", labelOf(AI_TOOL_LABEL, account.aiTool, "não respondeu")],
            ["Idioma", labelOf(LOCALE_LABEL, account.locale, "não definido")],
            ["Fuso horário", account.timezone ?? "não definido"],
            ["E-mails de novidades", account.marketingOptOut ? "pediu para não receber" : "recebe"],
            [
              "Documento fiscal",
              account.billingDocument
                ? `${account.billingDocument.kind.toUpperCase()} terminado em ${account.billingDocument.lastDigits}`
                : "não informado",
            ],
          ]}
        />
      </Section>

      <Section title="Acesso">
        <Facts
          rows={[
            ["Degrau", entitlements?.tier ? labelOf(TIER_LABEL, entitlements.tier) : "sem acesso ao catálogo"],
            [
              "Vem de",
              (entitlements?.sources ?? [])
                .map((source) => labelOf(SOURCE_LABEL, source.type))
                .filter((value, index, all) => all.indexOf(value) === index)
                .join(", ") || "nenhuma fonte",
            ],
            ["Conexões da CLI ativas", formatNumber(tokens.liveFamilies)],
            [
              "Próxima revalidação",
              tokens.nextRevalidationAt ? formatDate(tokens.nextRevalidationAt) : "nenhuma conexão ativa",
            ],
            ...limits.map(([key, value]): [string, string] => [LIMIT_LABEL[key], limitValue(key, value)]),
          ]}
        />
        {entitlements?.suspended ? (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            Acesso suspenso pela equipe: nada é liberado enquanto a suspensão durar, mesmo com a assinatura paga.
          </Alert>
        ) : null}
      </Section>

      <Section title="Dinheiro">
        <Facts
          rows={[
            ["Pago até hoje", formatMoneyByCurrency(money.paid)],
            ["Reembolsado", formatMoneyByCurrency(money.refunded)],
          ]}
        />
        {money.subscriptions.length === 0 && money.grants.length === 0 ? (
          <Nothing>Nenhuma compra e nenhuma assinatura.</Nothing>
        ) : (
          <Box className="flex flex-col gap-2">
            {money.subscriptions.map((subscription) => (
              <Line
                key={subscription.id}
                title={`${subscription.plan}${subscription.period ? ` ${labelOf(PERIOD_LABEL, subscription.period)}` : ""}`}
                detail={[
                  subscription.priceCents
                    ? formatMoney(subscription.priceCents, subscription.currency)
                    : "sem cobrança",
                  subscription.provider ? labelOf(PROVIDER_LABEL, subscription.provider) : "concedido pela equipe",
                  subscription.coupon ? `cupom ${subscription.coupon}` : null,
                  `desde ${formatDate(subscription.createdAt)}`,
                  subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd
                    ? `cancela em ${formatDate(subscription.currentPeriodEnd)}`
                    : null,
                  subscription.canceledAt ? `cancelada em ${formatDate(subscription.canceledAt)}` : null,
                  subscription.cancelReason
                    ? `motivo: ${labelOf(CANCEL_REASON_LABEL, subscription.cancelReason)}${subscription.cancelNote ? ` (${subscription.cancelNote})` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <StatusChip
                    label={
                      subscription.suspended ? "suspensa" : labelOf(SUBSCRIPTION_STATUS_LABEL, subscription.status)
                    }
                    tone={
                      subscription.suspended || subscription.status === "past_due"
                        ? "attention"
                        : subscription.status === "active"
                          ? "positive"
                          : "neutral"
                    }
                  />
                }
              />
            ))}
            {money.grants.map((grant) => (
              <Line
                key={grant.id}
                title={`${labelOf(GRANT_KIND_LABEL, grant.kind)}${grant.plan ? ` (${grant.plan})` : ""}`}
                detail={[
                  labelOf(GRANT_SOURCE_LABEL, grant.source),
                  grant.priceCents ? formatMoney(grant.priceCents, grant.currency) : null,
                  `em ${formatDate(grant.createdAt)}`,
                  grant.expiresAt ? `vale até ${formatDate(grant.expiresAt)}` : "sem vencimento",
                  grant.note,
                  grant.revokedAt
                    ? `revogado em ${formatDate(grant.revokedAt)}${grant.revokeReason ? `: ${grant.revokeReason}` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <StatusChip
                    label={grant.revokedAt ? "revogado" : "vale"}
                    tone={grant.revokedAt ? "neutral" : "positive"}
                  />
                }
              />
            ))}
          </Box>
        )}
        {money.invoices.length > 0 ? (
          <Box className="flex flex-col gap-2">
            <Typography variant="subtitle2" component="h4">
              Últimas faturas
            </Typography>
            {money.invoices.map((invoice) => (
              <Line
                key={invoice.id}
                title={formatMoney(invoice.amountCents, invoice.currency)}
                detail={[
                  invoice.paidAt
                    ? `paga em ${formatDate(invoice.paidAt)}`
                    : `criada em ${formatDate(invoice.createdAt)}`,
                  invoice.provider ? labelOf(PROVIDER_LABEL, invoice.provider) : null,
                  invoice.hasFiscalDocument ? "com nota fiscal" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <StatusChip
                    label={labelOf(INVOICE_STATUS_LABEL, invoice.status)}
                    tone={invoice.status === "paid" ? "positive" : invoice.status === "failed" ? "danger" : "neutral"}
                  />
                }
              />
            ))}
          </Box>
        ) : null}
      </Section>

      <Section title="Computadores">
        {dossier.devices.length === 0 ? (
          <Nothing>Nenhum computador conectado até hoje: a CLI ainda não fez login nesta conta.</Nothing>
        ) : (
          <Box className="flex flex-col gap-2">
            {dossier.devices.map((device) => (
              <Line
                key={device.id}
                title={device.name ?? "Computador sem nome"}
                detail={[
                  labelOf(DEVICE_OS_LABEL, device.os, "sistema não informado"),
                  labelOf(AI_TOOL_LABEL, device.aiTool, "IA não informada"),
                  device.cliVersion ? `CLI ${device.cliVersion}` : null,
                  `${formatNumber(device.modules)} ${device.modules === 1 ? "ferramenta instalada" : "ferramentas instaladas"}`,
                  device.projectKind ? labelOf(PROJECT_KIND_LABEL, device.projectKind) : null,
                  device.lastUpdateAt ? `atualizou ${sinceLabel(device.lastUpdateAt)}` : "nunca atualizou",
                  `visto ${sinceLabel(device.lastSeenAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <StatusChip
                    label={device.revokedAt ? "desconectado" : "conectado"}
                    tone={device.revokedAt ? "neutral" : "positive"}
                  />
                }
              />
            ))}
          </Box>
        )}
      </Section>

      <Section title="Uso">
        {usage.firstExecutionAt ? (
          <>
            <TrendSparkline
              label="Execuções de ferramentas por semana"
              data={weeks.map((week) => week.executions)}
              caption={`Oito semanas, de ${formatWeek(weeks[0].weekStart)} a ${formatWeek(weeks[weeks.length - 1].weekStart)}`}
            />
            <Facts
              rows={[
                ["Execuções em 30 dias", formatNumber(usage.executions30d)],
                ["Primeira execução", formatDate(usage.firstExecutionAt)],
                ["Última execução", sinceLabel(usage.lastExecutionAt)],
                ["Downloads em 30 dias", formatNumber(usage.downloads30d)],
              ]}
            />
            {usage.topModules30d.length > 0 ? (
              <Box className="flex flex-col gap-2">
                <Typography variant="subtitle2" component="h4">
                  Ferramentas mais usadas em 30 dias
                </Typography>
                {/* Each tool's share of ALL the account's executions, not of the six shown. */}
                <MetricBars
                  spacing="dense"
                  total={Math.max(
                    usage.executions30d,
                    usage.topModules30d.slice(0, 6).reduce((sum, entry) => sum + entry.executions, 0),
                  )}
                  items={usage.topModules30d.slice(0, 6).map((entry) => ({
                    key: entry.module,
                    label: entry.module,
                    value: entry.executions,
                  }))}
                />
              </Box>
            ) : null}
          </>
        ) : (
          <Nothing>
            {liveDevices.length > 0
              ? "Há computador conectado, mas nenhuma ferramenta foi executada ainda."
              : "Nenhuma ferramenta foi executada: a conta ainda não instalou a CLI."}
          </Nothing>
        )}
        <Facts
          rows={[
            ["Atualizações negadas em 30 dias", formatNumber(usage.denied30d)],
            [
              "Aulas iniciadas e concluídas",
              `${formatNumber(usage.lessonsStarted)} e ${formatNumber(usage.lessonsCompleted)}`,
            ],
            ["Votos no roadmap", formatNumber(usage.roadmapVotes)],
            [
              "Encontros: inscrições e presenças",
              `${formatNumber(usage.meetingsRegistered)} e ${formatNumber(usage.meetingsJoined)}`,
            ],
          ]}
        />
      </Section>

      <Section title="Termos e acessos">
        {dossier.consent.length === 0 ? (
          <Nothing>Nenhum aceite de termos registrado.</Nothing>
        ) : (
          <Box className="flex flex-col gap-2">
            {dossier.consent.map((entry) => (
              <Line
                key={`${entry.slug}-${entry.locale}-${entry.version}`}
                title={`${labelOf(CONSENT_SLUG_LABEL, entry.slug)}, versão ${entry.version}`}
                detail={`${labelOf(LOCALE_LABEL, entry.locale)} · aceito em ${formatDateTime(entry.acceptedAt)}${entry.revokedAt ? ` · retirado em ${formatDate(entry.revokedAt)}` : ""}`}
              />
            ))}
          </Box>
        )}
        <Facts
          rows={[
            ["Logins em 30 dias", formatNumber(dossier.access.signIns30d)],
            ["Sessões de suporte recebidas", formatNumber(dossier.access.supportVisits)],
          ]}
        />
      </Section>

      {attribution.length > 0 ? (
        <Section title="De onde veio">
          <Facts
            rows={attribution.map(([key, value]): [string, string] => [
              ATTRIBUTION_LABEL[key] ?? key,
              key === "captured_at" ? formatDateTime(String(value)) : String(value),
            ])}
          />
        </Section>
      ) : null}
    </Box>
  );
}

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; dossier: MemberDossier };

/**
 * The dossier of one account, read when it is opened. Mounted only while open
 * and keyed by the workspace, so one account's data never shows under
 * another's name.
 */
export default function MemberDossierDialog({
  orgId,
  name,
  preloaded,
  canImpersonate,
  canResetMfa,
  onImpersonate,
  onResetMfa,
  onClose,
}: {
  orgId: string;
  name: string;
  /** A dossier already in hand (fixtures): skips the read. */
  preloaded?: MemberDossier;
  canImpersonate: (target: PersonTarget) => boolean;
  canResetMfa: (target: PersonTarget) => boolean;
  onImpersonate: (target: PersonTarget) => void;
  onResetMfa: (target: PersonTarget) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>(
    preloaded ? { kind: "ready", dossier: preloaded } : { kind: "loading" },
  );

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    loadMemberDossier(orgId).then(
      (result) => {
        if (cancelled) return;
        setState(result.ok ? { kind: "ready", dossier: result } : { kind: "error" });
      },
      () => {
        if (!cancelled) setState({ kind: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [orgId, preloaded]);

  const dossier = state.kind === "ready" ? state.dossier : null;
  const target: PersonTarget | null =
    dossier && dossier.account.userId
      ? {
          userId: dossier.account.userId,
          orgId,
          name,
          email: dossier.account.email,
          isSuperadmin: dossier.account.isSuperadmin,
          hasMfa: dossier.account.twoFactor,
          banned: isBanned(dossier.account.bannedUntil),
          devices: dossier.devices.filter((device) => !device.revokedAt).length,
        }
      : null;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper" aria-labelledby="member-dossier-title">
      <DialogHeader
        id="member-dossier-title"
        title={name}
        onClose={onClose}
        closeLabel="Fechar o dossiê"
        trailing={
          dossier ? (
            <>
              <StatusChip
                label={dossier.entitlements?.tier ? labelOf(TIER_LABEL, dossier.entitlements.tier) : "sem acesso"}
                tone={dossier.entitlements?.tier ? "primary" : "neutral"}
              />
              {dossier.account.isSuperadmin ? <StatusChip label="superadmin" tone="info" /> : null}
              {isBanned(dossier.account.bannedUntil) ? <StatusChip label="bloqueada" tone="danger" /> : null}
            </>
          ) : null
        }
      />
      <DialogContent dividers>
        {state.kind === "loading" ? (
          <Box className="flex min-h-40 items-center gap-3">
            <CircularProgress size={20} aria-label="Carregando" />
            <Typography variant="body1" className="text-text-secondary">
              Lendo tudo o que a plataforma sabe desta conta…
            </Typography>
          </Box>
        ) : state.kind === "error" ? (
          // A failed read is an error, never an account that looks empty.
          <Alert severity="error" className="neutral bg-background-paper/60!">
            Não foi possível ler o dossiê desta conta. Feche e abra de novo; se continuar, confira se a sua sessão ainda
            tem o papel de superadmin.
          </Alert>
        ) : (
          <MemberDossierBody dossier={state.dossier} />
        )}
      </DialogContent>
      {/* Three actions do not fit a phone's width: the row wraps and each
          label stays on one line, instead of every button breaking in two. */}
      <DialogActions disableSpacing className="flex-wrap gap-2">
        <Button variant="text" color="grey" component={Link} href="/admin/billing" className="whitespace-nowrap">
          Abrir faturamento
        </Button>
        {target && canResetMfa(target) ? (
          <Button variant="outlined" color="grey" onClick={() => onResetMfa(target)} className="whitespace-nowrap">
            Redefinir 2FA
          </Button>
        ) : null}
        {target && canImpersonate(target) ? (
          <Button variant="contained" onClick={() => onImpersonate(target)} className="whitespace-nowrap">
            Entrar como
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
