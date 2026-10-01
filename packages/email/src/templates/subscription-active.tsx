import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type SubscriptionActiveEmailProps = {
  planName: string;
  appUrl: string;
  name?: string | null;
};

/**
 * "Your plan is active."
 *
 * With Pix the confirmation lands minutes or hours after the member closed the
 * tab, so without this they only find out by coming back and reloading.
 *
 * Transactional, not marketing: it confirms a purchase, so it carries no
 * unsubscribe. Phase 8 of docs/PLANO-IMPLEMENTACAO.md makes it bilingual.
 *
 * Inline styles only — email clients ignore stylesheets, so design tokens
 * cannot be consumed here; keep values aligned with packages/design-tokens by
 * hand.
 */
export default function SubscriptionActiveEmail({ planName, appUrl, name }: SubscriptionActiveEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Pagamento confirmado — {planName} já está ativo</Preview>
      <Body style={{ backgroundColor: "#faf8f5", fontFamily: "Arial, Helvetica, sans-serif", margin: 0 }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 16, margin: "40px auto", maxWidth: 480, padding: 32 }}
        >
          <Heading as="h2" style={{ color: "#3d3d3d", fontSize: 20, marginBottom: 8 }}>
            {planName} está ativo
          </Heading>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px" }}>
            {name ? `${name}, seu` : "Seu"} pagamento foi confirmado. Seu plano já está liberado.
          </Text>
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
              Abrir o flyee.club
            </Button>
          </Section>
          <Hr style={{ borderColor: "#e8e8e8", margin: "24px 0" }} />
          <Text style={{ color: "#999999", fontSize: 12, lineHeight: "18px" }}>
            Você pode ver as faturas e gerenciar a assinatura em Configurações → Cobrança.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
