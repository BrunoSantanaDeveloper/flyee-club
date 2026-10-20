import { isPackagePath } from "@/lib/cli/package-host";

/** The token a signed storage URL carries: a JWT. */
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/**
 * GET /api/public/packages/<slug>/<version>/<slug>-<version>.zip?token=…: one
 * package, passed through from the private `modules` bucket (the product's
 * request of 2026-10-20, item 2), so a Claude Code session in the cloud
 * downloads from the one host it allows, the platform's.
 *
 * It serves only what the download route signed: the token is the storage's
 * own, valid for 300 seconds, and storage checks it; the path must be a
 * package's (lib/cli/package-host.ts), so nothing else of the bucket, and no
 * `..`, gets through. Never cached anywhere (`no-store`, not the hour the
 * storage sends): a cached package would reach an account whose own gate
 * would have refused it. The CLI checks the size and the SHA-256 before it
 * extracts anything (docs/CLI-CONTRACT.md, 4.5).
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; version: string; file: string }> },
) {
  const { slug, version, file } = await params;
  if (!isPackagePath(slug, version, file)) return refuse(404, "not_found");

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (token.length > 4096 || !TOKEN.test(token)) return refuse(400, "missing_token");

  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storage) return refuse(503, "not_configured");

  let upstream: Response;
  try {
    upstream = await fetch(
      `${storage}/storage/v1/object/sign/modules/${slug}/${version}/${file}?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
  } catch {
    return refuse(502, "package_unavailable");
  }
  if (!upstream.ok || !upstream.body) {
    // The storage answers 400 for an expired or forged token and 404 for a package it does not have.
    if (upstream.status === 404) return refuse(404, "not_found");
    if (upstream.status >= 400 && upstream.status < 500) return refuse(403, "link_expired");
    return refuse(502, "package_unavailable");
  }

  const headers = new Headers({
    ...NO_STORE,
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${file}"`,
  });
  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
}
