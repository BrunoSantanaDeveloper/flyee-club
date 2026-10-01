"use client";

import { LocalizedInput, SelectInput, TextInput } from "../../catalogo/components/fields";
import { type MeetingInput, saveMeeting } from "../actions";
import { useState } from "react";

import { Alert, Box, Button, Dialog, DialogActions, DialogContent } from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import { toLocalInput } from "@/lib/admin/format";
import { labelOf, MEETING_PROVIDER_LABEL } from "@/lib/admin/labels";
import { MEETING_PROVIDERS, type MeetingDetail } from "@/lib/admin/meetings";

const PROVIDER_OPTIONS = MEETING_PROVIDERS.map((provider) => ({
  value: provider,
  label: labelOf(MEETING_PROVIDER_LABEL, provider),
}));

/**
 * The meeting's page and settings in one form: what members read (title and
 * description in both languages), when it happens, and the two private links
 * (the room and the recording), which only reach a registered, entitled member
 * through the door function.
 */
export default function MeetingFormDialog({
  meeting,
  slugFrozen,
  onClose,
  onSaved,
}: {
  meeting: MeetingDetail | null;
  /** Published or with registrations: the slug is already in e-mails and calendars. */
  slugFrozen: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState<MeetingInput>(() => ({
    id: meeting?.id ?? null,
    slug: meeting?.slug ?? "",
    title: meeting?.title ?? {},
    description: meeting?.description ?? {},
    startsAtLocal: toLocalInput(meeting?.startsAt),
    durationMinutes: meeting?.durationMinutes ?? 60,
    provider: meeting?.provider ?? "zoom",
    joinUrl: meeting?.joinUrl ?? "",
    recordingUrl: meeting?.recordingUrl ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MeetingInput>(key: K, value: MeetingInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveMeeting(form);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onSaved(result.data.id);
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="meeting-form-title"
    >
      <DialogHeader
        id="meeting-form-title"
        title={meeting ? "Editar encontro" : "Novo encontro"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-5">
          <TextInput
            label="Slug (endereço do encontro)"
            value={form.slug}
            onChange={(value) => set("slug", value.toLowerCase())}
            disabled={slugFrozen}
            placeholder="encontro-outubro"
            help={
              slugFrozen
                ? "Não muda depois da publicação ou da primeira inscrição."
                : "Letras minúsculas, números e hífens."
            }
          />
          <LocalizedInput label="Título" value={form.title} onChange={(value) => set("title", value)} required />
          <LocalizedInput
            label="Descrição"
            value={form.description}
            onChange={(value) => set("description", value)}
            multiline
            rows={4}
            help="O que vai acontecer e para quem é. Aparece na página do encontro no painel."
          />
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextInput
              label="Começa em (horário de Brasília)"
              type="datetime-local"
              value={form.startsAtLocal}
              onChange={(value) => set("startsAtLocal", value)}
            />
            <TextInput
              label="Duração em minutos"
              type="number"
              value={form.durationMinutes ?? ""}
              onChange={(value) => set("durationMinutes", value === "" ? null : Number(value))}
            />
            <SelectInput
              label="Ferramenta"
              value={form.provider}
              options={PROVIDER_OPTIONS}
              onChange={(value) => set("provider", value)}
            />
          </Box>
          <TextInput
            label="Link da sala"
            value={form.joinUrl}
            onChange={(value) => set("joinUrl", value)}
            placeholder="https://"
            help="Entregue só a quem se inscreveu e tem acesso, a partir de 15 minutos antes. Nunca aparece em página pública."
          />
          <TextInput
            label="Link da gravação"
            value={form.recordingUrl}
            onChange={(value) => set("recordingUrl", value)}
            placeholder="https://"
            help="Aparece para assinantes depois que o encontro é encerrado."
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
          {busy ? "Salvando…" : meeting ? "Salvar" : "Criar encontro"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
