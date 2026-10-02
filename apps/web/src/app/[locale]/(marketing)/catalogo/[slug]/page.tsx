import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import BreadcrumbJsonLd from "@/components/marketing/breadcrumb-json-ld";
import Cta from "@/components/marketing/cta";
import LocaleLink from "@/components/marketing/locale-link";
import MarkdownProse from "@/components/marketing/markdown-prose";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import TerminalFrame from "@/components/marketing/terminal-frame";
import { TONE, trailTone } from "@/components/marketing/tone";
import { localizeHref } from "@/i18n/routing";
import NiKey from "@/icons/nexture/ni-key";
import NiPlay from "@/icons/nexture/ni-play";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import type { CatalogLocale } from "@/lib/catalog/links";
import { loadPublicModule, type PublicModule } from "@/lib/catalog/public";
import { getLaunchStage, primaryCtaFor } from "@/lib/launch";
import { publicPageMetadata, type Translations } from "@/lib/seo";
import { cn } from "@/lib/utils";

const ENGLISH = "en";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** Product names are not translated. */
const AI_NAME: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  gemini_cli: "Gemini CLI",
  cursor: "Cursor",
};

const TYPE_KEY: Record<string, string> = {
  skill: "catalog-type-skill",
  workflow: "catalog-type-workflow",
  framework: "catalog-type-framework",
  tool: "catalog-type-tool",
};

const PERMISSION_KEY: Record<string, string> = {
  "fs:read": "verify-permission-fs-read",
  "fs:write": "verify-permission-fs-write",
  network: "verify-permission-network",
  shell: "verify-permission-shell",
  env: "verify-permission-env",
};

type Permission = { kind?: string; scope?: string; reason?: Record<string, string> | string };
type Credential = {
  name?: string;
  env?: string;
  url?: string;
  required?: boolean;
  purpose?: Record<string, string> | string;
};

const catalogLocaleOf = (locale: string): CatalogLocale => (locale === "en" ? "en" : "pt-BR");

/** A text the manifest may store per language or as one string. */
const textIn = (value: Record<string, string> | string | undefined, locale: string) =>
  typeof value === "string" ? value : (value?.[locale] ?? value?.["pt-BR"] ?? "");

const translationsOf = (module: PublicModule): Translations =>
  Object.fromEntries(module.languages.map((language) => [language, `/catalogo/${module.slug}`]));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, t, locale] = await Promise.all([params, getTranslations("marketing"), getLocale()]);
  const result = SLUG.test(slug) ? await loadPublicModule(slug, catalogLocaleOf(locale)) : null;
  if (result?.kind !== "ready") {
    return { title: t("catalog-meta-title"), robots: { index: false, follow: true } };
  }
  const { module } = result;
  const name = module.name ?? module.slug;
  const description = module.summary ?? t("module-meta-description", { name });
  return {
    title: t("module-meta-title", { name, type: t(TYPE_KEY[module.type] ?? "catalog-type-tool") }),
    description: description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description,
    ...publicPageMetadata({ path: `/catalogo/${module.slug}`, locale, translations: translationsOf(module) }),
  };
}

/**
 * /catalogo/<slug> (EN /catalog/<slug>): one published module as anybody may
 * read it — what it does, the command that installs it, what it can access and
 * which keys it asks for, every release with its changelog and verification
 * page, and the lessons (the videos themselves stay in the dashboard).
 *
 * A module that is not published is a 404. A module with no English text sends
 * the English address to the English catalog instead of serving Portuguese.
 */
