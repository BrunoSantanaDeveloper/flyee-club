"use client";

import { type ConfirmStatus, confirmWaitlist } from "../actions";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import Link from "@/components/marketing/locale-link";
import SiteAlert from "@/components/site/alert";
import SiteButton from "@/components/site/button";
import NiCheckSquare from "@/icons/nexture/ni-check-square";

/**
 * The confirmation itself: one button, pressed by a person. The link in the
 * e-mail only opens this page, because mail providers open every link they
 * deliver to scan it, and a GET that confirmed would sign up addresses whose
 * owners never asked.
 */
export default function ConfirmPanel({ pending }: { pending: boolean }) {
  const t = useTranslations("marketing");
  const [status, setStatus] = useState<ConfirmStatus | null>(pending ? null : "invalid");
  const [isPending, startTransition] = useTransition();

  if (status === "confirmed" || status === "resubscribed") {
    const titleKey = status === "resubscribed" ? "waitlist-resubscribed-title" : "waitlist-confirmed-title";
    return (
      <div
        role="status"
        className="border-grey-100 bg-background-paper mx-auto flex w-full max-w-xl flex-col items-start gap-3 rounded-3xl border p-6 md:p-8"
      >
        <span className="bg-accent-2-light/10 text-accent-2 flex h-11 w-11 items-center justify-center rounded-xl">
          <NiCheckSquare size="medium" />
        </span>
        <p className="font-display text-text-primary text-xl font-normal">{t(titleKey)}</p>
        <p className="text-text-secondary text-base leading-6">{t("waitlist-confirmed-body")}</p>
        <SiteButton variant="pastel" href="/blog">
          {t("waitlist-confirmed-cta")}
        </SiteButton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      {status === "invalid" && (
        <SiteAlert severity="warning" neutral className="w-full">
          {t("waitlist-confirm-invalid")}{" "}
          <Link href="/espera" className="text-primary-ink underline">
            {t("waitlist-confirm-again")}
          </Link>
        </SiteAlert>
      )}
      {status === "unavailable" && (
        <SiteAlert severity="error" neutral className="w-full">
          {t("waitlist-error-unavailable")}
        </SiteAlert>
      )}
      {status !== "invalid" && (
        <SiteButton
          size="large"
          variant="contained"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await confirmWaitlist();
              setStatus(result.status);
            })
          }
        >
          {isPending ? t("waitlist-submitting") : t("waitlist-confirm-button")}
        </SiteButton>
      )}
    </div>
  );
}
