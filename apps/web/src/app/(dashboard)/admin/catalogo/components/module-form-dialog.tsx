"use client";

import { type ModuleInput, saveModule } from "../actions";
import { CheckGroup, CheckInput, LocalizedInput, SelectInput, TextInput } from "./fields";
import { useState } from "react";

import { Alert, Box, Button, Dialog, DialogActions, DialogContent, IconButton, Typography } from "@mui/material";

import CatalogIcon from "@/components/product/catalog-icon";
import DialogHeader from "@/components/product/dialog-header";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiPlus from "@/icons/nexture/ni-plus";
import type { AdminModule, AdminStoreCategory, AdminTrail, Credential } from "@/lib/admin/catalog";
import { textOf } from "@/lib/admin/catalog";
import { AI_TOOL_LABEL, MODULE_TYPE_LABEL, SEGMENT_LABEL } from "@/lib/admin/labels";
import { PERSONA_SEGMENTS } from "@/lib/site-segment";

const AI_OPTIONS = Object.entries(AI_TOOL_LABEL).map(([value, label]) => ({ value, label }));
/** The site personas an app can be a good start for (migration 0032); `outro` is an answer, not a persona. */
const PERSONA_OPTIONS = PERSONA_SEGMENTS.map((persona) => ({
  value: persona,
  label: SEGMENT_LABEL[persona] ?? persona,
}));
const TYPE_OPTIONS = Object.entries(MODULE_TYPE_LABEL).map(([value, label]) => ({ value, label }));

const EMPTY_CREDENTIAL: Credential = { name: "", env: "", url: "", required: true, purpose: {} };

function initialForm(module: AdminModule | null, trails: AdminTrail[]): ModuleInput {
  return {
    id: module?.id ?? null,
    slug: module?.slug ?? "",
    trail: module?.trail ?? trails[0]?.slug ?? "planejar",
    storeCategory: module?.storeCategory ?? null,
    personas: module?.personas ?? [],
    type: module?.type ?? "skill",
    icon: module?.icon ?? "",
    name: module?.name ?? {},
    summary: module?.summary ?? {},
    descriptionMd: module?.descriptionMd ?? {},
    compatibleAis: module?.compatibleAis ?? ["claude_code"],
    externalCredentials: module?.externalCredentials ?? [],
    isFreeSample: module?.isFreeSample ?? false,
    entitlementKey: module?.entitlementKey ?? "catalog_access",
    sort: module?.sort ?? 0,
  };
}

/**
 * Creates or edits a module's catalog entry: what members read on its page and
 * what the CLI lists. The package itself (version, files, permissions) comes
 * from the ZIP and is never typed here; the manifest must agree with the slug,
 * trail and type chosen below, or the upload is refused.
 */
