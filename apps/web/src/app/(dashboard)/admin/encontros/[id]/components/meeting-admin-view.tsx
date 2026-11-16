"use client";

import { deleteMeeting, duplicateMeeting, sendMeetingEmails, setMeetingState } from "../../actions";
import MeetingFormDialog from "../../components/meeting-form-dialog";
import { MEETING_TONE } from "../../components/meetings-admin-view";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";

import DataTable from "@/components/data-grid/data-table";
import ComparisonTable from "@/components/product/comparison-table";
import ConfirmActionDialog from "@/components/product/confirm-action-dialog";
import EmptyState from "@/components/product/empty-state";
import InfoHint from "@/components/product/info-hint";
import MetricBars from "@/components/product/metric-bars";
import PageHeader from "@/components/product/page-header";
import StatusChip from "@/components/product/status-chip";
import IllustrationAccounts from "@/icons/illustrations/illustration-accounts";
import IllustrationDocumentation from "@/icons/illustrations/illustration-documentation";
import NiCalendar from "@/icons/nexture/ni-calendar";
import { textOf } from "@/lib/admin/catalog";
import { formatDateTime, formatNumber, formatPercent, ratio } from "@/lib/admin/format";
import { labelOf, MEETING_PROVIDER_LABEL, MEETING_STATE_LABEL, SEGMENT_LABEL } from "@/lib/admin/labels";
import {
  type MeetingDetail,
  type MeetingEmails,
  type MeetingRegistrant,
  type MeetingResults,
  nextStates,
} from "@/lib/admin/meetings";
import type { ConsoleState } from "@/lib/admin/session";
import { MEETING_EMAIL_KINDS, type MeetingEmailKind, type MeetingEmailWindow } from "@/lib/meeting-email-kinds";

export type MeetingAdminState = ConsoleState<{
  meeting: MeetingDetail | null;
  results: MeetingResults;
  registrants: MeetingRegistrant[];
  emails: MeetingEmails;
}>;

/** The four messages of a meeting, as the operator reads them: what each is and when it goes out by itself. */
const EMAIL_LABEL: Record<MeetingEmailKind, { label: string; when: string }> = {
  confirmation: { label: "Confirmação da inscrição", when: "Sai na hora, para quem acabou de se inscrever." },
  day: { label: "Lembrete de 24 horas", when: "Sai a partir de 24 horas antes do início." },
  hour: { label: "Lembrete da última hora", when: "Sai nos 60 minutos antes do início." },
  recording: { label: "Aviso da gravação", when: "Sai depois do encerramento, quando há link da gravação." },
};

/** Why a message cannot be sent right now, in the operator's words. */
function emailClosedReason(kind: MeetingEmailKind, sendWindow: MeetingEmailWindow): string | null {
  if (sendWindow.open) return null;
  switch (sendWindow.why) {
    case "no-date":
      return "Defina a data do encontro.";
    case "no-recording":
      return "Cole o link da gravação.";
    case "too-early":
      return kind === "day" ? "Abre 24 horas antes do início." : "Abre 60 minutos antes do início.";
    case "too-late":
      return "A janela deste lembrete já passou.";
    default:
      return kind === "recording"
        ? "Disponível depois de encerrar o encontro."
        : kind === "hour"
          ? "Disponível com as inscrições abertas ou ao vivo."
          : "Disponível com as inscrições abertas.";
  }
}

/**
 * One meeting: what members read, when it happens, the room link, and then
 * who registered and who came. The state buttons follow the order the operator
 * runs a meeting in: open registrations, go live, end, archive. The e-mails
 * card shows how far each message of the meeting has gone and lets the
 * operator send one now, inside its window, to whoever has not received it.
 */
