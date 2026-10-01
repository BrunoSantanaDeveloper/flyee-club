"use client";

import { LocalizedInput, SelectInput, TextInput } from "../../catalogo/components/fields";
import { deleteRoadmapItem, type RoadmapItemInput, saveRoadmapItem, setRoadmapStatus } from "../actions";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  Typography,
} from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import NiFlag from "@/icons/nexture/ni-flag";
import NiPlus from "@/icons/nexture/ni-plus";
import { type Localized, textOf } from "@/lib/admin/catalog";
import { formatNumber } from "@/lib/admin/format";
import { labelOf, ROADMAP_STATUS_LABEL } from "@/lib/admin/labels";
import {
  type AdminRoadmapItem,
  ROADMAP_STATUSES,
  type RoadmapModuleOption,
  type RoadmapStatus,
} from "@/lib/admin/roadmap";
import type { ConsoleState } from "@/lib/admin/session";

export type RoadmapAdminState = ConsoleState<{
  items: AdminRoadmapItem[];
  modules: RoadmapModuleOption[];
  trails: { slug: string; name: Localized }[];
}>;

const CRUMBS = [{ label: "Início", href: "/inicio" }, { label: "Admin", href: "/admin" }, { label: "Roadmap" }];

/** The next step of an open item, the one button each card offers. */
const NEXT: Partial<Record<RoadmapStatus, { status: RoadmapStatus; label: string }>> = {
  proposed: { status: "planned", label: "Planejar" },
  planned: { status: "building", label: "Começar a construir" },
};

const STATUS_OPTIONS = ROADMAP_STATUSES.map((status) => ({
  value: status,
  label: labelOf(ROADMAP_STATUS_LABEL, status),
}));

