"use client";
import { ContactResult, submitContact } from "./actions";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import SiteAlert from "@/components/site/alert";
import SiteButton from "@/components/site/button";
import { SiteField, SiteHelp, SiteInput, SiteLabel, SiteTextarea } from "@/components/site/field";

/** The same shape the server action accepts (contato/actions.ts). */
const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * The public contact form: name, e-mail and message. What is missing is said
 * under its field, from the first attempt to send on, in words a screen reader
 * reaches (it used to be an icon whose only text was a hover tooltip).
 */
export default function ContactForm({ initialMessage = "" }: { initialMessage?: string }) {
  const t = useTranslations("marketing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Prefilled from a known `?assunto=` so a visitor sent here from a campaign
  // page does not have to restate the context she was answering.
  const [message, setMessage] = useState(initialMessage);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ContactResult["status"] | null>(null);

  const errors = {
    name: name.trim() ? null : t("contact-required"),
    email: !email.trim() ? t("contact-required") : EMAIL.test(email.trim()) ? null : t("contact-invalid-email"),
    message: message.trim() ? null : t("contact-required"),
  };
  const shown = attempted ? errors : { name: null, email: null, message: null };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    setResult(null);
    if (errors.name || errors.email || errors.message) return;

    setSubmitting(true);
    const { status } = await submitContact({ name, email, message });
    setSubmitting(false);
    setResult(status);
    if (status === "sent") {
      setName("");
      setEmail("");
      setMessage("");
      setAttempted(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col">
      <SiteField>
        <SiteLabel htmlFor="name">{t("contact-name")}</SiteLabel>
        <SiteInput
          id="name"
          name="name"
          autoComplete="name"
          error={Boolean(shown.name)}
          aria-describedby={shown.name ? "name-error" : undefined}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {shown.name && (
          <SiteHelp id="name-error" error>
            {shown.name}
          </SiteHelp>
        )}
      </SiteField>

      <SiteField>
        <SiteLabel htmlFor="email">{t("contact-email")}</SiteLabel>
        <SiteInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={Boolean(shown.email)}
          aria-describedby={shown.email ? "email-error" : undefined}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {shown.email && (
          <SiteHelp id="email-error" error>
            {shown.email}
          </SiteHelp>
        )}
      </SiteField>

      <SiteField>
        <SiteLabel htmlFor="message">{t("contact-message")}</SiteLabel>
        <SiteTextarea
          id="message"
          name="message"
          rows={5}
          error={Boolean(shown.message)}
          aria-describedby={shown.message ? "message-error" : undefined}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        {shown.message && (
          <SiteHelp id="message-error" error>
            {shown.message}
          </SiteHelp>
        )}
      </SiteField>

      {result === "sent" && (
        <SiteAlert severity="success" className="mb-4">
          {t("contact-success")}
        </SiteAlert>
      )}
      {result === "not-configured" && (
        <SiteAlert severity="info" className="mb-4">
          {t("contact-not-configured")}
        </SiteAlert>
      )}
      {result === "error" && (
        <SiteAlert severity="error" className="mb-4">
          {t("contact-error")}
        </SiteAlert>
      )}

      <SiteButton type="submit" variant="contained" size="large" disabled={submitting}>
        {t("contact-submit")}
      </SiteButton>
    </form>
  );
}
