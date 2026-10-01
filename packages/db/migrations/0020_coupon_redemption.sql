-- ============================================================
-- 0020_coupon_redemption: one coupon use per purchase, counted atomically.
--
-- The webhook used to read `coupons.redeemed_count` and write it back + 1, and
-- only when a PROVIDER subscription activated. Two gaps followed:
--
--  - Two purchases confirmed together counted one, so `max_redemptions` let
--    the extra purchase through.
--  - The kit (a one-time payment) and a yearly plan split into installments
--    (one payment, no provider subscription) never activate a provider
--    subscription, so their coupon uses were never counted at all.
--
-- `redeem_coupon` claims and counts in one transaction. A subscription's use
-- is claimed by writing its `coupon_id` where still null, so a replayed event
-- (or a parallel parcel of the same split purchase) finds it taken and counts
-- nothing. A kit has no subscription row: the webhook calls this once, on the
-- first grant of the paid invoice (`grant_entitlement_on_invoice` answers
-- `granted` exactly once per invoice).
-- ============================================================

create or replace function public.redeem_coupon(target_coupon uuid, target_subscription uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;
  if target_coupon is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  if target_subscription is not null then
    update public.subscriptions
    set coupon_id = target_coupon
    where id = target_subscription
      and coupon_id is null;
    get diagnostics touched = row_count;
    if touched = 0 then
      return jsonb_build_object('ok', true, 'code', 'already_counted');
    end if;
  end if;

  update public.coupons
  set redeemed_count = redeemed_count + 1
  where id = target_coupon;
  get diagnostics touched = row_count;

  return jsonb_build_object('ok', true, 'code', case when touched > 0 then 'counted' else 'unknown_coupon' end);
end;
$$;

revoke all on function public.redeem_coupon(uuid, uuid) from public, anon, authenticated;
