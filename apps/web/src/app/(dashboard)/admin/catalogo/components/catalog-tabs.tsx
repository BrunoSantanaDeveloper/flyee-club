"use client";

import {
  type CatalogActionResult,
  deleteRecipe,
  deleteStoreCategory,
  saveDelivery,
  saveStoreCategory,
  saveStoreSettings,
  saveTrail,
  setRecipeStatus,
  type StoreCategoryInput,
  type TrailInput,
} from "../actions";
import { LocalizedInput, TextInput } from "./fields";
import RecipeDialog from "./recipe-dialog";
import { useSnackbar } from "notistack";
import { useState } from "react";

import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, Typography } from "@mui/material";

import CatalogIcon from "@/components/product/catalog-icon";
import DialogHeader from "@/components/product/dialog-header";
import EmptyState from "@/components/product/empty-state";
import StatusChip from "@/components/product/status-chip";
import NiListSquare from "@/icons/nexture/ni-list-square";
import NiPen from "@/icons/nexture/ni-pen";
import NiPlus from "@/icons/nexture/ni-plus";
import {
  type AdminModule,
  type AdminRecipe,
  type AdminStoreCategory,
  type AdminTrail,
  type DeliverySettings,
  type StoreSettings,
  textOf,
} from "@/lib/admin/catalog";
import { formatNumber } from "@/lib/admin/format";
import { labelOf, MODULE_STATUS_LABEL } from "@/lib/admin/labels";

const STATUS_TONE = { draft: "neutral", published: "positive", archived: "neutral" } as const;

/** Runs an action, shows its outcome, refreshes the page on success. */
function useRun(onChanged: () => void) {
  const { enqueueSnackbar } = useSnackbar();
  return async (action: () => Promise<CatalogActionResult<unknown>>, success: string) => {
    const result = await action();
    if (!result.ok) {
      enqueueSnackbar(result.error, { variant: "error" });
      return false;
    }
    enqueueSnackbar(success, { variant: "success" });
    onChanged();
    return true;
  };
}

// ---------- Recipes ----------

