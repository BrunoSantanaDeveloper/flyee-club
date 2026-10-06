/**
 * Database values as the operator reads them. The consoles are hardcoded pt-BR
 * (apps/web/CLAUDE.md): an enum, a slug or a status is always mapped to a word
 * here and never shown raw. `labelOf` falls back to the raw value, so a value
 * added by a migration shows up as itself instead of as nothing.
 */

export const labelOf = (labels: Record<string, string>, value: string | null | undefined, fallback = "—"): string =>
  value ? (labels[value] ?? value) : fallback;

/** `member_segment` (migration 0000), plus the bucket the metrics use for a blank answer. */
export const SEGMENT_LABEL: Record<string, string> = {
  produto_proprio: "Produto próprio",
  freelancer_agencia: "Freelancer ou agência",
  profissional_ia: "Profissional que usa IA",
  dev: "Dev",
  outro: "Outro",
  unknown: "Não informado",
};

/** The order segments are listed in: the four the focus rule reads, then the two it leaves out. */
export const SEGMENT_ORDER = ["produto_proprio", "freelancer_agencia", "profissional_ia", "dev", "outro", "unknown"];

export const AI_TOOL_LABEL: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  gemini_cli: "Gemini CLI",
  cursor: "Cursor",
  other: "Outra",
};

export const LOCALE_LABEL: Record<string, string> = { "pt-BR": "Português", en: "Inglês" };

export const TIER_LABEL: Record<string, string> = { kit: "FlyeeClub", club: "FlyeeClub Pro", pro: "Pro (antigo)" };

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: "ativa",
  trialing: "em teste",
  past_due: "inadimplente",
  incomplete: "incompleta",
  canceled: "cancelada",
};

export const PERIOD_LABEL: Record<string, string> = { monthly: "mensal", yearly: "anual", weekly: "semanal" };

export const PROVIDER_LABEL: Record<string, string> = { asaas: "Asaas", stripe: "Stripe" };

export const GRANT_KIND_LABEL: Record<string, string> = { kit: "kit", license: "licença", comp: "cortesia" };

export const GRANT_SOURCE_LABEL: Record<string, string> = { purchase: "compra", admin: "concedido pela equipe" };

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: "paga",
  open: "em aberto",
  failed: "falhou",
  refunded: "reembolsada",
  void: "anulada",
};

export const MODULE_TYPE_LABEL: Record<string, string> = {
  skill: "Skill",
  workflow: "Workflow",
  framework: "Framework",
  tool: "Tool",
};

export const MODULE_STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  published: "publicada",
  archived: "arquivada",
};

export const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  published: "publicada",
  yanked: "retirada",
};

export const LESSON_DEPTH_LABEL: Record<string, string> = { usar: "Usar", abrir_o_capo: "Abrir o capô" };

export const PERMISSION_KIND_LABEL: Record<string, string> = {
  "fs:read": "Ler arquivos",
  "fs:write": "Escrever arquivos",
  network: "Acessar a rede",
  shell: "Rodar comandos",
  env: "Ler variáveis de ambiente",
};

export const ROADMAP_STATUS_LABEL: Record<string, string> = {
  proposed: "proposto",
  planned: "planejado",
  building: "em construção",
  shipped: "entregue",
  declined: "recusado",
};

export const MEETING_STATE_LABEL: Record<string, string> = {
  rascunho: "rascunho",
  inscricoes: "inscrições abertas",
  ao_vivo: "ao vivo",
  encerrado: "encerrado",
  arquivado: "arquivado",
};

export const MEETING_PROVIDER_LABEL: Record<string, string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  youtube: "YouTube",
  outro: "Outra ferramenta",
};

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  waitlist: "lista de espera",
  newsletter: "newsletter",
  contact: "contato",
  meeting: "encontro",
};

export const DEVICE_OS_LABEL: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  other: "Outro sistema",
};

export const PROJECT_KIND_LABEL: Record<string, string> = { own: "projeto próprio", client: "projeto de cliente" };

export const CONSENT_SLUG_LABEL: Record<string, string> = {
  terms: "Termos de uso",
  privacy: "Política de privacidade",
  cookies: "Política de cookies",
  "cli-connection": "Conexão da CLI",
  newsletter: "Newsletter",
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  too_expensive: "achou caro",
  not_using: "não está usando",
  missing_tool: "falta a ferramenta",
  switched: "trocou de solução",
  technical: "problema técnico",
  temporary: "pausa temporária",
  other: "outro motivo",
};
