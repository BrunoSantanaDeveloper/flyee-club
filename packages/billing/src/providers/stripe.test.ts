import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import Stripe from "stripe";

import { StripeProvider } from "./stripe.ts";

const SECRET = "whsec_flyee_test";
const KEY = "sk_test_flyee";

before(() => {
  process.env.STRIPE_SECRET_KEY = KEY;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

/** A delivery signed the way Stripe signs it, so the real verification runs. */
function delivery(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${type}`, object: "event", type, data: { object } });
  const signature = new Stripe(KEY).webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { payload, headers: { "stripe-signature": signature } };
}

/** FlyeeClub bought in reais on Stripe's page: a one-off payment session. */
const session = (paymentStatus: "paid" | "unpaid") => ({
  id: "cs_test_kit",
  object: "checkout.session",
  mode: "payment",
  payment_status: paymentStatus,
  payment_intent: "pi_test_kit",
  amount_total: 9700,
  currency: "brl",
  metadata: { org_id: "org-1", plan_id: "plan-kit", billing_operation_key: "op-1" },
});

async function parse(type: string, object: Record<string, unknown>) {
  const { payload, headers } = delivery(type, object);
  return new StripeProvider().parseWebhook(payload, headers);
}

describe("Stripe one-off payments", () => {
  it("records a card payment when the session completes paid", async () => {
    const [event, ...rest] = await parse("checkout.session.completed", session("paid"));
    assert.equal(rest.length, 0);
    assert.equal(event.type, "payment_succeeded");
    assert.equal(event.type === "payment_succeeded" && event.providerInvoiceId, "pi_test_kit");
    assert.equal(event.type === "payment_succeeded" && event.currency, "BRL");
  });

  it("waits while a PIX is unpaid, and grants when Stripe confirms it later", async () => {
    assert.deepEqual(await parse("checkout.session.completed", session("unpaid")), []);

    const [event, ...rest] = await parse("checkout.session.async_payment_succeeded", session("paid"));
    assert.equal(rest.length, 0);
    assert.equal(event.type, "payment_succeeded");
    if (event.type !== "payment_succeeded") return;
    // The same key as a card purchase: one grant per payment intent.
    assert.equal(event.providerInvoiceId, "pi_test_kit");
    assert.equal(event.amountCents, 9700);
    assert.equal(event.metadata.plan_id, "plan-kit");
    assert.equal(event.metadata.org_id, "org-1");
  });

  it("refuses a delivery that Stripe did not sign", async () => {
    const { payload } = delivery("checkout.session.async_payment_succeeded", session("paid"));
    await assert.rejects(new StripeProvider().parseWebhook(payload, { "stripe-signature": "t=1,v1=forged" }));
  });
});
