import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type LeadConfirmLocale = "pt-BR" | "en";

export type LeadConfirmEmailProps = {
  locale: LeadConfirmLocale;
  /** The one-time confirmation link (valid for 7 days). */
  confirmUrl: string;
};

/**
 * The text of the confirmation message per language. Kept next to the template
 * until phase 8 of docs/PLANO-IMPLEMENTACAO.md moves every e-mail's copy to
 * `copy/{pt-BR,en}.ts`.
 */
export const LEAD_CONFIRM_COPY: Record<
  LeadConfirmLocale,
  { subject: string; preview: string; heading: string; body: string; button: string; expiry: string; ignore: string }
> = {
  "pt-BR": {
    subject: "Confirme sua inscrição na lista do flyee.club",
    preview: "Um clique para entrar na lista de espera do flyee.club",
    heading: "Confirme sua inscrição",
    body: "Recebemos um pedido para colocar este endereço na lista de espera do flyee.club. Confirme com o botão abaixo e avisaremos quando abrir.",
    button: "Confirmar inscrição",
    expiry: "O link vale por 7 dias.",
    ignore:
      "Não foi você? Ignore esta mensagem: endereços não confirmados são apagados em 7 dias e não recebem mais nada.",
  },
  en: {
    subject: "Confirm your spot on the flyee.club waitlist",
    preview: "One click to join the flyee.club waitlist",
    heading: "Confirm your spot",
    body: "We received a request to add this address to the flyee.club waitlist. Confirm with the button below and we will let you know when it opens.",
    button: "Confirm my spot",
    expiry: "The link is valid for 7 days.",
    ignore: "Not you? Ignore this message: unconfirmed addresses are deleted after 7 days and receive nothing else.",
  },
};

/**
 * Double opt-in for the waitlist (migration 0013): the address only joins the
 * list once its owner clicks the link. Transactional by nature (it answers a
 * request made on the site), so it carries no unsubscribe: an unconfirmed
 * address receives nothing else and is erased after 7 days.
 *
 * Inline styles only — email clients ignore stylesheets, so design tokens
 * cannot be consumed here; keep values aligned with packages/design-tokens by
 * hand.
 */
export default function LeadConfirmEmail({ locale, confirmUrl }: LeadConfirmEmailProps) {
  const copy = LEAD_CONFIRM_COPY[locale];
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
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px" }}>{copy.body}</Text>
          <Section style={{ margin: "24px 0", textAlign: "center" }}>
            <Button
              href={confirmUrl}
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
          <Text style={{ color: "#4d4d4d", fontSize: 13, lineHeight: "20px" }}>{copy.expiry}</Text>
          <Hr style={{ borderColor: "#e8e8e8", margin: "24px 0" }} />
          <Text style={{ color: "#999999", fontSize: 12, lineHeight: "18px" }}>{copy.ignore}</Text>
        </Container>
      </Body>
    </Html>
  );
}
