/**
 * What the header bell says, in both languages.
 *
 * A notification is stored as text (`notifications.title` / `body`), so the
 * language is chosen when it is written: `notifyLocalized`
 * (lib/notifications.ts) reads each recipient's `profiles.locale` and picks the
 * copy here. Portuguese is the structural source: `BellCopy` is its type and
 * the English object has to match it.
 *
 * The rules are the e-mails' (packages/email/src/copy/pt-BR.ts): the site's
 * vocabulary (app, guia, acesso), a plan called by the name it has in the data
 * and never by a word written here, no sentence that depends on the gender of
 * that name, and dates that arrive already formatted for the reader.
 */

export type BellLocale = "pt-BR" | "en";

/** Anything that is not English reads Portuguese, the default language. */
export const toBellLocale = (value: string | null | undefined): BellLocale => (value === "en" ? "en" : "pt-BR");

export type BellText = { title: string; body: string };

const ptBR = {
  /** A new account is confirmed. */
  welcome: (): BellText => ({
    title: "Sua conta está criada",
    body: "Escolha o seu acesso e instale o primeiro app.",
  }),

  /** A subscription went live. */
  planActive: (plan: string): BellText => ({
    title: "Pagamento confirmado",
    body: `${plan} já vale na sua conta.`,
  }),

  /** The one-time access was granted. `until` is the end of its term, already formatted; null when it has none. */
  accessGranted: (plan: string, until: string | null): BellText => ({
    title: "Acesso liberado",
    body: until
      ? `Pagamento confirmado: ${plan}. Os apps da loja e as atualizações estão liberados na sua conta até ${until}.`
      : `Pagamento confirmado: ${plan}. Os apps da loja e as atualizações estão liberados na sua conta.`,
  }),

  /** The term of a one-time access ran out and nothing else keeps the store open. */
  accessEnded: (plan: string, date: string): BellText => ({
    title: "Seu acesso terminou",
    body: `${plan} terminou em ${date}. Os apps já instalados continuam funcionando; as versões novas deixam de chegar. Para renovar, compre o acesso de novo em Cobrança.`,
  }),

  /** A late payment went through. */
  paymentRecovered: (): BellText => ({
    title: "Pagamento confirmado",
    body: "Sua assinatura está em dia e seu acesso segue liberado.",
  }),

  /** A charge failed. `days` is the grace period, 0 when there is none. */
  paymentFailed: (days: number): BellText => ({
    title: "Não conseguimos processar seu pagamento",
    body:
      days > 0
        ? `Atualize sua forma de pagamento em até ${days === 1 ? "1 dia" : `${days} dias`} para não interromper seu acesso. Os apps já instalados continuam funcionando.`
        : "Atualize sua forma de pagamento para manter seu acesso. Os apps já instalados continuam funcionando.",
  }),

  /** A subscription ended. `keepsAccess` is true when another purchase still unlocks the store. */
  subscriptionEnded: (plan: string, keepsAccess: boolean): BellText => ({
    title: "Sua assinatura foi encerrada",
    body: keepsAccess
      ? `${plan} terminou. O acesso à loja e às atualizações continua.`
      : `${plan} terminou. Os apps já instalados continuam funcionando; as versões novas deixam de chegar.`,
  }),

  /** A paid period that does not renew is about to end. */
  termEnding: (plan: string, date: string): BellText => ({
    title: "O período pago está terminando",
    body: `O período pago de ${plan} vai até ${date}. Para continuar depois dessa data, faça uma nova compra em Cobrança.`,
  }),

  /** A machine's connection is about to expire. `days` is rounded up: 1 means "within 24 hours". */
  tokenReminder: (device: string | null, days: number): BellText => ({
    title:
      days <= 1
        ? "A conexão do seu computador vence em até 24 horas"
        : `A conexão do seu computador vence em ${days} dias`,
    body: device
      ? `No computador "${device}", peça à sua IA para atualizar os apps do flyee e o prazo se renova por mais 30 dias.`
      : "Peça à sua IA para atualizar os apps do flyee e o prazo se renova por mais 30 dias.",
  }),

  /** Installed apps have a newer version. */
  updatesAvailable: (count: number): BellText => ({
    title: count === 1 ? "1 app seu tem versão nova" : `${count} apps seus têm versão nova`,
    body: "Peça à sua IA para atualizar os apps do flyee: ela atualiza todos de uma vez.",
  }),

  /**
   * A live session the member registered for. `when` is already in the reader's
   * time zone. The wording is true anywhere inside the window each reminder is
   * sent in (lib/meeting-email-kinds.ts).
   */
  meetingDay: (title: string, when: string | null): BellText => ({
    title: `Nas próximas 24 horas: ${title}`,
    body: when ? `Quando: ${when}. A sala abre 15 minutos antes.` : "A sala abre 15 minutos antes.",
  }),
  meetingHour: (title: string): BellText => ({
    title: `Começa em menos de uma hora: ${title}`,
    body: "A sala abre 15 minutos antes do início.",
  }),
  meetingRecording: (title: string): BellText => ({
    title: `A gravação está disponível: ${title}`,
    body: "O encontro terminou e a gravação já está no painel.",
  }),

  /** Support opened the account. `operator` is the name of who did, when known. */
  supportAccess: (operator: string | null, reason: string, minutes: number): BellText => ({
    title: "Acesso de suporte à sua conta",
    body: `${operator ?? "A equipe de suporte"} acessou sua conta para investigar: "${reason}". O acesso é somente leitura e expira em ${minutes} minutos.`,
  }),
};

