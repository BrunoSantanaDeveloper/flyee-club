"use client";

import MemberDossierDialog from "./member-dossier-dialog";
import { type PersonTarget, usePersonActions } from "./person-actions";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Grid, Tab, Tabs, Typography } from "@mui/material";
import { GridActionsCellItem, type GridColDef } from "@mui/x-data-grid";

import DataTable from "@/components/data-grid/data-table";
import EmptyState from "@/components/product/empty-state";
import { StatTile } from "@/components/product/home-tiles";
import PageHeader from "@/components/product/page-header";
import StatusChip from "@/components/product/status-chip";
import type { TileTone } from "@/components/product/tile-tone";
import IllustrationAccounts from "@/icons/illustrations/illustration-accounts";
import IllustrationConfigure from "@/icons/illustrations/illustration-configure";
import IllustrationDocumentation from "@/icons/illustrations/illustration-documentation";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiClock from "@/icons/nexture/ni-clock";
import NiCoin from "@/icons/nexture/ni-coin";
import NiCreditCard from "@/icons/nexture/ni-credit-card";
import NiCrown from "@/icons/nexture/ni-crown";
import NiDocumentFull from "@/icons/nexture/ni-document-full";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiPause from "@/icons/nexture/ni-pause";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiStar from "@/icons/nexture/ni-star";
import NiUserMinus from "@/icons/nexture/ni-user-minus";
import NiUsers from "@/icons/nexture/ni-users";
import { formatDate, formatDateTime, formatMoneyByCurrency, formatNumber, sinceLabel } from "@/lib/admin/format";
import { AI_TOOL_LABEL, labelOf, SEGMENT_LABEL, TIER_LABEL } from "@/lib/admin/labels";
import {
  ATTENTION_FILTERS,
  filterMembers,
  isBanned,
  memberClock,
  type MemberRow,
  memberSearchText,
  type MembersOverview,
  type MemberTotals,
  type PeopleWithoutWorkspace,
  type PersonWithoutWorkspace,
  planLabel,
  TIER_FILTERS,
} from "@/lib/admin/members";
import type { ConsoleState } from "@/lib/admin/session";

export type MembersState = ConsoleState<{
  overview: MembersOverview;
  people: PeopleWithoutWorkspace;
  superadminIds: string[];
  selfId: string;
  /** False without SUPABASE_SERVICE_ROLE_KEY: the auth-admin actions are not offered. */
  serviceAvailable: boolean;
}>;

const CRUMBS = [{ label: "Início", href: "/inicio" }, { label: "Admin", href: "/admin" }, { label: "Membros" }];

const FILTER_ICON: Record<keyof MemberTotals, { icon: React.ReactNode; tone: TileTone }> = {
  accounts: { icon: <NiUsers size="large" />, tone: "primary" },
  kit: { icon: <NiCoin size="large" />, tone: "accent-2" },
  club: { icon: <NiStar size="large" />, tone: "primary" },
  pro: { icon: <NiCrown size="large" />, tone: "accent-4" },
  noAccess: { icon: <NiUserMinus size="large" />, tone: "secondary" },
  pastDue: { icon: <NiCreditCard size="large" />, tone: "accent-3" },
  noDevice: { icon: <NiLaptop size="large" />, tone: "accent-3" },
  staleUpdate: { icon: <NiClock size="large" />, tone: "accent-3" },
  cancelScheduled: { icon: <NiCalendar size="large" />, tone: "accent-3" },
  suspended: { icon: <NiPause size="large" />, tone: "secondary" },
};

const nameOf = (person: { name: string | null; email: string | null }) =>
  person.name ?? person.email ?? "Conta sem nome";

/**
 * Who is in the club and what needs attention. The operator arrives with one
 * of two jobs: a support call about ONE person (search, open the dossier, act)
 * or a look at a GROUP that needs something (the tiles are the filters). Both
 * end in a list of many accounts to scan and compare, which is why this is a
 * table.
 */
