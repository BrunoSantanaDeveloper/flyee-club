import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Box, Button } from "@mui/material";

import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";

/**
 * The first-run frame: `/onboarding` sits outside the dashboard, so there is
 * no nav rail or header competing with the three questions. It keeps one way
 * out: a guided flow with no exit is a cage, and every answer here can also
 * be given later in the settings.
 */
export default async function OnboardingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("product");
  return (
    <Box className="bg-waves flex min-h-screen w-full flex-col bg-cover bg-center">
      <Box
        component="header"
        className="mx-auto flex w-full max-w-3xl flex-none items-center justify-between gap-3 px-4 pt-5 pb-2"
      >
        <Logo classNameFull="h-[27px] w-auto" classNameMobile="hidden" />
        <Button
          LinkComponent={Link}
          href={DEFAULTS.appRoot}
          variant="text"
          color="grey"
          size="small"
          className="flex-none"
        >
          {t("onboarding-skip")}
        </Button>
      </Box>
      <Box component="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-10">
        {children}
      </Box>
    </Box>
  );
}
