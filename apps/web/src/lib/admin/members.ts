import { daysSince, formatDate, formatMoney, lastWeeks } from "@/lib/admin/format";
import { AI_TOOL_LABEL, labelOf, PERIOD_LABEL, SEGMENT_LABEL, TIER_LABEL } from "@/lib/admin/labels";
import type { RpcEntitlements } from "@/lib/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The shapes of `admin_members_overview()`, `admin_member_dossier()` and
 * `admin_people_without_workspace()` (migration 0015), and what the members
 * console derives from them.
 *
 * The tiles and the rows come out of ONE query in the database, and the flags a
 * tile counts are the flags a row carries. The predicates here only select on
 * those flags; none of them recomputes a rule, so a tile and the list it
 * filters cannot disagree.
 */

export type MemberTier = "kit" | "club" | "pro";

export type MemberPlan = {
  slug: string;
  name: string;
  status: string;
  period: string | null;
  priceCents: number | null;
  currency: string | null;
  /** Set while the plan renews; null once a cancellation is scheduled or it never renews. */
  renewsAt: string | null;
  /** When access through this plan ends: a scheduled cancellation, or a term that does not renew. */
  endsAt: string | null;
  provider: string | null;
  /** A paid plan with no provider behind it: given by the team, charged to nobody. */
  comped: boolean;
};

export type MemberGrant = {
  id: string;
  kind: string;
  plan: string | null;
  source: string;
  createdAt: string;
  expiresAt: string | null;
};

export type MemberFlags = {
  pastDue: boolean;
  suspended: boolean;
  cancelScheduled: boolean;
  noDevice: boolean;
  staleUpdate: boolean;
  comped: boolean;
  neverSignedIn: boolean;
};

export type MemberRow = {
  orgId: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  bannedUntil: string | null;
  segment: string | null;
  aiTool: string | null;
  locale: string | null;
  tier: MemberTier | null;
  plan: MemberPlan | null;
  grants: MemberGrant[];
  devices: { live: number; lastSeenAt: string | null; lastUpdateAt: string | null };
  installedModules: number;
  executions30d: number;
  lastExecutionAt: string | null;
  revenue: { BRL: number; USD: number };
  attribution: { origem?: string; onda?: string; utmSource?: string; utmCampaign?: string };
  flags: MemberFlags;
};

export type MemberTotals = {
  accounts: number;
  kit: number;
  club: number;
  pro: number;
  noAccess: number;
  pastDue: number;
  noDevice: number;
  staleUpdate: number;
  suspended: number;
  cancelScheduled: number;
};

export type MembersOverview = { generatedAt: string; totals: MemberTotals; members: MemberRow[] };

export type PersonWithoutWorkspace = {
  userId: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  bannedUntil: string | null;
  isSuperadmin: boolean;
  authProvider: string | null;
};

export type PeopleWithoutWorkspace = {
  generatedAt: string;
  totals: { people: number; neverSignedIn: number };
  people: PersonWithoutWorkspace[];
};

/** One filter: the tile that counts it and the rows it selects. */
export type MemberFilter = {
  key: keyof MemberTotals;
  label: string;
  hint: string;
  matches: (row: MemberRow) => boolean;
};

/** The rung filters: every account is in exactly one of the last four. */
export const TIER_FILTERS: MemberFilter[] = [
  { key: "accounts", label: "Todas", hint: "Todas as contas da plataforma", matches: () => true },
  { key: "kit", label: "Kit", hint: "Têm o kit de entrada e nenhuma assinatura", matches: (row) => row.tier === "kit" },
  { key: "club", label: "Assinatura", hint: "Assinatura do clube ativa", matches: (row) => row.tier === "club" },
  { key: "pro", label: "Pro", hint: "Plano Pro ativo", matches: (row) => row.tier === "pro" },
  {
    key: "noAccess",
    label: "Sem acesso",
    hint: "Criaram a conta e não têm kit nem assinatura",
    matches: (row) => row.tier === null,
  },
];

