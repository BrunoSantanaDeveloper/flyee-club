"use client";

import { type AccountDeletionResult, deleteAccount, retryAccountStoragePurge } from "../actions";
import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  Input,
  Typography,
} from "@mui/material";

import { plural } from "@/lib/admin/format";
import { createClient } from "@flyee/auth/client";

/** `admin_account_deletion_preview` (migration 0016). */
type DeletionPreview = {
  email: string | null;
  workspaces: { id: string; name: string }[];
  sharedWorkspaces: string[];
  counts: {
    subscriptions: number;
    invoices: number;
    grants: number;
    devices: number;
    tokens: number;
    consents: number;
    lessons: number;
    votes: number;
    meetings: number;
    comments: number;
    files: number;
  };
  providerSubscriptions: { id: string; provider: string; status: string }[];
  blockers: string[];
};

const BLOCKERS: Record<string, string> = {
  self: "Esta é a sua própria conta. Outra pessoa com o papel de superadmin precisa excluí-la.",
  superadmin:
    "Esta conta tem o papel de superadmin da plataforma. Remova o papel primeiro (mesmo menu), depois exclua a conta.",
  shared_workspace:
    "Esta conta é dona de um workspace do qual outras pessoas ainda fazem parte. Remova as outras pessoas primeiro.",
};

function actionError(error: string): string {
  if (error === "forbidden") return "Só quem tem o papel de superadmin pode excluir contas.";
  if (error === "not-configured") {
    return "Defina SUPABASE_SERVICE_ROLE_KEY: os arquivos guardados só podem ser removidos com a service role, então a exclusão fica desligada sem ela.";
  }
  return error;
}

/**
 * Permanent deletion of an account and every piece of data it holds
 * (migration 0016).
 *
 * The dialog's job is to make the operator SEE the size of what goes before
 * the click, and to carry the friction the database also enforces: a stated
 * reason and the account's e-mail typed back. It is mounted only while open
 * (keyed by user), so each account starts from a fresh preview.
 */