export default function MembersView({
  state,
  notice = null,
}: {
  state: MembersState;
  /** A support session just ended, by the operator or by its time limit. */
  notice?: "ended" | "expired" | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<keyof MemberTotals>("accounts");
  const [tab, setTab] = useState<"accounts" | "people">("accounts");
  const [query, setQuery] = useState("");
  const [dossier, setDossier] = useState<MemberRow | null>(null);

  const ready = state.kind === "ready" ? state : null;
  const refresh = useCallback(() => router.refresh(), [router]);
  const actions = usePersonActions({
    selfId: ready?.selfId ?? null,
    serviceAvailable: ready?.serviceAvailable ?? false,
    onChanged: refresh,
  });

  const superadmins = useMemo(() => new Set(ready?.superadminIds ?? []), [ready?.superadminIds]);
  const members = useMemo(() => ready?.overview.members ?? [], [ready?.overview.members]);
  const visible = useMemo(() => filterMembers(members, filter), [members, filter]);

  const targetOf = useCallback(
    (row: MemberRow): PersonTarget | null =>
      row.userId
        ? {
            userId: row.userId,
            orgId: row.orgId,
            name: nameOf(row),
            email: row.email,
            isSuperadmin: superadmins.has(row.userId),
            hasMfa: false,
            banned: isBanned(row.bannedUntil),
            devices: row.devices.live,
          }
        : null,
    [superadmins],
  );

  // The columns shown by default fit a desktop screen with the row actions in
  // view; plan, AI, amount paid and join date start hidden in the columns
  // panel, and the dossier carries all of them.
  const memberColumns = useMemo<GridColDef<MemberRow>[]>(
    () => [
      {
        field: "member",
        headerName: "Integrante",
        flex: 1.5,
        minWidth: 220,
        valueGetter: (_, row) => memberSearchText(row),
        renderCell: ({ row }) => (
          <Box className="flex min-w-0 flex-col justify-center py-1">
            <Box className="flex min-w-0 flex-row items-center gap-2">
              <Typography variant="subtitle2" component="span" className="truncate">
                {nameOf(row)}
              </Typography>
              {isBanned(row.bannedUntil) ? <StatusChip label="bloqueada" tone="danger" /> : null}
              {row.userId && superadmins.has(row.userId) ? <StatusChip label="superadmin" tone="info" /> : null}
            </Box>
            <Typography variant="body2" className="text-text-secondary truncate">
              {row.email ?? "sem e-mail"}
              {row.flags.neverSignedIn ? " · nunca entrou" : ""}
            </Typography>
          </Box>
        ),
      },
      {
        field: "tier",
        headerName: "Degrau",
        width: 120,
        valueGetter: (_, row) => (row.tier ? TIER_LABEL[row.tier] : "Sem acesso"),
        renderCell: ({ row }) => (
          <StatusChip label={row.tier ? TIER_LABEL[row.tier] : "sem acesso"} tone={row.tier ? "primary" : "neutral"} />
        ),
      },
      { field: "plan", headerName: "Plano", flex: 1, minWidth: 190, valueGetter: (_, row) => planLabel(row) },
      { field: "clock", headerName: "Prazo", flex: 1, minWidth: 170, valueGetter: (_, row) => memberClock(row) },
      {
        field: "segment",
        headerName: "Segmento",
        width: 170,
        valueGetter: (_, row) => labelOf(SEGMENT_LABEL, row.segment, "não respondeu"),
      },
      {
        field: "aiTool",
        headerName: "IA",
        width: 130,
        valueGetter: (_, row) => labelOf(AI_TOOL_LABEL, row.aiTool, "não respondeu"),
      },
      {
        field: "devices",
        headerName: "Computadores",
        flex: 1,
        minWidth: 180,
        type: "number",
        align: "left",
        headerAlign: "left",
        valueGetter: (_, row) => row.devices.live,
        renderCell: ({ row }) =>
          row.devices.live === 0
            ? "nenhum conectado"
            : `${formatNumber(row.devices.live)} · ${row.devices.lastUpdateAt ? `atualizou ${sinceLabel(row.devices.lastUpdateAt)}` : "nunca atualizou"}`,
      },
      {
        field: "executions30d",
        headerName: "Execuções 30 d",
        width: 130,
        type: "number",
        valueGetter: (_, row) => row.executions30d,
      },
      {
        field: "revenue",
        headerName: "Pago até hoje",
        width: 170,
        type: "number",
        align: "left",
        headerAlign: "left",
        // Sorting needs one number; the cell keeps the currencies apart.
        valueGetter: (_, row) => row.revenue.BRL + row.revenue.USD,
        renderCell: ({ row }) => formatMoneyByCurrency(row.revenue),
      },
      {
        field: "createdAt",
        headerName: "Entrou em",
        width: 120,
        valueGetter: (_, row) => row.createdAt,
        renderCell: ({ row }) => formatDate(row.createdAt),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Ações",
        width: 64,
        getActions: ({ row }) => {
          const target = targetOf(row);
          return [
            <GridActionsCellItem
              key="dossier"
              icon={<NiDocumentFull size="medium" />}
              label="Abrir o dossiê"
              onClick={() => setDossier(row)}
              showInMenu
            />,
            ...(target ? actions.buildItems(target) : []),
          ];
        },
      },
    ],
    [actions, superadmins, targetOf],
  );

  const peopleColumns = useMemo<GridColDef<PersonWithoutWorkspace>[]>(
    () => [
      {
        field: "person",
        headerName: "Pessoa",
        flex: 1.4,
        minWidth: 240,
        valueGetter: (_, row) => `${row.name ?? ""} ${row.email ?? ""}`,
        renderCell: ({ row }) => (
          <Box className="flex min-w-0 flex-col justify-center py-1">
            <Box className="flex min-w-0 flex-row items-center gap-2">
              <Typography variant="subtitle2" component="span" className="truncate">
                {nameOf(row)}
              </Typography>
              {row.isSuperadmin ? <StatusChip label="superadmin" tone="info" /> : null}
              {isBanned(row.bannedUntil) ? <StatusChip label="bloqueada" tone="danger" /> : null}
            </Box>
            <Typography variant="body2" className="text-text-secondary truncate">
              {row.email ?? "sem e-mail"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "authProvider",
        headerName: "Entra com",
        width: 160,
        valueGetter: (_, row) => (row.authProvider === "google" ? "Google" : "e-mail e senha"),
      },
      {
        field: "confirmed",
        headerName: "E-mail",
        width: 150,
        valueGetter: (_, row) => (row.confirmed ? "confirmado" : "não confirmado"),
      },
      {
        field: "createdAt",
        headerName: "Conta criada",
        width: 160,
        valueGetter: (_, row) => row.createdAt,
        renderCell: ({ row }) => formatDateTime(row.createdAt),
      },
      {
        field: "lastSignInAt",
        headerName: "Último acesso",
        width: 150,
        valueGetter: (_, row) => row.lastSignInAt ?? "",
        renderCell: ({ row }) => (row.lastSignInAt ? sinceLabel(row.lastSignInAt) : "nunca entrou"),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Ações",
        width: 64,
        getActions: ({ row }) =>
          actions.buildItems({
            userId: row.userId,
            orgId: null,
            name: nameOf(row),
            email: row.email,
            isSuperadmin: row.isSuperadmin,
            hasMfa: false,
            banned: isBanned(row.bannedUntil),
            devices: 0,
          }),
      },
    ],
    [actions],
  );

  const header = (
    <PageHeader
      title="Membros"
      crumbs={CRUMBS}
      description="Quem está no clube, em que degrau, com que computadores conectados e o que pede atenção."
      action={
        <Button variant="outlined" color="grey" startIcon={<NiRefresh size="medium" />} onClick={refresh}>
          Atualizar
        </Button>
      }
    />
  );

  if (!ready) {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>{header}</Grid>
        <Grid size={12}>
          {state.kind === "unavailable" ? (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Este console precisa do Supabase configurado e de uma sessão com o papel de superadmin.
            </Alert>
          ) : (
            // A failed read is an error, never a club with no members.
            <Alert
              severity="error"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" onClick={refresh}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler as contas agora. Nada foi alterado.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  const { totals } = ready.overview;
  const activeFilter = [...TIER_FILTERS, ...ATTENTION_FILTERS].find((entry) => entry.key === filter);

  return (
    <Grid container spacing={5}>
      <Grid size={12}>{header}</Grid>

      {notice ? (
        <Grid size={12}>
          <Alert severity="info" className="neutral bg-background-paper/60!">
            {notice === "expired"
              ? "A sessão de suporte expirou e você voltou para a sua conta."
              : "Sessão de suporte encerrada. Você está de volta na sua conta."}
          </Alert>
        </Grid>
      ) : null}

      {!ready.serviceAvailable ? (
        <Grid size={12}>
          <Alert severity="info" className="neutral bg-background-paper/60!">
            Sem SUPABASE_SERVICE_ROLE_KEY neste ambiente: entrar como, bloquear, redefinir 2FA e excluir conta ficam
            desligados. O restante do console funciona.
          </Alert>
        </Grid>
      ) : null}

      <Grid size={12}>
        <Box className="flex flex-col gap-2.5">
          <Box className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {TIER_FILTERS.map((entry) => (
              <StatTile
                key={entry.key}
                icon={FILTER_ICON[entry.key].icon}
                tone={FILTER_ICON[entry.key].tone}
                label={entry.label}
                value={formatNumber(totals[entry.key])}
                hint={entry.hint}
                pressed={tab === "accounts" && filter === entry.key}
                onClick={() => {
                  setTab("accounts");
                  setFilter(entry.key);
                }}
              />
            ))}
          </Box>
          <Box className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {ATTENTION_FILTERS.map((entry) => (
              <StatTile
                key={entry.key}
                icon={FILTER_ICON[entry.key].icon}
                tone={FILTER_ICON[entry.key].tone}
                label={entry.label}
                value={formatNumber(totals[entry.key])}
                hint={entry.hint}
                pressed={tab === "accounts" && filter === entry.key}
                onClick={() => {
                  setTab("accounts");
                  setFilter(entry.key);
                }}
              />
            ))}
          </Box>
        </Box>
      </Grid>

      <Grid size={12}>
        <Card>
          <CardContent>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} className="mb-4" aria-label="Listas de pessoas">
              <Tab value="accounts" label={`Contas (${formatNumber(visible.length)})`} />
              <Tab value="people" label={`Sem workspace (${formatNumber(ready.people.totals.people)})`} />
            </Tabs>

            {tab === "accounts" ? (
              members.length === 0 ? (
                <EmptyState
                  framed={false}
                  illustration={<IllustrationAccounts />}
                  title="Nenhuma conta ainda"
                  description="Toda pessoa que cria uma conta aparece aqui, com o degrau, os computadores conectados e o uso. Enquanto o site está em lista de espera, quem se inscreve fica em Leads."
                  action={{ label: "Ver a lista de espera", href: "/admin/leads" }}
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  framed={false}
                  illustration={<IllustrationAccounts />}
                  title={`Nenhuma conta em “${activeFilter?.label ?? "este filtro"}”`}
                  description={activeFilter?.hint ?? "Nenhuma conta corresponde a este filtro agora."}
                  action={{ label: "Ver todas as contas", onClick: () => setFilter("accounts") }}
                />
              ) : (
                <DataTable<MemberRow>
                  rows={visible}
                  columns={memberColumns}
                  getRowId={(row) => row.orgId}
                  onRowClick={(row) => setDossier(row)}
                  onQuickFilterChange={setQuery}
                  pageSize={25}
                  pageSizeOptions={[25, 50, 100]}
                  initialColumnVisibility={{ plan: false, aiTool: false, revenue: false, createdAt: false }}
                  labels={{ search: "Buscar por nome, e-mail, segmento ou campanha" }}
                  noResultsOverlay={
                    <EmptyState
                      layout="row"
                      illustration={<IllustrationDocumentation />}
                      title="Nenhuma conta corresponde à busca"
                      description={`Nada encontrado para “${query}” ${filter === "accounts" ? "entre todas as contas" : `no filtro “${activeFilter?.label}”`}. Quem criou a conta e ficou sem workspace está na outra aba.`}
                    />
                  }
                />
              )
            ) : ready.people.people.length === 0 ? (
              <EmptyState
                framed={false}
                illustration={<IllustrationConfigure />}
                title="Ninguém sem workspace"
                description="O cadastro cria o workspace pessoal de cada conta. Se alguém aparecer aqui, o workspace foi removido ou a criação falhou: é uma exceção que merece um olhar."
              />
            ) : (
              <Box className="flex flex-col gap-4">
                <Alert severity="info" className="neutral bg-background-paper/60!">
                  Estas pessoas têm login e não têm workspace, então não conseguem comprar nem conectar a CLI. Peça que
                  entrem de novo: a tela “Completar cadastro” cria o workspace em um passo. Não há o que corrigir pelo
                  banco.
                </Alert>
                <DataTable<PersonWithoutWorkspace>
                  rows={ready.people.people}
                  columns={peopleColumns}
                  getRowId={(row) => row.userId}
                  pageSize={25}
                  pageSizeOptions={[25, 50]}
                  enableExport={false}
                  labels={{ search: "Buscar por nome ou e-mail" }}
                  noResultsOverlay={
                    <EmptyState
                      layout="row"
                      illustration={<IllustrationDocumentation />}
                      title="Nenhuma pessoa corresponde à busca"
                    />
                  }
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {dossier ? (
        <MemberDossierDialog
          key={dossier.orgId}
          orgId={dossier.orgId}
          name={nameOf(dossier)}
          canImpersonate={actions.canImpersonate}
          canResetMfa={actions.canResetMfa}
          onImpersonate={actions.openImpersonation}
          onResetMfa={actions.openMfaReset}
          onClose={() => setDossier(null)}
        />
      ) : null}
      {actions.dialogs}
    </Grid>
  );
}
