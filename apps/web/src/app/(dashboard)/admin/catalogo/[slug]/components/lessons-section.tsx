"use client";

import { deleteLesson, type LessonInput, saveLesson } from "../../actions";
import { CheckInput, SelectInput, TextInput } from "../../components/fields";
import { useSnackbar } from "notistack";
import { useState } from "react";

import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, Typography } from "@mui/material";

import DialogHeader from "@/components/product/dialog-header";
import EmptyState from "@/components/product/empty-state";
import StatusChip from "@/components/product/status-chip";
import NiPlay from "@/icons/nexture/ni-play";
import NiPlus from "@/icons/nexture/ni-plus";
import type { AdminLesson } from "@/lib/admin/catalog";
import { labelOf, LESSON_DEPTH_LABEL, LOCALE_LABEL } from "@/lib/admin/labels";

const DEPTH_OPTIONS = Object.entries(LESSON_DEPTH_LABEL).map(([value, label]) => ({ value, label }));
const LOCALE_OPTIONS = Object.entries(LOCALE_LABEL).map(([value, label]) => ({ value, label }));

function LessonDialog({
  lesson,
  moduleId,
  moduleSlug,
  onClose,
  onSaved,
}: {
  lesson: AdminLesson | null;
  moduleId: string;
  moduleSlug: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<LessonInput>(() => ({
    id: lesson?.id ?? null,
    moduleId,
    depth: lesson?.depth ?? "usar",
    locale: lesson?.locale ?? "pt-BR",
    title: lesson?.title ?? "",
    youtubeId: lesson?.youtubeId ?? "",
    durationMinutes: lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : null,
    isAdvanced: lesson?.isAdvanced ?? false,
    sort: lesson?.sort ?? 0,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LessonInput>(key: K, value: LessonInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveLesson(form, moduleSlug);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else onSaved();
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="lesson-form-title">
      <DialogHeader
        id="lesson-form-title"
        title={lesson ? "Editar vídeo" : "Novo vídeo do guia"}
        onClose={onClose}
        closeLabel="Fechar sem salvar"
      />
      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectInput
              label="Profundidade"
              value={form.depth}
              options={DEPTH_OPTIONS}
              onChange={(value) => set("depth", value)}
            />
            <SelectInput
              label="Idioma"
              value={form.locale}
              options={LOCALE_OPTIONS}
              onChange={(value) => set("locale", value)}
            />
          </Box>
          <TextInput
            label="Título"
            value={form.title}
            onChange={(value) => set("title", value)}
            placeholder="Como usar a checagem de deploy"
          />
          <TextInput
            label="Vídeo no YouTube (link ou id)"
            value={form.youtubeId}
            onChange={(value) => set("youtubeId", value)}
            placeholder="https://youtu.be/…"
            help="Use um vídeo não listado. Sem vídeo, o guia aparece só com o texto."
          />
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              label="Duração em minutos"
              type="number"
              value={form.durationMinutes ?? ""}
              onChange={(value) => set("durationMinutes", value === "" ? null : Number(value))}
            />
            <TextInput label="Ordem" type="number" value={form.sort} onChange={(value) => set("sort", Number(value))} />
          </Box>
          <CheckInput
            label="Vídeo avançado (FlyeeClub Pro)"
            checked={form.isAdvanced}
            onChange={(value) => set("isAdvanced", value)}
            help="Só quem tem a assinatura recebe o vídeo. Os outros veem o título e o caminho para liberar."
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
          {busy ? "Salvando…" : lesson ? "Salvar" : "Criar vídeo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * The module's short lessons, one per depth and language (the database keeps
 * that pair unique). The video id is stored apart from the lesson and handed
 * only to members the lesson is open to.
 */
export default function LessonsSection({
  lessons,
  moduleId,
  moduleSlug,
  onChanged,
}: {
  lessons: AdminLesson[];
  moduleId: string;
  moduleSlug: string;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState<AdminLesson | "new" | null>(null);

  const remove = async (lesson: AdminLesson) => {
    const result = await deleteLesson(lesson.id, moduleSlug);
    if (!result.ok) enqueueSnackbar(result.error, { variant: "error" });
    else {
      enqueueSnackbar("Vídeo excluído.", { variant: "success" });
      onChanged();
    }
  };

  return (
    <Card component="section" aria-labelledby="lessons-title">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row flex-wrap items-center justify-between gap-3">
          <Box className="flex flex-col">
            <Typography id="lessons-title" variant="h5" component="h2" className="mb-0">
              Vídeos dos guias
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              Um vídeo por profundidade e idioma, mostrado dentro do guia. O texto do guia vem no pacote de cada versão
              (guides/&lt;idioma&gt;/&lt;profundidade&gt;.md), e a lista de versões diz quais guias cada uma traz.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="grey"
            startIcon={<NiPlus size="medium" />}
            onClick={() => setEditing("new")}
          >
            Novo vídeo
          </Button>
        </Box>

        {lessons.length === 0 ? (
          <EmptyState
            icon={<NiPlay size="large" />}
            title="Nenhum vídeo ainda"
            description="O vídeo é opcional: o guia escrito vem no pacote. Um vídeo curto de uso, no topo do guia, mostra em poucos minutos como o app entra no dia a dia."
            action={{ label: "Criar o vídeo de uso", onClick: () => setEditing("new") }}
          />
        ) : (
          <Box className="flex flex-col gap-2">
            {lessons.map((lesson) => (
              <Box
                key={lesson.id}
                className="border-grey-100 flex flex-col gap-2 border-b pb-3 last:border-b-0 sm:flex-row sm:items-center"
              >
                <Box className="flex min-w-0 flex-1 flex-col">
                  <Box className="flex flex-row flex-wrap items-center gap-2">
                    <Typography variant="subtitle2" component="h3">
                      {lesson.title}
                    </Typography>
                    {lesson.isAdvanced ? <StatusChip label="avançado" tone="info" /> : null}
                    {!lesson.youtubeId ? <StatusChip label="sem vídeo" tone="attention" /> : null}
                  </Box>
                  <Typography variant="body2" className="text-text-secondary">
                    {labelOf(LESSON_DEPTH_LABEL, lesson.depth)} · {labelOf(LOCALE_LABEL, lesson.locale)}
                    {lesson.durationSeconds ? ` · ${Math.max(1, Math.round(lesson.durationSeconds / 60))} min` : ""}
                  </Typography>
                </Box>
                <Box className="flex flex-row gap-2">
                  <Button variant="outlined" color="grey" size="small" onClick={() => setEditing(lesson)}>
                    Editar
                  </Button>
                  <Button variant="text" color="error" size="small" onClick={() => remove(lesson)}>
                    Excluir
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>

      {editing ? (
        <LessonDialog
          key={editing === "new" ? "new" : editing.id}
          lesson={editing === "new" ? null : editing}
          moduleId={moduleId}
          moduleSlug={moduleSlug}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </Card>
  );
}
