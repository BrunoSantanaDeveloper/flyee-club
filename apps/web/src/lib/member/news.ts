import "server-only";

import { type CatalogLocale, verifyUrl } from "@/lib/catalog/links";
import { localize } from "@/lib/catalog/read";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What changed, newest first (`/novidades` and the home's strip): every
 * published module version with its changelog, and the members-only news
 * posts ("what changed in the AIs and what that changes in your tools",
 * `blog_posts.kind = 'news'`) in the member's language.
 */
export type NewsItem =
  | {
      kind: "release";
      id: string;
      date: string;
      module: { slug: string; name: string; icon: string | null; trail: string };
      version: string;
      changelog: string | null;
      verifyUrl: string;
    }
  | {
      kind: "post";
      id: string;
      date: string;
      title: string;
      excerpt: string | null;
      bodyMd: string;
    };

/** Two feeds merged by date, newest first. Pure. */
export function mergeNews(releases: NewsItem[], posts: NewsItem[], limit: number): NewsItem[] {
  return [...releases, ...posts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit);
}

export async function loadNews(
  supabase: SupabaseClient,
  input: { locale: CatalogLocale; limit: number; releasesOnly?: boolean },
): Promise<NewsItem[]> {
  const [{ data: versions, error: versionsError }, { data: posts, error: postsError }] = await Promise.all([
    supabase
      .from("catalog_module_versions")
      .select("id, module_id, version, published_at, changelog")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(input.limit),
    input.releasesOnly
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("blog_posts")
          .select("id, title, excerpt, body_md, published_at")
          .eq("kind", "news")
          .eq("is_published", true)
          .eq("locale", input.locale)
          .order("published_at", { ascending: false })
          .limit(input.limit),
  ]);
  if (versionsError || postsError) throw new Error("news_read_failed");

  const versionRows = (versions ?? []) as {
    id: string;
    module_id: string;
    version: string;
    published_at: string | null;
    changelog: Record<string, string> | null;
  }[];
  const moduleIds = [...new Set(versionRows.map((row) => row.module_id))];
  const { data: modules } = moduleIds.length
    ? await supabase.from("catalog_modules").select("id, slug, name, icon, trail").in("id", moduleIds)
    : { data: [] };
  const moduleById = new Map(
    (
      (modules ?? []) as {
        id: string;
        slug: string;
        name: Record<string, string>;
        icon: string | null;
        trail: string;
      }[]
    ).map((module) => [module.id, module]),
  );

  const releases: NewsItem[] = versionRows.flatMap((row) => {
    const module = moduleById.get(row.module_id);
    if (!module || !row.published_at) return [];
    return [
      {
        kind: "release" as const,
        id: row.id,
        date: row.published_at,
        module: {
          slug: module.slug,
          name: localize(module.name, input.locale) ?? module.slug,
          icon: module.icon,
          trail: module.trail,
        },
        version: row.version,
        changelog: localize(row.changelog, input.locale),
        verifyUrl: verifyUrl(module.slug, row.version, input.locale),
      },
    ];
  });

  const postItems: NewsItem[] = (
    (posts ?? []) as {
      id: string;
      title: string;
      excerpt: string | null;
      body_md: string;
      published_at: string | null;
    }[]
  ).flatMap((post) =>
    post.published_at
      ? [
          {
            kind: "post" as const,
            id: post.id,
            date: post.published_at,
            title: post.title,
            excerpt: post.excerpt,
            bodyMd: post.body_md,
          },
        ]
      : [],
  );

  return mergeNews(releases, postItems, input.limit);
}
