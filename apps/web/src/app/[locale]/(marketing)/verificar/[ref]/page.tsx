import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import NiCheck from "@/icons/nexture/ni-check";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { createAnonClient } from "@/lib/public-content";
import { publicPageMetadata } from "@/lib/seo";
import { isSemver } from "@flyee/catalog/semver";

/**
 * /verificar/<module>@<version> (EN /verify/…): what anybody can check about
 * a released package before or after installing it: the SHA-256 of the exact
 * bytes the CLI downloads, the size, the AIs it works with and every
 * permission it declares, with the reason. The data is `verify_module_version`
 * (migration 0008), public by design and never the package location.
 *
 * Linked from the CLI (`verify_url`) and from each module page; not indexed.
 */

type Verification = {
  slug: string;
  version: string;
  is_stable: boolean;
  status: "published" | "yanked";
  sha256: string;
  size_bytes: number;
  permissions: { kind?: string; scope?: string; reason?: Record<string, string> | string }[];
  compatible_ais: string[];
  published_at: string | null;
  yanked_at: string | null;
};

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** `deploy-check@1.2.0` → its parts; null when it cannot be a released version. */
function parseRef(raw: string): { slug: string; version: string } | null {
  let ref: string;
  try {
    ref = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const at = ref.lastIndexOf("@");
  if (at <= 0) return null;
  const slug = ref.slice(0, at);
  const version = ref.slice(at + 1);
  return SLUG.test(slug) && isSemver(version) ? { slug, version } : null;
}

const PERMISSION_LABEL: Record<string, string> = {
  "fs:read": "verify-permission-fs-read",
  "fs:write": "verify-permission-fs-write",
  network: "verify-permission-network",
  shell: "verify-permission-shell",
  env: "verify-permission-env",
};

/** Product names are not translated; only "other" is. */
const AI_NAME: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  gemini_cli: "Gemini CLI",
  cursor: "Cursor",
};

async function readVerification(ref: { slug: string; version: string }): Promise<Verification | null | "unavailable"> {
  const client = createAnonClient();
  if (!client) return "unavailable";
  const { data, error } = await client.rpc("verify_module_version", {
    target_slug: ref.slug,
    target_version: ref.version,
  });
  if (error) return "unavailable";
  return (data as Verification | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const [{ ref }, t, locale] = await Promise.all([params, getTranslations("marketing"), getLocale()]);
  const parsed = parseRef(ref);
  return {
    title: t("verify-meta-title", { ref: parsed ? `${parsed.slug}@${parsed.version}` : ref }),
    description: t("verify-meta-description"),
    robots: { index: false, follow: false },
    ...publicPageMetadata({ path: `/verificar/${ref}`, locale }),
  };
}

export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const [{ ref }, t, locale] = await Promise.all([params, getTranslations("marketing"), getLocale()]);
  const parsed = parseRef(ref);
  const result = parsed ? await readVerification(parsed) : null;

  if (!parsed || result === null || result === "unavailable") {
    return (
      <Section spacing="compact">
        <SectionHeader
          as="h1"
          align="start"
          className="mx-0"
          eyebrow={t("verify-eyebrow")}
          title={result === "unavailable" ? t("verify-unavailable-title") : t("verify-not-found-title")}
          subtitle={result === "unavailable" ? t("verify-unavailable-body") : t("verify-not-found-body")}
        />
      </Section>
    );
  }

  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "—";
  const size =
    result.size_bytes >= 1024 * 1024
      ? `${(result.size_bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(result.size_bytes / 1024)).toLocaleString(locale)} KB`;
  const file = `${result.slug}-${result.version}.zip`;
  const reasonOf = (reason: Record<string, string> | string | undefined) =>
    typeof reason === "string" ? reason : (reason?.[locale] ?? reason?.["pt-BR"] ?? "");
  const withdrawn = result.status === "yanked";

  return (
    <>
      <Section spacing="compact">
        <SectionHeader
          as="h1"
          align="start"
          className="mx-0"
          eyebrow={t("verify-eyebrow")}
          title={t("verify-title", { module: result.slug, version: result.version })}
          subtitle={
            withdrawn
              ? t("verify-status-yanked", { date: date(result.yanked_at) })
              : t("verify-status-published", { date: date(result.published_at) })
          }
        />

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-grey-100 bg-background-paper flex flex-col gap-4 rounded-3xl border p-6">
            <dl className="m-0 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-text-secondary text-sm">{t("verify-sha256")}</dt>
                <dd className="text-text-primary m-0 font-mono text-sm leading-6 break-all">{result.sha256}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-text-secondary text-sm">{t("verify-size")}</dt>
                <dd className="text-text-primary m-0 text-base">{size}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-text-secondary text-sm">{t("verify-compatible")}</dt>
                <dd className="m-0 flex flex-wrap gap-2">
                  {result.compatible_ais.map((tool) => (
                    <span key={tool} className="bg-accent-2-light/10 text-text-primary rounded-full px-3 py-1 text-sm">
                      {AI_NAME[tool] ?? t("verify-ai-other")}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            {result.is_stable && !withdrawn ? (
              <p className="text-text-primary m-0 flex flex-row items-center gap-2 text-sm">
                <NiCheck size="small" className="text-accent-2" aria-hidden />
                {t("verify-stable")}
              </p>
            ) : null}
          </div>

          <div className="border-grey-100 bg-background-paper flex flex-col gap-4 rounded-3xl border p-6">
            <div className="text-text-primary flex flex-row items-center gap-2 font-semibold">
              <NiShieldCheck size="medium" className="text-primary" aria-hidden />
              <h2 className="m-0 text-base font-semibold">{t("verify-permissions")}</h2>
            </div>
            {result.permissions.length === 0 ? (
              <p className="text-text-secondary m-0 text-base leading-6">{t("verify-permissions-none")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {result.permissions.map((permission, index) => (
                  <li key={`${permission.kind}-${index}`} className="flex flex-col gap-0.5">
                    <span className="text-text-primary text-sm font-semibold">
                      {t(PERMISSION_LABEL[permission.kind ?? ""] ?? "verify-permission-other")}{" "}
                      <code className="text-text-secondary font-mono text-xs">{permission.scope}</code>
                    </span>
                    {reasonOf(permission.reason) ? (
                      <span className="text-text-secondary text-sm leading-5">{reasonOf(permission.reason)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section spacing="compact" background="paper">
        <SectionHeader align="start" className="mx-0" title={t("verify-how-title")} subtitle={t("verify-how-body")} />
        <TerminalFrame
          label={t("verify-terminal-label")}
          title={file}
          lines={[
            { text: `shasum -a 256 ${file}`, kind: "command" },
            { text: `Get-FileHash ${file} -Algorithm SHA256`, kind: "command" },
            // The plain output tone: the green success tone is too faint on
            // the deep body to read a 64-character checksum against.
            { text: result.sha256, kind: "output" },
          ]}
        />
      </Section>
    </>
  );
}
