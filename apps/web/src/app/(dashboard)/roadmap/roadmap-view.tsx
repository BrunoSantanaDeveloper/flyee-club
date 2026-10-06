"use client";

import { useFormik } from "formik";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import * as Yup from "yup";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import EmptyState from "@/components/product/empty-state";
import GateNotice from "@/components/product/gate-notice";
import { QuickActionTile } from "@/components/product/home-tiles";
import PageHeader from "@/components/product/page-header";
import StatusChip, { type StatusTone } from "@/components/product/status-chip";
import NiFlag from "@/icons/nexture/ni-flag";
import NiHeart from "@/icons/nexture/ni-heart";
import NiPlus from "@/icons/nexture/ni-plus";
import { castRoadmapVote, proposeRoadmapItem, withdrawRoadmapVote } from "@/lib/member/actions";
import type { RoadmapItem, RoadmapLeader, RoadmapStatus, RoadmapTrail } from "@/lib/member/community";

export type RoadmapState =
  | {
      kind: "ready";
      items: RoadmapItem[];
      trails: RoadmapTrail[];
      /** The open idea with the most votes cast this month; null when nobody voted yet. */
      leader: RoadmapLeader | null;
      canVote: boolean;
      locale: string;
      /** The contact form, in the member's language, opened on the custom app. */
      contactHref: string;
    }
  | { kind: "error" }
  | { kind: "unavailable" };

/** The columns, in the order an idea travels. Declined ideas and the queue under review are not columns. */
const COLUMNS: { status: RoadmapStatus; label: string }[] = [
  { status: "proposed", label: "roadmap-status-proposed" },
  { status: "planned", label: "roadmap-status-planned" },
  { status: "building", label: "roadmap-status-building" },
  { status: "shipped", label: "roadmap-status-shipped" },
];

/** How the author's own proposal reads, in each state. */
const MINE_STATUS: Record<RoadmapStatus, { label: string; tone: StatusTone }> = {
  submitted: { label: "roadmap-mine-status-submitted", tone: "info" },
  proposed: { label: "roadmap-mine-status-proposed", tone: "primary" },
  planned: { label: "roadmap-status-planned", tone: "attention" },
  building: { label: "roadmap-status-building", tone: "attention" },
  shipped: { label: "roadmap-status-shipped", tone: "positive" },
  declined: { label: "roadmap-mine-status-declined", tone: "neutral" },
};

/**
 * Who: a member who wants a say in what comes next. Job: back the ideas that
 * matter to their work, propose the app the store lacks, and see where each
 * one stands. Success: a vote cast or a proposal sent, and later the shipped
 * tool, linked from the idea that asked for it. Proposing and voting are part
 * of FlyeeClub Pro; everyone with an account can read, and anyone can ask for
 * commissioned work through the contact form.
 */