export default function MeetingAdminView({ state, id }: { state: MeetingAdminState; id: string }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => router.refresh(), [router]);

  const registrantColumns = useMemo<GridColDef<MeetingRegistrant>[]>(
    () => [
      {
        field: "name",
        headerName: "Pessoa",
        flex: 1.3,
        minWidth: 220,
        valueGetter: (_, row) => `${row.name ?? ""} ${row.email ?? ""}`,
        renderCell: ({ row }) => (
          <Box className="flex min-w-0 flex-col justify-center py-1">
            <Typography variant="subtitle2" component="span" className="truncate">
              {row.name ?? row.email ?? "Sem nome"}
            </Typography>
            <Typography variant="body2" className="text-text-secondary truncate">
              {row.email ?? "sem e-mail"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "segment",
        headerName: "Segmento",
        width: 190,
        valueGetter: (_, row) => labelOf(SEGMENT_LABEL, row.segment ?? "unknown"),
      },
      {
        field: "registeredAt",
        headerName: "Inscrição",
        width: 160,
        valueGetter: (_, row) => row.registeredAt,
        renderCell: ({ row }) => formatDateTime(row.registeredAt),
      },
      {
        field: "joinedAt",
        headerName: "Entrou na sala",
        width: 170,
        valueGetter: (_, row) => row.joinedAt ?? "",
        renderCell: ({ row }) => (row.joinedAt ? formatDateTime(row.joinedAt) : "não entrou"),
      },
    ],
    [],
  );

  const crumbs = [
    { label: "Início", href: "/inicio" },
    { label: "Admin", href: "/admin" },
    { label: "Encontros", href: "/admin/encontros" },
    { label: state.kind === "ready" && state.meeting ? textOf(state.meeting.title, state.meeting.slug) : "Encontro" },
  ];

  if (state.kind !== "ready" || !state.meeting) {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>
          <PageHeader title="Encontro" crumbs={crumbs} />
        </Grid>
        <Grid size={12}>
          {state.kind === "ready" ? (
            <EmptyState
              icon={<NiCalendar size="large" />}
              title="Este encontro não existe"
              description="Ele pode ter sido excluído enquanto era rascunho."
              action={{ label: "Voltar aos encontros", href: "/admin/encontros" }}
            />
          ) : state.kind === "unavailable" ? (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Este console precisa do Supabase configurado e de uma sessão com o papel de superadmin.
            </Alert>
          ) : (
            <Alert
              severity="error"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" onClick={refresh}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler este encontro agora.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  const { meeting, results, registrants, emails } = state;
  const slugFrozen = Boolean(meeting.publishedAt) || registrants.length > 0;
  const canDelete = meeting.state === "rascunho" && !meeting.publishedAt && registrants.length === 0;

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) enqueueSnackbar(result.error ?? "Não foi possível concluir.", { variant: "error" });
    else {
      enqueueSnackbar(success, { variant: "success" });
      refresh();
    }
  };

  const sendEmails = async (kind: MeetingEmailKind) => {
    setBusy(true);
    const result = await sendMeetingEmails(meeting.id, kind);
    setBusy(false);
    if (!result.ok) {
      enqueueSnackbar(result.error, { variant: "error" });
      return;
    }
    const { queued, emailed } = result.data;
    enqueueSnackbar(
      queued
        ? "Envio colocado na fila. Os números desta tela mudam em instantes."
        : emailed === 0
          ? "Ninguém a avisar agora: quem podia receber esta mensagem já recebeu."
          : emailed === 1
            ? "1 e-mail enviado."
            : `${formatNumber(emailed)} e-mails enviados.`,
      { variant: queued || emailed > 0 ? "success" : "info" },
    );
    refresh();
  };

  const duplicate = async () => {
    setBusy(true);
    const result = await duplicateMeeting(meeting.id);
    setBusy(false);
    if (!result.ok) enqueueSnackbar(result.error, { variant: "error" });
    else {
      enqueueSnackbar("Cópia criada como rascunho, sem data e sem links.", { variant: "success" });
      router.push(`/admin/encontros/${result.data.id}`);
    }
  };

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <PageHeader
          title={textOf(meeting.title, meeting.slug)}
          crumbs={crumbs}
          detail={textOf(meeting.description, "Sem descrição ainda.")}
          action={
            <Button variant="outlined" color="grey" onClick={() => setEditing(true)}>
              Editar página e links
            </Button>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }} className="flex flex-col gap-5">
        <Card component="section" aria-labelledby="meeting-state-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-row flex-wrap items-center gap-2">
              <Typography id="meeting-state-title" variant="h6" component="h2" className="mb-0">
                Estado
              </Typography>
              <StatusChip label={labelOf(MEETING_STATE_LABEL, meeting.state)} tone={MEETING_TONE[meeting.state]} />
            </Box>
            <Box component="dl" className="m-0 flex flex-col gap-2">
              {[
                ["Quando", meeting.startsAt ? `${formatDateTime(meeting.startsAt)} (Brasília)` : "sem data"],
                ["Duração", meeting.durationMinutes ? `${meeting.durationMinutes} min` : "não definida"],
                ["Ferramenta", labelOf(MEETING_PROVIDER_LABEL, meeting.provider)],
                ["Link da sala", meeting.joinUrl ? "definido" : "falta"],
                ["Gravação", meeting.recordingUrl ? "definida" : "falta"],
              ].map(([label, value]) => (
                <Box key={label} className="flex flex-row justify-between gap-3">
                  <Typography component="dt" variant="body2" className="text-text-secondary">
                    {label}
                  </Typography>
                  <Typography component="dd" variant="body1" className="m-0 text-right">
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box className="flex flex-col gap-2">
              {nextStates(meeting.state).map((next, index) => (
                <Button
                  key={next.state}
                  variant={index === 0 ? "contained" : "outlined"}
                  color={index === 0 ? "primary" : "grey"}
                  disabled={busy}
                  onClick={() =>
                    run(() => setMeetingState(meeting.id, next.state), `${labelOf(MEETING_STATE_LABEL, next.state)}.`)
                  }
                >
                  {next.label}
                </Button>
              ))}
              {meeting.state === "inscricoes" && !meeting.joinUrl ? (
                <Typography variant="body2" className="text-text-secondary">
                  Cole o link da sala antes do início: sem ele, quem se inscreveu não tem por onde entrar.
                </Typography>
              ) : null}
              <Button variant="text" color="grey" disabled={busy} onClick={duplicate}>
                Duplicar
              </Button>
              {canDelete ? (
                <Button variant="text" color="error" disabled={busy} onClick={() => setDeleting(true)}>
                  Excluir rascunho
                </Button>
              ) : null}
            </Box>
          </CardContent>
        </Card>

        <Card component="section" aria-labelledby="meeting-results-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-row items-center gap-1">
              <Typography id="meeting-results-title" variant="h6" component="h2" className="mb-0">
                Resultado
              </Typography>
              <InfoHint
                label="“Entrar” é o clique que abre a sala pela plataforma. Quanto tempo cada pessoa ficou, a plataforma não sabe: a sala é de outra ferramenta."
                placement="bottom-start"
                className="self-center"
              />
            </Box>
            <MetricBars
              spacing="dense"
              total={Math.max(results.registered, 1)}
              items={[
                { key: "registered", label: "Inscrições", value: results.registered },
                {
                  key: "joined",
                  label: "Entraram na sala",
                  value: results.joined,
                  hint:
                    results.registered > 0
                      ? `${formatPercent(ratio(results.joined, results.registered))} de quem se inscreveu`
                      : undefined,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card component="section" aria-labelledby="meeting-emails-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-row items-center gap-1">
              <Typography id="meeting-emails-title" variant="h6" component="h2" className="mb-0">
                E-mails
              </Typography>
              <InfoHint
                label="Quantas pessoas inscritas já receberam cada mensagem. Cada uma vai uma vez por pessoa, no idioma e no fuso dela, na hora indicada. “Enviar agora” escreve só para quem não recebeu."
                placement="bottom-start"
                className="self-center"
              />
            </Box>
            <MetricBars
              spacing="dense"
              total={results.registered}
              items={MEETING_EMAIL_KINDS.map((kind) => {
                const closed = emailClosedReason(kind, emails[kind].window);
                const everyone = results.registered > 0 && emails[kind].sent >= results.registered;
                return {
                  key: kind,
                  label: EMAIL_LABEL[kind].label,
                  value: emails[kind].sent,
                  hint: EMAIL_LABEL[kind].when,
                  action: (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        color="grey"
                        disabled={busy || closed !== null || results.registered === 0 || everyone}
                        onClick={() => sendEmails(kind)}
                        aria-label={`Enviar agora: ${EMAIL_LABEL[kind].label}`}
                      >
                        Enviar agora
                      </Button>
                      {closed || everyone ? (
                        <Typography variant="body2" className="text-text-secondary">
                          {closed ?? "Todos já receberam."}
                        </Typography>
                      ) : null}
                    </>
                  ),
                };
              })}
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }} className="flex flex-col gap-5">
        {results.bySegment.length > 0 ? (
          <Card component="section" aria-labelledby="meeting-segments-title">
            <CardContent className="flex flex-col gap-3">
              <Typography id="meeting-segments-title" variant="h6" component="h2" className="mb-0">
                Por segmento
              </Typography>
              <ComparisonTable
                caption="Inscrições e entradas por segmento"
                rowHeader="Segmento"
                columns={[
                  { key: "registered", label: "Inscrições" },
                  { key: "joined", label: "Entraram" },
                  { key: "rate", label: "Taxa" },
                ]}
                rows={results.bySegment.map((entry) => ({
                  key: entry.segment,
                  label: labelOf(SEGMENT_LABEL, entry.segment),
                  cells: [
                    { primary: formatNumber(entry.registered) },
                    { primary: formatNumber(entry.joined) },
                    { primary: formatPercent(ratio(entry.joined, entry.registered)) },
                  ],
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card component="section" aria-labelledby="meeting-registrants-title">
          <CardContent className="flex flex-col gap-3">
            <Typography id="meeting-registrants-title" variant="h6" component="h2" className="mb-0">
              Inscritos
            </Typography>
            {registrants.length === 0 ? (
              <EmptyState
                framed={false}
                titleAs="h3"
                illustration={<IllustrationAccounts />}
                title="Nenhuma inscrição ainda"
                description={
                  meeting.state === "rascunho"
                    ? "Abra as inscrições: assinantes passam a ver o encontro no painel e podem se inscrever."
                    : "Assinantes se inscrevem pela página de encontros do painel."
                }
              />
            ) : (
              <DataTable<MeetingRegistrant>
                rows={registrants}
                columns={registrantColumns}
                getRowId={(row) => row.userId}
                pageSize={25}
                pageSizeOptions={[25, 50, 100]}
                labels={{ search: "Buscar por nome ou e-mail" }}
                noResultsOverlay={
                  <EmptyState
                    layout="row"
                    illustration={<IllustrationDocumentation />}
                    title="Ninguém corresponde à busca"
                  />
                }
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      {editing ? (
        <MeetingFormDialog
          meeting={meeting}
          slugFrozen={slugFrozen}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            enqueueSnackbar("Encontro salvo.", { variant: "success" });
            refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmActionDialog
          key={`delete-${id}`}
          title="Excluir este rascunho?"
          consequences={["O encontro deixa de existir. Ele nunca foi publicado e ninguém se inscreveu."]}
          stays={["A trilha de auditoria guarda o slug e o motivo."]}
          confirmLabel="Excluir"
          tone="danger"
          reasonMinLength={4}
          onConfirm={async (reason) => {
            const result = await deleteMeeting(meeting.id, reason);
            if (!result.ok) return result.error;
            enqueueSnackbar("Rascunho excluído.", { variant: "success" });
            router.push("/admin/encontros");
            return null;
          }}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </Grid>
  );
}
