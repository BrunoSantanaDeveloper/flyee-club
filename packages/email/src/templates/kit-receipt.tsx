import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type KitReceiptLocale = "pt-BR" | "en";

export type KitReceiptEmailProps = {
  locale: KitReceiptLocale;
  /** The dashboard address the button opens. */
  appUrl: string;
  name?: string | null;
  /** What was paid, already formatted ("R$ 97", "$29"). */
  amountLabel: string;
  /** BRL purchases get their NFS-e from Asaas; the e-mail says where it comes from. */
  fiscalNote: boolean;
};

/**
 * The text of the receipt per language. Kept next to the template until
 * phase 8 of docs/PLANO-IMPLEMENTACAO.md moves every e-mail's copy to
 * `copy/{pt-BR,en}.ts`.
 */
export const KIT_RECEIPT_COPY: Record<
  KitReceiptLocale,
  {
    subject: string;
    preview: string;
    heading: string;
    greeting: (name: string | null | undefined) => string;
    body: (amount: string) => string;
    next: string;
    steps: [string, string];
    button: string;
    fiscal: string;
    keep: string;
  }
> = {
  "pt-BR": {
    subject: "Seu kit flyee está liberado",
    preview: "Pagamento confirmado: o catálogo e as atualizações são seus",
    heading: "O kit é seu",
    greeting: (name) => (name ? `${name}, pagamento confirmado.` : "Pagamento confirmado."),
    body: (amount) =>
      `Recebemos ${amount}. O catálogo inteiro e as atualizações estão liberados na sua conta, sem prazo para acabar.`,
    next: "Para começar:",
    steps: [
      "Abra o painel e conecte o seu terminal com npx flyee login.",
      "Instale o primeiro módulo na IA que você usa.",
    ],
    button: "Abrir o painel",
    fiscal: "A nota fiscal é emitida pelo Asaas e chega em outro e-mail.",
    keep: "Guarde esta mensagem: ela é o seu recibo de compra.",
  },
  en: {
    subject: "Your flyee kit is ready",
    preview: "Payment confirmed: the catalog and its updates are yours",
    heading: "The kit is yours",
    greeting: (name) => (name ? `${name}, your payment is confirmed.` : "Your payment is confirmed."),
    body: (amount) =>
      `We received ${amount}. The whole catalog and its updates are now on your account, with no expiry date.`,
    next: "To get started:",
    steps: [
      "Open the dashboard and connect your terminal with npx flyee login.",
      "Install your first module in the AI you use.",
    ],
    button: "Open the dashboard",
    fiscal: "The tax invoice is issued by Asaas and arrives in a separate email.",
    keep: "Keep this message: it is your purchase receipt.",
  },
};

/**
 * "The kit is yours": the receipt of the one-time purchase, sent by the
 * webhook when the paid invoice grants the kit. Transactional (it confirms a
 * purchase), so it carries no unsubscribe.
 *
 * Inline styles only — email clients ignore stylesheets, so design tokens
 * cannot be consumed here; keep values aligned with packages/design-tokens by
 * hand.
 */
export default function KitReceiptEmail({ locale, appUrl, name, amountLabel, fiscalNote }: KitReceiptEmailProps) {
  const copy = KIT_RECEIPT_COPY[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={{ backgroundColor: "#faf8f5", fontFamily: "Arial, Helvetica, sans-serif", margin: 0 }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 16, margin: "40px auto", maxWidth: 480, padding: 32 }}
        >
          <Heading as="h2" style={{ color: "#3d3d3d", fontSize: 20, marginBottom: 8 }}>
            {copy.heading}
          </Heading>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px" }}>
            {copy.greeting(name)} {copy.body(amountLabel)}
          </Text>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px", marginBottom: 4 }}>{copy.next}</Text>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px", margin: 0 }}>1. {copy.steps[0]}</Text>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px", marginTop: 0 }}>2. {copy.steps[1]}</Text>
          <Section style={{ margin: "24px 0", textAlign: "center" }}>
            <Button
              href={appUrl}
              style={{
                backgroundColor: "#177c81",
                borderRadius: 12,
                color: "#ffffff",
                display: "inline-block",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              {copy.button}
            </Button>
          </Section>
          <Hr style={{ borderColor: "#e8e8e8", margin: "24px 0" }} />
          {fiscalNote && (
            <Text style={{ color: "#999999", fontSize: 12, lineHeight: "18px", margin: 0 }}>{copy.fiscal}</Text>
          )}
          <Text style={{ color: "#999999", fontSize: 12, lineHeight: "18px" }}>{copy.keep}</Text>
        </Container>
      </Body>
    </Html>
  );
}