/** The filters that name something to act on. */
export const ATTENTION_FILTERS: MemberFilter[] = [
  {
    key: "pastDue",
    label: "Inadimplentes",
    hint: "O provedor não conseguiu cobrar a assinatura",
    matches: (row) => row.flags.pastDue,
  },
  {
    key: "noDevice",
    label: "Sem computador",
    hint: "Têm acesso e nunca conectaram a CLI, ou desconectaram tudo",
    matches: (row) => row.flags.noDevice,
  },
  {
    key: "staleUpdate",
    label: "Sem atualizar há 25 d",
    hint: "Computador conectado, sem atualização há 25 dias ou mais: a revalidação está perto",
    matches: (row) => row.flags.staleUpdate,
  },
  {
    key: "cancelScheduled",
    label: "Cancelamento marcado",
    hint: "Pediram para encerrar no fim do período já pago",
    matches: (row) => row.flags.cancelScheduled,
  },
  {
    key: "suspended",
    label: "Suspensas",
    hint: "Acesso desligado pela equipe",
    matches: (row) => row.flags.suspended,
  },
];

export const MEMBER_FILTERS: MemberFilter[] = [...TIER_FILTERS, ...ATTENTION_FILTERS];

export const filterMembers = (rows: MemberRow[], key: keyof MemberTotals): MemberRow[] => {
  const filter = MEMBER_FILTERS.find((entry) => entry.key === key);
  return filter ? rows.filter(filter.matches) : rows;
};

/** What the plan column says: the plan sold and its price, a courtesy, or the kit. */
export function planLabel(row: MemberRow): string {
  const plan = row.plan;
  if (plan && plan.status !== "canceled") {
    if (plan.comped) return `${plan.name} · cortesia`;
    if (plan.priceCents && plan.priceCents > 0) {
      const period = plan.period ? ` ${labelOf(PERIOD_LABEL, plan.period, "")}` : "";
      return `${plan.name} · ${formatMoney(plan.priceCents, plan.currency)}${period}`;
    }
    if (row.tier === null) return plan.name;
  }
  if (row.tier === "kit") {
    const kit = row.grants.find((grant) => grant.kind === "kit");
    return kit?.source === "admin" ? "Kit · cortesia" : "Kit";
  }
  return plan?.name ?? "Sem plano";
}

/**
 * The ONE time fact that matters for this account right now, by precedence:
 * money that failed, access that is about to end, then the next renewal.
 * A kit has no deadline, and says so.
 */
export function memberClock(row: MemberRow, now: number = Date.now()): string {
  const plan = row.plan;
  if (row.flags.suspended) return "acesso suspenso";
  if (row.flags.pastDue) return "inadimplente";
  if (plan?.endsAt) {
    const days = daysSince(plan.endsAt, now);
    if (days !== null && days > 0) return `encerrou em ${formatDate(plan.endsAt)}`;
    return `${row.flags.cancelScheduled ? "cancela" : "termina"} em ${formatDate(plan.endsAt)}`;
  }
  if (plan?.renewsAt) return `renova em ${formatDate(plan.renewsAt)}`;
  if (plan?.comped) return "cortesia, sem cobrança";
  if (row.tier === "kit") return "kit, sem vencimento";
  return "sem cobrança";
}

