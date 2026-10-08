import { approveDevice, denyDevice } from "./actions";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  Alert,
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";

import { ConsentError, ConsentShell } from "@/components/cli/consent-shell";
import NiBook from "@/icons/nexture/ni-book";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiCheck from "@/icons/nexture/ni-check";
import NiDownloadCloud from "@/icons/nexture/ni-download-cloud";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiUser from "@/icons/nexture/ni-user";
import { formatUserCode, normalizeUserCode } from "@/lib/oauth/device-code";
import { type OauthScope, resolveRequestedScopes, SCOPE_LABEL_KEYS } from "@/lib/oauth/scopes";
import { findPendingDeviceCode } from "@/lib/oauth/server";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /ativar: connect a machine without a browser (`npx flyee login --device`,
 * RFC 8628). The terminal shows a short code; the member types it here on any
 * device, checks that the code on screen is the one in the terminal, and
 * approves. The terminal, polling, picks the access up by itself.
 *
 * Three states, one job each: type the code, approve it, or read the outcome.
 */

const SCOPE_ICONS: Record<OauthScope, React.ReactNode> = {
  "profile:read": <NiUser size="medium" className="text-primary-ink" />,
  "catalog:read": <NiBook size="medium" className="text-primary-ink" />,
  "modules:download": <NiDownloadCloud size="medium" className="text-primary-ink" />,
  "telemetry:write": <NiChartLine size="medium" className="text-primary-ink" />,
};

