import { isSemver } from "@flyee/catalog/semver";

/**
 * Where a package leaves from (the product's request of 2026-10-20, item 2,
 * decision D2). The download route signs a 300-second URL of the private
 * `modules` bucket; a Claude Code session in the cloud reaches only the hosts
 * its environment allows, so that URL made the person allow the storage host
 * too. With the platform as the host, the same signed link is served by the
 * site itself (/api/public/packages/…), which passes the bytes through, and
 * the session needs one address.
 *
 * `platform_settings.cli.package_host`, edited in the Entrega tab, so the way
 * back needs no deploy:
 *  - `storage` (the default): the storage URL, as before;
 *  - `preview`: the platform on every deployment but production, for the
 *    acceptance in a preview, which may share the production database;
 *  - `platform`: the platform everywhere.
 */
export const PACKAGE_HOSTS = ["storage", "preview", "platform"] as const;
export type PackageHost = (typeof PACKAGE_HOSTS)[number];

export const PACKAGE_ROUTE = "/api/public/packages";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** The setting as stored; anything else reads as the storage, the way that worked before. */
export function packageHostOf(value: unknown): PackageHost {
  return (PACKAGE_HOSTS as readonly unknown[]).includes(value) ? (value as PackageHost) : "storage";
}

/** Whether packages leave from the platform's own host on this deployment (`VERCEL_ENV`). */
export function servesPackages(host: PackageHost, deployment: string | undefined = process.env.VERCEL_ENV): boolean {
  return host === "platform" || (host === "preview" && deployment !== "production");
}

/** A package's address in the bucket, and nothing else: `<slug>/<version>/<slug>-<version>.zip`. */
export function isPackagePath(slug: string, version: string, file: string): boolean {
  return SLUG.test(slug) && isSemver(version) && file === `${slug}-${version}.zip`;
}

const SIGNED_PATH = /^\/storage\/v1\/object\/sign\/modules\/([^/]+)\/([^/]+)\/([^/]+)$/;

const decoded = (part: string): string | null => {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
};

/**
 * The platform's address for a signed storage URL: the same package, the same
 * token, so the same 300 seconds. Null for anything that is not a package of
 * the `modules` bucket, so nothing else can be served through the route.
 * `origin` is the host the CLI called, so a preview serves its own packages.
 */
export function platformPackageUrl(signedUrl: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(signedUrl);
  } catch {
    return null;
  }
  const match = SIGNED_PATH.exec(url.pathname);
  if (!match) return null;
  const [slug, version, file] = match.slice(1).map(decoded);
  if (slug === null || version === null || file === null || !isPackagePath(slug, version, file)) return null;
  const token = url.searchParams.get("token");
  if (!token) return null;
  return `${origin}${PACKAGE_ROUTE}/${slug}/${version}/${file}?token=${encodeURIComponent(token)}`;
}
