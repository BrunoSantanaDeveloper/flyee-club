"use client";

import { joinWaitlist, type WaitlistStatus } from "./actions";
import { WAITLIST_FORM_ID } from "./form-anchor";
import { useFormik } from "formik";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import * as Yup from "yup";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Input,
  MenuItem,
  Select,
} from "@mui/material";

import Link from "@/components/marketing/locale-link";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import { readSegmentCookie, rememberSegment, trackSiteEvent } from "@/lib/site-events";
import { profileSegmentFor } from "@/lib/site-segment";

/** Segment value (enum member_segment) → its label key. "" = not declared. */
const SEGMENT_OPTIONS = [
  { value: "produto_proprio", labelKey: "waitlist-segment-own-product" },
  { value: "freelancer_agencia", labelKey: "waitlist-segment-agency" },
  { value: "profissional_ia", labelKey: "waitlist-segment-ai-professional" },
  { value: "dev", labelKey: "waitlist-segment-dev" },
  { value: "outro", labelKey: "waitlist-segment-other" },
] as const;

const ERROR_KEY: Partial<Record<WaitlistStatus, string>> = {
  rate_limited: "waitlist-error-rate",
  unavailable: "waitlist-error-unavailable",
  error: "waitlist-error-generic",
};

/**
 * The waitlist sign-up: e-mail, an optional segment (it decides what gets
 * built first, docs/PRODUCT.md) and the newsletter consent. The answer never
 * says whether the address was already on the list.
 */
export default function WaitlistForm() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<WaitlistStatus | null>(null);
  const prefilled = useRef(false);

  const formik = useFormik({
    initialValues: { email: "", segment: "", consent: false, website: "" },
    validationSchema: Yup.object({
      email: Yup.string().trim().email(t("waitlist-error-email")).required(t("waitlist-error-email")),
      consent: Yup.boolean().oneOf([true], t("waitlist-error-consent")),
    }),
    validateOnBlur: false,
    onSubmit: async (values, helpers) => {
      setFailure(null);
      const { status } = await joinWaitlist({ ...values, locale });
      if (status === "sent") {
        setSentTo(values.email.trim());
        helpers.resetForm();
        return;
      }
      if (status === "invalid_email") helpers.setFieldError("email", t("waitlist-error-email"));
      else if (status === "consent_required") helpers.setFieldError("consent", t("waitlist-error-consent"));
      else setFailure(status);
    },
  });

  // The segment declared on the site (a link, a click) pre-fills the select once.
  const { setFieldValue, values } = formik;
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const declared = profileSegmentFor(readSegmentCookie());
    if (declared && !values.segment) void setFieldValue("segment", declared);
  }, [setFieldValue, values.segment]);

  if (sentTo) {
    return (
      <Box
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
          <Button variant="text" color="primary" onClick={() => setSentTo(null)}>
            {t("waitlist-sent-again")}
          </Button>
        </div>
      </Box>
    );
  }

  const emailError = formik.touched.email && formik.errors.email ? formik.errors.email : null;
  const consentError = formik.submitCount > 0 && formik.errors.consent ? formik.errors.consent : null;
  const failureKey = failure ? ERROR_KEY[failure] : undefined;

  return (
    <Box
      id={WAITLIST_FORM_ID}
      component="form"
      noValidate
      onSubmit={formik.handleSubmit}
      className="flex w-full max-w-md flex-col gap-1"
    >
      <FormControl className="outlined" variant="standard" size="small" error={Boolean(emailError)}>
        <FormLabel component="label" htmlFor="waitlist-email">
          {t("waitlist-email-label")}
        </FormLabel>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("waitlist-email-placeholder")}
          inputProps={{ inputMode: "email", "aria-describedby": emailError ? "waitlist-email-error" : undefined }}
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
        {emailError && <FormHelperText id="waitlist-email-error">{emailError}</FormHelperText>}
      </FormControl>

      <FormControl className="outlined" variant="standard" size="small">
        <FormLabel component="label" id="waitlist-segment-label" htmlFor="waitlist-segment">
          {t("waitlist-segment-label")}
        </FormLabel>
        <Select
          id="waitlist-segment"
          name="segment"
          labelId="waitlist-segment-label"
          displayEmpty
          value={formik.values.segment}
          onChange={(event) => {
            formik.handleChange(event);
            // Choosing a segment here is the same declaration a segment card makes.
            const chosen = String(event.target.value ?? "");
            if (chosen) {
              rememberSegment(chosen);
              trackSiteEvent("segment_click", { segment: chosen, location: "waitlist" });
            }
          }}
          renderValue={(value) => {
            const option = SEGMENT_OPTIONS.find((candidate) => candidate.value === value);
            return option ? t(option.labelKey) : t("waitlist-segment-none");
          }}
        >
          <MenuItem value="">{t("waitlist-segment-none")}</MenuItem>
          {SEGMENT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Honeypot: hidden from people and from assistive technology. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={formik.values.website}
        onChange={formik.handleChange}
      />

      <FormControl error={Boolean(consentError)} className="mt-1">
        <FormControlLabel
          className="items-start"
          control={
            <Checkbox
              name="consent"
              checked={formik.values.consent}
              onChange={formik.handleChange}
              className="-mt-1.5"
              slotProps={{
                input: {
                  // Named by reference: the wrapping label alone is unnamed while
                  // the hero entrance still hides its text.
                  "aria-labelledby": "waitlist-consent-label",
                  "aria-describedby": "waitlist-consent-privacy",
                },
              }}
            />
          }
          label={
            <span id="waitlist-consent-label" className="text-text-secondary text-sm leading-5">
              {t("waitlist-consent")}
            </span>
          }
        />
        <p id="waitlist-consent-privacy" className="text-text-secondary ml-8 text-sm leading-5">
          <Link href="/legal/privacidade" className="text-primary underline">
            {t("waitlist-consent-privacy")}
          </Link>
        </p>
        {consentError && <FormHelperText className="ml-8">{consentError}</FormHelperText>}
      </FormControl>

      {failureKey && (
        <Alert severity="error" className="neutral bg-background-paper/60! mt-2">
          {t(failureKey)}
        </Alert>
      )}

      <Button
        type="submit"
        size="large"
        variant="contained"
        color="primary"
        className="mt-3 self-start"
        disabled={formik.isSubmitting}
      >
        {formik.isSubmitting ? t("waitlist-submitting") : t("cta-waitlist")}
      </Button>
    </Box>
  );
}
