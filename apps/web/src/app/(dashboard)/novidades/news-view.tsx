"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";

import { TRAIL_TONE } from "@/components/marketing/tone";
import CatalogIcon from "@/components/product/catalog-icon";
import EmptyState from "@/components/product/empty-state";
import PageHeader from "@/components/product/page-header";
import ProductMarkdown from "@/components/product/product-markdown";
import { TILE_TONE } from "@/components/product/tile-tone";
import NiBell from "@/icons/nexture/ni-bell";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import type { NewsItem } from "@/lib/member/news";
import { cn } from "@/lib/utils";

export type NewsState =
  | { kind: "ready"; items: NewsItem[]; locale: string }
  | { kind: "error" }
  | { kind: "unavailable" };

/**
 * Who: a member coming back to see what changed. Job: know which of their
 * tools moved and what changed in the AIs that matters to them. Success: the
 * changes read, and `npx flyee update` run. Releases and the editorial news
 * share one timeline, so "the model changed" and "the tool that adapts to it
 * shipped" sit next to each other.
 */
export default function NewsView({ state }: { state: NewsState }) {
  const t = useTranslations("product");
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const header = (
    <PageHeader
      title={t("news-title")}
      crumbs={[{ label: t("home-breadcrumb"), href: "/inicio" }, { label: t("news-title") }]}
      description={t("news-subtitle")}
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
          {state.kind === "error" ? t("news-error") : t("settings-unavailable")}
        </Alert>
      </Box>
    );
  }

  const date = (value: string) => new Intl.DateTimeFormat(state.locale, { dateStyle: "long" }).format(new Date(value));

  return (
    <Box className="flex flex-col gap-6">
      {header}
      {state.items.length === 0 ? (
        <EmptyState
          icon={<NiBell size="large" />}
          title={t("news-empty-title")}
          description={t("news-empty-body")}
          action={{ label: t("news-empty-cta"), href: "/modulos" }}
        />
      ) : (
        <Box component="ol" className="m-0 flex list-none flex-col gap-4 p-0">
          {state.items.map((item) => {
            if (item.kind === "release") {
              const tone = TILE_TONE[TRAIL_TONE[item.module.trail] ?? "primary"];
              return (
                <Box component="li" key={item.id}>
                  <Card className="flex flex-row p-1">
                    <Box
                      aria-hidden
                      className={cn(
                        "flex w-14 flex-none items-start justify-center rounded-2xl pt-4",
                        tone.bg,
                        tone.text,
                      )}
                    >
                      <CatalogIcon name={item.module.icon} />
                    </Box>
                    <CardContent className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Box className="flex flex-row flex-wrap items-center gap-2">
                        <Typography variant="subtitle2" component="h2" className="mb-0">
                          <Link href={`/modulos/${item.module.slug}`} className="hover:underline">
                            {item.module.name}
                          </Link>{" "}
                          <span className="font-mono">v{item.version}</span>
                        </Typography>
                        <Chip size="small" variant="outlined" label={t("news-kind-release")} />
                      </Box>
                      <Typography variant="body2" className="text-text-secondary">
                        <time dateTime={item.date}>{date(item.date)}</time>
                      </Typography>
                      {item.changelog ? (
                        <Typography variant="body2" className="whitespace-pre-line">
                          {item.changelog}
                        </Typography>
                      ) : null}
                      <Link
                        href={item.verifyUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-primary text-sm underline"
                      >
                        {t("module-version-verify")}
                      </Link>
                    </CardContent>
                  </Card>
                </Box>
              );
            }
            const expanded = open.has(item.id);
            return (
              <Box component="li" key={item.id}>
                <Card className="flex flex-row p-1">
                  <Box
                    aria-hidden
                    className={cn(
                      "flex w-14 flex-none items-start justify-center rounded-2xl pt-4",
                      TILE_TONE.secondary.bg,
                      TILE_TONE.secondary.text,
                    )}
                  >
                    <NiSparkle size="large" />
                  </Box>
                  <CardContent className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <Typography variant="subtitle2" component="h2" className="mb-0">
                        {item.title}
                      </Typography>
                      <Chip size="small" variant="outlined" label={t("news-kind-post")} />
                    </Box>
                    <Typography variant="body2" className="text-text-secondary">
                      <time dateTime={item.date}>{date(item.date)}</time>
                    </Typography>
                    {expanded ? (
                      <ProductMarkdown>{item.bodyMd}</ProductMarkdown>
                    ) : item.excerpt ? (
                      <Typography variant="body2">{item.excerpt}</Typography>
                    ) : null}
                    {item.bodyMd ? (
                      <Box>
                        <Button
                          size="small"
                          aria-expanded={expanded}
                          onClick={() =>
                            setOpen((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                        >
                          {expanded ? t("news-read-less") : t("news-read-more")}
                        </Button>
                      </Box>
                    ) : null}
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
