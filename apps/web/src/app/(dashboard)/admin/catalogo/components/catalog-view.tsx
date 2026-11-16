"use client";

import { DeliveryTab, RecipesTab, StoreCategoriesTab, TrailsTab } from "./catalog-tabs";
import ModuleFormDialog from "./module-form-dialog";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Grid, Tab, Tabs, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";

import DataTable from "@/components/data-grid/data-table";
import AppIconLazy from "@/components/marketing/app-icon-lazy";
import EmptyState from "@/components/product/empty-state";
import { StatTile } from "@/components/product/home-tiles";
import PageHeader from "@/components/product/page-header";
import StatusChip from "@/components/product/status-chip";
import IllustrationDocumentation from "@/icons/illustrations/illustration-documentation";
import IllustrationLaunch from "@/icons/illustrations/illustration-launch";
import NiArchive from "@/icons/nexture/ni-archive";
import NiCatalog from "@/icons/nexture/ni-catalog";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiPen from "@/icons/nexture/ni-pen";
import NiPlus from "@/icons/nexture/ni-plus";
import NiUploadCloud from "@/icons/nexture/ni-upload-cloud";
import {
  type AdminModule,
  type AdminRecipe,
  type AdminStoreCategory,
  type AdminTrail,
  type DeliverySettings,
  latestPublished,
  type StoreSettings,
  textOf,
} from "@/lib/admin/catalog";
import { formatNumber } from "@/lib/admin/format";
import { labelOf, MODULE_STATUS_LABEL, MODULE_TYPE_LABEL } from "@/lib/admin/labels";
import type { ConsoleState } from "@/lib/admin/session";
import { storeLook } from "@/lib/catalog/store-look";

export type CatalogState = ConsoleState<{
  trails: AdminTrail[];
  storeCategories: AdminStoreCategory[];
  storeSettings: StoreSettings;
  modules: AdminModule[];
  recipes: AdminRecipe[];
  delivery: DeliverySettings;
}>;

type Filter = "all" | "published" | "draft" | "review" | "archived";

const FILTERS: {
  key: Filter;
  label: string;
  hint: string;
  icon: React.ReactNode;
  matches: (module: AdminModule) => boolean;
}[] = [
  {
    key: "all",
    label: "Todas",
    hint: "Todas as ferramentas cadastradas",
    icon: <NiCatalog size="large" />,
    matches: () => true,
  },
  {
    key: "published",
    label: "Publicadas",
    hint: "No catálogo dos integrantes e na CLI",
    icon: <NiCheckSquare size="large" />,
    matches: (module) => module.status === "published",
  },
  {
    key: "review",
    label: "Versão para revisar",
    hint: "Têm um pacote enviado em rascunho, esperando publicação",
    icon: <NiUploadCloud size="large" />,
    matches: (module) => module.versions.some((version) => version.status === "draft"),
  },
  {
    key: "draft",
    label: "Rascunhos",
    hint: "Ainda não publicadas: só a equipe vê",
    icon: <NiPen size="large" />,
    matches: (module) => module.status === "draft",
  },
  {
    key: "archived",
    label: "Arquivadas",
    hint: "Fora do catálogo; quem instalou continua com elas",
    icon: <NiArchive size="large" />,
    matches: (module) => module.status === "archived",
  },
];

const STATUS_TONE = { draft: "neutral", published: "positive", archived: "neutral" } as const;

const CRUMBS = [{ label: "Início", href: "/inicio" }, { label: "Admin", href: "/admin" }, { label: "Catálogo" }];

/**
 * The catalog the CLI installs from. The operator comes to add a tool, to ship
 * a version that is waiting, or to see what is used: the tiles say what waits,
 * a row opens the tool's own page, where its versions and lessons live.
 */