export default function ModuleFormDialog({
  module,
  trails,
  storeCategories,
  onClose,
  onSaved,
}: {
  module: AdminModule | null;
  trails: AdminTrail[];
  storeCategories: AdminStoreCategory[];
  onClose: () => void;
  onSaved: (saved: { id: string; slug: string }) => void;
}) {
  const [form, setForm] = useState<ModuleInput>(() => initialForm(module, trails));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugFrozen = Boolean(module?.publishedAt);
  const set = <K extends keyof ModuleInput>(key: K, value: ModuleInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setCredential = (index: number, patch: Partial<Credential>) =>
    set(
      "externalCredentials",
      form.externalCredentials.map((credential, at) => (at === index ? { ...credential, ...patch } : credential)),
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveModule(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="module-form-title"
    >
      <DialogHeader
        id="module-form-title"
        title={module ? `Editar ${textOf(module.name, module.slug)}` : "Nova ferramenta"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-5">
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextInput
              label="Slug (endereço e nome no npx flyee add)"
              value={form.slug}
              onChange={(value) => set("slug", value.toLowerCase())}
              disabled={slugFrozen}
              placeholder="deploy-check"
              help={slugFrozen ? "Não muda depois da primeira publicação." : "Letras minúsculas, números e hífens."}
            />
            <SelectInput
              label="Trilha"
              value={form.trail}
              options={trails.map((trail) => ({ value: trail.slug, label: textOf(trail.name, trail.slug) }))}
              onChange={(value) => set("trail", value)}
            />
            <SelectInput
              label="Tipo"
              value={form.type}
              options={TYPE_OPTIONS}
              onChange={(value) => set("type", value)}
            />
            <SelectInput
              label="Categoria da loja"
              value={form.storeCategory ?? ""}
              options={[
                { value: "", label: "Sem categoria (aparece só em Todos)" },
                ...storeCategories.map((category) => ({
                  value: category.slug,
                  label: textOf(category.name, category.slug),
                })),
              ]}
              onChange={(value) => set("storeCategory", value || null)}
            />
          </Box>

          <LocalizedInput label="Nome" value={form.name} onChange={(value) => set("name", value)} required />
          <LocalizedInput
            label="Resumo"
            value={form.summary}
            onChange={(value) => set("summary", value)}
            multiline
            rows={2}
            help="Uma ou duas frases: aparecem no cartão do catálogo e na listagem da CLI."
          />
          <LocalizedInput
            label="Descrição em Markdown"
            value={form.descriptionMd}
            onChange={(value) => set("descriptionMd", value)}
            multiline
            rows={6}
            help="O texto da página da ferramenta no painel. Markdown simples; HTML é ignorado."
          />

          <CheckGroup
            label="Funciona com"
            options={AI_OPTIONS}
            value={form.compatibleAis}
            onChange={(value) => set("compatibleAis", value)}
          />

          <CheckGroup
            label="Bom começo para (bloco Para quem é da home: até 3 apps por perfil, na ordem do catálogo)"
            options={PERSONA_OPTIONS}
            value={form.personas}
            onChange={(value) => set("personas", value)}
          />

          <Box className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
            <Box className="flex flex-row items-end gap-3">
              <TextInput
                label="Ícone"
                value={form.icon}
                onChange={(value) => set("icon", value)}
                placeholder="NiRocket"
                help="Nome do conjunto Ni. Vazio usa o ícone do catálogo."
              />
              <Box
                aria-hidden
                className="bg-primary-light/10 text-primary mb-6 flex h-10 w-10 flex-none items-center justify-center rounded-xl"
              >
                <CatalogIcon name={form.icon} size="medium" />
              </Box>
            </Box>
            <TextInput
              label="Ordem no catálogo"
              type="number"
              value={form.sort}
              onChange={(value) => set("sort", Number(value))}
              help="Menor aparece antes, dentro da trilha."
            />
            <TextInput
              label="Chave de acesso"
              value={form.entitlementKey}
              onChange={(value) => set("entitlementKey", value)}
              help="catalog_access libera para quem tem o kit. Mude só para uma ferramenta exclusiva de um degrau."
            />
          </Box>

          <CheckInput
            label="Amostra grátis"
            checked={form.isFreeSample}
            onChange={(value) => set("isFreeSample", value)}
            help="Qualquer conta instala o app e lê o guia de uso, sem compra."
          />

          <Box className="flex flex-col gap-3">
            <Box className="flex flex-row items-center justify-between gap-3">
              <Box className="flex flex-col">
                <Typography variant="subtitle2" component="h3">
                  Chaves que o integrante fornece
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  Credenciais de serviços externos que a ferramenta usa. Ela nunca vem com uma chave dentro.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="grey"
                size="small"
                startIcon={<NiPlus size="small" />}
                onClick={() => set("externalCredentials", [...form.externalCredentials, { ...EMPTY_CREDENTIAL }])}
              >
                Adicionar chave
              </Button>
            </Box>
            {form.externalCredentials.map((credential, index) => (
              <Box key={index} className="border-grey-100 flex flex-col gap-3 rounded-2xl border p-4">
                <Box className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <TextInput
                    label="Serviço"
                    value={credential.name}
                    onChange={(value) => setCredential(index, { name: value })}
                    placeholder="Vercel"
                  />
                  <TextInput
                    label="Variável de ambiente"
                    value={credential.env}
                    onChange={(value) => setCredential(index, { env: value.toUpperCase() })}
                    placeholder="VERCEL_TOKEN"
                  />
                  <TextInput
                    label="Onde conseguir (https)"
                    value={credential.url ?? ""}
                    onChange={(value) => setCredential(index, { url: value })}
                  />
                  <IconButton
                    aria-label={`Remover a chave ${credential.name || index + 1}`}
                    className="mt-6"
                    onClick={() =>
                      set(
                        "externalCredentials",
                        form.externalCredentials.filter((_, at) => at !== index),
                      )
                    }
                  >
                    <NiBinEmpty size="medium" />
                  </IconButton>
                </Box>
                <LocalizedInput
                  label="Para que serve"
                  value={credential.purpose}
                  onChange={(value) => setCredential(index, { purpose: value })}
                />
                <CheckInput
                  label="Obrigatória"
                  checked={credential.required}
                  onChange={(value) => setCredential(index, { required: value })}
                />
              </Box>
            ))}
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
          {busy ? "Salvando…" : module ? "Salvar" : "Criar ferramenta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
