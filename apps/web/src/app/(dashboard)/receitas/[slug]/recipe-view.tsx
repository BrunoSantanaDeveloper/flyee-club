"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";

import CommandBlock from "@/components/product/command-block";
import EmptyState from "@/components/product/empty-state";
import ModuleTile from "@/components/product/module-tile";
import PageHeader from "@/components/product/page-header";
import ProductMarkdown from "@/components/product/product-markdown";
import NiLock from "@/icons/nexture/ni-lock";
import type { loadCatalog, loadRecipe } from "@/lib/catalog/read";

type Recipe = NonNullable<Awaited<ReturnType<typeof loadRecipe>>>;
type Trails = Awaited<ReturnType<typeof loadCatalog>>["trails"];

export type RecipeState =
  | { kind: "ready"; recipe: Recipe; trails: Trails }
  | { kind: "error" }
  | { kind: "unavailable" };

/**
 * Who: a member who chose a recipe. Job: install its tools and follow its
 * workflow. Success: `npx flyee add receita:<slug>` run, the workflow open
 * next to the terminal. The tools list keeps each tool's own access status;
 * the workflow is the membership's part.
 */
export default function RecipeView({ slug, state }: { slug: string; state: RecipeState }) {
  const t = useTranslations("product");
  const router = useRouter();

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
            <CommandBlock
              command={`npx flyee add receita:${recipe.slug}`}
              copyLabel={t("command-copy")}
              copiedLabel={t("command-copied")}
            />
          ) : (
            <Alert
              severity="info"
              className="neutral bg-background-paper/60!"
              action={
                <Button color="inherit" size="small" component={Link} href="/settings/billing?source=catalog">
                  {t("recipes-unlock")}
                </Button>
              }
            >
              {t("recipe-install-locked")}
            </Alert>
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
            return (
              <Grid key={module.slug} size={{ xs: 12, sm: 6, lg: 4 }}>
                <ModuleTile
                  href={`/modulos/${module.slug}`}
                  icon={module.icon ?? trail?.icon ?? null}
                  trail={module.trail}
                  name={module.name ?? module.slug}
                  summary={module.summary}
                  trailLabel={trail?.name ?? module.trail}
                  meta={module.latest ? `v${module.latest.version}` : undefined}
                  status={
                    module.is_free_sample
                      ? { kind: "free", label: t("modules-free-sample") }
                      : module.entitled
                        ? null
                        : { kind: "locked", label: t("modules-locked") }
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
          ) : recipe.entitled ? (
            <Typography variant="body2" className="text-text-secondary">
              {t("recipe-workflow-empty")}
            </Typography>
          ) : (
            <EmptyState
              icon={<NiLock size="large" />}
              title={t("recipe-workflow-locked")}
              description={t("recipes-locked-body")}
              action={{ label: t("recipes-unlock"), href: "/settings/billing?source=catalog" }}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
