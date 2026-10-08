"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Typography } from "@mui/material";

import CatalogIcon from "@/components/product/catalog-icon";
import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import { TILE_TONE } from "@/components/product/tile-tone";
import NiListSquare from "@/icons/nexture/ni-list-square";
import { cn } from "@/lib/utils";

export type RecipeSummary = {
  slug: string;
  name: string | null;
  summary: string | null;
  icon: string | null;
  modules: string[];
  moduleNames: string[];
};

export type RecipesState = { kind: "ready"; recipes: RecipeSummary[] } | { kind: "error" } | { kind: "unavailable" };

/**
 * Who: a member with a goal bigger than one tool ("launch an MVP"). Job: pick
 * the set of tools that gets there, with the order to use them in. Success:
 * one recipe opened and installed. Every account sees the sets (each tool
 * keeps its own access); installing a whole recipe and its step by step are
 * FlyeeClub Pro, offered on the recipe's own page when one is clicked
 * (docs/PRODUCT.md, 2026-10-08). With nothing published the area says
 * "Em breve".
 */
export default function RecipesView({ state }: { state: RecipesState }) {
  const t = useTranslations("product");
  const router = useRouter();
  const tone = TILE_TONE["accent-3"];

  const header = (
    <PageHeader
      title={t("recipes-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("recipes-title") }]}
      description={t("recipes-subtitle")}
    />
  );

  if (state.kind !== "ready") {
    return (
      <Box className="flex flex-col gap-6">
        {header}
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

  return (
    <Box className="flex flex-col gap-6">
      {header}

      {state.recipes.length === 0 ? (
        <EmptyState
          icon={<NiListSquare size="large" />}
          badge={t("soon")}
          title={t("recipes-empty-title")}
          description={t("recipes-empty-body")}
          action={{ label: t("recipes-empty-cta"), href: "/modulos" }}
        />
      ) : (
        <Grid container spacing={3}>
          {state.recipes.map((recipe) => (
            <Grid key={recipe.slug} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card
                component={Link}
                href={`/receitas/${recipe.slug}`}
                className="flex h-full flex-row p-1 transition-transform hover:scale-[1.02]"
              >
                <Box
                  aria-hidden
                  className={cn("flex w-16 flex-none items-center justify-center rounded-2xl", tone.bg, tone.text)}
                >
                  <CatalogIcon name={recipe.icon ?? "NiListSquare"} />
                </Box>
                <CardContent className="flex min-w-0 flex-col gap-2">
                  <Typography variant="subtitle2" component="h2" className="mb-0 leading-5">
                    {recipe.name ?? recipe.slug}
                  </Typography>
                  {recipe.summary ? (
                    <Typography variant="body2" className="text-text-secondary line-clamp-2 leading-5">
                      {recipe.summary}
                    </Typography>
                  ) : null}
                  <Box className="flex flex-row flex-wrap gap-1.5">
                    {recipe.moduleNames.slice(0, 4).map((name) => (
                      <Chip key={name} size="small" variant="outlined" label={name} />
                    ))}
                    {recipe.moduleNames.length > 4 ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t("recipes-more", { count: recipe.moduleNames.length - 4 })}
                      />
                    ) : null}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
