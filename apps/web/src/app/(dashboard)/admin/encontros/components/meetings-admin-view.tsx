"use client";

import MeetingFormDialog from "./meeting-form-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Box, Button, Card, CardActionArea, CardContent, Grid, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import { type StatusTone } from "@/components/product/status-chip";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiPlus from "@/icons/nexture/ni-plus";
import { textOf } from "@/lib/admin/catalog";
import { formatDateTime, formatNumber } from "@/lib/admin/format";
import { labelOf, MEETING_PROVIDER_LABEL } from "@/lib/admin/labels";
import type { MeetingState, MeetingSummary } from "@/lib/admin/meetings";
import type { ConsoleState } from "@/lib/admin/session";

export type MeetingsAdminState = ConsoleState<{ meetings: MeetingSummary[] }>;

const CRUMBS = [{ label: "Início", href: "/inicio" }, { label: "Admin", href: "/admin" }, { label: "Encontros" }];

export const MEETING_TONE: Record<MeetingState, StatusTone> = {
  rascunho: "neutral",
  inscricoes: "info",
  ao_vivo: "attention",
  encerrado: "positive",
  arquivado: "neutral",
};

/** The groups in the order the operator needs them: what is live, what is coming, what is being written, what is done. */
const GROUPS: { title: string; states: MeetingState[] }[] = [
  { title: "Ao vivo agora", states: ["ao_vivo"] },
  { title: "Com inscrições abertas", states: ["inscricoes"] },
  { title: "Rascunhos", states: ["rascunho"] },
  { title: "Encerrados", states: ["encerrado"] },
  { title: "Arquivados", states: ["arquivado"] },
];

/**
 * The live sessions of the subscription. The operator plans one (page, date,
 * room link), opens registrations, runs it and then reads who came. Each card
 * opens the meeting's own page, where all of that happens.
 */
export default function MeetingsAdminView({ state }: { state: MeetingsAdminState }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const header = (
    <PageHeader
      title="Encontros"
      crumbs={CRUMBS}
      description="Os encontros ao vivo da assinatura: a página, a data, o link da sala, as inscrições e quem entrou."
      action={
        state.kind === "ready" ? (
          <Button variant="contained" startIcon={<NiPlus size="medium" />} onClick={() => setCreating(true)}>
            Novo encontro
          </Button>
        ) : undefined
      }
    />
  );

  if (state.kind !== "ready") {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>{header}</Grid>
        <Grid size={12}>
          {state.kind === "unavailable" ? (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Este console precisa do Supabase configurado e de uma sessão com o papel de superadmin.
            </Alert>
          ) : (
            <Alert
              severity="error"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" onClick={() => router.refresh()}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler os encontros agora.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={5}>
      <Grid size={12}>{header}</Grid>
      <Grid size={12}>
        {state.meetings.length === 0 ? (
          <EmptyState
            icon={<NiCalendar size="large" />}
            title="Nenhum encontro ainda"
            description="Crie o primeiro: escreva a página, marque a data, cole o link da sala e abra as inscrições. Assinantes se inscrevem pelo painel."
            action={{ label: "Criar o primeiro encontro", onClick: () => setCreating(true) }}
          />
        ) : (
          <Box className="flex flex-col gap-6">
            {GROUPS.map((group) => {
              const meetings = state.meetings.filter((meeting) => group.states.includes(meeting.state));
              if (meetings.length === 0) return null;
              return (
                <Box
                  key={group.title}
                  component="section"
                  aria-labelledby={`group-${group.states[0]}`}
                  className="flex flex-col gap-3"
                >
                  <Typography id={`group-${group.states[0]}`} variant="h5" component="h2" className="mb-0">
                    {group.title}
                  </Typography>
                  <Box className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {meetings.map((meeting) => (
                      <Card key={meeting.id} component="article">
                        <CardActionArea component={Link} href={`/admin/encontros/${meeting.id}`} className="h-full">
                          {/* No state chip: the group heading already names the
                              one state every card under it shares. */}
                          <CardContent className="flex flex-col gap-2">
                            <Typography variant="subtitle2" component="h3">
                              {textOf(meeting.title, meeting.slug)}
                            </Typography>
                            <Typography variant="body2" className="text-text-secondary">
                              {meeting.startsAt ? formatDateTime(meeting.startsAt) : "sem data"} ·{" "}
                              {labelOf(MEETING_PROVIDER_LABEL, meeting.provider)}
                              {meeting.durationMinutes ? ` · ${meeting.durationMinutes} min` : ""}
                            </Typography>
                            <Typography variant="body2" className="text-text-secondary">
                              {formatNumber(meeting.registered)} {meeting.registered === 1 ? "inscrição" : "inscrições"}{" "}
                              · {formatNumber(meeting.joined)} {meeting.joined === 1 ? "entrou" : "entraram"}
                            </Typography>
                            {meeting.state !== "encerrado" && meeting.state !== "arquivado" && !meeting.hasJoinUrl ? (
                              <Typography variant="body2" className="text-text-secondary">
                                Falta o link da sala.
                              </Typography>
                            ) : null}
                            {meeting.state === "encerrado" && !meeting.hasRecording ? (
                              <Typography variant="body2" className="text-text-secondary">
                                Falta o link da gravação.
                              </Typography>
                            ) : null}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Grid>

      {creating ? (
        <MeetingFormDialog
          meeting={null}
          slugFrozen={false}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            router.push(`/admin/encontros/${id}`);
          }}
        />
      ) : null}
    </Grid>
  );
}
