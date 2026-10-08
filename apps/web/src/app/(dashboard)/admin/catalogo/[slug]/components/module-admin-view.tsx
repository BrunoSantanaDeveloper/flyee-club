"use client";

import { deleteModule, setModuleStatus } from "../../actions";
import ModuleFormDialog from "../../components/module-form-dialog";
import LessonsSection from "./lessons-section";
import VersionUpload from "./version-upload";
import VersionsList from "./versions-list";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";

import CatalogIcon from "@/components/product/catalog-icon";
import EmptyState from "@/components/product/empty-state";
import MetricBars from "@/components/product/metric-bars";
import PageHeader from "@/components/product/page-header";
import StatusChip from "@/components/product/status-chip";
import NiCatalog from "@/icons/nexture/ni-catalog";
import {
  type AdminLesson,
  type AdminModule,
  type AdminStoreCategory,
  type AdminTrail,
  latestPublished,
  textOf,
} from "@/lib/admin/catalog";
import { formatNumber } from "@/lib/admin/format";
import { AI_TOOL_LABEL, labelOf, MODULE_STATUS_LABEL, MODULE_TYPE_LABEL, SEGMENT_LABEL } from "@/lib/admin/labels";
import type { ConsoleState } from "@/lib/admin/session";

export type ModuleAdminState = ConsoleState<{
  module: AdminModule | null;
  lessons: AdminLesson[];
  trails: AdminTrail[];
  storeCategories: AdminStoreCategory[];
}>;

const STATUS_TONE = { draft: "neutral", published: "positive", archived: "neutral" } as const;

/**
 * One tool of the catalog: what members read about it, the versions the CLI
 * delivers and the lessons. The operator usually arrives to ship a version
 * (upload, review, publish), so the upload sits at the top of the work area.
 */
