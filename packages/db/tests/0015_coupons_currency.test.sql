begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ============================================================
-- Coupons (0003). A fixed discount is money, so it belongs to one currency;
-- a coupon may be scoped to plan families; codes are upper case. The checkout
-- asks validate_coupon with the plan, so a coupon that does not fit the plan
-- simply does not exist for it.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('af000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'buyer@flyee.invalid', '', '{}', '{"display_name":"Buyer"}', now(), now());

select throws_ok(
  $$insert into public.coupons (code, discount_type, discount_value) values ('VINTE', 'fixed', 2000)$$,
  '23514', null,
  'a fixed discount without a currency is refused'
);
select throws_ok(
  $$insert into public.coupons (code, discount_type, discount_value) values ('lower', 'percent', 10)$$,
  '23514', null,
  'codes are upper case'
);

insert into public.coupons (code, discount_type, discount_value, currency, plan_families, max_redemptions, redeemed_count, valid_until)
values
  ('LANCAMENTO', 'percent', 20, null, null, null, 0, null),
  ('VINTE', 'fixed', 2000, 'BRL', null, null, 0, null),
  ('CLUBE', 'percent', 10, null, array['club'], null, 0, null),
  ('ESGOTADO', 'percent', 10, null, null, 5, 5, null),
  ('VENCIDO', 'percent', 10, null, null, null, 0, now() - interval '1 day');

select set_config('request.jwt.claims', '{"sub":"af000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select code from public.validate_coupon(' lancamento ')), 'LANCAMENTO', 'the typed code is trimmed and upper-cased');
select is(
  (select count(*)::int from public.validate_coupon('VINTE', (select id from public.plans where slug = 'kit-usd'))),
  0,
  'twenty reais off does not apply to a dollar price'
);
select is(
  (select count(*)::int from public.validate_coupon('VINTE', (select id from public.plans where slug = 'kit'))),
  1,
  'it applies to the same plan in reais'
);
select ok(
  (select count(*)::int from public.validate_coupon('CLUBE', (select id from public.plans where slug = 'kit'))) = 0
  and (select count(*)::int from public.validate_coupon('CLUBE', (select id from public.plans where slug = 'club-anual'))) = 1,
  'a coupon scoped to the club family does not discount the kit'
);
select is(
  (select count(*)::int from public.validate_coupon('LANCAMENTO', (select id from public.plans where slug = 'gratuito'))),
  0,
  'nothing discounts the free plan'
);
select is(
  (select count(*)::int from public.validate_coupon('ESGOTADO')) + (select count(*)::int from public.validate_coupon('VENCIDO')),
  0,
  'an exhausted or expired coupon does not exist'
);
select is((select count(*)::int from public.coupons), 0, 'a member cannot read the coupon list');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.validate_coupon('LANCAMENTO')$$, '42501', null, 'a visitor cannot probe coupon codes');
reset role;

select * from finish();
rollback;
