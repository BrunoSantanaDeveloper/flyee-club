"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";

import AskAiBlock from "@/components/product/ask-ai-block";
import ModuleTile from "@/components/product/module-tile";
import PageHeader from "@/components/product/page-header";
import ProductMarkdown from "@/components/product/product-markdown";
import StatusChip from "@/components/product/status-chip";
import { useUpgradePrompt } from "@/components/product/upgrade-prompt";
import type { loadCatalog, loadRecipe } from "@/lib/catalog/read";
import { installGuideUrl, REFERENCE_COMMAND } from "@/lib/install-links";
import { moduleAccess, newerThanInstalls } from "@/lib/member/module-access";
import type { Channel } from "@flyee/catalog/channels";

type Recipe = NonNullable<Awaited<ReturnType<typeof loadRecipe>>>;
type Trails = Awaited<ReturnType<typeof loadCatalog>>["trails"];

export type RecipeState =
  | {
      kind: "ready";
      recipe: Recipe;
      trails: Trails;
      /** A step by step is written, whether or not this account can read it. */
      hasWorkflow: boolean;
      /** The account's channel: "free" installs the entry version of each app (0040). */
      channel: Channel | null;
    }
  | { kind: "error" }
  | { kind: "unavailable" };

/**
 * Who: a member who chose a recipe. Job: install its tools and follow its
 * workflow. Success: their AI asked to install the recipe, the workflow open
 * beside the conversation. The tools list keeps each tool's own access status.
 * Installing the whole recipe and its step by step are FlyeeClub Pro: without
 * it, both buttons open the upgrade prompt (docs/PRODUCT.md, 2026-10-08), and
 * a step by step not written yet says "Em breve" to everyone.
 */
export default function RecipeView({ slug, state }: { slug: string; state: RecipeState }) {
  const t = useTranslations("product");
  const locale = useLocale();
  const router = useRouter();
  const openUpgrade = useUpgradePrompt();

  const crumbs = (name: string) => [
    { label: t("home-breadcrumb"), href: "/inicio" },
    { label: t("recipes-title"), href: "/receitas" },
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
          {state.kind === "error" ? t("recipes-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const { recipe } = state;
  const name = recipe.name ?? slug;

  return (
    <Box className="flex flex-col gap-6">
      <PageHeader title={name} crumbs={crumbs(name)} description={recipe.summary ?? undefined} />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <Typography variant="subtitle2" component="h2" className="mb-0">
            {t("recipe-install-title")}
          </Typography>
          {recipe.entitled ? (
            <AskAiBlock
              label={t("ask-ai-label")}
              prompt={t("ask-ai-add-recipe", { recipe: recipe.slug, url: installGuideUrl(locale) })}
              copyLabel={t("ask-ai-copy")}
              copiedLabel={t("ask-ai-copied")}
              referenceLabel={t("ask-ai-reference")}
              command={REFERENCE_COMMAND.addRecipe(recipe.slug)}
            />
          ) : (
            <>
              <Typography variant="body2" className="text-text-secondary">
                {t("recipe-install-pro-body")}
              </Typography>
              <Box>
                <Button variant="contained" onClick={() => openUpgrade("recipe_install")}>
                  {t("recipe-install-pro-cta")}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Box className="flex flex-col gap-3">
        <Typography variant="h5" component="h2" className="mb-0">
          {t("recipe-tools-title")}
        </Typography>
        <Grid container spacing={3}>
          {recipe.modules.map((module) => {
            const trail = state.trails.find((item) => item.slug === module.trail);
            const access = moduleAccess(module, state.channel);
            const newer = newerThanInstalls(access);
            return (
              <Grid key={module.slug} size={{ xs: 12, sm: 6, lg: 4 }}>
                <ModuleTile
                  href={`/modulos/${module.slug}`}
                  icon={module.icon ?? trail?.icon ?? null}
                  trail={module.trail}
                  name={module.name ?? module.slug}
                  summary={module.summary}
                  trailLabel={trail?.name ?? module.trail}
                  meta={
                    [
                      access.installs ? `v${access.installs}` : module.latest ? `v${module.latest.version}` : null,
                      newer ? t("modules-newest", { version: newer }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  status={
                    access.kind === "entry"
                      ? { kind: "entry", label: t("modules-entry-version") }
                      : access.kind === "locked"
                        ? { kind: "locked", label: t("modules-locked") }
                        : null
                  }
                />
              </Grid>
            );
          })}
        </Grid>
      </Box>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Typography variant="h5" component="h2" className="mb-0">
            {t("recipe-workflow-title")}
          </Typography>
          {recipe.workflow ? (
            <ProductMarkdown>{recipe.workflow}</ProductMarkdown>
          ) : !state.hasWorkflow ? (
            <Box className="flex flex-row flex-wrap items-center gap-2">
              <StatusChip label={t("soon")} tone="attention" />
              <Typography variant="body2" className="text-text-secondary">
                {t("recipe-workflow-empty")}
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" className="text-text-secondary">
                {t("recipe-workflow-pro-body")}
              </Typography>
              <Box>
                <Button variant="outlined" onClick={() => openUpgrade("recipe_workflow")}>
                  {t("recipe-workflow-pro-cta")}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
