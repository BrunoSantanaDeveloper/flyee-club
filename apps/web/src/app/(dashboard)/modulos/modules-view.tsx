"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import ModuleTile from "@/components/product/module-tile";
import PageHeader from "@/components/product/page-header";
import NiCatalog from "@/icons/nexture/ni-catalog";
import NiFilter from "@/icons/nexture/ni-filter";
import type { loadCatalog } from "@/lib/catalog/read";
import type { PlannedApp } from "@/lib/member/community";
import { aiToolName, MODULE_TYPES } from "@/lib/member/labels";
import { moduleAccess, newerThanInstalls } from "@/lib/member/module-access";
import type { Channel } from "@flyee/catalog/channels";

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export type ModulesState =
  | {
      kind: "ready";
      trails: Catalog["trails"];
      modules: Catalog["modules"];
      /** The roadmap's planned and building apps, shown as "Em breve". */
      planned: PlannedApp[];
      /** The account's channel: "free" installs the entry version of each app (0040). */
      channel: Channel | null;
      hasAccess: boolean;
    }
  | { kind: "error" }
  | { kind: "unavailable" };

const AI_FILTERS = ["claude_code", "codex", "gemini_cli", "cursor"] as const;

/** Where a planned app stands on the roadmap, in the roadmap's own words. */
const PLANNED_STATUS: Record<PlannedApp["status"], string> = {
  planned: "roadmap-status-planned",
  building: "roadmap-status-building",
};

/**
 * Who: a member choosing what to install next. Job: find the tool for the
 * stage they are in. Success: a tool picked, with its command one tap away on
 * its page. Filters are the seven trails (the stages of a product), the AI
 * they use and the kind of tool; the entry version an account with no
 * purchase installs, with the newest version beside it, and a tool outside
 * the plan say so on the tile itself. The apps on their way follow the grid, marked
 * "Em breve" and linked to their idea on the roadmap (docs/PRODUCT.md,
 * 2026-10-08); the stage filter narrows them too, while the AI and kind
 * filters, which an idea does not have yet, set them aside.
 */