function ItemDialog({
  item,
  modules,
  trails,
  onClose,
  onSaved,
}: {
  item: AdminRoadmapItem | null;
  modules: RoadmapModuleOption[];
  trails: { slug: string; name: Localized }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RoadmapItemInput>(() => ({
    id: item?.id ?? null,
    title: item?.title ?? {},
    description: item?.description ?? {},
    trail: item?.trail ?? null,
    status: item?.status ?? "proposed",
    shippedModuleId: item?.shippedModuleId ?? null,
    sort: item?.sort ?? 0,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RoadmapItemInput>(key: K, value: RoadmapItemInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveRoadmapItem(form);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onSaved();
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="roadmap-form-title">
      <DialogHeader
        id="roadmap-form-title"
        title={item ? "Editar item" : "Novo item do roadmap"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <LocalizedInput label="Título" value={form.title} onChange={(value) => set("title", value)} required />
          <LocalizedInput
            label="Descrição"
            value={form.description}
            onChange={(value) => set("description", value)}
            multiline
            rows={3}
          />
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectInput
              label="Trilha"
              value={form.trail ?? ""}
              options={[
                { value: "", label: "Sem trilha" },
                ...trails.map((trail) => ({ value: trail.slug, label: textOf(trail.name, trail.slug) })),
              ]}
              onChange={(value) => set("trail", value || null)}
            />
            <SelectInput
              label="Estado"
              value={form.status}
              options={STATUS_OPTIONS}
              onChange={(value) => set("status", value)}
            />
          </Box>
          {form.status === "shipped" ? (
            <SelectInput
              label="Virou a ferramenta"
              value={form.shippedModuleId ?? ""}
              options={[
                { value: "", label: "Nenhuma ainda" },
                ...modules.map((module) => ({
                  value: module.id,
                  label: `${textOf(module.name, module.slug)} (${module.slug})`,
                })),
              ]}
              onChange={(value) => set("shippedModuleId", value || null)}
            />
          ) : null}
          <TextInput
            label="Ordem entre itens com os mesmos votos"
            type="number"
            value={form.sort}
            onChange={(value) => set("sort", Number(value))}
          />
          {error ? (
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="grey" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : item ? "Salvar" : "Criar item"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * What the club builds next, as members voted. The operator comes to read the
 * demand (votes), move ideas along, and close the loop when an idea ships or is
 * declined: members see each of those states on their own roadmap.
 */
export default function RoadmapAdminView({ state }: { state: RoadmapAdminState }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState<AdminRoadmapItem | "new" | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);

  const header = (
    <PageHeader
      title="Roadmap"
      crumbs={CRUMBS}
      description="As ideias do que construir, com os votos dos assinantes. Mover um item muda o que os integrantes veem no roadmap deles."
      action={
        state.kind === "ready" ? (
          <Button variant="contained" startIcon={<NiPlus size="medium" />} onClick={() => setEditing("new")}>
            Novo item
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
                <Button color="inherit" size="small" onClick={refresh}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler o roadmap agora.
            </Alert>
          )}
        </Grid>
      </Grid>
    );
  }

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    const result = await action();
    if (!result.ok) enqueueSnackbar(result.error ?? "Não foi possível concluir.", { variant: "error" });
    else {
      enqueueSnackbar(success, { variant: "success" });
      refresh();
    }
  };
  const moduleName = (id: string | null) => {
    const module = state.modules.find((entry) => entry.id === id);
    return module ? textOf(module.name, module.slug) : null;
  };
  const trailName = (slug: string | null) =>
    slug ? textOf(state.trails.find((trail) => trail.slug === slug)?.name, slug) : null;

  return (
    <Grid container spacing={5}>
      <Grid size={12}>{header}</Grid>
      <Grid size={12}>
        {state.items.length === 0 ? (
          <EmptyState
            icon={<NiFlag size="large" />}
            title="O roadmap está vazio"
            description="Proponha as primeiras ideias de ferramenta. Assinantes votam no painel, e os votos dizem o que construir primeiro."
            action={{ label: "Propor a primeira ideia", onClick: () => setEditing("new") }}
          />
        ) : (
          <Box className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
            {ROADMAP_STATUSES.map((status) => {
              const items = state.items.filter((item) => item.status === status);
              return (
                <Box
                  key={status}
                  component="section"
                  aria-labelledby={`column-${status}`}
                  className="flex flex-col gap-3"
                >
                  <Box className="flex flex-row items-center gap-2">
                    <Typography id={`column-${status}`} variant="h6" component="h2" className="mb-0">
                      {labelOf(ROADMAP_STATUS_LABEL, status)}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary">
                      {formatNumber(items.length)}
                    </Typography>
                  </Box>
                  {items.length === 0 ? (
                    <Typography variant="body2" className="text-text-secondary">
                      Nenhum item.
                    </Typography>
                  ) : (
                    items.map((item) => {
                      const next = NEXT[item.status];
                      return (
                        <Card key={item.id} component="article">
                          {/* No state chip: the column heading already names it. */}
                          <CardContent className="flex flex-col gap-2">
                            <Typography variant="subtitle2" component="h3">
                              {textOf(item.title)}
                            </Typography>
                            <Typography variant="body2" className="text-text-secondary">
                              {formatNumber(item.votes)} {item.votes === 1 ? "voto" : "votos"}
                              {trailName(item.trail) ? ` · ${trailName(item.trail)}` : ""}
                            </Typography>
                            {item.status === "shipped" ? (
                              <Typography variant="body2" className="text-text-secondary">
                                {moduleName(item.shippedModuleId)
                                  ? `Virou ${moduleName(item.shippedModuleId)}`
                                  : "Sem ferramenta ligada"}
                              </Typography>
                            ) : null}
                            <Box className="flex flex-row flex-wrap gap-2">
                              <Button variant="outlined" color="grey" size="small" onClick={() => setEditing(item)}>
                                Editar
                              </Button>
                              {next ? (
                                <Button
                                  variant="outlined"
                                  color="grey"
                                  size="small"
                                  onClick={() =>
                                    run(
                                      () => setRoadmapStatus(item.id, next.status),
                                      `“${textOf(item.title)}”: ${labelOf(ROADMAP_STATUS_LABEL, next.status)}.`,
                                    )
                                  }
                                >
                                  {next.label}
                                </Button>
                              ) : null}
                              {item.votes === 0 && item.status !== "shipped" ? (
                                <Button
                                  variant="text"
                                  color="error"
                                  size="small"
                                  onClick={() => run(() => deleteRoadmapItem(item.id), "Item excluído.")}
                                >
                                  Excluir
                                </Button>
                              ) : null}
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Grid>

      {editing ? (
        <ItemDialog
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          modules={state.modules}
          trails={state.trails}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
    </Grid>
  );
}
