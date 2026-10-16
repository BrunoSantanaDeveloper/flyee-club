import { Section, Text } from "@react-email/components";

import EmailShell, { COLOR, EmailButton, EmailText } from "./shell";

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
const cell = {
  color: COLOR.text,
  fontSize: 13,
  padding: "6px 4px",
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
};
const head = {
  ...cell,
  color: COLOR.muted,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "normal" as const,
  verticalAlign: "bottom" as const,
};

/**
 * The operator's Monday digest: last week's focus metrics per segment, the
 * focus rule, and the accounts that need someone. Sent only when the week had
 * something in it, once per operator per week.
 *
 * Operational, not marketing: it goes to the platform's own staff, in
 * Portuguese like the consoles, so it carries no unsubscribe. The frame is the
 * one every message has, in its wide column, so the table fits.
 */
export default function AdminWeeklyDigestEmail({
  headline,
  focus,
  rows,
  attention,
  appUrl,
}: AdminWeeklyDigestEmailProps) {
  return (
    <EmailShell
      locale="pt-BR"
      width="wide"
      preview={headline}
      heading={headline}
      notes={["Aviso interno da plataforma, enviado às segundas e só quando a semana teve algo."]}
    >
      <EmailText>{focus}</EmailText>

      <Section style={{ margin: "0 0 16px" }}>
        <table
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
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
              <tr key={row.segment} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
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
        <Text style={{ color: COLOR.muted, fontSize: 12, lineHeight: "18px", margin: "8px 0 0" }}>
          † Janela ainda aberta: o número pode crescer. “Outro” e “não informado” ficam fora da regra de foco.
        </Text>
      </Section>

      {attention.length > 0 ? (
        <Section style={{ margin: "0 0 16px" }}>
          <EmailText tight>
            <strong>Contas que pedem alguém</strong>
          </EmailText>
          {attention.map((entry) => (
            <EmailText key={entry.label} tight>
              {entry.count} {entry.label}
            </EmailText>
          ))}
        </Section>
      ) : null}

      <EmailButton href={appUrl}>Abrir as métricas</EmailButton>
    </EmailShell>
  );
}