/** Everything a search box should find a member by, lower-cased once. */
export function memberSearchText(row: MemberRow): string {
  return [
    row.name,
    row.email,
    labelOf(SEGMENT_LABEL, row.segment, ""),
    labelOf(AI_TOOL_LABEL, row.aiTool, ""),
    row.tier ? TIER_LABEL[row.tier] : "sem acesso",
    row.plan?.name,
    row.attribution.origem,
    row.attribution.utmCampaign,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** A ban has no end date in this product: the auth API is given a century. */
export const isBanned = (bannedUntil: string | null, now: number = Date.now()): boolean =>
  Boolean(bannedUntil) && new Date(bannedUntil as string).getTime() > now;

// ---------- The dossier ----------

export type DossierSubscription = {
  id: string;
  plan: string;
  status: string;
  period: string | null;
  priceCents: number | null;
  currency: string | null;
  coupon: string | null;
  provider: string | null;
  renews: boolean | null;
  paymentMethod: string | null;
  createdAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  cancelReason: string | null;
  cancelNote: string | null;
  canceledAt: string | null;
  pastDueSince: string | null;
  suspended: boolean | null;
};

export type DossierGrant = MemberGrant & {
  priceCents: number | null;
  currency: string | null;
  note: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type DossierInvoice = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  provider: string | null;
  hasFiscalDocument: boolean;
};

export type DossierDevice = {
  id: string;
  name: string | null;
  os: string | null;
  aiTool: string | null;
  cliVersion: string | null;
  coreVersion: string | null;
  modules: number;
  projectKind: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUpdateAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type MemberDossier = {
  ok: true;
  generatedAt: string;
  account: {
    orgId: string;
    workspaceName: string | null;
    createdAt: string;
    userId: string | null;
    name: string | null;
    email: string | null;
    authProvider: string | null;
    confirmed: boolean;
    lastSignInAt: string | null;
    bannedUntil: string | null;
    segment: string | null;
    aiTool: string | null;
    locale: string | null;
    timezone: string | null;
    marketingOptOut: boolean | null;
    isSuperadmin: boolean;
    twoFactor: boolean;
    billingDocument: { kind: "cpf" | "cnpj"; lastDigits: string } | null;
  };
  /** `org_entitlements(org)` as the database answers it: the same object every gate reads. */
  entitlements: RpcEntitlements | null;
  money: {
    paid: Record<string, number>;
    refunded: Record<string, number>;
    subscriptions: DossierSubscription[];
    grants: DossierGrant[];
    invoices: DossierInvoice[];
  };
  devices: DossierDevice[];
  tokens: { liveFamilies: number; nextRevalidationAt: string | null };
  usage: {
    executions30d: number;
    firstExecutionAt: string | null;
    lastExecutionAt: string | null;
    topModules30d: { module: string; executions: number }[];
    weeks: { weekStart: string; executions: number }[];
    denied30d: number;
    downloads30d: number;
    lessonsStarted: number;
    lessonsCompleted: number;
    roadmapVotes: number;
    meetingsRegistered: number;
    meetingsJoined: number;
  };
  consent: { slug: string; locale: string; version: number; acceptedAt: string; revokedAt: string | null }[];
  access: { signIns30d: number; supportVisits: number };
  attribution: Record<string, string | null> | null;
};

export type DossierResult = MemberDossier | { ok: false; code: string };

// ---------- Reads (the operator's session; RLS and the functions check the role) ----------

export async function loadMembersOverview(supabase: SupabaseClient): Promise<MembersOverview> {
  const { data, error } = await supabase.rpc("admin_members_overview");
  if (error || !data) throw new Error("members_overview_failed");
  return data as MembersOverview;
}

export async function loadPeopleWithoutWorkspace(supabase: SupabaseClient): Promise<PeopleWithoutWorkspace> {
  const { data, error } = await supabase.rpc("admin_people_without_workspace");
  if (error || !data) throw new Error("people_without_workspace_failed");
  return data as PeopleWithoutWorkspace;
}

/** Who holds the platform role: the overview rows do not carry it, and three actions depend on it. */
export async function loadSuperadminIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("id").eq("is_superadmin", true).limit(200);
  if (error) throw new Error("superadmins_failed");
  return (data ?? []).map((row) => row.id as string);
}

/**
 * The dossier's weekly executions as a continuous series. The database returns
 * only the weeks that had executions; a chart of those alone would hide every
 * quiet week, which is the very thing the operator opens the dossier to see.
 */
export function executionWeeks(
  weeks: { weekStart: string; executions: number }[],
  generatedAt: string,
  count = 8,
): { weekStart: string; executions: number }[] {
  const byWeek = new Map(weeks.map((week) => [week.weekStart.slice(0, 10), week.executions]));
  return lastWeeks(count, generatedAt).map((weekStart) => ({ weekStart, executions: byWeek.get(weekStart) ?? 0 }));
}
