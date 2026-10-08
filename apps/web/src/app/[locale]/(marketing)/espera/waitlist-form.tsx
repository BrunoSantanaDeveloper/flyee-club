"use client";

import { joinWaitlist, type WaitlistStatus } from "./actions";
import { WAITLIST_FORM_ID } from "./form-anchor";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";

import Link from "@/components/marketing/locale-link";
import SiteAlert from "@/components/site/alert";
import SiteButton from "@/components/site/button";
import { SiteCheckbox, SiteField, SiteHelp, SiteInput, SiteLabel, SiteSelect } from "@/components/site/field";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import { readSegmentCookie, rememberSegment, trackSiteEvent } from "@/lib/site-events";

/** Segment value (enum member_segment) → its label key. "" = not declared. */
const SEGMENT_OPTIONS = [
  { value: "negocio", labelKey: "waitlist-segment-business" },
  { value: "agencia", labelKey: "waitlist-segment-agency" },
  { value: "produto", labelKey: "waitlist-segment-product" },
  { value: "dev", labelKey: "waitlist-segment-dev" },
  { value: "outro", labelKey: "waitlist-segment-other" },
] as const;

const ERROR_KEY: Partial<Record<WaitlistStatus, string>> = {
  rate_limited: "waitlist-error-rate",
  unavailable: "waitlist-error-unavailable",
  error: "waitlist-error-generic",
};

/** The same shape the server action accepts (espera/actions.ts), so the two never disagree. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The waitlist sign-up: e-mail, an optional segment (it decides what gets
 * built first, docs/PRODUCT.md) and the newsletter consent. The answer never
 * says whether the address was already on the list.
 *
 * Three fields and two rules, so it keeps its own state: a form library and a
 * schema validator on the page every pre-launch button leads to were most of
 * its script.
 */
export default function WaitlistForm() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  // Errors show from the first attempt to send on, then follow what is typed.
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<"email" | "consent" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<WaitlistStatus | null>(null);
  const prefilled = useRef(false);

  // The segment declared on the site (a link, a click) pre-fills the select once.
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const declared = readSegmentCookie();
    if (declared) setSegment((current) => current || declared);
  }, []);

  const emailValid = EMAIL.test(email.trim());

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    setServerError(null);
    setFailure(null);
    if (!emailValid || !consent) return;

    setSubmitting(true);
    const { status } = await joinWaitlist({ email, segment, consent, website, locale });
    setSubmitting(false);
    if (status === "sent") {
      setSentTo(email.trim());
      setEmail("");
      setSegment("");
      setConsent(false);
      setAttempted(false);
      return;
    }
    if (status === "invalid_email") setServerError("email");
    else if (status === "consent_required") setServerError("consent");
    else setFailure(status);
  };

  if (sentTo) {
    return (
      <div
        id={WAITLIST_FORM_ID}
        role="status"
        className="border-grey-100 bg-background-paper flex w-full flex-col gap-3 rounded-3xl border p-6"
      >
        <span className="bg-accent-2-light/10 text-accent-2 flex h-11 w-11 items-center justify-center rounded-xl">
          <NiCheckSquare size="medium" />
        </span>
        <p className="font-display text-text-primary text-xl font-normal">{t("waitlist-sent-title")}</p>
        <p className="text-text-secondary text-base leading-6">{t("waitlist-sent-body", { email: sentTo })}</p>
        <div>
          <SiteButton variant="text" onClick={() => setSentTo(null)}>
            {t("waitlist-sent-again")}
          </SiteButton>
        </div>
      </div>
    );
  }

  const emailError = serverError === "email" || (attempted && !emailValid) ? t("waitlist-error-email") : null;
  const consentError = serverError === "consent" || (attempted && !consent) ? t("waitlist-error-consent") : null;
  const failureKey = failure ? ERROR_KEY[failure] : undefined;

  return (
    <form id={WAITLIST_FORM_ID} noValidate onSubmit={submit} className="flex w-full max-w-md flex-col gap-1">
      <SiteField>
        <SiteLabel htmlFor="waitlist-email">{t("waitlist-email-label")}</SiteLabel>
        <SiteInput
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("waitlist-email-placeholder")}
          error={Boolean(emailError)}
          aria-describedby={emailError ? "waitlist-email-error" : undefined}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setServerError(null);
          }}
        />
        {emailError && (
          <SiteHelp id="waitlist-email-error" error>
            {emailError}
          </SiteHelp>
        )}
      </SiteField>

      <SiteField>
        <SiteLabel htmlFor="waitlist-segment">{t("waitlist-segment-label")}</SiteLabel>
        <SiteSelect
          id="waitlist-segment"
          name="segment"
          value={segment}
          onChange={(event) => {
            const chosen = event.target.value;
            setSegment(chosen);
            // Choosing a segment here is the same declaration a segment card makes.
            if (chosen) {
              rememberSegment(chosen);
              trackSiteEvent("segment_click", { segment: chosen, location: "waitlist" });
            }
          }}
        >
          <option value="">{t("waitlist-segment-none")}</option>
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </SiteSelect>
      </SiteField>

      {/* Honeypot: hidden from people and from assistive technology. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
      />

      <SiteField className="mt-1">
        <SiteCheckbox
          name="consent"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            setServerError(null);
          }}
          // Named by reference: the wrapping label alone is unnamed while the
          // hero entrance still hides its text.
          aria-labelledby="waitlist-consent-label"
          aria-describedby="waitlist-consent-privacy"
          label={
            <span id="waitlist-consent-label" className="text-text-secondary text-sm leading-5">
              {t("waitlist-consent")}
            </span>
          }
        />
        <p id="waitlist-consent-privacy" className="text-text-secondary ml-8 text-sm leading-5">
          <Link href="/legal/privacidade" className="text-primary-ink underline">
            {t("waitlist-consent-privacy")}
          </Link>
        </p>
        {consentError && (
          <SiteHelp error className="ml-8">
            {consentError}
          </SiteHelp>
        )}
      </SiteField>

      {failureKey && (
        <SiteAlert severity="error" neutral className="mt-2">
          {t(failureKey)}
        </SiteAlert>
      )}

      <SiteButton type="submit" size="large" variant="contained" className="mt-3 self-start" disabled={submitting}>
        {submitting ? t("waitlist-submitting") : t("cta-waitlist")}
      </SiteButton>
    </form>
  );
}
