"use client";

import SettingsMenu from "../components/settings-menu";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  Grid,
  Tooltip,
  Typography,
} from "@mui/material";

import AskAiBlock from "@/components/product/ask-ai-block";
import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import { useUpgradePrompt } from "@/components/product/upgrade-prompt";
import UsageMeter from "@/components/product/usage-meter";
import NiCloud from "@/icons/nexture/ni-cloud";
import NiLaptop from "@/icons/nexture/ni-laptop";
import NiListCircle from "@/icons/nexture/ni-list-circle";
import { installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import { revokeDevice } from "@/lib/member/actions";
import type { DevicesOverview, MemberDevice } from "@/lib/member/devices";
import { aiToolName } from "@/lib/member/labels";

export type DevicesState =
  | {
      kind: "ready";
      overview: DevicesOverview;
      locale: string;
      /** FlyeeClub Pro would raise the ceiling: at the ceiling, "connect more" opens the upgrade prompt. */
      canUpgrade: boolean;
    }
  | { kind: "error" }
  | { kind: "unavailable" };

const OS_NAME: Record<string, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

/**
 * Who: a member checking which machines use their account. Job: see every
 * connected machine, when each must revalidate, and cut one off. Success: the
 * list matches the machines they actually use, and they know how to bring a
 * lapsed one back. The plan's ceiling is shown as what it is, an allowance;
 * once it is reached, connecting more is the moment FlyeeClub Pro is offered,
 * on the click (docs/PRODUCT.md, 2026-10-08).
 */
export default function DevicesView({ state }: { state: DevicesState }) {
  const t = useTranslations("product");
  const router = useRouter();
  const [openDrawer, setOpenDrawer] = useState(false);
  const [confirming, setConfirming] = useState<MemberDevice | null>(null);
  const [feedback, setFeedback] = useState<"revoked" | "failed" | "support" | null>(null);
  const [pending, startTransition] = useTransition();
  const openUpgrade = useUpgradePrompt();

  const header = (
    <Grid size={12} spacing={2.5} container>
      <Grid size={{ xs: 12, md: "grow" }}>
        <PageHeader
          title={t("devices-title")}
          crumbs={[
            { label: t("settings-home"), href: "/inicio" },
            { label: t("settings-title"), href: "/settings" },
            { label: t("settings-devices") },
          ]}
          description={t("devices-subtitle")}
        />
      </Grid>
      <Grid size={{ xs: 12, md: "auto" }} className="lg:hidden">
        <Tooltip title={t("settings-open-menu")}>
          <Button
            className="icon-only surface-standard"
            color="grey"
            variant="surface"
            onClick={() => setOpenDrawer(true)}
            aria-label={t("settings-open-menu")}
          >
            <NiListCircle size={"medium"} />
          </Button>
        </Tooltip>
      </Grid>
    </Grid>
  );

  const confirmRevoke = () => {
    if (!confirming) return;
    const target = confirming;
    startTransition(async () => {
      const result = await revokeDevice(target.id);
      setConfirming(null);
      if (result.ok) {
        setFeedback("revoked");
        router.refresh();
      } else {
        setFeedback(result.code === "support_session" ? "support" : "failed");
      }
    });
  };

  const date = (value: string | null, locale: string) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : null;

  const body = () => {
    if (state.kind !== "ready") {
      return (
        <Grid size={12}>
          <Alert
            severity={state.kind === "error" ? "error" : "info"}
            className="neutral bg-background-paper/60!"
            action={
              state.kind === "error" ? (
                <Button color="inherit" size="small" onClick={() => router.refresh()}>
                  {t("retry")}
                </Button>
              ) : undefined
            }
          >
            {state.kind === "error" ? t("devices-error") : t("settings-unavailable")}
          </Alert>
        </Grid>
      );
    }

    const { overview, locale } = state;
    // The computers the plan's ceiling counts, then the cloud session, which has its own place (migration 0044).
    const live = [
      ...overview.devices.filter((device) => !device.revokedAt && !device.cloud),
      ...(overview.cloudSession ? [overview.cloudSession] : []),
    ];
    const revoked = overview.devices.filter((device) => device.revokedAt);

    if (overview.devices.length === 0) {
      return (
        <Grid size={12}>
          <EmptyState
            icon={<NiLaptop size="large" />}
            title={t("devices-empty-title")}
            description={t("devices-empty-body")}
            action={{ label: t("devices-empty-cta"), href: "/inicio#instalar" }}
          />
        </Grid>
      );
    }

    return (
      <>
        {feedback ? (
          <Grid size={12}>
            <Alert
              severity={feedback === "revoked" ? "success" : "error"}
              className="neutral bg-background-paper/60!"
              onClose={() => setFeedback(null)}
            >
              {feedback === "revoked"
                ? t("devices-revoked-success")
                : feedback === "support"
                  ? t("devices-revoke-support")
                  : t("devices-revoke-failed")}
            </Alert>
          </Grid>
        ) : null}

        {overview.limit > 0 ? (
          <Grid size={12}>
            <Card>
              <CardContent>
                <UsageMeter
                  headline={t("home-devices-headline", { live: overview.live, limit: overview.limit })}
                  caption={overview.live >= overview.limit ? t("devices-limit-reached") : undefined}
                  ariaLabel={t("home-devices-aria", { live: overview.live, limit: overview.limit })}
                  segments={[
                    {
                      key: "live",
                      label: t("home-devices-live"),
                      value: overview.live,
                      display: String(overview.live),
                      tone: "primary",
                    },
                    {
                      key: "free",
                      label: t("home-devices-free"),
                      value: Math.max(0, overview.limit - overview.live),
                      display: String(Math.max(0, overview.limit - overview.live)),
                      tone: "secondary",
                    },
                  ]}
                />
                {overview.live >= overview.limit && state.canUpgrade ? (
                  <Box className="mt-3">
                    <Button variant="outlined" size="small" onClick={() => openUpgrade("more_devices")}>
                      {t("devices-more")}
                    </Button>
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        ) : null}

        <Grid size={12} className="flex flex-col gap-4">
          {live.map((device) => {
            const days = device.refreshExpiresAt
              ? Math.max(0, Math.ceil((Date.parse(device.refreshExpiresAt) - Date.now()) / 86_400_000))
              : null;
            const details = [
              device.os ? (OS_NAME[device.os] ?? t("devices-os-other")) : null,
              device.aiTool ? aiToolName(device.aiTool, t("ai-tool-other")) : null,
              device.cliVersion ? `flyee v${device.cliVersion}` : null,
              t("devices-installed", { count: device.installedModules }),
            ].filter(Boolean);
            return (
              <Card component="section" key={device.id}>
                <CardContent className="flex flex-col gap-3">
                  <Box className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <Box className="flex flex-row items-center gap-2">
                      {device.cloud ? (
                        <NiCloud size="medium" className="text-primary-ink" aria-hidden />
                      ) : (
                        <NiLaptop size="medium" className="text-primary-ink" aria-hidden />
                      )}
                      <Typography variant="h6" component="h2" className="mb-0">
                        {device.cloud ? t("devices-cloud-title") : device.name || t("oauth-device-unnamed")}
                      </Typography>
                      {device.projectKind === "client" ? (
                        <Chip size="small" variant="outlined" label={t("devices-client-project")} />
                      ) : null}
                    </Box>
                    <Button color="error" variant="outlined" onClick={() => setConfirming(device)}>
                      {t("devices-revoke")}
                    </Button>
                  </Box>
                  <Typography variant="body2" className="text-text-secondary">
                    {details.join(" · ")}
                  </Typography>
                  {device.cloud ? (
                    <Typography variant="body2" className="text-text-secondary">
                      {t("devices-cloud-body")}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" className="text-text-secondary">
                    {device.lastUpdateAt
                      ? t("devices-last-update", { date: date(device.lastUpdateAt, locale) ?? "" })
                      : t("devices-never-updated")}
                  </Typography>
                  <Typography variant="body2" className={days !== null && days <= 5 ? "font-semibold" : undefined}>
                    {days === null
                      ? t("devices-lapsed")
                      : days <= 5
                        ? t("home-revalidate-soon", { days })
                        : t("home-revalidate-in", { days })}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <Typography variant="subtitle1" component="h2" className="mb-0">
                {t("devices-reconnect-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("devices-reconnect-body")}
              </Typography>
              <AskAiBlock
                label={t("ask-ai-label")}
                prompt={t("ask-ai-reconnect", { url: installGuideUrl(locale) })}
                copyLabel={t("ask-ai-copy")}
                copiedLabel={t("ask-ai-copied")}
                referenceLabel={t("ask-ai-reference")}
                command={REFERENCE_COMMAND.reconnect}
              />
            </CardContent>
          </Card>
        </Grid>

        {revoked.length > 0 ? (
          <Grid size={12} className="flex flex-col gap-2">
            <Typography variant="subtitle1" component="h2" className="mb-0">
              {t("devices-revoked-title")}
            </Typography>
            <Box component="ul" className="m-0 flex list-none flex-col gap-1 p-0">
              {revoked.map((device) => (
                <Typography component="li" variant="body2" key={device.id} className="text-text-secondary">
                  {device.name || t("oauth-device-unnamed")}
                  {" · "}
                  {t("devices-revoked-on", { date: date(device.revokedAt, locale) ?? "" })}
                </Typography>
              ))}
            </Box>
          </Grid>
        ) : null}
      </>
    );
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"auto"} className="hidden pr-8 lg:flex">
        <SettingsMenu active="devices" />
      </Grid>
      <Grid size={"grow"} spacing={5} container>
        {header}
        {body()}

        <Dialog open={confirming !== null} onClose={() => (pending ? null : setConfirming(null))}>
          <DialogTitle>{t("devices-revoke-confirm-title")}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t("devices-revoke-confirm-body", { device: confirming?.name || t("oauth-device-unnamed") })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="grey" variant="text" onClick={() => setConfirming(null)} disabled={pending}>
              {t("devices-revoke-cancel")}
            </Button>
            <Button color="error" variant="contained" onClick={confirmRevoke} disabled={pending}>
              {t("devices-revoke")}
            </Button>
          </DialogActions>
        </Dialog>

        <Drawer open={openDrawer} anchor="right" onClose={() => setOpenDrawer(false)}>
          <Box className="min-w-80 p-7">
            <SettingsMenu active="devices" />
          </Box>
        </Drawer>
      </Grid>
    </Grid>
  );
}
