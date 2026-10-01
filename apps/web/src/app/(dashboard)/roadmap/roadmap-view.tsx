"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import GateNotice from "@/components/product/gate-notice";
import PageHeader from "@/components/product/page-header";
import NiFlag from "@/icons/nexture/ni-flag";
import NiHeart from "@/icons/nexture/ni-heart";
import { castRoadmapVote, withdrawRoadmapVote } from "@/lib/member/actions";
import type { RoadmapItem, RoadmapStatus } from "@/lib/member/community";

export type RoadmapState =
  | { kind: "ready"; items: RoadmapItem[]; canVote: boolean }
  | { kind: "error" }
  | { kind: "unavailable" };

/** The columns, in the order an idea travels. Declined ideas are not shown. */
const COLUMNS: { status: RoadmapStatus; label: string }[] = [
  { status: "proposed", label: "roadmap-status-proposed" },
  { status: "planned", label: "roadmap-status-planned" },
  { status: "building", label: "roadmap-status-building" },
  { status: "shipped", label: "roadmap-status-shipped" },
];

/**
 * Who: a member who wants a say in what comes next. Job: back the ideas that
 * matter to their work and see where each one stands. Success: a vote cast,
 * and later the shipped tool, linked from the idea that asked for it.
 * Voting is part of the membership; everyone with an account can read.
 */
export default function RoadmapView({ state }: { state: RoadmapState }) {
  const t = useTranslations("product");
  const router = useRouter();

  const header = (
    <PageHeader
      title={t("roadmap-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("roadmap-title") }]}
      description={t("roadmap-subtitle")}
    />
  );

  if (state.kind !== "ready") {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <Alert
          severity={state.kind === "error" ? "error" : "info"}
          className="neutral bg-background-paper/60!"
          action={
            state.kind === "error" ? (
              <Button color="inherit" size="small" onClick={() => router.refresh()}>
                {t("retry")}
              </Button>
            ) : undefined
          }
        >
          {state.kind === "error" ? t("roadmap-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const visible = state.items.filter((item) => item.status !== "declined");
  if (visible.length === 0) {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<NiFlag size="large" />}
          title={t("roadmap-empty-title")}
          description={t("roadmap-empty-body")}
          action={{ label: t("roadmap-empty-cta"), href: "/contato?assunto=ideia" }}
        />
      </Box>
    );
  }

  return (
    <Box className="flex flex-col gap-6">
      {header}
      {!state.canVote ? (
        <Alert
          severity="info"
          className="neutral bg-background-paper/60!"
          action={
            <Button color="inherit" size="small" component={Link} href="/settings/billing?source=roadmap">
              {t("roadmap-unlock")}
            </Button>
          }
        >
          {t("roadmap-locked")}
        </Alert>
      ) : null}
      <Grid container spacing={3}>
        {COLUMNS.map((column) => {
          const items = visible.filter((item) => item.status === column.status);
          return (
            <Grid key={column.status} size={{ xs: 12, md: 6, xl: 3 }} className="flex flex-col gap-3">
              <Typography variant="subtitle1" component="h2" className="mb-0">
                {t(column.label)} <span className="text-text-secondary">({items.length})</span>
              </Typography>
              {items.length === 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("roadmap-column-empty")}
                </Typography>
              ) : (
                items.map((item) => <RoadmapCard key={item.id} item={item} canVote={state.canVote} />)
              )}
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

function RoadmapCard({ item, canVote }: { item: RoadmapItem; canVote: boolean }) {
  const t = useTranslations("product");
  const [voted, setVoted] = useState(item.voted);
  const [votes, setVotes] = useState(item.votes);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const votable = item.status !== "shipped";
  const gateId = `roadmap-gate-${item.id}`;

  const toggle = () => {
    setError(false);
    startTransition(async () => {
      const result = voted ? await withdrawRoadmapVote(item.id) : await castRoadmapVote(item.id);
      if (result.ok) {
        setVotes((count) => count + (voted ? -1 : 1));
        setVoted(!voted);
      } else {
        setError(true);
      }
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <Typography variant="subtitle2" component="h3" className="mb-0">
          {item.title}
        </Typography>
        {item.description ? (
          <Typography variant="body2" className="text-text-secondary line-clamp-4">
            {item.description}
          </Typography>
        ) : null}
        {item.shippedModule ? (
          <Link href={`/modulos/${item.shippedModule.slug}`} className="text-primary text-sm underline">
            {t("roadmap-shipped-as", { name: item.shippedModule.name })}
          </Link>
        ) : null}
        <Box className="flex flex-row flex-wrap items-center gap-2">
          <Chip
            size="small"
            variant="outlined"
            icon={<NiHeart size="small" />}
            label={t("roadmap-votes", { count: votes })}
          />
          {votable ? (
            <Button
              size="small"
              variant={voted ? "outlined" : "contained"}
              disabled={!canVote || pending}
              aria-pressed={voted}
              aria-describedby={!canVote ? gateId : undefined}
              onClick={toggle}
            >
              {voted ? t("roadmap-withdraw") : t("roadmap-vote")}
            </Button>
          ) : null}
        </Box>
        {votable && !canVote ? (
          <GateNotice id={gateId} gate={{ state: "blocked", message: t("roadmap-gate") }} />
        ) : null}
        {error ? (
          <Typography variant="body2" role="status" className="text-text-secondary">
            {t("roadmap-vote-failed")}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