export default function ModulesView({ state }: { state: ModulesState }) {
  const t = useTranslations("product");
  const router = useRouter();
  const [trail, setTrail] = useState<string | null>(null);
  const [ai, setAi] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const modules = state.kind === "ready" ? state.modules : [];
  const visible = useMemo(
    () =>
      modules.filter(
        (module) =>
          (!trail || module.trail === trail) &&
          (ai === "all" || module.compatible_ais.includes(ai)) &&
          (type === "all" || module.type === type),
      ),
    [modules, trail, ai, type],
  );
  const filtered = Boolean(trail) || ai !== "all" || type !== "all";
  const planned =
    state.kind === "ready" && ai === "all" && type === "all"
      ? state.planned.filter((app) => !trail || app.trail === trail)
      : [];

  const header = (
    <PageHeader
      title={t("modules-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("modules-title") }]}
      description={t("modules-subtitle")}
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
          {state.kind === "error" ? t("modules-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const comingSoon =
    planned.length > 0 ? (
      <Box component="section" aria-labelledby="modules-soon-title" className="flex flex-col gap-3">
        <Box className="flex flex-col gap-1">
          <Typography id="modules-soon-title" variant="h5" component="h2" className="mb-0">
            {t("modules-soon-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("modules-soon-body")}
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {planned.map((app) => {
            const trailInfo = app.trail ? state.trails.find((item) => item.slug === app.trail) : undefined;
            return (
              <Grid key={app.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                <ModuleTile
                  href={`/roadmap#roadmap-item-${app.id}`}
                  icon={trailInfo?.icon ?? null}
                  trail={app.trail}
                  name={app.title}
                  summary={app.description}
                  trailLabel={trailInfo?.name ?? undefined}
                  meta={t(PLANNED_STATUS[app.status])}
                  status={{ kind: "soon", label: t("soon") }}
                />
              </Grid>
            );
          })}
        </Grid>
      </Box>
    ) : null;

  if (modules.length === 0) {
    return (
      <Box className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<NiCatalog size="large" />}
          title={t("modules-empty-title")}
          description={t("modules-empty-body")}
          action={{ label: t("modules-empty-cta"), href: "/roadmap" }}
        />
        {comingSoon}
      </Box>
    );
  }

  return (
    <Box className="flex flex-col gap-6">
      {header}

      {!state.hasAccess ? (
        <Alert
          severity="info"
          className="neutral bg-background-paper/60!"
          action={
            <Button color="inherit" size="small" href="/settings/billing?source=catalog">
              {t("modules-get-kit")}
            </Button>
          }
        >
          {t("modules-no-access")}
        </Alert>
      ) : null}

      <Box className="flex flex-col gap-3">
        <Box role="group" aria-label={t("modules-filter-trail")} className="flex flex-row flex-wrap gap-2">
          <Chip
            label={t("modules-filter-all")}
            clickable
            onClick={() => setTrail(null)}
            color={trail === null ? "primary" : "default"}
            variant={trail === null ? "filled" : "outlined"}
            aria-pressed={trail === null}
          />
          {state.trails.map((item) => (
            <Chip
              key={item.slug}
              label={item.name ?? item.slug}
              clickable
              onClick={() => setTrail(item.slug === trail ? null : item.slug)}
              color={trail === item.slug ? "primary" : "default"}
              variant={trail === item.slug ? "filled" : "outlined"}
              aria-pressed={trail === item.slug}
            />
          ))}
        </Box>
        <Box className="flex flex-row flex-wrap gap-3">
          <FormControl size="small" className="min-w-44">
            <InputLabel id="modules-ai">{t("modules-filter-ai")}</InputLabel>
            <Select
              labelId="modules-ai"
              label={t("modules-filter-ai")}
              value={ai}
              onChange={(event) => setAi(event.target.value)}
            >
              <MenuItem value="all">{t("modules-filter-all")}</MenuItem>
              {AI_FILTERS.map((tool) => (
                <MenuItem key={tool} value={tool}>
                  {aiToolName(tool, t("ai-tool-other"))}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" className="min-w-44">
            <InputLabel id="modules-type">{t("modules-filter-type")}</InputLabel>
            <Select
              labelId="modules-type"
              label={t("modules-filter-type")}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <MenuItem value="all">{t("modules-filter-all")}</MenuItem>
              {MODULE_TYPES.map((kind) => (
                <MenuItem key={kind.value} value={kind.value}>
                  {t(kind.label)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {visible.length === 0 ? (
        <EmptyState
          icon={<NiFilter size="large" />}
          title={t("modules-filtered-empty-title")}
          description={t("modules-filtered-empty-body")}
          action={
            filtered
              ? {
                  label: t("modules-filter-clear"),
                  onClick: () => {
                    setTrail(null);
                    setAi("all");
                    setType("all");
                  },
                }
              : undefined
          }
        />
      ) : (
        <Grid container spacing={3}>
          {visible.map((module) => {
            const trailInfo = state.trails.find((item) => item.slug === module.trail);
            const ais = module.compatible_ais.map((tool) => aiToolName(tool, t("ai-tool-other"))).join(", ");
            const access = moduleAccess(module, state.channel);
            const newer = newerThanInstalls(access);
            return (
              <Grid key={module.slug} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                <ModuleTile
                  href={`/modulos/${module.slug}`}
                  icon={module.icon ?? trailInfo?.icon ?? null}
                  trail={module.trail}
                  name={module.name ?? module.slug}
                  summary={module.summary}
                  trailLabel={trailInfo?.name ?? module.trail}
                  meta={[
                    access.installs ? `v${access.installs}` : module.latest ? `v${module.latest.version}` : null,
                    newer ? t("modules-newest", { version: newer }) : null,
                    ais || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  status={
                    access.kind === "entry"
                      ? { kind: "entry", label: t("modules-entry-version") }
                      : access.kind === "locked"
                        ? { kind: "locked", label: t("modules-locked") }
                        : null
                  }
                />
              </Grid>
            );
          })}
        </Grid>
      )}

      {comingSoon}
    </Box>
  );
}