export type BellCopy = typeof ptBR;

const en: BellCopy = {
  welcome: () => ({
    title: "Your account is ready",
    body: "Choose your access and install your first app.",
  }),

  planActive: (plan) => ({
    title: "Payment confirmed",
    body: `${plan} is live on your account.`,
  }),

  accessGranted: (plan, until) => ({
    title: "Your access is active",
    body: until
      ? `Payment confirmed: ${plan}. Every app in the store and its updates are on your account until ${until}.`
      : `Payment confirmed: ${plan}. Every app in the store and its updates are on your account.`,
  }),

  accessEnded: (plan, date) => ({
    title: "Your access has ended",
    body: `${plan} ended on ${date}. The apps you installed keep working; new versions stop arriving. To renew, buy the access again under Billing.`,
  }),

  paymentRecovered: () => ({
    title: "Payment confirmed",
    body: "Your subscription is up to date and your access continues.",
  }),

  paymentFailed: (days) => ({
    title: "We could not process your payment",
    body:
      days > 0
        ? `Update your payment method within ${days === 1 ? "1 day" : `${days} days`} to keep your access. The apps you installed keep working.`
        : "Update your payment method to keep your access. The apps you installed keep working.",
  }),

  subscriptionEnded: (plan, keepsAccess) => ({
    title: "Your subscription has ended",
    body: keepsAccess
      ? `${plan} has ended. Access to the store and its updates continues.`
      : `${plan} has ended. The apps you installed keep working; new versions stop arriving.`,
  }),

  termEnding: (plan, date) => ({
    title: "The paid period is ending",
    body: `The paid period of ${plan} runs until ${date}. To continue after that date, make a new purchase under Billing.`,
  }),

  tokenReminder: (device, days) => ({
    title:
      days <= 1
        ? "Your computer's connection expires within 24 hours"
        : `Your computer's connection expires in ${days} days`,
    body: device
      ? `On your computer "${device}", ask your AI to update the flyee apps and the term renews for another 30 days.`
      : "Ask your AI to update the flyee apps and the term renews for another 30 days.",
  }),

  updatesAvailable: (count) => ({
    title: count === 1 ? "1 of your apps has a new version" : `${count} of your apps have a new version`,
    body: "Ask your AI to update the flyee apps: it updates them all at once.",
  }),

  meetingDay: (title, when) => ({
    title: `Within 24 hours: ${title}`,
    body: when ? `When: ${when}. The room opens 15 minutes before.` : "The room opens 15 minutes before.",
  }),
  meetingHour: (title) => ({
    title: `Starting in less than an hour: ${title}`,
    body: "The room opens 15 minutes before the start.",
  }),
  meetingRecording: (title) => ({
    title: `The recording is available: ${title}`,
    body: "The session has ended and the recording is now in the dashboard.",
  }),

  supportAccess: (operator, reason, minutes) => ({
    title: "Support access to your account",
    body: `${operator ?? "The support team"} opened your account to look into: "${reason}". The access is read-only and expires in ${minutes} minutes.`,
  }),
};

const COPY: Record<BellLocale, BellCopy> = { "pt-BR": ptBR, en };

/** The bell's copy in one language. */
export const bellCopyFor = (locale: BellLocale): BellCopy => COPY[locale];
