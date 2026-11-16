"use client";

import { discardDraftVersion } from "../../actions";
import Link from "next/link";
import { useSnackbar } from "notistack";
import { useState } from "react";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import ConfirmActionDialog from "@/components/product/confirm-action-dialog";
import EmptyState from "@/components/product/empty-state";
import StatusChip from "@/components/product/status-chip";
import IllustrationLaunch from "@/icons/illustrations/illustration-launch";
import { type AdminVersion, textOf } from "@/lib/admin/catalog";
import { formatBytes, formatDate, formatNumber } from "@/lib/admin/format";
import { AI_TOOL_LABEL, labelOf, PERMISSION_KIND_LABEL, VERSION_STATUS_LABEL } from "@/lib/admin/labels";
import { publishVersion, setEntryVersion, setVersionStable, yankVersion } from "@/lib/catalog/version-actions";

const STATUS_TONE = { draft: "attention", published: "positive", yanked: "neutral" } as const;

const ACTION_ERROR: Record<string, string> = {
  forbidden: "Só quem tem o papel de superadmin muda versões.",
  invalid_transition: "Essa mudança de estado não é permitida para esta versão.",
  reason_required: "Diga por que a versão está sendo retirada.",
  not_found: "Esta versão não existe mais. Recarregue a página.",
  entry_yank: "Esta é a versão de entrada. Marque outra versão de entrada, ou tire a marca, antes de retirá-la.",
  invalid_entry: "Só uma versão publicada desta ferramenta pode ser a versão de entrada.",
};

const reasonText = (reason: AdminVersion["permissions"][number]["reason"]) =>
  typeof reason === "string" ? reason : textOf(reason);

/** Which written guides the package carries, as the operator reads it: "Guia: pt-BR (usar, abrir o capô) · en (usar)". */
function guidesLine(guides: AdminVersion["guides"]): string {
  const parts = (["pt-BR", "en"] as const).flatMap((locale) => {
    const depths = guides[locale] ?? [];
    return depths.length > 0
      ? [`${locale} (${depths.map((depth) => (depth === "usar" ? "usar" : "abrir o capô")).join(", ")})`]
      : [];
  });
  return parts.length > 0
    ? `Guia: ${parts.join(" · ")}`
    : "Sem guia escrito no pacote (guides/<pt-BR|en>/<usar|abrir-o-capo>.md)";
}

/**
 * The versions of one module, newest first. A version is a package members
 * verify by its checksum, so once released it never changes: the actions are
 * the lifecycle the database allows (publish a draft, mark stable, yank with a
 * reason members will read, discard a draft). One published version is the
 * entry version, the one an account with no purchase installs (migration
 * 0040): the first release takes the mark, the operator moves or clears it,
 * and a marked version is not yanked until the mark leaves it.
 */
