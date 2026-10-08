import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, Box, Button, Typography } from "@mui/material";

import { ConsentShell } from "@/components/cli/consent-shell";
import AskAiBlock from "@/components/product/ask-ai-block";
import NiRefresh from "@/icons/nexture/ni-refresh";
import { type DeviceStatus, readDeviceStatus } from "@/lib/cli/device-status";
import { installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import { isDeviceId } from "@/lib/oauth/server";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /revalidar?d=<device>: where the CLI points (the token endpoint's
 * `error_uri`) when a machine's connection lapsed after 30 days without an
 * update. The CLI already reopened the approval in the browser; this page is
 * the explanation and the way back for whoever opens the link later: why it
 * happened, how long this machine has been away, and the sentence that has
 * their AI connect it again.
 */
export default async function RevalidatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, locale] = await Promise.all([getTranslations("product"), getLocale()]);
  const query = await searchParams;
  const deviceParam = Array.isArray(query.d) ? query.d[0] : query.d;
  const deviceId = isDeviceId(deviceParam) ? deviceParam : null;

  let device: DeviceStatus | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect(`/auth/sign-in?next=${encodeURIComponent(deviceId ? `/revalidar?d=${deviceId}` : "/revalidar")}`);
    }
    if (deviceId) {
      try {
        device = await readDeviceStatus(createServiceClient(), { userId: user!.id, deviceId });
      } catch {
        device = null;
      }
    }
  }

  return (
    <ConsentShell>
      <Box className="flex flex-col items-center gap-2 text-center">
        <NiRefresh size="large" className="text-primary-ink" />
        <Typography variant="h1" component="h1" className="mb-0">
          {t("revalidate-page-title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          {t("revalidate-page-body")}
        </Typography>
      </Box>

      {device ? (
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {t("oauth-revalidate-subtitle", {
            device: device.name || t("oauth-device-unnamed"),
            days: device.daysSinceUpdate,
          })}{" "}
          {device.behind > 0
            ? t("oauth-revalidate-behind", { count: device.behind })
            : device.beyondChannel > 0
              ? t("oauth-revalidate-beyond", { count: device.beyondChannel })
              : t("oauth-revalidate-current")}
        </Alert>
      ) : null}

      <Box className="flex flex-col gap-2">
        <Typography variant="h6" component="h2" className="mb-0">
          {t("revalidate-page-steps")}
        </Typography>
        <AskAiBlock
          label={t("ask-ai-label")}
          prompt={t("ask-ai-reconnect", { url: installGuideUrl(locale) })}
          copyLabel={t("ask-ai-copy")}
          copiedLabel={t("ask-ai-copied")}
          referenceLabel={t("ask-ai-reference")}
          command={REFERENCE_COMMAND.reconnect}
        />
        <Typography variant="body2" className="text-text-secondary">
          {t("revalidate-page-note")}
        </Typography>
      </Box>

      <Button color="grey" variant="text" component={Link} href="/settings/devices">
        {t("revalidate-page-devices")}
      </Button>
    </ConsentShell>
  );
}