export default function CatalogView({ state }: { state: CatalogState }) {
  const router = useRouter();
  const [tab, setTab] = useState<"modules" | "recipes" | "trails" | "categories" | "delivery">("modules");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const refresh = useCallback(() => router.refresh(), [router]);

  const ready = state.kind === "ready" ? state : null;
  const modules = useMemo(() => ready?.modules ?? [], [ready?.modules]);
  const trails = useMemo(() => ready?.trails ?? [], [ready?.trails]);
  const activeFilter = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
  const visible = useMemo(() => modules.filter(activeFilter.matches), [modules, activeFilter]);
  const trailName = useCallback(
    (slug: string) => textOf(trails.find((trail) => trail.slug === slug)?.name, slug),
    [trails],
  );
  // Each row shows the app's icon as the store draws it (components/marketing/app-icon.tsx).
  const storeCategories = useMemo(() => ready?.storeCategories ?? [], [ready?.storeCategories]);
  const look = useMemo(
    () =>
      storeLook({
        trails: trails.map((trail) => ({ slug: trail.slug, name: textOf(trail.name) })),
        storeCategories: storeCategories.map((category) => ({ slug: category.slug, name: textOf(category.name) })),
      }),
    [trails, storeCategories],
  );

  const columns = useMemo<GridColDef<AdminModule>[]>(
    () => [
      {
        field: "name",
        headerName: "Ferramenta",
        flex: 1.4,
        minWidth: 220,
        valueGetter: (_, row) => `${textOf(row.name, row.slug)} ${row.slug}`,
        renderCell: ({ row }) => (
          <Box className="flex min-w-0 flex-row items-center gap-3 py-1">
            <AppIconLazy name={row.icon} tone={look.lookOf(row).tone} size="sm" />
            <Box className="flex min-w-0 flex-col">
              <Typography variant="subtitle2" component="span" className="truncate">
                {textOf(row.name, row.slug)}
              </Typography>
              <Typography variant="body2" className="text-text-secondary truncate">
                {row.slug}
              </Typography>
            </Box>
          </Box>
        ),
      },
      { field: "trail", headerName: "Trilha", width: 120, valueGetter: (_, row) => trailName(row.trail) },
      { field: "type", headerName: "Tipo", width: 100, valueGetter: (_, row) => labelOf(MODULE_TYPE_LABEL, row.type) },
      {
        field: "status",
        headerName: "Estado",
        width: 120,
        valueGetter: (_, row) => labelOf(MODULE_STATUS_LABEL, row.status),
        renderCell: ({ row }) => (
          <StatusChip label={labelOf(MODULE_STATUS_LABEL, row.status)} tone={STATUS_TONE[row.status]} />
        ),
      },
      {
        field: "version",
        headerName: "Versão publicada",
        width: 190,
        valueGetter: (_, row) => latestPublished(row.versions)?.version ?? "",
        renderCell: ({ row }) => {
          const latest = latestPublished(row.versions);
          const entry = row.versions.find((version) => version.isEntry);
          const drafts = row.versions.filter((version) => version.status === "draft").length;
          // The entry version is what an account with no purchase installs (0040).
          const notes = [
            latest ? (entry ? `entrada v${entry.version}` : "sem versão de entrada") : null,
            drafts > 0 ? (drafts === 1 ? "1 rascunho" : `${formatNumber(drafts)} rascunhos`) : null,
          ].filter(Boolean);
          return (
            <Box className="flex flex-col justify-center py-1">
              <Typography variant="body1" component="span">
                {latest ? `v${latest.version}` : "nenhuma"}
              </Typography>
              {notes.length > 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {notes.join(" · ")}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        field: "installs",
        headerName: "Computadores",
        width: 130,
        type: "number",
        valueGetter: (_, row) => row.usage.installs,
      },
      {
        field: "executions30d",
        headerName: "Execuções 30 d",
        width: 130,
        type: "number",
        valueGetter: (_, row) => row.usage.executions30d,
      },
      {
        field: "downloads30d",
        headerName: "Downloads 30 d",
        width: 130,
        type: "number",
        valueGetter: (_, row) => row.usage.downloads30d,
      },
    ],
    [trailName, look],
  );

  const header = (
    <PageHeader
      title="Catálogo"
      crumbs={CRUMBS}
      description="As ferramentas que a CLI instala, as receitas que as encadeiam, as trilhas que as organizam e as regras da entrega."
      action={
        ready ? (
          <Button variant="contained" startIcon={<NiPlus size="medium" />} onClick={() => setCreating(true)}>
            Nova ferramenta
          </Button>
        ) : undefined
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
            // A failed read is an error, never an empty catalog.
            <Alert
              severity="error"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" onClick={refresh}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível ler o catálogo agora.
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
        <Box className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {FILTERS.map((entry) => (
            <StatTile
              key={entry.key}
              icon={entry.icon}
              tone={entry.key === "review" ? "accent-3" : entry.key === "published" ? "accent-2" : "primary"}
              label={entry.label}
              value={formatNumber(modules.filter(entry.matches).length)}
              hint={entry.hint}
              pressed={tab === "modules" && filter === entry.key}
              onClick={() => {
                setTab("modules");
                setFilter(entry.key);
              }}
            />
          ))}
        </Box>
      </Grid>

      <Grid size={12}>
        <Card>
          <CardContent>
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              className="mb-5"
              aria-label="Partes do catálogo"
            >
              <Tab value="modules" label={`Ferramentas (${formatNumber(modules.length)})`} />
              <Tab value="recipes" label={`Receitas (${formatNumber(ready.recipes.length)})`} />
              <Tab value="trails" label="Trilhas" />
              <Tab value="categories" label="Categorias da loja" />
              <Tab value="delivery" label="Entrega" />
            </Tabs>

            {tab === "modules" ? (
              modules.length === 0 ? (
                <EmptyState
                  framed={false}
                  illustration={<IllustrationLaunch />}
                  title="O catálogo ainda está vazio"
                  description="Cadastre a primeira ferramenta, envie o pacote ZIP com o flyee.module.json e publique a versão: ela aparece no painel e na CLI."
                  action={{ label: "Cadastrar a primeira ferramenta", onClick: () => setCreating(true) }}
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  framed={false}
                  illustration={<IllustrationDocumentation />}
                  title={`Nenhuma ferramenta em “${activeFilter.label}”`}
                  description={activeFilter.hint}
                  action={{ label: "Ver todas", onClick: () => setFilter("all") }}
                />
              ) : (
                <DataTable<AdminModule>
                  rows={visible}
                  columns={columns}
                  getRowId={(row) => row.id}
                  onRowClick={(row) => router.push(`/admin/catalogo/${row.slug}`)}
                  onQuickFilterChange={setQuery}
                  pageSize={25}
                  pageSizeOptions={[25, 50, 100]}
                  labels={{ search: "Buscar por nome ou slug" }}
                  noResultsOverlay={
                    <EmptyState
                      layout="row"
                      illustration={<IllustrationDocumentation />}
                      title="Nenhuma ferramenta corresponde à busca"
                      description={`Nada encontrado para “${query}”.`}
                    />
                  }
                />
              )
            ) : tab === "recipes" ? (
              <RecipesTab recipes={ready.recipes} modules={modules} onChanged={refresh} />
            ) : tab === "trails" ? (
              <TrailsTab trails={trails} modules={modules} onChanged={refresh} />
            ) : tab === "categories" ? (
              <StoreCategoriesTab
                categories={ready.storeCategories}
                settings={ready.storeSettings}
                modules={modules}
                onChanged={refresh}
              />
            ) : (
              <DeliveryTab delivery={ready.delivery} onChanged={refresh} />
            )}
          </CardContent>
        </Card>
      </Grid>

      {creating ? (
        <ModuleFormDialog
          module={null}
          trails={trails}
          storeCategories={ready?.storeCategories ?? []}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            router.push(`/admin/catalogo/${saved.slug}`);
          }}
        />
      ) : null}
    </Grid>
  );
}