export default function RoadmapView({ state }: { state: RoadmapState }) {
  const t = useTranslations("product");
  const router = useRouter();
  const [proposing, setProposing] = useState(false);

  const header = (
    <PageHeader
      title={t("roadmap-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("roadmap-title") }]}
      description={t("roadmap-subtitle")}
      action={
        state.kind === "ready" && state.canVote ? (
          <Button variant="contained" startIcon={<NiPlus size="medium" />} onClick={() => setProposing(true)}>
            {t("roadmap-propose")}
          </Button>
        ) : undefined
      }
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

  const dialog = proposing ? (
    <ProposeDialog
      trails={state.trails}
      locale={state.locale}
      onClose={() => setProposing(false)}
      onSent={() => router.refresh()}
    />
  ) : null;

  const visible = state.items.filter((item) => item.status !== "declined" && item.status !== "submitted");
  const mine = state.items.filter((item) => item.mine);

  if (visible.length === 0 && mine.length === 0) {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<NiFlag size="large" />}
          title={t("roadmap-empty-title")}
          description={t("roadmap-empty-body")}
          action={
            state.canVote
              ? { label: t("roadmap-propose"), onClick: () => setProposing(true) }
              : { label: t("roadmap-empty-cta-contact"), href: state.contactHref }
          }
        />
        {dialog}
      </Box>
    );
  }

  const monthLabel = (monthStart: string) => {
    // A date, not an instant: parsed by its parts so the month never shifts with the zone.
    const [year, month] = monthStart.split("-").map(Number);
    return new Intl.DateTimeFormat(state.locale, { month: "long" }).format(new Date(year, month - 1, 1));
  };

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

      {state.leader ? (
        <QuickActionTile
          href={`#roadmap-item-${state.leader.id}`}
          icon={<NiHeart size="large" />}
          tone="primary"
          title={t("roadmap-leader-title")}
          description={t("roadmap-leader-body", {
            title: state.leader.title,
            count: state.leader.votesInMonth,
            month: monthLabel(state.leader.monthStart),
          })}
        />
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

      {mine.length > 0 ? (
        <Box component="section" aria-labelledby="roadmap-mine-title" className="flex flex-col gap-3">
          <Typography id="roadmap-mine-title" variant="subtitle1" component="h2" className="mb-0">
            {t("roadmap-mine-title")}
          </Typography>
          <Grid container spacing={3}>
            {mine.map((item) => (
              <Grid key={item.id} size={{ xs: 12, md: 6, xl: 3 }}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <Typography variant="subtitle2" component="h3" className="mb-0">
                      {item.title}
                    </Typography>
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <StatusChip label={t(MINE_STATUS[item.status].label)} tone={MINE_STATUS[item.status].tone} />
                      {item.status !== "submitted" ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<NiHeart size="small" />}
                          label={t("roadmap-votes", { count: item.votes })}
                        />
                      ) : null}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : null}

      <Card component="section" aria-labelledby="roadmap-custom-title">
        <CardContent className="flex flex-col gap-3">
          <Box className="flex flex-col gap-1">
            <Typography id="roadmap-custom-title" variant="subtitle1" component="h2" className="mb-0">
              {t("roadmap-custom-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("roadmap-custom-body")}
            </Typography>
          </Box>
          <Box className="flex flex-row flex-wrap items-center gap-2">
            <Button
              variant="contained"
              startIcon={<NiPlus size="medium" />}
              disabled={!state.canVote}
              aria-describedby={!state.canVote ? "roadmap-custom-gate" : undefined}
              onClick={() => setProposing(true)}
            >
              {t("roadmap-propose")}
            </Button>
            <Button variant="outlined" color="grey" component={Link} href={state.contactHref}>
              {t("roadmap-custom-contact")}
            </Button>
          </Box>
          {!state.canVote ? (
            <GateNotice id="roadmap-custom-gate" gate={{ state: "blocked", message: t("roadmap-gate") }} />
          ) : null}
        </CardContent>
      </Card>

      {dialog}
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
    <Card id={`roadmap-item-${item.id}`} className="scroll-mt-24">
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

/**
 * The proposal: a name, what the app would do, and the stage it serves. The
 * database function re-checks the right and the ceiling of proposals under
 * review; this form only keeps the member from sending what it would refuse.
 */
function ProposeDialog({
  trails,
  locale,
  onClose,
  onSent,
}: {
  trails: RoadmapTrail[];
  locale: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useTranslations("product");
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const form = useFormik({
    initialValues: { title: "", description: "", trail: "" },
    validationSchema: Yup.object({
      title: Yup.string()
        .trim()
        .min(4, t("roadmap-propose-error-title"))
        .max(120, t("roadmap-propose-error-title"))
        .required(t("roadmap-propose-error-title")),
      description: Yup.string().max(1000, t("roadmap-propose-error-description")),
    }),
    onSubmit: async (values) => {
      setFailure(null);
      const result = await proposeRoadmapItem({
        title: values.title,
        description: values.description,
        trail: values.trail || null,
        locale,
      });
      if (result.ok) {
        setSent(true);
        onSent();
        return;
      }
      if (result.code === "too_many_open") setFailure(t("roadmap-propose-limit", { max: result.max ?? 3 }));
      else if (result.code === "not_entitled") setFailure(t("roadmap-gate"));
      else if (result.code === "invalid_title") setFailure(t("roadmap-propose-error-title"));
      else setFailure(t("roadmap-propose-failed"));
    },
  });
  const busy = form.isSubmitting;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="roadmap-propose-title">
      <DialogHeader
        id="roadmap-propose-title"
        title={sent ? t("roadmap-propose-done-title") : t("roadmap-propose-title")}
        onClose={onClose}
        closeLabel={t("close")}
      />
      {sent ? (
        <>
          <DialogContent dividers>
            <Typography variant="body1">{t("roadmap-propose-done-body")}</Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={onClose}>
              {t("close")}
            </Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={form.handleSubmit} noValidate>
          <DialogContent dividers className="flex flex-col gap-4">
            <Typography variant="body2" className="text-text-secondary">
              {t("roadmap-propose-body")}
            </Typography>
            <TextField
              name="title"
              label={t("roadmap-propose-field-title")}
              value={form.values.title}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.title && Boolean(form.errors.title)}
              helperText={form.touched.title && form.errors.title ? form.errors.title : " "}
              slotProps={{ htmlInput: { maxLength: 120 } }}
              required
              fullWidth
              autoFocus
            />
            <TextField
              name="description"
              label={t("roadmap-propose-field-description")}
              value={form.values.description}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.description && Boolean(form.errors.description)}
              helperText={
                form.touched.description && form.errors.description
                  ? form.errors.description
                  : `${form.values.description.length}/1000`
              }
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              select
              name="trail"
              label={t("roadmap-propose-field-trail")}
              value={form.values.trail}
              onChange={form.handleChange}
              fullWidth
            >
              <MenuItem value="">{t("roadmap-propose-trail-none")}</MenuItem>
              {trails.map((trail) => (
                <MenuItem key={trail.slug} value={trail.slug}>
                  {trail.name}
                </MenuItem>
              ))}
            </TextField>
            {failure ? (
              <Alert severity="error" className="neutral bg-background-paper/60!" role="alert">
                {failure}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button variant="text" color="grey" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? t("roadmap-propose-sending") : t("roadmap-propose-submit")}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