export default function ModuleAdminView({ state, slug }: { state: ModuleAdminState; slug: string }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => router.refresh(), [router]);

  const crumbs = [
    { label: "Início", href: "/inicio" },
    { label: "Admin", href: "/admin" },
    { label: "Catálogo", href: "/admin/catalogo" },
    { label: state.kind === "ready" && state.module ? textOf(state.module.name, slug) : slug },
  ];

  if (state.kind !== "ready" || !state.module) {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>
          <PageHeader title={slug} crumbs={crumbs} />
        </Grid>
        <Grid size={12}>
          {state.kind === "ready" ? (
            <EmptyState
              icon={<NiCatalog size="large" />}
              title="Esta ferramenta não existe"
              description="O endereço pode ter mudado antes da primeira publicação, ou a ferramenta foi excluída."
              action={{ label: "Voltar ao catálogo", href: "/admin/catalogo" }}
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
              Não foi possível ler esta ferramenta agora.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  const module = state.module;
  const latest = latestPublished(module.versions);
  const trail = state.trails.find((entry) => entry.slug === module.trail);
  const storeCategory = state.storeCategories.find((entry) => entry.slug === module.storeCategory);

  const changeStatus = async (status: "draft" | "published" | "archived", success: string) => {
    setBusy(true);
    const result = await setModuleStatus(module.id, status);
    setBusy(false);
    if (!result.ok) enqueueSnackbar(result.error, { variant: "error" });
    else {
      enqueueSnackbar(success, { variant: "success" });
      refresh();
    }
  };

  const remove = async () => {
    setBusy(true);
    const result = await deleteModule(module.id);
    setBusy(false);
    if (!result.ok) enqueueSnackbar(result.error, { variant: "error" });
    else {
      enqueueSnackbar("Ferramenta excluída.", { variant: "success" });
      router.push("/admin/catalogo");
    }
  };

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <PageHeader
          title={textOf(module.name, module.slug)}
          crumbs={crumbs}
          description={textOf(module.summary, "Sem resumo ainda.")}
          action={
            <Button variant="outlined" color="grey" onClick={() => setEditing(true)}>
              Editar dados
            </Button>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }} className="flex flex-col gap-5">
        <VersionUpload
          moduleSlug={module.slug}
          onUploaded={(version) => {
            enqueueSnackbar(`v${version} recebida como rascunho. Confira e publique.`, { variant: "success" });
            refresh();
          }}
        />
        <Box component="section" aria-labelledby="versions-title" className="flex flex-col gap-3">
          <Typography id="versions-title" variant="h5" component="h2" className="mb-0">
            Versões
          </Typography>
          <VersionsList slug={module.slug} versions={module.versions} onChanged={refresh} />
        </Box>
        <LessonsSection lessons={state.lessons} moduleId={module.id} moduleSlug={module.slug} onChanged={refresh} />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }} className="flex flex-col gap-5">
        <Card component="section" aria-labelledby="module-state-title">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-row items-center gap-3">
              <Box
                aria-hidden
                className="bg-primary/20 text-primary-ink flex h-12 w-12 flex-none items-center justify-center rounded-2xl"
              >
                <CatalogIcon name={module.icon} size="medium" />
              </Box>
              <Box className="flex min-w-0 flex-col">
                <Typography id="module-state-title" variant="h6" component="h2" className="mb-0">
                  No catálogo
                </Typography>
                <Box className="flex flex-row flex-wrap items-center gap-2">
                  <StatusChip label={labelOf(MODULE_STATUS_LABEL, module.status)} tone={STATUS_TONE[module.status]} />
                  {module.isFreeSample ? <StatusChip label="amostra grátis" tone="info" /> : null}
                </Box>
              </Box>
            </Box>
            <Typography variant="body2" className="text-text-secondary">
              {module.slug} · {textOf(trail?.name, module.trail)} ·{" "}
              {storeCategory ? `loja: ${textOf(storeCategory.name, storeCategory.slug)}` : "sem categoria na loja"} ·{" "}
              {module.personas.length > 0
                ? `começo para: ${module.personas.map((persona) => labelOf(SEGMENT_LABEL, persona)).join(", ")}`
                : "sem perfil marcado"}{" "}
              · {labelOf(MODULE_TYPE_LABEL, module.type)}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              Funciona com{" "}
              {module.compatibleAis.length > 0
                ? module.compatibleAis.map((tool) => labelOf(AI_TOOL_LABEL, tool)).join(", ")
                : "nenhuma IA marcada"}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {latest ? `Versão entregue: v${latest.version}` : "Nenhuma versão publicada ainda."}
            </Typography>

            {module.status !== "published" ? (
              <Box className="flex flex-col gap-1">
                <Button
                  variant="contained"
                  disabled={busy || !latest}
                  onClick={() => changeStatus("published", "Ferramenta publicada no catálogo.")}
                >
                  Publicar no catálogo
                </Button>
                {!latest ? (
                  <Typography variant="body2" className="text-text-secondary">
                    Publique uma versão antes: o catálogo só mostra o que dá para instalar.
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <Box className="flex flex-col gap-1">
                <Button
                  variant="outlined"
                  color="grey"
                  disabled={busy}
                  onClick={() => changeStatus("archived", "Ferramenta arquivada.")}
                >
                  Arquivar
                </Button>
                <Typography variant="body2" className="text-text-secondary">
                  Sai do catálogo e da CLI. Quem instalou continua com ela.
                </Typography>
              </Box>
            )}
            {module.status === "archived" ? (
              <Button
                variant="text"
                color="grey"
                disabled={busy}
                onClick={() => changeStatus("draft", "Ferramenta voltou para rascunho.")}
              >
                Voltar para rascunho
              </Button>
            ) : null}
            {!module.publishedAt ? (
              <Button variant="text" color="error" disabled={busy} onClick={remove}>
                Excluir ferramenta
              </Button>
            ) : null}
            <Button variant="text" color="grey" component={Link} href={`/modulos/${module.slug}`}>
              Ver como integrante
            </Button>
          </CardContent>
        </Card>

        <Card component="section" aria-labelledby="module-usage-title">
          <CardContent className="flex flex-col gap-4">
            <Typography id="module-usage-title" variant="h6" component="h2" className="mb-0">
              Uso
            </Typography>
            {/* Independent counts, each in its own unit, so a labelled list:
                as bars they would read as shares of a sum that means nothing. */}
            <Box component="dl" className="m-0 flex flex-col gap-2">
              {[
                ["Computadores com ela instalada", module.usage.installs],
                ["Contas que executaram em 30 dias", module.usage.activeAccounts30d],
                ["Execuções em 30 dias", module.usage.executions30d],
                ["Downloads em 30 dias", module.usage.downloads30d],
                ["Downloads desde o início", module.usage.downloads],
              ].map(([label, value]) => (
                <Box key={label} className="flex flex-row justify-between gap-3">
                  <Typography component="dt" variant="body2" className="text-text-secondary">
                    {label}
                  </Typography>
                  <Typography component="dd" variant="body1" className="m-0 text-right tabular-nums">
                    {formatNumber(Number(value))}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="subtitle2" component="h3" className="mb-0">
              Aulas iniciadas
            </Typography>
            {module.usage.lessonsStarted > 0 ? (
              <MetricBars
                spacing="dense"
                total={module.usage.lessonsStarted}
                items={[
                  { key: "completed", label: "Concluídas", value: module.usage.lessonsCompleted },
                  {
                    key: "open",
                    label: "Ainda não concluídas",
                    value: Math.max(0, module.usage.lessonsStarted - module.usage.lessonsCompleted),
                    tone: "empty",
                  },
                ]}
              />
            ) : (
              <Typography variant="body2" className="text-text-secondary">
                Ninguém começou uma aula desta ferramenta ainda.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {editing ? (
        <ModuleFormDialog
          module={module}
          trails={state.trails}
          storeCategories={state.storeCategories}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            enqueueSnackbar("Dados salvos.", { variant: "success" });
            if (saved.slug !== slug) router.replace(`/admin/catalogo/${saved.slug}`);
            else refresh();
          }}
        />
      ) : null}
    </Grid>
  );
}
