"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, Grid, InputLabel, MenuItem, Select } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import ModuleTile from "@/components/product/module-tile";
import PageHeader from "@/components/product/page-header";
import NiCatalog from "@/icons/nexture/ni-catalog";
import NiFilter from "@/icons/nexture/ni-filter";
import type { loadCatalog } from "@/lib/catalog/read";
import { aiToolName, MODULE_TYPES } from "@/lib/member/labels";

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export type ModulesState =
  | { kind: "ready"; trails: Catalog["trails"]; modules: Catalog["modules"]; hasAccess: boolean }
  | { kind: "error" }
  | { kind: "unavailable" };

const AI_FILTERS = ["claude_code", "codex", "gemini_cli", "cursor"] as const;

/**
 * Who: a member choosing what to install next. Job: find the tool for the
 * stage they are in. Success: a tool picked, with its command one tap away on
 * its page. Filters are the seven trails (the stages of a product), the AI
 * they use and the kind of tool; a free sample and a tool outside the plan
 * say so on the tile itself.
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
            return (
              <Grid key={module.slug} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                <ModuleTile
                  href={`/modulos/${module.slug}`}
                  icon={module.icon ?? trailInfo?.icon ?? null}
                  trail={module.trail}
                  name={module.name ?? module.slug}
                  summary={module.summary}
                  trailLabel={trailInfo?.name ?? module.trail}
                  meta={[module.latest ? `v${module.latest.version}` : null, ais || null].filter(Boolean).join(" · ")}
                  status={
                    module.is_free_sample
                      ? { kind: "free", label: t("modules-free-sample") }
                      : module.entitled
                        ? null
                        : { kind: "locked", label: t("modules-locked") }
                  }
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