const ERRORS = ["invalid", "expired", "plan", "workspace", "consent", "unavailable"] as const;
type ActivationError = (typeof ERRORS)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("product");
  const query = await searchParams;
  const rawCode = first(query.code);
  const status = first(query.status);
  const errorParam = first(query.error);
  const error = (ERRORS as readonly string[]).includes(errorParam) ? (errorParam as ActivationError) : null;

  if (!isSupabaseConfigured) {
    return (
      <ConsentError
        title={t("oauth-authorize-error-title")}
        message={t("oauth-error-not-configured")}
        backLabel={t("oauth-authorize-back-home")}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(rawCode ? `/ativar?code=${rawCode}` : "/ativar")}`);
  }

  if (status === "approved" || status === "denied") {
    const approved = status === "approved";
    return (
      <ConsentShell>
        <Box className="flex flex-col items-center gap-2 text-center">
          {approved ? (
            <NiCheck size="large" className="text-success" />
          ) : (
            <NiLaptop size="large" className="text-text-secondary" />
          )}
          <Typography variant="h1" component="h1" className="mb-0">
            {approved ? t("device-approved-title") : t("device-denied-title")}
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            {approved ? t("device-approved-body") : t("device-denied-body")}
          </Typography>
        </Box>
        <Button color="grey" variant="text" component={Link} href="/inicio">
          {t("oauth-authorize-back-home")}
        </Button>
      </ConsentShell>
    );
  }

  const code = normalizeUserCode(rawCode);
  let service;
  try {
    service = createServiceClient();
  } catch {
    return (
      <ConsentError
        title={t("oauth-authorize-error-title")}
        message={t("oauth-error-not-configured")}
        backLabel={t("oauth-authorize-back-home")}
      />
    );
  }
  const pending = code ? await findPendingDeviceCode(service, code) : null;

  // Step 1: type the code (or type it again).
  if (!code || !pending) {
    const message =
      error === "plan"
        ? t("oauth-error-plan")
        : error === "workspace"
          ? t("oauth-error-no-workspace")
          : error === "unavailable"
            ? t("oauth-error-not-configured")
            : rawCode && !code
              ? t("device-code-invalid")
              : rawCode || error
                ? t("device-code-unknown")
                : null;
    return (
      <ConsentShell>
        <Box className="flex flex-col items-center gap-2 text-center">
          <NiLaptop size="large" className="text-primary-ink" />
          <Typography variant="h1" component="h1" className="mb-0">
            {t("device-title")}
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            {t("device-subtitle")}
          </Typography>
        </Box>
        {message ? (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            {message}
          </Alert>
        ) : null}
        <Box component="form" method="get" action="/ativar" className="flex flex-col gap-3">
          <TextField
            name="code"
            label={t("device-code-label")}
            defaultValue={rawCode}
            required
            autoFocus
            autoComplete="one-time-code"
            slotProps={{
              htmlInput: {
                maxLength: 9,
                autoCapitalize: "characters",
                spellCheck: false,
                className: "font-mono tracking-widest uppercase",
              },
            }}
          />
          <Button type="submit" variant="contained" fullWidth>
            {t("device-continue")}
          </Button>
        </Box>
      </ConsentShell>
    );
  }

  // Step 2: approve. The workspace and plan gates repeat in the action.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgRel = membership?.organizations as { name?: string } | { name?: string }[] | null;
  const orgName = (Array.isArray(orgRel) ? orgRel[0]?.name : orgRel?.name) ?? "";

  const { data: terms } = await service.rpc("current_consent_terms", {
    p_locale: (await getLocale()) === "en" ? "en" : "pt-BR",
  });
  const term = ((terms ?? []) as { slug: string; body_md: string }[]).find((row) => row.slug === "cli-connection");
  const scopes = resolveRequestedScopes(pending.scope);
  const formatted = formatUserCode(code);

  return (
    <ConsentShell>
      <Box className="flex flex-col items-center gap-2 text-center">
        <NiLaptop size="large" className="text-primary-ink" />
        <Typography variant="h1" component="h1" className="mb-0">
          {t("oauth-authorize-title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          {t("oauth-authorize-subtitle", { client: pending.client.client_name })}
        </Typography>
        {orgName ? (
          <Typography variant="body2" className="text-text-secondary">
            {t("oauth-authorize-workspace")}: <span className="text-text-primary font-medium">{orgName}</span>
          </Typography>
        ) : null}
      </Box>

      <Alert severity="info" className="neutral bg-background-paper/60!">
        {t("device-code-check")}{" "}
        <span className="text-text-primary font-mono font-semibold tracking-widest">{formatted}</span>
      </Alert>

      {error ? (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          {error === "consent" ? t("device-consent-failed") : t("device-code-unknown")}
        </Alert>
      ) : null}

      <Divider />

      <Box className="flex flex-col gap-1">
        <Typography variant="h6" component="h2" className="mb-0">
          {t("oauth-authorize-permissions")}
        </Typography>
        <List dense disablePadding>
          {scopes.map((scope) => (
            <ListItem key={scope} disableGutters>
              <ListItemIcon>{SCOPE_ICONS[scope]}</ListItemIcon>
              <ListItemText primary={t(SCOPE_LABEL_KEYS[scope])} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Typography variant="body2" className="text-text-secondary">
        {t("oauth-authorize-revalidation-note")}
      </Typography>

      {term ? (
        <Box className="flex flex-col gap-1">
          <Typography variant="h6" component="h2" className="mb-0">
            {t("oauth-authorize-term-title")}
          </Typography>
          <Box className="border-grey-100 max-h-40 overflow-y-auto rounded-lg border p-3">
            <Typography variant="body2" className="text-text-secondary whitespace-pre-line">
              {term.body_md}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Box className="flex flex-col gap-2">
        <Box component="form" action={approveDevice}>
          <input type="hidden" name="user_code" value={code} />
          <Button type="submit" variant="contained" fullWidth>
            {t("oauth-authorize-approve")}
          </Button>
        </Box>
        <Box component="form" action={denyDevice}>
          <input type="hidden" name="user_code" value={code} />
          <Button type="submit" color="grey" variant="text" fullWidth>
            {t("oauth-authorize-deny")}
          </Button>
        </Box>
      </Box>
    </ConsentShell>
  );
}
