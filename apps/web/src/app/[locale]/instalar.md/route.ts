import { isPublicLocale, localizeHref } from "@/i18n/routing";
import { cloudHostsNow } from "@/lib/cli/settings";
import { installGuide } from "@/lib/install-guide";
import { installGuideUrl } from "@/lib/install-links";
import { absoluteUrl } from "@/lib/seo";

/**
 * /instalar.md and /en/install.md: the page a member's AI reads to install
 * flyee, as plain Markdown (docs/PLANO-IMPLEMENTACAO.md, 12.6). The member
 * pastes "Instale o flyee seguindo <this address>" into the conversation and
 * the AI follows the steps; the text lives in lib/install-guide.ts.
 *
 * A public address declared in src/i18n/routing.ts, like any page of the site,
 * which is what lets the middleware serve it without a session and gives it
 * its English address. It is out of the sitemap and of the index (option 1 of
 * 2026-10-08): it is an instruction for an AI that was handed the link, not a
 * page to find by searching.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) return new Response("Not found", { status: 404 });

  const body = installGuide(locale, {
    install: installGuideUrl(locale),
    store: absoluteUrl(localizeHref("/catalogo", locale)),
    hosts: await cloudHostsNow(),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Language": locale,
      "X-Robots-Tag": "noindex",
      // The same for everyone, changed by a deploy or by the package host switch (5 minutes behind it).
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
