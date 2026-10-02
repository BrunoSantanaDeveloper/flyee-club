import { emailCopyFor } from "../copy";
import type { EmailLocale } from "../locale";
import EmailShell, { EmailButton, EmailList, EmailText } from "./shell";

export type SubscriptionActiveEmailProps = {
  locale: EmailLocale;
  name: string | null;
  /** The plan as it is named in the data (`plans.name`). */
  planName: string;
  /** The plan's limits (`plans.limits`): what it unlocks is read from here. */
  limits: Record<string, unknown>;
  /** The dashboard address the button opens. */
  appUrl: string;
};

/** The order the unlocked items are listed in: the store first, then what the tier adds. */
const FLAGS = [
  "catalog_access",
  "advanced_lessons",
  "recipes",
  "roadmap_vote",
  "meetings",
  "commercial_license",
  "open_the_hood",
] as const;

const amount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * What a plan unlocks, as sentences, read from its limits: a flag the plan
 * does not have is not mentioned, and the number of computers is the plan's
 * own. Exported for the test that pins it to the entitlement keys.
 */
export function unlockedLines(locale: EmailLocale, limits: Record<string, unknown>): string[] {
  const { features } = emailCopyFor(locale).subscriptionActive;
  const lines: string[] = FLAGS.filter((key) => amount(limits[key]) > 0).map((key) => features[key]);
  const devices = amount(limits.devices);
  if (devices > 0) lines.push(features.devices(devices));
  return lines;
}

/**
 * "Payment confirmed": a subscription is live. With Pix the confirmation lands
 * minutes or hours after the member closed the tab, so without this they only
 * find out by coming back. Transactional (it confirms a purchase), so it
 * carries no unsubscribe.
 */
export default function SubscriptionActiveEmail({
  locale,
  name,
  planName,
  limits,
  appUrl,
}: SubscriptionActiveEmailProps) {
  const copy = emailCopyFor(locale).subscriptionActive;
  const lines = unlockedLines(locale, limits);
  return (
    <EmailShell locale={locale} preview={copy.preview(planName)} heading={copy.heading} notes={[copy.manage]}>
      <EmailText>{copy.greeting(name, planName)}</EmailText>
      {lines.length > 0 && (
        <>
          <EmailText tight>{copy.includes}</EmailText>
          <EmailList items={lines} />
        </>
      )}
      <EmailButton href={appUrl}>{copy.button}</EmailButton>
    </EmailShell>
  );
}
