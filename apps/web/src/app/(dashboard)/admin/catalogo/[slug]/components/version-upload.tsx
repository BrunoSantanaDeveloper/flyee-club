"use client";

import { useId, useRef, useState } from "react";

import { Alert, Box, Button, Card, CardContent, LinearProgress, Typography } from "@mui/material";

import InfoHint from "@/components/product/info-hint";
import NiUploadCloud from "@/icons/nexture/ni-upload-cloud";
import { formatBytes } from "@/lib/admin/format";
import { createClient } from "@flyee/auth/client";

type Step = "idle" | "slot" | "sending" | "checking";

/** What the upload routes answer when they refuse, in the operator's words. */
const REFUSAL: Record<string, string> = {
  forbidden: "Só quem tem o papel de superadmin envia pacotes.",
  not_configured: "Defina SUPABASE_SERVICE_ROLE_KEY: o pacote é guardado com ela.",
  upload_slot_failed: "O armazenamento não abriu um espaço para o envio. Tente de novo.",
  invalid_package: "O pacote foi recusado:",
  manifest_mismatch: "O manifesto não corresponde a esta ferramenta:",
  version_exists: "Esta versão já existe. Aumente a versão no flyee.module.json e gere o pacote de novo.",
  package_already_stored: "Já existe um pacote guardado para esta versão.",
  package_too_large: "O pacote passa do tamanho máximo.",
  staged_package_not_found: "O arquivo enviado não chegou ao armazenamento. Envie de novo.",
  module_not_found: "Esta ferramenta não existe mais. Recarregue a página.",
  missing_package: "Escolha um arquivo .zip.",
  version_insert_failed: "O pacote foi conferido, mas registrar a versão falhou. Nada ficou guardado: tente de novo.",
};

/**
 * Sends a module package in two steps (docs/CLI-CONTRACT.md): a signed upload
 * slot straight into private storage, then the backend inspects the ZIP, checks
 * the manifest against this module and records a DRAFT version. Publishing is
 * a separate act, on the version itself.
 */
export default function VersionUpload({
  moduleSlug,
  onUploaded,
}: {
  moduleSlug: string;
  onUploaded: (version: string) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [problem, setProblem] = useState<{ message: string; details: string[] } | null>(null);

  const busy = step !== "idle";

  const send = async () => {
    if (!file) return;
    setProblem(null);
    try {
      setStep("slot");
      const slotResponse = await fetch("/api/admin/catalog/uploads", { method: "POST" });
      const slot = (await slotResponse.json()) as {
        staging_path?: string;
        token?: string;
        max_bytes?: number;
        error?: string;
      };
      if (!slotResponse.ok || !slot.staging_path || !slot.token) {
        throw { code: slot.error ?? "upload_slot_failed" };
      }
      if (slot.max_bytes && file.size > slot.max_bytes) {
        throw {
          code: "package_too_large",
          details: [`Limite: ${formatBytes(slot.max_bytes)}. Arquivo: ${formatBytes(file.size)}.`],
        };
      }

      setStep("sending");
      const { error: uploadError } = await createClient()
        .storage.from("modules")
        .uploadToSignedUrl(slot.staging_path, slot.token, file, { contentType: "application/zip" });
      if (uploadError) throw { code: "staged_package_not_found", details: [uploadError.message] };

      setStep("checking");
      const finalize = await fetch("/api/admin/catalog/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module: moduleSlug, staging_path: slot.staging_path }),
      });
      const result = (await finalize.json()) as {
        version?: { version: string };
        error?: string;
        errors?: string[];
      };
      if (!finalize.ok || !result.version)
        throw { code: result.error ?? "version_insert_failed", details: result.errors };

      setFile(null);
      if (input.current) input.current.value = "";
      onUploaded(result.version.version);
    } catch (failure) {
      const { code, details } = (failure ?? {}) as { code?: string; details?: string[] };
      setProblem({
        message: (code && REFUSAL[code]) || "O envio falhou. Confira a conexão e tente de novo.",
        details: details ?? [],
      });
    } finally {
      setStep("idle");
    }
  };

  return (
    <Card component="section" aria-labelledby={`${inputId}-title`}>
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row items-center gap-1">
          <Typography id={`${inputId}-title`} variant="h5" component="h2" className="mb-0">
            Enviar uma versão
          </Typography>
          <InfoHint
            label="O ZIP precisa do flyee.module.json na raiz, com o mesmo slug, trilha e tipo desta ferramenta e uma versão nova. A versão entra como rascunho: confira o checksum e as permissões antes de publicar."
            placement="bottom-start"
            className="self-center"
          />
        </Box>
        <Box className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <Button
            component="label"
            htmlFor={inputId}
            variant="outlined"
            color="grey"
            startIcon={<NiUploadCloud size="medium" />}
            disabled={busy}
          >
            {file ? "Trocar o arquivo" : "Escolher o pacote .zip"}
          </Button>
          <Typography variant="body1" className="text-text-secondary min-w-0 truncate">
            {file ? `${file.name} · ${formatBytes(file.size)}` : "Nenhum arquivo escolhido"}
          </Typography>
          <Button variant="contained" onClick={send} disabled={!file || busy} className="sm:ml-auto">
            Enviar e conferir
          </Button>
        </Box>
        {busy ? (
          <Box className="flex flex-col gap-1" role="status">
            <LinearProgress />
            <Typography variant="body2" className="text-text-secondary">
              {step === "slot"
                ? "Abrindo espaço no armazenamento…"
                : step === "sending"
                  ? "Enviando o pacote…"
                  : "Conferindo o pacote e o manifesto…"}
            </Typography>
          </Box>
        ) : null}
        {problem ? (
          <Alert severity="error" className="neutral bg-background-paper/60!">
            <Typography variant="body1">{problem.message}</Typography>
            {problem.details.length > 0 ? (
              <Box component="ul" className="m-0 mt-2 flex list-disc flex-col gap-1 pl-4">
                {problem.details.map((detail) => (
                  <li key={detail}>
                    <code>{detail}</code>
                  </li>
                ))}
              </Box>
            ) : null}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
