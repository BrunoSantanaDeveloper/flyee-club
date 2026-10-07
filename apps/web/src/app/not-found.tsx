import { getLocale, getTranslations } from "next-intl/server";

import Logo from "@/components/logo/logo";
import SiteButton from "@/components/site/button";
import { localizeHref } from "@/i18n/routing";
import NiHome from "@/icons/nexture/ni-home";

/**
 * The 404 of every address outside the member area: a page that called
 * notFound() (an app, a help article or a post that does not exist) and any
 * address no route matches. It is read in the language of the address and
 * leads back to the site, never to the member home, where a visitor without an
 * account would land on sign-in. The member area has its own,
 * app/(dashboard)/not-found.tsx.
 *
 * It renders under the root layout alone, which mounts no provider (no MUI, no
 * messages for client components), so it is a server component built on the
 * site primitives, and its two links are plain anchors with the address of the
 * language already written in.
 */
export default async function NotFound() {
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="bg-background-paper shadow-darker-xs min-h-[400px] max-w-full min-w-full items-center justify-center rounded-4xl bg-[url(/images/misc/error-background-light.svg)] bg-center py-14 md:min-w-[800px] dark:bg-[url(/images/misc/error-background-dark.svg)]">
        <div className="flex flex-col gap-4 px-8 sm:px-14">
          <div className="mb-14 flex justify-center">
            <Logo classNameMobile="hidden h-9 w-auto" />
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="font-heading text-text-primary m-0 text-5xl font-bold">{t("not-found-title")}</h1>
            <p className="text-text-secondary m-0 text-base leading-5">{t("not-found-body")}</p>
            <div className="flex flex-row flex-wrap justify-center gap-2">
              <SiteButton plain variant="contained" startIcon={<NiHome />} href={localizeHref("/", locale)}>
                {t("not-found-home")}
              </SiteButton>
              <SiteButton plain variant="outlined" href={localizeHref("/catalogo", locale)}>
                {t("not-found-catalog")}
              </SiteButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
