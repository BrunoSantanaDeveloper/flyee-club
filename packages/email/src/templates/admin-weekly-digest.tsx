import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type AdminWeeklyDigestEmailProps = {
  /** One line: the week and its three headline numbers. */
  headline: string;
  /** The focus rule in one sentence. */
  focus: string;
  /** One row per segment, already formatted. "†" marks a window still open. */
  rows: { segment: string; kit: string; activation: string; weekly: string; conversion: string; revenue: string }[];
  /** Accounts that need a person, only the groups that are not empty. */
  attention: { label: string; count: number }[];
  /** The metrics console. */
  appUrl: string;
};

// Values keep to one line, headers may wrap: six columns have to fit a phone
// without the message scrolling sideways (mail clients ignore overflow rules).
const cell = { color: "#3d3d3d", fontSize: 13, padding: "6px 4px", textAlign: "right" as const, whiteSpace: "nowrap" as const };
const head = { ...cell, color: "#6b6b6b", fontSize: 12, fontWeight: 600, whiteSpace: "normal" as const, verticalAlign: "bottom" as const };

/**
 * The operator's Monday digest: last week's focus metrics per segment, the
 * focus rule, and the accounts that need someone. Sent only when the week had
 * something in it, once per operator per week.
 *
 * Operational, not marketing: it goes to the platform's own staff, so it
 * carries no unsubscribe.
 *
 * Inline styles only: e-mail clients ignore stylesheets, so the design tokens
 * cannot be read here. The button is the charcoal of the logo tile with white
 * text, which reads at 13:1 whatever palette the site uses.
 */
export default function AdminWeeklyDigestEmail({ headline, focus, rows, attention, appUrl }: AdminWeeklyDigestEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={{ backgroundColor: "#faf8f5", fontFamily: "Arial, Helvetica, sans-serif", margin: 0 }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 16, margin: "24px auto", maxWidth: 640, padding: 16 }}
        >
          <Heading as="h1" style={{ color: "#3d3d3d", fontSize: 20, marginBottom: 8 }}>
            {headline}
          </Heading>
          <Text style={{ color: "#4d4d4d", fontSize: 14, lineHeight: "22px" }}>{focus}</Text>

          <Section style={{ margin: "16px 0" }}>
            <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8e8e8" }}>
                  <th style={{ ...head, textAlign: "left" }}>Segmento</th>
                  <th style={head}>Kit</th>
                  <th style={head}>Ativação 7 d</th>
                  <th style={head}>Uso semanal</th>
                  <th style={head}>Kit → assinatura</th>
                  <th style={head}>Receita / pagante</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.segment} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ ...cell, textAlign: "left", whiteSpace: "normal" }}>{row.segment}</td>
                    <td style={cell}>{row.kit}</td>
                    <td style={cell}>{row.activation}</td>
                    <td style={cell}>{row.weekly}</td>
                    <td style={cell}>{row.conversion}</td>
                    <td style={cell}>{row.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Text style={{ color: "#6b6b6b", fontSize: 12, lineHeight: "18px", margin: "8px 0 0" }}>
              † Janela ainda aberta: o número pode crescer. “Outro” e “não informado” ficam fora da regra de foco.
            </Text>
          </Section>

          {attention.length > 0 ? (
            <Section style={{ margin: "16px 0" }}>
              <Text style={{ color: "#3d3d3d", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>
                Contas que pedem alguém
              </Text>
              {attention.map((entry) => (
                <Text key={entry.label} style={{ color: "#3d3d3d", fontSize: 14, margin: "0 0 4px" }}>
                  {entry.count} {entry.label}
                </Text>
              ))}
            </Section>
          ) : null}

          <Section style={{ margin: "24px 0", textAlign: "center" }}>
            <Button
              href={appUrl}
              style={{
                backgroundColor: "#313131",
                borderRadius: 12,
                color: "#ffffff",
                display: "inline-block",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              Abrir as métricas
            </Button>
          </Section>
          <Hr style={{ borderColor: "#e8e8e8", margin: "24px 0" }} />
          <Text style={{ color: "#6b6b6b", fontSize: 12, lineHeight: "18px" }}>
            Aviso interno da plataforma, enviado às segundas e só quando a semana teve algo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
