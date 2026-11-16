"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, Typography } from "@mui/material";

import { TRAIL_TONE } from "@/components/marketing/tone";
import AskAiBlock from "@/components/product/ask-ai-block";
import CatalogIcon from "@/components/product/catalog-icon";
import GuidePanel, { type GuideTab } from "@/components/product/guide-panel";
import PageHeader from "@/components/product/page-header";
import ProductMarkdown from "@/components/product/product-markdown";
import StatusChip from "@/components/product/status-chip";
import { TILE_TONE } from "@/components/product/tile-tone";
import NiKey from "@/icons/nexture/ni-key";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import type { loadModule } from "@/lib/catalog/read";
import { installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import type { MemberGuide } from "@/lib/member/guides";
import { aiToolName, MODULE_TYPE_LABEL, PERMISSION_LABEL, pickLocalized } from "@/lib/member/labels";
import type { MemberLesson } from "@/lib/member/lessons";
import { moduleAccess, newerThanInstalls } from "@/lib/member/module-access";
import { cn } from "@/lib/utils";
import type { Channel } from "@flyee/catalog/channels";

type ModuleDetail = NonNullable<Awaited<ReturnType<typeof loadModule>>>;

export type ModuleState =
  | {
      kind: "ready";
      module: ModuleDetail;
      lessons: MemberLesson[];
      guide: MemberGuide;
      locale: string;
      /** The account's channel: "free" installs the entry version of each app (0040). */
      channel: Channel | null;
    }
  | { kind: "error" }
  | { kind: "unavailable" };

const UPGRADE = "/settings/billing?source=module";

/**
 * Who: a member deciding whether, and how, to use one tool. Job: understand
 * what it does, see that it is safe, and install it. Success: the sentence
 * copied into the conversation with their AI, which runs the installer
 * (docs/PRODUCT.md, 2026-10-08). Everything a careful member checks before
 * running something is here: the permissions it declares with their reasons,
 * the keys it needs from them, and each release with its checksum page. An
 * account with no purchase installs the entry version (migration 0040): the
 * page says which one, how far the newest is, and marks each release it does
 * not get.
 */
export default function ModuleView({ slug, state }: { slug: string; state: ModuleState }) {
  const t = useTranslations("product");
  const router = useRouter();

  const crumbs = (name: string) => [
    { label: t("home-breadcrumb"), href: "/inicio" },
    { label: t("modules-title"), href: "/modulos" },
    { label: name },
  ];

  if (state.kind !== "ready") {
    return (
      <Box className="flex flex-col gap-6">
        <PageHeader title={slug} crumbs={crumbs(slug)} />
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
          {state.kind === "error" ? t("module-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const { module, locale } = state;
  const access = moduleAccess(module, state.channel);
  const newer = newerThanInstalls(access);
  const tone = TILE_TONE[TRAIL_TONE[module.trail] ?? "primary"];
  const date = (value: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : "";
  // One tab per depth that has a written guide (from the package of the
  // version shown) or a video; the video sits inside its depth's guide. Once
  // the app has a guide, the depth of FlyeeClub Pro is always a tab: "Em
  // breve" until it is written (docs/PRODUCT.md, 2026-10-08).
  const guide = state.guide;
  const hasGuide = (guide.kind === "ready" && guide.depths.length > 0) || state.lessons.length > 0;
  const guideTabs: GuideTab[] = (["usar", "abrir_o_capo"] as const).flatMap((depth) => {
    const written = guide.kind === "ready" ? guide.depths.find((entry) => entry.depth === depth) : undefined;
    const lesson = state.lessons.find((entry) => entry.depth === depth);
    if (!written && !lesson) {
      return depth === "abrir_o_capo" && hasGuide ? [{ depth, guide: null, video: null, soon: true }] : [];
    }
    return [
      {
        depth,
        guide: written ? { markdown: written.markdown, otherLanguage: written.locale !== locale } : null,
        video: lesson
          ? {
              id: lesson.id,
              title: lesson.title,
              durationLabel: lesson.durationSeconds
                ? t("module-lesson-minutes", { minutes: Math.max(1, Math.round(lesson.durationSeconds / 60)) })
                : null,
              youtubeId: lesson.youtubeId,
              completed: lesson.completed,
            }
          : null,
      },
    ];
  });
  const guideVersionKey =
    guide.kind === "ready" && guide.installed
      ? "module-guide-version-installed"
      : guide.kind === "ready" && access.kind === "entry" && guide.version === access.installs
        ? "module-guide-version-entry"
        : "module-guide-version";
  const guideVersionLine = guide.kind === "ready" ? t(guideVersionKey, { version: guide.version }) : null;
  // The entry version is never updated: the newer guide comes with FlyeeClub, not with an update.
  const newerGuideKey = access.kind === "entry" ? "module-guide-newer-entry" : "module-guide-newer";
  const guideNewerLine = guide.kind === "ready" && guide.newer ? t(newerGuideKey, { version: guide.newer }) : null;
  const credentials = (module.external_credentials ?? []) as {
    name?: string;
    env?: string;
    url?: string;
    required?: boolean;
    purpose?: unknown;
  }[];
  const permissions = (module.latest?.permissions ?? []) as { kind?: string; scope?: string; reason?: unknown }[];

  return (
    <Box className="flex flex-col gap-6">
      {/* What the app does is the record's own data, so it stays in sight under the title. */}
      <PageHeader title={module.name ?? slug} crumbs={crumbs(module.name ?? slug)} detail={module.summary} />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Box className="flex flex-row items-center gap-3">
                <Box
                  aria-hidden
                  className={cn("flex h-14 w-14 flex-none items-center justify-center rounded-2xl", tone.bg, tone.text)}
                >
                  <CatalogIcon name={module.icon} />
                </Box>
                <Box className="flex flex-row flex-wrap gap-1.5">
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(MODULE_TYPE_LABEL[module.type] ?? "module-type-tool")}
                  />
                  {module.latest ? (
                    <Chip size="small" variant="outlined" label={`v${access.installs ?? module.latest.version}`} />
                  ) : null}
                  {access.kind === "entry" ? <StatusChip label={t("modules-entry-version")} tone="positive" /> : null}
                </Box>
              </Box>

              {module.entitled ? (
                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2" component="h2" className="mb-0">
                    {t("module-install-title")}
                  </Typography>
                  <AskAiBlock
                    label={t("ask-ai-label")}
                    prompt={t("ask-ai-add", { app: module.slug, url: installGuideUrl(locale) })}
                    copyLabel={t("ask-ai-copy")}
                    copiedLabel={t("ask-ai-copied")}
                    referenceLabel={t("ask-ai-reference")}
                    command={REFERENCE_COMMAND.add(module.slug)}
                  />
                  <Typography variant="body2" className="text-text-secondary">
                    {t("module-install-note")}
                  </Typography>
                  {access.kind === "entry" ? (
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <Typography variant="body2">
                        {newer
                          ? t("module-entry-note-newer", { version: access.installs ?? "", newest: newer })
                          : t("module-entry-note", { version: access.installs ?? "" })}
                      </Typography>
                      <Button size="small" variant="outlined" component={Link} href="/assinatura">
                        {t("modules-get-kit")}
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              ) : (
                <Alert
                  severity="info"
                  className="neutral bg-background-paper/60!"
                  action={
                    <Button color="inherit" size="small" component={Link} href={UPGRADE}>
                      {t("module-unlock")}
                    </Button>
                  }
                >
                  {t("module-locked-body")}
                </Alert>
              )}
            </CardContent>
          </Card>

          <GuidePanel
            tabs={guideTabs}
            versionLine={guideVersionLine}
            newerLine={guideNewerLine}
            upgradeHref={UPGRADE}
          />

          {module.description ? (
            <Card>
              <CardContent>
                <ProductMarkdown>{module.description}</ProductMarkdown>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-col gap-3">
              <Typography variant="subtitle1" component="h2" className="mb-0">
                {t("module-versions-title")}
              </Typography>
              {module.versions.length === 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("module-versions-empty")}
                </Typography>
              ) : (
                <Box component="ol" className="m-0 flex list-none flex-col gap-3 p-0">
                  {module.versions.map((version, index) => (
                    <Box component="li" key={version.version} className="flex flex-col gap-1">
                      {index > 0 ? <Divider className="mb-2" /> : null}
                      <Box className="flex flex-row flex-wrap items-center gap-2">
                        <Typography variant="subtitle2" component="h3" className="mb-0 font-mono">
                          v{version.version}
                        </Typography>
                        <Typography variant="body2" className="text-text-secondary">
                          {date(version.published_at)}
                        </Typography>
                        {version.status === "yanked" ? (
                          <Chip size="small" color="error" variant="outlined" label={t("module-version-yanked")} />
                        ) : access.kind === "entry" && version.version === access.installs ? (
                          <StatusChip label={t("modules-entry-version")} tone="positive" />
                        ) : access.kind === "entry" && !version.entitled ? (
                          <StatusChip label={t("module-version-with-kit")} tone="neutral" />
                        ) : null}
                        <Link
                          href={version.verify_url}
                          className="text-primary-ink text-sm underline"
                          target="_blank"
                          rel="noopener"
                        >
                          {t("module-version-verify")}
                        </Link>
                      </Box>
                      {version.status === "yanked" && version.yank_reason ? (
                        <Typography variant="body2" className="text-text-secondary">
                          {version.yank_reason}
                        </Typography>
                      ) : null}
                      {version.changelog ? (
                        <Typography variant="body2" className="whitespace-pre-line">
                          {version.changelog}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Box className="flex flex-row items-center gap-2">
                <NiShieldCheck size="medium" className="text-primary-ink" aria-hidden />
                <Typography variant="subtitle1" component="h2" className="mb-0">
                  {t("module-permissions-title")}
                </Typography>
              </Box>
              {permissions.length === 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("module-permissions-none")}
                </Typography>
              ) : (
                <Box component="ul" className="m-0 flex list-none flex-col gap-3 p-0">
                  {permissions.map((permission, index) => (
                    <Box component="li" key={`${permission.kind}-${index}`} className="flex flex-col gap-0.5">
                      <Typography variant="body2" className="font-semibold">
                        {t(PERMISSION_LABEL[permission.kind ?? ""] ?? "permission-other")}{" "}
                        <code className="text-text-secondary font-mono text-xs">{permission.scope}</code>
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary">
                        {pickLocalized(permission.reason, locale)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <Box className="flex flex-row items-center gap-2">
                <NiKey size="medium" className="text-primary-ink" aria-hidden />
                <Typography variant="subtitle1" component="h2" className="mb-0">
                  {t("module-credentials-title")}
                </Typography>
              </Box>
              {credentials.length === 0 ? (
                <Typography variant="body2" className="text-text-secondary">
                  {t("module-credentials-none")}
                </Typography>
              ) : (
                <Box component="ul" className="m-0 flex list-none flex-col gap-3 p-0">
                  {credentials.map((credential) => (
                    <Box component="li" key={credential.env ?? credential.name} className="flex flex-col gap-0.5">
                      <Typography variant="body2" className="font-semibold">
                        {credential.name}{" "}
                        <code className="text-text-secondary font-mono text-xs">{credential.env}</code>
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary">
                        {pickLocalized(credential.purpose, locale)}{" "}
                        {credential.required ? t("module-credential-required") : t("module-credential-optional")}
                      </Typography>
                      {credential.url ? (
                        <Link
                          href={credential.url}
                          className="text-primary-ink text-sm underline"
                          target="_blank"
                          rel="noopener"
                        >
                          {t("module-credential-get")}
                        </Link>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2">
              <Typography variant="subtitle1" component="h2" className="mb-0">
                {t("module-compatible-title")}
              </Typography>
              <Box className="flex flex-row flex-wrap gap-1.5">
                {module.compatible_ais.map((tool) => (
                  <Chip key={tool} size="small" variant="outlined" label={aiToolName(tool, t("ai-tool-other"))} />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