/** Recipes are few and each one is a small story (a chain of tools), so they read as cards, not rows. */
export function RecipesTab({
  recipes,
  modules,
  onChanged,
}: {
  recipes: AdminRecipe[];
  modules: AdminModule[];
  onChanged: () => void;
}) {
  const run = useRun(onChanged);
  const [editing, setEditing] = useState<AdminRecipe | "new" | null>(null);
  const nameOf = (id: string) => {
    const module = modules.find((entry) => entry.id === id);
    return module ? textOf(module.name, module.slug) : "ferramenta removida";
  };

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-row flex-wrap items-center justify-between gap-3">
        <Typography variant="body1" className="text-text-secondary max-w-2xl">
          Uma receita encadeia ferramentas para um resultado. O nome e a lista são públicos; o passo a passo é da
          assinatura.
        </Typography>
        <Button
          variant="contained"
          startIcon={<NiPlus size="medium" />}
          onClick={() => setEditing("new")}
          disabled={modules.length < 2}
        >
          Nova receita
        </Button>
      </Box>

      {recipes.length === 0 ? (
        <EmptyState
          icon={<NiListSquare size="large" />}
          title="Nenhuma receita ainda"
          description={
            modules.length < 2
              ? "Uma receita encadeia pelo menos duas ferramentas. Cadastre as ferramentas primeiro."
              : "Junte duas ou mais ferramentas que costumam ser usadas em sequência e escreva o passo a passo."
          }
          action={
            modules.length < 2 ? undefined : { label: "Criar a primeira receita", onClick: () => setEditing("new") }
          }
        />
      ) : (
        <Box className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recipes.map((recipe) => (
            <Card key={recipe.id} component="article">
              <CardContent className="flex flex-col gap-3">
                <Box className="flex flex-row items-start gap-3">
                  <Box
                    aria-hidden
                    className="bg-accent-2-light/10 text-accent-2 flex h-12 w-12 flex-none items-center justify-center rounded-2xl"
                  >
                    <CatalogIcon name={recipe.icon} size="medium" />
                  </Box>
                  <Box className="flex min-w-0 flex-1 flex-col">
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <Typography variant="h6" component="h3" className="mb-0">
                        {textOf(recipe.name, recipe.slug)}
                      </Typography>
                      <StatusChip
                        label={labelOf(MODULE_STATUS_LABEL, recipe.status)}
                        tone={STATUS_TONE[recipe.status]}
                      />
                    </Box>
                    <Typography variant="body2" className="text-text-secondary">
                      receita:{recipe.slug}
                    </Typography>
                  </Box>
                </Box>
                {textOf(recipe.summary) ? <Typography variant="body1">{textOf(recipe.summary)}</Typography> : null}
                <Typography variant="body2" className="text-text-secondary">
                  {recipe.moduleIds.map(nameOf).join(" → ")}
                </Typography>
                {!textOf(recipe.workflow) ? (
                  <Typography variant="body2" className="text-text-secondary">
                    Sem passo a passo escrito ainda.
                  </Typography>
                ) : null}
                <Box className="flex flex-row flex-wrap gap-2">
                  <Button variant="outlined" color="grey" size="small" onClick={() => setEditing(recipe)}>
                    Editar
                  </Button>
                  {recipe.status !== "published" ? (
                    <Button
                      variant="outlined"
                      color="grey"
                      size="small"
                      onClick={() => run(() => setRecipeStatus(recipe.id, "published"), "Receita publicada.")}
                    >
                      Publicar
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="grey"
                      size="small"
                      onClick={() => run(() => setRecipeStatus(recipe.id, "archived"), "Receita arquivada.")}
                    >
                      Arquivar
                    </Button>
                  )}
                  {!recipe.publishedAt ? (
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      onClick={() => run(() => deleteRecipe(recipe.id), "Receita excluída.")}
                    >
                      Excluir rascunho
                    </Button>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {editing ? (
        <RecipeDialog
          key={editing === "new" ? "new" : editing.id}
          recipe={editing === "new" ? null : editing}
          modules={modules}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </Box>
  );
}

// ---------- Trails ----------

function TrailDialog({ trail, onClose, onSaved }: { trail: AdminTrail; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TrailInput>({
    slug: trail.slug,
    name: trail.name,
    description: trail.description,
    icon: trail.icon ?? "",
    sort: trail.sort,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveTrail(form);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onSaved();
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="trail-form-title">
      <DialogHeader
        id="trail-form-title"
        title={`Trilha ${textOf(trail.name, trail.slug)}`}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <LocalizedInput label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <LocalizedInput
            label="Descrição"
            value={form.description}
            onChange={(description) => setForm({ ...form, description })}
            multiline
            rows={2}
          />
          <Box className="grid grid-cols-2 gap-3">
            <TextInput
              label="Ícone"
              value={form.icon}
              onChange={(icon) => setForm({ ...form, icon })}
              placeholder="NiCompass"
            />
            <TextInput
              label="Ordem"
              type="number"
              value={form.sort}
              onChange={(sort) => setForm({ ...form, sort: Number(sort) })}
            />
          </Box>
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
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The seven stages of a product: their words, icon and order change; the list itself does not. */
export function TrailsTab({
  trails,
  modules,
  onChanged,
}: {
  trails: AdminTrail[];
  modules: AdminModule[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminTrail | null>(null);
  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="body1" className="text-text-secondary max-w-2xl">
        As sete etapas que organizam o catálogo. Os nomes, as descrições, o ícone e a ordem podem mudar; a lista é fixa,
        porque cada ferramenta e cada manifesto apontam para uma delas.
      </Typography>
      <Box className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trails.map((trail) => {
          const count = modules.filter((module) => module.trail === trail.slug).length;
          return (
            <Card key={trail.slug} component="article">
              <CardContent className="flex flex-row items-start gap-3">
                <Box
                  aria-hidden
                  className="bg-primary-light/10 text-primary flex h-12 w-12 flex-none items-center justify-center rounded-2xl"
                >
                  <CatalogIcon name={trail.icon} size="medium" />
                </Box>
                <Box className="flex min-w-0 flex-1 flex-col gap-1">
                  <Typography variant="h6" component="h3" className="mb-0">
                    {textOf(trail.name, trail.slug)}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {textOf(trail.description, "Sem descrição.")}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {formatNumber(count)} {count === 1 ? "ferramenta" : "ferramentas"} · ordem {trail.sort}
                  </Typography>
                </Box>
                <Button variant="outlined" color="grey" size="small" onClick={() => setEditing(trail)}>
                  Editar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Box>
      {editing ? (
        <TrailDialog
          key={editing.slug}
          trail={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </Box>
  );
}

// ---------- Store categories ----------

function StoreCategoryDialog({
  category,
  nextSort,
  onClose,
  onSaved,
}: {
  category: AdminStoreCategory | null;
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StoreCategoryInput>({
    slug: category?.slug ?? "",
    name: category?.name ?? {},
    sort: category?.sort ?? nextSort,
    isNew: !category,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveStoreCategory(form);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onSaved();
  };
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="store-category-form-title"
    >
      <DialogHeader
        id="store-category-form-title"
        title={category ? `Categoria ${textOf(category.name, category.slug)}` : "Nova categoria da loja"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <LocalizedInput label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Box className="grid grid-cols-2 gap-3">
            <TextInput
              label="Identificador"
              value={form.slug}
              onChange={(slug) => setForm({ ...form, slug: slug.toLowerCase() })}
              disabled={!form.isNew}
              placeholder="design"
              help={form.isNew ? "Não muda depois de criada: os links e os eventos usam ele." : "Fixo desde a criação."}
            />
            <TextInput
              label="Ordem"
              type="number"
              value={form.sort}
              onChange={(sort) => setForm({ ...form, sort: Number(sort) })}
            />
          </Box>
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
          {busy ? "Salvando…" : category ? "Salvar" : "Criar categoria"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * The kinds of work the public store filters by (migration 0029). Unlike the
 * stages they are free: create, rename, reorder; delete one no app is in.
 * Which category an app is in is set on the app, in its form.
 */
export function StoreCategoriesTab({
  categories,
  settings,
  modules,
  onChanged,
}: {
  categories: AdminStoreCategory[];
  settings: StoreSettings;
  modules: AdminModule[];
  onChanged: () => void;
}) {
  const run = useRun(onChanged);
  const [editing, setEditing] = useState<AdminStoreCategory | "new" | null>(null);
  const [newBadgeDays, setNewBadgeDays] = useState(settings.newBadgeDays);
  const uncategorized = modules.filter((module) => !module.storeCategory).length;
  const nextSort = (categories.at(-1)?.sort ?? 0) + 10;
  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-row flex-wrap items-start justify-between gap-3">
        <Typography variant="body1" className="text-text-secondary max-w-2xl">
          Os tipos de trabalho pelos quais a loja pública (a home e /catalogo) filtra os apps. As etapas continuam
          organizando o catálogo, o painel e a CLI; a categoria só muda onde o app aparece na loja e não pede versão
          nova.{" "}
          {uncategorized > 0
            ? `${formatNumber(uncategorized)} ${uncategorized === 1 ? "ferramenta está" : "ferramentas estão"} sem categoria e ${uncategorized === 1 ? "aparece" : "aparecem"} só em Todos.`
            : "Toda ferramenta tem categoria."}
        </Typography>
        <Button variant="contained" startIcon={<NiPlus size="medium" />} onClick={() => setEditing("new")}>
          Nova categoria
        </Button>
      </Box>
      <Box className="flex flex-row flex-wrap items-end gap-3">
        <TextInput
          label="Dias com o selo Novo depois da primeira publicação"
          type="number"
          value={newBadgeDays}
          onChange={(value) => setNewBadgeDays(Number(value))}
          help="O selo Usa sua conta vem das credenciais obrigatórias de cada ferramenta."
        />
        <Button
          variant="outlined"
          color="grey"
          disabled={newBadgeDays === settings.newBadgeDays}
          onClick={() => run(() => saveStoreSettings({ newBadgeDays }), `Selo Novo: ${newBadgeDays} dias.`)}
        >
          Salvar
        </Button>
      </Box>
      {categories.length === 0 ? (
        <EmptyState
          icon={<NiListSquare size="large" />}
          title="Nenhuma categoria na loja"
          description="Sem categorias, a loja pública mostra só Todos. Crie a primeira para os visitantes filtrarem os apps."
          action={{ label: "Criar a primeira categoria", onClick: () => setEditing("new") }}
        />
      ) : (
        <Box className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const count = modules.filter((module) => module.storeCategory === category.slug).length;
            return (
              <Card key={category.slug} component="article">
                <CardContent className="flex flex-col gap-2">
                  <Typography variant="h6" component="h3" className="mb-0">
                    {textOf(category.name, category.slug)}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {category.name.en
                      ? `EN: ${category.name.en}`
                      : "Sem nome em inglês: a página em inglês usa o português."}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {formatNumber(count)} {count === 1 ? "ferramenta" : "ferramentas"} · {category.slug} · ordem{" "}
                    {category.sort}
                  </Typography>
                  <Box className="flex flex-row flex-wrap gap-2">
                    <Button
                      variant="outlined"
                      color="grey"
                      size="small"
                      startIcon={<NiPen size="small" />}
                      onClick={() => setEditing(category)}
                    >
                      Editar
                    </Button>
                    {count === 0 ? (
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        onClick={() =>
                          run(
                            () => deleteStoreCategory(category.slug),
                            `Categoria ${textOf(category.name, category.slug)} excluída.`,
                          )
                        }
                      >
                        Excluir
                      </Button>
                    ) : null}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
      {editing ? (
        <StoreCategoryDialog
          key={editing === "new" ? "new" : editing.slug}
          category={editing === "new" ? null : editing}
          nextSort={nextSort}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </Box>
  );
}

// ---------- Delivery ----------

/** What the CLI delivery API enforces and announces (`platform_settings.cli`). */
export function DeliveryTab({ delivery, onChanged }: { delivery: DeliverySettings; onChanged: () => void }) {
  const run = useRun(onChanged);
  const [form, setForm] = useState({
    perMinute: String(delivery.perMinute),
    perHour: String(delivery.perHour),
    downloadsPerDay: String(delivery.downloadsPerDay),
    eventsPerHour: String(delivery.eventsPerHour),
    minCliVersion: delivery.minCliVersion,
    latestCoreVersion: delivery.latestCoreVersion ?? "",
    deprecations: delivery.deprecations.join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    await run(
      () =>
        saveDelivery({
          perMinute: Number(form.perMinute),
          perHour: Number(form.perHour),
          downloadsPerDay: Number(form.downloadsPerDay),
          eventsPerHour: Number(form.eventsPerHour),
          minCliVersion: form.minCliVersion.trim(),
          latestCoreVersion: form.latestCoreVersion.trim() || null,
          deprecations: form.deprecations.split("\n"),
        }),
      "Configurações da entrega salvas.",
    );
    setBusy(false);
  };

  return (
    <Box className="flex max-w-3xl flex-col gap-6">
      <Typography variant="body1" className="text-text-secondary">
        O que a API da CLI aplica a cada conta e o que ela avisa a quem roda o npx flyee. Vale na próxima chamada, sem
        deploy.
      </Typography>

      <Box className="flex flex-col gap-3">
        <Typography variant="subtitle2" component="h3">
          Limites por conta
        </Typography>
        <Box className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextInput label="Chamadas por minuto" type="number" value={form.perMinute} onChange={set("perMinute")} />
          <TextInput label="Chamadas por hora" type="number" value={form.perHour} onChange={set("perHour")} />
          <TextInput
            label="Downloads por dia"
            type="number"
            value={form.downloadsPerDay}
            onChange={set("downloadsPerDay")}
          />
          <TextInput
            label="Eventos de uso por hora"
            type="number"
            value={form.eventsPerHour}
            onChange={set("eventsPerHour")}
            help="Acima disso, os eventos da CLI são descartados até a hora virar: a medição fica incompleta, o uso não."
          />
        </Box>
      </Box>

      <Box className="flex flex-col gap-3">
        <Typography variant="subtitle2" component="h3">
          Versões
        </Typography>
        <Box className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextInput
            label="Versão mínima da CLI atendida"
            value={form.minCliVersion}
            onChange={set("minCliVersion")}
            placeholder="0.1.0"
            help="Uma CLI mais velha recebe o aviso para atualizar o npx flyee."
          />
          <TextInput
            label="Versão mais nova do core"
            value={form.latestCoreVersion}
            onChange={set("latestCoreVersion")}
            placeholder="vazio enquanto não houver"
          />
        </Box>
        <TextInput
          label="Avisos para a CLI mostrar, um por linha"
          value={form.deprecations}
          onChange={set("deprecations")}
          multiline
          rows={3}
          help="Até 10 avisos curtos. A CLI imprime cada um como está."
        />
      </Box>

      <Box>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </Box>
    </Box>
  );
}
