import type { ReactNode } from "react";

import { BRAND } from "@flyee/content";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";

/**
 * Colours of the e-mails. Inline styles only: e-mail clients ignore
 * stylesheets, so the design tokens cannot be consumed here. These are the
 * light values of packages/design-tokens (common.css and yellow.css) copied by
 * hand, each beside the token it copies: keep them aligned when the palette
 * changes. The primary is the yellow of the logo, as the SVG writes it.
 *
 * The button carries the charcoal label, not white: white on this yellow
 * measures 1.5:1, the charcoal 8.7:1 (docs/DESIGN.md, palette usage). The
 * yellow is never the colour of text or of a link here.
 */
export const COLOR = {
  ground: "#f9f8f6", // --background
  paper: "#ffffff", // --background-paper
  heading: "#2c2926", // --text-primary-dark
  text: "#48433d", // --text-primary
  muted: "#716c65", // --text-muted
  rule: "#e8e6e3", // --grey-100
  primary: "#ffcc12", // --primary
  onPrimary: "#303030", // --primary-contrast
  deep: "#303030", // --background-deep
  onDeep: "#f9f8f6", // the ground, as the site's terminal frames write on the band
} as const;

/**
 * The header's image: the dark lockup on the deep band, a PNG because mail
 * clients show no SVG, drawn at three times this size by
 * apps/web/scripts/brand-assets.mjs. Its background is the band's colour, so
 * a client that repaints the band in dark mode still shows it whole.
 */
export const LOGO = { path: "/images/email/logo.png", width: 144, height: 36 } as const;

/** A message is one column: 480 for what a person reads, 640 for the operator's table. */
const WIDTH = { regular: 480, wide: 640 } as const;

const FONT = "Arial, Helvetica, sans-serif";
const MONO = "Consolas, Menlo, 'Courier New', monospace";
const GUTTER = 28;

const text = { color: COLOR.text, fontSize: 15, lineHeight: "24px" } as const;
const small = { color: COLOR.muted, fontSize: 13, lineHeight: "20px" } as const;

/** A paragraph of body copy. */
export function EmailText({ children, tight = false }: { children: ReactNode; tight?: boolean }) {
  return <Text style={{ ...text, margin: tight ? "0 0 4px" : "0 0 16px" }}>{children}</Text>;
}

/** The one action of the message. */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px", textAlign: "center" }}>
      <Button
        href={href}
        style={{
          backgroundColor: COLOR.primary,
          borderRadius: 12,
          color: COLOR.onPrimary,
          display: "inline-block",
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "20px",
          padding: "14px 28px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** Numbered steps, or a plain list when `ordered` is false. */
export function EmailList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  return (
    <Section style={{ margin: "0 0 16px" }}>
      {items.map((item, index) => (
        <Text key={item} style={{ ...text, margin: "0 0 6px" }}>
          {ordered ? `${index + 1}. ` : "• "}
          {item}
        </Text>
      ))}
    </Section>
  );
}

/** A terminal command, in the mono face on the deep band (the look of the site's terminal frames). */
export function EmailCommand({ children }: { children: string }) {
  return (
    <Section style={{ backgroundColor: COLOR.deep, borderRadius: 12, margin: "0 0 16px", padding: "12px 16px" }}>
      <Text style={{ color: COLOR.onDeep, fontFamily: MONO, fontSize: 13, lineHeight: "20px", margin: 0 }}>
        {children}
      </Text>
    </Section>
  );
}

/** Small print under the rule: why the message was sent, where to manage it. */
export function EmailNote({ children }: { children: ReactNode }) {
  return <Text style={{ ...small, margin: "0 0 8px" }}>{children}</Text>;
}

/** The frame's props: what a template says, and how the frame is drawn around it. */
type EmailShellProps = {
  locale: EmailLocale;
  /** The line a mail client shows beside the subject, before the message is opened. */
  preview: string;
  heading: string;
  children: ReactNode;
  /** Small print: one string per line. */
  notes?: string[];
  /**
   * The button's address, written out under the small print, for a message
   * whose whole point is that one link (a confirmation, a reset): a reader
   * whose client will not open the button still gets there.
   */
  fallbackUrl?: string;
  unsubscribe?: { label: string; url: string };
  width?: keyof typeof WIDTH;
  /**
   * Where the header's image is served from. The site's own address by
   * default; the Supabase templates pass the field Supabase fills in, so each
   * environment's mail points at its own site.
   */
  siteUrl?: string;
};

/**
 * The frame every e-mail shares: language, preview line, one card with the
 * logo on the deep band, the heading, the body, then the small print and the
 * signature. The card sits in a table of the ground's colour rather than on
 * <body>, because Gmail drops the styles of <body>; its border keeps it a card
 * where the ground comes out white anyway.
 *
 * The messages declare the light scheme only: Apple Mail then leaves them as
 * drawn, and the clients that repaint them anyway keep the logo readable,
 * because its band is part of the image.
 *
 * `unsubscribe` is for the messages a reader may stop (the weekly summary, the
 * list): the same address goes in the List-Unsubscribe header, so the link in
 * the body and the button of the mail client do the same thing. A message that
 * confirms a purchase or warns about the account has none.
 */
export default function EmailShell({
  locale,
  preview,
  heading,
  children,
  notes,
  fallbackUrl,
  unsubscribe,
  width = "regular",
  siteUrl = BRAND.siteUrl,
}: EmailShellProps) {
  const copy = emailCopyFor(locale).shell;
  return (
    <Html lang={locale} dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLOR.ground, fontFamily: FONT, margin: 0, padding: 0 }}>
        <Section style={{ backgroundColor: COLOR.ground, padding: "32px 8px" }}>
          <Container
            style={{
              backgroundColor: COLOR.paper,
              border: `1px solid ${COLOR.rule}`,
              borderRadius: 16,
              maxWidth: WIDTH[width],
            }}
          >
            <Section
              style={{ backgroundColor: COLOR.deep, borderRadius: "15px 15px 0 0", padding: `20px ${GUTTER}px` }}
            >
              <Img src={`${siteUrl}${LOGO.path}`} width={LOGO.width} height={LOGO.height} alt={copy.logoAlt} />
            </Section>
            <Section style={{ padding: `28px ${GUTTER}px 20px` }}>
              <Heading
                as="h1"
                style={{ color: COLOR.heading, fontSize: 22, fontWeight: 700, lineHeight: "30px", margin: "0 0 16px" }}
              >
                {heading}
              </Heading>
              {children}
              <Hr style={{ borderColor: COLOR.rule, margin: "8px 0 16px" }} />
              {notes?.map((note) => <EmailNote key={note}>{note}</EmailNote>)}
              {fallbackUrl && (
                <>
                  <EmailNote>{copy.fallback}</EmailNote>
                  <EmailNote>
                    <Link
                      href={fallbackUrl}
                      style={{ color: COLOR.muted, textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      {fallbackUrl}
                    </Link>
                  </EmailNote>
                </>
              )}
              {unsubscribe && (
                <EmailNote>
                  <Link href={unsubscribe.url} style={{ color: COLOR.muted, textDecoration: "underline" }}>
                    {unsubscribe.label}
                  </Link>
                </EmailNote>
              )}
              <EmailNote>{copy.signature}</EmailNote>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}
