import type { EmailLocale } from "../locale";
import { emailCopy as en } from "./en";
import { emailCopy as ptBR, type EmailCopy } from "./pt-BR";

const COPY: Record<EmailLocale, EmailCopy> = { "pt-BR": ptBR, en };

/** The copy of every e-mail in one language. */
export const emailCopyFor = (locale: EmailLocale): EmailCopy => COPY[locale];

export type { EmailCopy };