export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, stage] = await Promise.all([
    params,
    getTranslations("marketing"),
    getLocale(),
    getLaunchStage(),
  ]);
  if (!SLUG.test(slug)) notFound();
  const result = await loadPublicModule(slug, catalogLocaleOf(locale));
  if (result.kind === "missing") notFound();
  if (result.kind === "untranslated") redirect(localizeHref("/catalogo", locale));

  const cta = primaryCtaFor(stage);
  const isOpen = stage === "open";
  const primary = { label: t(cta.labelKey), href: cta.href };
  const back = { label: t("module-back"), href: "/catalogo" };

  if (result.kind === "unavailable") {
    return (
      <>
        <Section decor="glow">
          <SectionHeader
            as="h1"
            eyebrow={t("catalog-eyebrow")}
            title={t("catalog-unavailable-title")}
            subtitle={t("catalog-unavailable-body")}
          />
        </Section>
        <Cta decor="orbit" title={t("catalog-cta-title")} cta={primary} secondaryCta={back} />
      </>
    );
  }

  const { module } = result;
  const name = module.name ?? module.slug;
  const tone = TONE[trailTone(module.trail, 0)];
  const latest = module.latest;
  const permissions = (latest?.permissions ?? []) as Permission[];
  const credentials = (module.external_credentials ?? []) as Credential[];
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "";
  const minutes = (seconds: number | null) => (seconds ? Math.max(1, Math.round(seconds / 60)) : null);

  return (
    <>
      <BreadcrumbJsonLd
        home={t("nav-home")}
        trail={[
          { name: t("nav-catalog"), path: "/catalogo" },
          { name, path: `/catalogo/${module.slug}` },
        ]}
      />

      <Section decor="glow">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <SectionHeader
              as="h1"
              align="start"
              className="mx-0 mb-0 md:mb-0"
              eyebrow={module.trailName ?? t("catalog-eyebrow")}
              title={name}
              subtitle={module.summary ?? undefined}
            />
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t("module-facts-label")}>
              <li className={cn("text-text-primary rounded-full px-3 py-1 text-sm font-semibold", tone.softBg)}>
                {t(TYPE_KEY[module.type] ?? "catalog-type-tool")}
              </li>
              {module.is_free_sample ? (
                <li className="bg-grey-50 text-text-primary rounded-full px-3 py-1 text-sm font-semibold">
                  {t("catalog-free-sample")}
                </li>
              ) : null}
              {module.compatible_ais.map((ai) => (
                <li
                  key={ai}
                  className="border-grey-100 text-text-primary rounded-lg border px-2.5 py-1 font-mono text-xs"
                >
                  {AI_NAME[ai] ?? t("catalog-ai-other")}
                </li>
              ))}
            </ul>
            <p className="text-text-secondary m-0 text-sm leading-6">
              {t(module.is_free_sample ? "module-access-free" : "module-access-plan")}{" "}
              <LocaleLink href="/planos" className="text-text-primary font-semibold underline">
                {t("module-access-link")}
              </LocaleLink>
            </p>
          </div>
          <TerminalFrame
            glow
            title={t("catalog-terminal-title")}
            label={t("module-terminal-label", { name })}
            lines={
              latest
                ? [
                    { kind: "command", text: `npx flyee add ${module.slug}` },
                    {
                      kind: "success",
                      text: t("catalog-terminal-installed", { module: module.slug, version: latest.version }),
                    },
                    { kind: "success", text: t("catalog-terminal-verified") },
                    { kind: "muted", text: t("catalog-terminal-update") },
                  ]
                : [
                    { kind: "command", text: `npx flyee add ${module.slug}` },
                    { kind: "muted", text: t("module-terminal-no-version") },
                  ]
            }
          />
        </div>
      </Section>

      {module.description ? (
        <Section spacing="compact">
          <SectionHeader align="start" className="mx-0" title={t("module-description-title")} />
          <MarkdownProse className="mx-0">{module.description}</MarkdownProse>
        </Section>
      ) : null}

      <Section background="paper">
        <SectionHeader
          align="start"
          className="mx-0"
          eyebrow={t("module-access-eyebrow")}
          title={t("module-access-title")}
          subtitle={t("module-access-subtitle")}
        />
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-grey-100 bg-background flex flex-col gap-4 rounded-3xl border p-6">
            <h3 className="text-text-primary font-heading m-0 flex flex-row items-center gap-2 text-xl font-normal">
              <NiShieldCheck size="medium" className={tone.text} aria-hidden />
              {t("module-permissions-title")}
            </h3>
            {!latest ? (
              <p className="text-text-secondary m-0 text-base leading-6">{t("module-terminal-no-version")}</p>
            ) : permissions.length === 0 ? (
              <p className="text-text-secondary m-0 text-base leading-6">{t("verify-permissions-none")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {permissions.map((permission, index) => (
                  <li key={`${permission.kind}-${index}`} className="flex flex-col gap-0.5">
                    <span className="text-text-primary text-sm font-semibold">
                      {t(PERMISSION_KEY[permission.kind ?? ""] ?? "verify-permission-other")}{" "}
                      <code className="text-text-secondary font-mono text-xs">{permission.scope}</code>
                    </span>
                    {textIn(permission.reason, locale) ? (
                      <span className="text-text-secondary text-sm leading-5">{textIn(permission.reason, locale)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-grey-100 bg-background flex flex-col gap-4 rounded-3xl border p-6">
            <h3 className="text-text-primary font-heading m-0 flex flex-row items-center gap-2 text-xl font-normal">
              <NiKey size="medium" className={tone.text} aria-hidden />
              {t("module-credentials-title")}
            </h3>
            {credentials.length === 0 ? (
              <p className="text-text-secondary m-0 text-base leading-6">{t("module-credentials-none")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {credentials.map((credential, index) => (
                  <li key={`${credential.env ?? credential.name}-${index}`} className="flex flex-col gap-0.5">
                    <span className="text-text-primary text-sm font-semibold">
                      {credential.name ?? credential.env}{" "}
                      <span className="text-text-secondary text-xs font-normal">
                        {t(credential.required === false ? "module-credential-optional" : "module-credential-required")}
                      </span>
                    </span>
                    {textIn(credential.purpose, locale) ? (
                      <span className="text-text-secondary text-sm leading-5">
                        {textIn(credential.purpose, locale)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {module.versions.length > 0 ? (
        <Section>
          <SectionHeader
            align="start"
            className="mx-0"
            eyebrow={t("module-versions-eyebrow")}
            title={t("module-versions-title")}
            subtitle={t("module-versions-subtitle")}
          />
          <ol className="border-grey-100 m-0 flex list-none flex-col border-t p-0">
            {module.versions.map((version) => {
              const withdrawn = version.status === "yanked";
              return (
                <li
                  key={version.version}
                  className="border-grey-100 grid grid-cols-1 gap-3 border-b py-5 md:grid-cols-[10rem_1fr_auto] md:gap-8"
                >
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="text-text-primary font-mono text-base">{version.version}</span>
                    {version.is_stable && !withdrawn ? (
                      <span className={cn("text-text-primary rounded-full px-2.5 py-0.5 text-xs", tone.softBg)}>
                        {t("module-version-stable")}
                      </span>
                    ) : null}
                    {withdrawn ? (
                      <span className="bg-grey-50 text-text-primary rounded-full px-2.5 py-0.5 text-xs">
                        {t("module-version-yanked-badge")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-text-secondary text-sm">
                      {withdrawn
                        ? t("module-version-yanked", { date: date(version.yanked_at) })
                        : t("module-version-published", { date: date(version.published_at) })}
                    </span>
                    {version.changelog ? (
                      <p className="text-text-primary m-0 text-base leading-6 whitespace-pre-line">
                        {version.changelog}
                      </p>
                    ) : null}
                    {withdrawn && version.yank_reason ? (
                      <p className="text-text-secondary m-0 text-sm leading-5">
                        {t("module-version-reason", { reason: version.yank_reason })}
                      </p>
                    ) : null}
                  </div>
                  <LocaleLink
                    href={`/verificar/${encodeURIComponent(`${module.slug}@${version.version}`)}`}
                    className="text-text-primary self-start text-sm font-semibold underline"
                    prefetch={false}
                  >
                    {t("module-version-verify")}
                  </LocaleLink>
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}

      {module.lessons.length > 0 ? (
        <Section background="paper" spacing="compact">
          <SectionHeader
            align="start"
            className="mx-0"
            eyebrow={t("module-lessons-eyebrow")}
            title={t("module-lessons-title")}
            subtitle={t("module-lessons-subtitle")}
          />
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {module.lessons.map((lesson, index) => (
              <li
                key={`${lesson.depth}-${lesson.locale}-${index}`}
                className="border-grey-100 bg-background flex flex-row items-start gap-4 rounded-3xl border p-5"
              >
                <span
                  className={cn(
                    "inline-grid h-11 w-11 flex-none place-items-center rounded-xl",
                    tone.softBg,
                    tone.text,
                  )}
                >
                  <NiPlay size="medium" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-text-primary text-base font-semibold">{lesson.title}</span>
                  <span className="text-text-secondary text-sm">
                    {[
                      t(lesson.depth === "abrir_o_capo" ? "module-lesson-depth-hood" : "module-lesson-depth-use"),
                      t(lesson.locale === ENGLISH ? "module-lesson-locale-en" : "module-lesson-locale-pt"),
                      minutes(lesson.duration_seconds)
                        ? t("module-lesson-minutes", { count: minutes(lesson.duration_seconds) ?? 0 })
                        : null,
                      lesson.is_advanced ? t("module-lesson-advanced") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Cta
        decor="orbit"
        title={t("module-cta-title", { name })}
        subtitle={t(isOpen ? "module-cta-subtitle-open" : "module-cta-subtitle-waitlist")}
        cta={primary}
        secondaryCta={back}
      />
    </>
  );
}