export default function DeleteAccountDialog({
  userId,
  userName,
  onClose,
  onDeleted,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountDeletionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error: rpcError } = await createClient().rpc("admin_account_deletion_preview", {
        target_user: userId,
      });
      if (cancelled) return;
      if (rpcError) setLoadError(rpcError.message);
      else setPreview(data as DeletionPreview);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const expected = (preview?.email ?? userId).toLowerCase();
  const confirmed = typed.trim().toLowerCase() === expected;
  const reasonOk = reason.trim().length >= 8;
  const blockers = preview?.blockers ?? [];
  const canConfirm = Boolean(preview) && blockers.length === 0 && !result;

  // Files the purge could not remove (or could not verify) are the one state
  // this dialog must not let go of: `retryAccountStoragePurge` needs
  // `result.deletedWorkspaces`, which exists only in this component's state.
  // Once it closes, the only trace left is the audit trail.
  const storagePending = Boolean(result) && result!.storage.remaining !== 0;

  const close = () => {
    if (busy || storagePending) return;
    if (result) onDeleted();
    else onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const outcome = await deleteAccount(userId, typed, reason);
    setBusy(false);
    if (!outcome.ok) {
      setError(actionError(outcome.error));
      return;
    }
    setResult(outcome.data);
  };

  const retry = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    const outcome = await retryAccountStoragePurge(userId, result.deletedWorkspaces);
    setBusy(false);
    if (!outcome.ok) {
      setError(actionError(outcome.error));
      return;
    }
    setResult({ ...result, storage: outcome.data });
  };

  return (
    // `open` is controlled and `close` refuses while files are stranded, so the
    // backdrop and Escape are already inert.
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="delete-account-title">
      <DialogTitle id="delete-account-title">
        {result ? "Conta excluída" : `Excluir a conta de ${userName} e todos os dados?`}
      </DialogTitle>
      <DialogContent>
        {result ? (
          <DeletionOutcome userName={userName} result={result} error={error} />
        ) : loadError ? (
          // A failed count is an error, never an empty-looking account.
          <Alert severity="error" className="neutral bg-background-paper/60!">
            Não foi possível carregar o que esta exclusão removeria: {loadError}
          </Alert>
        ) : !preview ? (
          <Box className="flex min-h-40 items-center gap-3">
            <CircularProgress size={20} aria-label="Carregando" />
            <Typography variant="body1" className="text-text-secondary">
              Contando tudo o que esta conta guarda…
            </Typography>
          </Box>
        ) : blockers.length > 0 ? (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            <Box component="ul" className="m-0 flex list-disc flex-col gap-1 pl-4">
              {blockers.map((blocker) => (
                <li key={blocker}>
                  {BLOCKERS[blocker] ?? blocker}
                  {blocker === "shared_workspace" && preview.sharedWorkspaces.length > 0
                    ? ` (${preview.sharedWorkspaces.join(", ")})`
                    : null}
                </li>
              ))}
            </Box>
          </Alert>
        ) : (
          <Box className="flex flex-col gap-4 pt-1">
            <Typography variant="body1" className="text-text-secondary">
              Tudo abaixo é removido para sempre. Não existe lixeira, restauração nem desfazer em lugar nenhum da
              plataforma.
            </Typography>

            <Box component="ul" className="m-0 flex list-disc flex-col gap-1 pl-5">
              <li>
                <Typography variant="body1">
                  {preview.workspaces.length === 0
                    ? "Nenhum workspace: esta conta não tem um próprio"
                    : `${preview.workspaces.length === 1 ? "O workspace" : "Os workspaces"} ${preview.workspaces
                        .map((workspace) => workspace.name)
                        .join(", ")}`}
                </Typography>
              </li>
              <li>
                <Typography variant="body1">
                  {plural(preview.counts.grants, "kit ou cortesia", "kits e cortesias")},{" "}
                  {plural(preview.counts.subscriptions, "assinatura", "assinaturas")} e{" "}
                  {plural(preview.counts.invoices, "fatura", "faturas")}
                </Typography>
              </li>
              <li>
                <Typography variant="body1">
                  {plural(preview.counts.devices, "computador conectado", "computadores conectados")} e{" "}
                  {plural(preview.counts.tokens, "token da CLI", "tokens da CLI")}
                </Typography>
              </li>
              <li>
                <Typography variant="body1">
                  O progresso em {plural(preview.counts.lessons, "aula", "aulas")},{" "}
                  {plural(preview.counts.votes, "voto no roadmap", "votos no roadmap")},{" "}
                  {plural(preview.counts.meetings, "inscrição em encontro", "inscrições em encontros")} e{" "}
                  {plural(preview.counts.comments, "comentário no blog", "comentários no blog")}
                </Typography>
              </li>
              <li>
                <Typography variant="body1">
                  {plural(preview.counts.consents, "aceite de termos", "aceites de termos")} e{" "}
                  {plural(preview.counts.files, "arquivo guardado", "arquivos guardados")} (a foto do perfil)
                </Typography>
              </li>
              <li>
                <Typography variant="body1">O login, o perfil, as notificações e o histórico de acessos</Typography>
              </li>
            </Box>

            {preview.providerSubscriptions.length > 0 && (
              <Alert severity="info" className="neutral bg-background-paper/60!">
                {plural(preview.providerSubscriptions.length, "assinatura", "assinaturas")} ainda cobrando em{" "}
                {[...new Set(preview.providerSubscriptions.map((subscription) => subscription.provider))].join(" e ")}{" "}
                será cancelada no provedor primeiro. Se isso falhar, nada é excluído.
              </Alert>
            )}

            <Alert severity="warning" className="neutral bg-background-paper/60!">
              <Box component="ul" className="m-0 flex list-disc flex-col gap-1 pl-4">
                <li>
                  As ferramentas já instaladas nos computadores da pessoa continuam funcionando: a plataforma não apaga
                  nada na máquina de ninguém. Elas só deixam de receber atualizações.
                </li>
                <li>
                  As cobranças e as notas fiscais ficam registradas no provedor de pagamento (Asaas ou Stripe): excluir
                  a conta aqui não apaga a obrigação fiscal de lá.
                </li>
                <li>Os backups automáticos guardam uma cópia até serem descartados (30 dias por padrão).</li>
              </Box>
            </Alert>

            <FormControl className="outlined" variant="standard">
              <FormLabel htmlFor="delete-account-reason">Por que esta conta está sendo excluída?</FormLabel>
              <Input
                id="delete-account-reason"
                placeholder="Pedido da pessoa por e-mail, ticket 1234"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                autoFocus
              />
              <Typography variant="body2" className="text-text-secondary mt-1">
                Fica na trilha de auditoria com o seu nome, junto com quanto foi excluído.
              </Typography>
            </FormControl>

            <FormControl className="outlined" variant="standard">
              <FormLabel htmlFor="delete-account-confirm">
                Digite <strong>{expected}</strong> para confirmar
              </FormLabel>
              <Input
                id="delete-account-confirm"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                disabled={busy}
              />
            </FormControl>

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                {error}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          storagePending ? (
            // Retry is the primary action while files are stranded; leaving is
            // still possible, but it has to be chosen, not stumbled into.
            <>
              <Button variant="text" color="grey" onClick={onDeleted} disabled={busy}>
                Fechar mesmo assim
              </Button>
              <Button variant="contained" onClick={retry} disabled={busy}>
                {busy ? "Tentando…" : "Tentar de novo a limpeza dos arquivos"}
              </Button>
            </>
          ) : (
            <Button variant="contained" onClick={onDeleted} disabled={busy}>
              Pronto
            </Button>
          )
        ) : (
          <>
            <Button variant="text" color="grey" onClick={close} disabled={busy}>
              {canConfirm ? "Cancelar" : "Fechar"}
            </Button>
            {canConfirm && (
              <Button variant="contained" color="error" onClick={confirm} disabled={busy || !reasonOk || !confirmed}>
                {busy ? "Excluindo…" : "Excluir para sempre"}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DeletionOutcome({
  userName,
  result,
  error,
}: {
  userName: string;
  result: AccountDeletionResult;
  error: string | null;
}) {
  const { storage, counts } = result;
  return (
    <Box className="flex flex-col gap-3 pt-1">
      <Alert severity="success" className="neutral bg-background-paper/60!">
        A conta de {userName} foi excluída: {plural(result.deletedWorkspaces.length, "workspace", "workspaces")},{" "}
        {plural(counts.devices ?? 0, "computador", "computadores")} e{" "}
        {plural(counts.grants ?? 0, "kit ou cortesia", "kits e cortesias")}.
        {result.canceledSubscriptions > 0
          ? ` ${plural(result.canceledSubscriptions, "assinatura cancelada no provedor", "assinaturas canceladas no provedor")}.`
          : ""}
      </Alert>
      {storage.remaining === 0 ? (
        <Typography variant="body1" className="text-text-secondary">
          {storage.removed === 0
            ? "Não havia arquivos guardados para remover."
            : `${plural(storage.removed, "arquivo guardado foi removido", "arquivos guardados foram removidos")}.`}
        </Typography>
      ) : storage.remaining > 0 ? (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          {plural(
            storage.remaining,
            "arquivo guardado ainda não pôde ser removido",
            "arquivos guardados ainda não puderam ser removidos",
          )}
          . Eles não pertencem mais a nenhuma conta: tente de novo agora. Os ids dos workspaces também ficam na trilha
          de auditoria.
        </Alert>
      ) : (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          Não foi possível verificar a limpeza dos arquivos{storage.error ? `: ${storage.error}` : ""}. Tente de novo
          agora.
        </Alert>
      )}
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}
    </Box>
  );
}
