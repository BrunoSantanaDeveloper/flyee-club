"use client";

import { type RecipeInput, saveRecipe } from "../actions";
import { LocalizedInput, TextInput } from "./fields";
import { useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import { type AdminModule, type AdminRecipe, textOf } from "@/lib/admin/catalog";

/**
 * Creates or edits a recipe: modules chained toward one result. The name, the
 * summary and the chain are public; the workflow (how to chain them) is what
 * the subscription unlocks, and lives apart in the database.
 */
export default function RecipeDialog({
  recipe,
  modules,
  onClose,
  onSaved,
}: {
  recipe: AdminRecipe | null;
  modules: AdminModule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RecipeInput>(() => ({
    id: recipe?.id ?? null,
    slug: recipe?.slug ?? "",
    name: recipe?.name ?? {},
    summary: recipe?.summary ?? {},
    icon: recipe?.icon ?? "",
    sort: recipe?.sort ?? 0,
    moduleIds: recipe?.moduleIds ?? [],
    workflow: recipe?.workflow ?? {},
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RecipeInput>(key: K, value: RecipeInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const chosen = form.moduleIds
    .map((id) => modules.find((module) => module.id === id))
    .filter((module): module is AdminModule => Boolean(module));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveRecipe(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="recipe-form-title"
    >
      <DialogHeader
        id="recipe-form-title"
        title={recipe ? `Editar ${textOf(recipe.name, recipe.slug)}` : "Nova receita"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-5">
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextInput
              label="Slug (npx flyee add receita:…)"
              value={form.slug}
              onChange={(value) => set("slug", value.toLowerCase())}
              placeholder="lancar-landing"
            />
            <TextInput
              label="Ícone"
              value={form.icon}
              onChange={(value) => set("icon", value)}
              placeholder="NiRocket"
            />
            <TextInput label="Ordem" type="number" value={form.sort} onChange={(value) => set("sort", Number(value))} />
          </Box>
          <LocalizedInput label="Nome" value={form.name} onChange={(value) => set("name", value)} required />
          <LocalizedInput
            label="Resumo"
            value={form.summary}
            onChange={(value) => set("summary", value)}
            multiline
            rows={2}
          />

          <Box className="flex flex-col gap-1">
            <Autocomplete
              multiple
              options={modules}
              value={chosen}
              onChange={(_, value) =>
                set(
                  "moduleIds",
                  value.map((module) => module.id),
                )
              }
              getOptionLabel={(module) => `${textOf(module.name, module.slug)} (${module.slug})`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label="Ferramentas, na ordem em que encadeiam" size="small" />
              )}
            />
            <Typography variant="body2" className="text-text-secondary">
              Pelo menos duas. A ordem de escolha é a ordem da receita. Uma ferramenta em rascunho aparece para o
              integrante só quando for publicada.
            </Typography>
          </Box>

          <LocalizedInput
            label="Passo a passo em Markdown"
            value={form.workflow}
            onChange={(value) => set("workflow", value)}
            multiline
            rows={8}
            help="Só quem tem a assinatura lê este texto. O nome, o resumo e a lista de ferramentas são públicos."
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
          {busy ? "Salvando…" : recipe ? "Salvar" : "Criar receita"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
