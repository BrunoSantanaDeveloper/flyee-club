import type { Tier } from "@flyee/billing/entitlements";

/**
 * What the delivery API says when it refuses, in the member's language. The
 * CLI prints `message` as is and acts on `error` (docs/CLI-CONTRACT.md), so
 * every code needs both languages: the type refuses a missing one. The rung's
 * name it prints sits here too, for the same reason.
 */

export type CliLocale = "pt-BR" | "en";

export const CLI_ERROR_CODES = [
  "invalid_token",
  "insufficient_scope",
  "not_entitled",
  "suspended",
  "device_required",
  "device_unknown",
  "device_revoked",
  "device_mismatch",
  "device_limit_reached",
  "rate_limited",
  "download_limit",
  "denied_entitlement",
  "not_found",
  "version_yanked",
  "invalid_request",
  "unavailable",
] as const;

export type CliErrorCode = (typeof CLI_ERROR_CODES)[number];

const MESSAGES: Record<CliErrorCode, Record<CliLocale, string>> = {
  invalid_token: {
    "pt-BR": "A conexão deste computador precisa ser renovada. Um login novo resolve.",
    en: "This machine's connection needs renewing. A new login does it.",
  },
  insufficient_scope: {
    "pt-BR": "Este login não tem todas as permissões que o flyee usa. Um login novo, aprovando tudo, resolve.",
    en: "This login lacks some permissions flyee uses. A new login, approving all of them, fixes it.",
  },
  not_entitled: {
    "pt-BR": "Sua conta não tem um plano ativo. Veja as opções no painel.",
    en: "Your account has no active plan. See the options in your dashboard.",
  },
  suspended: {
    "pt-BR": "Sua conta está suspensa. Fale com o suporte do FlyeeClub.",
    en: "Your account is suspended. Contact FlyeeClub support.",
  },
  device_required: {
    "pt-BR": "Esta chamada precisa identificar o computador (header X-Flyee-Device). Atualize a CLI.",
    en: "This call must name the machine (X-Flyee-Device header). Update the CLI.",
  },
  device_unknown: {
    "pt-BR": "Este computador ainda não está registrado na sua conta. O flyee o registra e tenta de novo.",
    en: "This machine is not registered on your account yet. flyee registers it and tries again.",
  },
  device_revoked: {
    "pt-BR": "Este computador foi desconectado da sua conta. Um login novo o conecta de novo.",
    en: "This machine was disconnected from your account. A new login connects it again.",
  },
  device_mismatch: {
    "pt-BR": "Esta conexão pertence a outro computador. Um login novo neste computador resolve.",
    en: "This connection belongs to another machine. A new login on this machine fixes it.",
  },
  device_limit_reached: {
    "pt-BR":
      "Você chegou ao limite de {limit} {limit|computador|computadores} do seu plano. Desconecte um no painel ou mude de plano.",
    en: "You reached your plan's limit of {limit} {limit|machine|machines}. Disconnect one in your dashboard or change plans.",
  },
  rate_limited: {
    "pt-BR": "Muitas chamadas em sequência. Espere um minuto e tente de novo.",
    en: "Too many calls in a row. Wait a minute and try again.",
  },
  download_limit: {
    "pt-BR": "Você chegou ao limite diário de downloads. Tente de novo amanhã.",
    en: "You reached the daily download limit. Try again tomorrow.",
  },
  denied_entitlement: {
    "pt-BR": "Esta ferramenta não faz parte do seu plano. Veja como liberar no painel.",
    en: "This tool is not part of your plan. See how to get it in your dashboard.",
  },
  not_found: {
    "pt-BR": "Não encontramos isso no catálogo.",
    en: "We could not find that in the catalog.",
  },
  version_yanked: {
    "pt-BR": "Esta versão foi retirada do catálogo: {reason}. Instale a versão mais recente.",
    en: "This version was withdrawn from the catalog: {reason}. Install the latest version.",
  },
  invalid_request: {
    "pt-BR": "A chamada veio incompleta ou num formato que não entendemos. Atualize a CLI.",
    en: "The call was incomplete or in a format we do not understand. Update the CLI.",
  },
  unavailable: {
    "pt-BR": "O FlyeeClub não conseguiu responder agora. Tente de novo em instantes.",
    en: "FlyeeClub could not answer right now. Try again in a moment.",
  },
};

/**
 * The rung's name for the CLI to print, in the member's language: the names
 * the member screens give it (`product.tier-*`, held equal to the catalogs by
 * lib/cli/product-conformance.test.ts). `access.tier` is the value the code
 * keys on, never what a person reads.
 */
const TIER_NAMES: Record<Tier, Record<CliLocale, string>> = {
  kit: { "pt-BR": "FlyeeClub", en: "FlyeeClub" },
  club: { "pt-BR": "FlyeeClub Pro", en: "FlyeeClub Pro" },
  pro: { "pt-BR": "Pro (antigo)", en: "Pro (legacy)" },
};

/** "FlyeeClub", "FlyeeClub Pro"; null for an account with no rung. */
export function tierName(tier: Tier | null, locale: CliLocale): string | null {
  return tier ? TIER_NAMES[tier][locale] : null;
}

/**
 * The message for a code, with `{name}` placeholders filled in, and
 * `{name|one|other}` replaced by the word that agrees with that number
 * ("1 computador", "3 computadores").
 */
export function cliMessage(
  code: CliErrorCode,
  locale: CliLocale,
  values: Record<string, string | number> = {},
): string {
  return MESSAGES[code][locale].replace(
    /\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g,
    (match, key: string, one?: string, other?: string) => {
      if (!(key in values)) return match;
      if (one !== undefined && other !== undefined) return Number(values[key]) === 1 ? one : other;
      return String(values[key]);
    },
  );
}