export default function VersionsList({
  slug,
  versions,
  onChanged,
}: {
  slug: string;
  versions: AdminVersion[];
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState<string | null>(null);
  const [yanking, setYanking] = useState<AdminVersion | null>(null);
  const [publishing, setPublishing] = useState<AdminVersion | null>(null);
  const [entering, setEntering] = useState<AdminVersion | null>(null);
  const entryVersion = versions.find((version) => version.isEntry) ?? null;
  const released = versions.some((version) => version.status !== "draft");

  const run = async (versionId: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(versionId);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      enqueueSnackbar(ACTION_ERROR[result.error ?? ""] ?? result.error ?? "Não foi possível concluir.", {
        variant: "error",
      });
      return result.error ?? "failed";
    }
    enqueueSnackbar(success, { variant: "success" });
    onChanged();
    return null;
  };

  if (versions.length === 0) {
    return (
      <EmptyState
        layout="row"
        titleAs="h3"
        illustration={<IllustrationLaunch />}
        title="Nenhuma versão enviada"
        description="Envie o primeiro pacote acima. Ele entra como rascunho; depois de publicado, aparece para quem tem acesso e a ferramenta pode ir para o catálogo."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      {versions.map((version) => {
        const changelog = textOf(version.changelog);
        return (
          <Card key={version.id} component="article" aria-label={`Versão ${version.version}`}>
            <CardContent className="flex flex-col gap-3">
              <Box className="flex flex-row flex-wrap items-center gap-2">
                <Typography variant="h6" component="h3" className="mb-0 font-mono">
                  v{version.version}
                </Typography>
                <StatusChip label={labelOf(VERSION_STATUS_LABEL, version.status)} tone={STATUS_TONE[version.status]} />
                {version.isStable ? <StatusChip label="estável" tone="info" /> : null}
                {version.isEntry ? <StatusChip label="versão de entrada" tone="positive" /> : null}
                <Typography variant="body2" className="text-text-secondary sm:ml-auto">
                  {version.status === "draft"
                    ? `enviada em ${formatDate(version.createdAt)}`
                    : version.status === "yanked"
                      ? `retirada em ${formatDate(version.yankedAt)}`
                      : `publicada em ${formatDate(version.publishedAt)}`}
                </Typography>
              </Box>

              <Box className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                <Typography variant="body2" className="text-text-secondary break-all">
                  SHA-256 <code>{version.sha256}</code>
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {formatBytes(version.sizeBytes)}
                  {version.files !== null
                    ? ` · ${formatNumber(version.files)} ${version.files === 1 ? "arquivo" : "arquivos"}`
                    : ""}
                  {version.entry ? ` · arquivo inicial ${version.entry}` : ""}
                  {version.license === "commercial" ? " · licença comercial" : ""}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {guidesLine(version.guides)}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  Funciona com{" "}
                  {version.compatibleAis.length > 0
                    ? version.compatibleAis.map((tool) => labelOf(AI_TOOL_LABEL, tool)).join(", ")
                    : "nenhuma IA declarada"}
                  {version.minCoreVersion ? ` · core ${version.minCoreVersion} ou mais novo` : ""}
                </Typography>
                {version.status !== "draft" ? (
                  <Typography variant="body2" className="text-text-secondary">
                    {formatNumber(version.downloads)} {version.downloads === 1 ? "download" : "downloads"} ·{" "}
                    {formatNumber(version.downloads30d)} em 30 dias
                  </Typography>
                ) : null}
              </Box>

              {version.permissions.length > 0 ? (
                <Box className="flex flex-col gap-1">
                  <Typography variant="subtitle2" component="h4">
                    O que ela pode acessar
                  </Typography>
                  <Box component="ul" className="m-0 flex list-disc flex-col gap-1 pl-5">
                    {version.permissions.map((permission, index) => (
                      <li key={`${permission.kind}-${index}`}>
                        <Typography variant="body2">
                          {labelOf(PERMISSION_KIND_LABEL, permission.kind)} <code>{permission.scope}</code>
                          {reasonText(permission.reason) ? `: ${reasonText(permission.reason)}` : ""}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" className="text-text-secondary">
                  Não declara nenhuma permissão.
                </Typography>
              )}

              {changelog ? (
                <Typography variant="body1" className="whitespace-pre-line">
                  {changelog}
                </Typography>
              ) : null}
              {version.yankReason ? (
                <Typography variant="body2" className="text-text-secondary">
                  Motivo da retirada: {version.yankReason}
                </Typography>
              ) : null}

              <Box className="flex flex-row flex-wrap gap-2">
                {version.status === "draft" ? (
                  <>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={busy === version.id}
                      onClick={() => setPublishing(version)}
                    >
                      Publicar
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      disabled={busy === version.id}
                      onClick={() =>
                        run(
                          version.id,
                          () => discardDraftVersion(version.id),
                          `Rascunho v${version.version} descartado.`,
                        )
                      }
                    >
                      Descartar rascunho
                    </Button>
                  </>
                ) : null}
                {version.status === "published" ? (
                  <>
                    <Button
                      variant="outlined"
                      color="grey"
                      size="small"
                      disabled={busy === version.id}
                      onClick={() =>
                        run(
                          version.id,
                          () => setVersionStable(version.id, !version.isStable),
                          version.isStable ? "Marca de estável retirada." : "Versão marcada como estável.",
                        )
                      }
                    >
                      {version.isStable ? "Desmarcar estável" : "Marcar como estável"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="grey"
                      size="small"
                      disabled={busy === version.id}
                      onClick={() => setEntering(version)}
                    >
                      {version.isEntry ? "Tirar a marca de entrada" : "Marcar como versão de entrada"}
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      disabled={busy === version.id || version.isEntry}
                      onClick={() => setYanking(version)}
                    >
                      Retirar
                    </Button>
                  </>
                ) : null}
                {version.status !== "draft" ? (
                  <Button
                    variant="text"
                    color="grey"
                    size="small"
                    component={Link}
                    href={`/verificar/${slug}@${version.version}`}
                    target="_blank"
                  >
                    Página de verificação
                  </Button>
                ) : null}
              </Box>
              {version.status === "published" && version.isEntry ? (
                <Typography variant="body2" className="text-text-secondary">
                  Para retirar a versão de entrada, marque outra ou tire a marca antes.
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {publishing ? (
        <ConfirmActionDialog
          key={`publish-${publishing.id}`}
          title={`Publicar a v${publishing.version}?`}
          intro="A partir daqui, o pacote é o que os integrantes baixam e conferem pelo checksum."
          consequences={[
            "Quem tem acesso a esta ferramenta passa a receber esta versão no próximo npx flyee update.",
            ...(released
              ? []
              : [
                  "Por ser a primeira versão publicada, ela vira a versão de entrada: a conta sem compra instala esta e nenhuma outra, até você marcar outra.",
                ]),
            "O pacote, o checksum, o manifesto e as permissões ficam congelados: corrigir é publicar uma versão nova.",
            "A página de verificação passa a responder por esta versão.",
          ]}
          stays={[
            "A ferramenta não entra no catálogo sozinha: se ela ainda é rascunho, publicá-la é outro passo, no topo da página.",
            "As versões anteriores continuam disponíveis para quem ainda não atualizou.",
          ]}
          reasonLabel="O que muda nesta versão, para a trilha de auditoria"
          reasonPlaceholder="Primeira versão; checagem de rotas"
          reasonMinLength={4}
          confirmLabel="Publicar versão"
          onConfirm={async () => {
            const error = await run(
              publishing.id,
              () => publishVersion(publishing.id),
              `v${publishing.version} publicada.`,
            );
            if (!error) setPublishing(null);
            return error ? (ACTION_ERROR[error] ?? error) : null;
          }}
          onClose={() => setPublishing(null)}
        />
      ) : null}

      {entering ? (
        <ConfirmActionDialog
          key={`entry-${entering.id}`}
          title={
            entering.isEntry
              ? `Tirar a marca de entrada da v${entering.version}?`
              : `Marcar a v${entering.version} como versão de entrada?`
          }
          intro="A versão de entrada é a única que a conta sem compra instala deste app. Ela nunca é atualizada: a próxima vem com o FlyeeClub."
          consequences={
            entering.isEntry
              ? [
                  "A conta sem compra fica sem este app até você marcar outra versão de entrada.",
                  "O guia de uso e o vídeo básico deste app deixam de abrir para ela.",
                ]
              : [
                  "A conta sem compra passa a instalar esta versão, e nenhuma outra deste app.",
                  ...(entryVersion && entryVersion.id !== entering.id
                    ? [`A v${entryVersion.version} deixa de ser a versão de entrada.`]
                    : []),
                ]
          }
          stays={[
            "Quem já instalou continua com a versão que tem: nada muda na máquina de ninguém.",
            "Quem tem o FlyeeClub continua recebendo a versão mais nova.",
          ]}
          reasonLabel="Por que esta mudança, para a trilha de auditoria"
          reasonPlaceholder="A 1.1.0 traz a fatia completa; a entrada fica na 1.0.0"
          reasonMinLength={4}
          confirmLabel={entering.isEntry ? "Tirar a marca" : "Marcar como versão de entrada"}
          onConfirm={async (reason) => {
            const error = await run(
              entering.id,
              () => setEntryVersion(entering.moduleId, entering.isEntry ? null : entering.id, reason),
              entering.isEntry
                ? `A v${entering.version} deixou de ser a versão de entrada.`
                : `A v${entering.version} é a versão de entrada.`,
            );
            if (!error) setEntering(null);
            return error ? (ACTION_ERROR[error] ?? error) : null;
          }}
          onClose={() => setEntering(null)}
        />
      ) : null}

      {yanking ? (
        <ConfirmActionDialog
          key={`yank-${yanking.id}`}
          title={`Retirar a v${yanking.version}?`}
          intro="Use quando a versão tem um problema que nenhum integrante deveria instalar."
          consequences={[
            "A versão deixa de ser entregue: ninguém mais baixa ou atualiza para ela.",
            "A página de verificação passa a dizer que ela foi retirada, com o motivo abaixo. O motivo é público.",
          ]}
          stays={[
            "Quem já instalou continua com ela até atualizar para outra versão: nada é apagado na máquina de ninguém.",
            "O registro da versão e o checksum continuam, para quem precisar conferir.",
            "Não dá para desfazer: para voltar, publique uma versão nova.",
          ]}
          reasonLabel="Motivo da retirada (aparece na página de verificação)"
          reasonPlaceholder="Falhava em projetos sem lockfile"
          reasonMinLength={4}
          confirmLabel="Retirar versão"
          tone="danger"
          onConfirm={async (reason) => {
            const error = await run(yanking.id, () => yankVersion(yanking.id, reason), `v${yanking.version} retirada.`);
            if (!error) setYanking(null);
            return error ? (ACTION_ERROR[error] ?? error) : null;
          }}
          onClose={() => setYanking(null)}
        />
      ) : null}
    </Box>
  );
}
