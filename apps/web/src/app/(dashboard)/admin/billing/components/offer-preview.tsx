"use client";

import { RowLine, RowText } from "./catalog-shared";

export type OfferPlanRow = {
  slug: string;
  name: string;
  period: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  limits: Record<string, number> | null;
};

const PERIOD_WORD: Record<string, string> = { yearly: "ano", monthly: "mês", weekly: "semana" };

/**
 * What the visitor will actually SEE, resolved from the same plan rows the
 * offer page reads.
 *
 * Every offer console needs this and none of them should compute it twice: a
 * console that only writes settings hides its own typos, and the failure it
 * hides is silent by nature — an anchor price that never renders (wrong slug,
 * inactive plan, another currency, or a price below the offer's).
 */
export default function OfferPreview({
  plans,
  planSlug,
  compareSlug,
  label,
}: {
  plans: OfferPlanRow[];
  planSlug: string;
  compareSlug: string;
  /** Where these numbers show up, for the operator reading the line. */
  label: string;
}) {
  const plan = plans.find((row) => row.slug === planSlug.trim()) ?? null;
  const comparePlan = compareSlug.trim() ? (plans.find((row) => row.slug === compareSlug.trim()) ?? null) : null;

  // Mirrors the page exactly: a monthly anchor is annualized, a period or
  // currency mismatch yields no anchor, and an anchor cheaper than the offer
  // is dropped.
  const anchorCents =
    comparePlan && plan && comparePlan.currency === plan.currency
      ? comparePlan.period === "monthly" && plan.period === "yearly"
        ? comparePlan.price_cents * 12
        : comparePlan.period === plan.period
          ? comparePlan.price_cents
          : 0
      : 0;
  const anchorRenders = Boolean(plan && comparePlan?.is_active && anchorCents > plan.price_cents);

  if (!plan) {
    return (
      <RowLine>
        <RowText
          primary={
            planSlug.trim() ? `Plano "${planSlug.trim()}" não encontrado no catálogo` : "Nenhum plano selecionado"
          }
          secondary={`${label} mostra o estado fechado até um plano ativo ser informado aqui.`}
        />
      </RowLine>
    );
  }

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  });
  const periodWord = plan.period ? (PERIOD_WORD[plan.period] ?? "ciclo") : "pagamento único";
  const devices = Number(plan.limits?.devices ?? 0);

  return (
    <RowLine>
      <RowText
        primary={`${label} mostra ${money.format(plan.price_cents / 100)} por ${periodWord}${
          anchorRenders ? ` · riscado ${money.format(anchorCents / 100)}` : " · SEM preço riscado"
        }`}
        secondary={`${devices > 0 ? `${devices} dispositivo${devices === 1 ? "" : "s"}` : "sem dispositivo"}${
          anchorRenders
            ? ""
            : comparePlan
              ? ` · a âncora "${comparePlan.slug}" não aparece (inativa, em outra moeda, mais barata que a oferta, ou período incomparável)`
              : " · nenhum plano de âncora definido"
        }${plan.is_active ? "" : " · O PLANO ESTÁ INATIVO e não pode ser comprado"}`}
      />
    </RowLine>
  );
}
