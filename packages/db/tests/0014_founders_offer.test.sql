begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ============================================================
-- The founders offer (0004). The counter on the page and the guard at
-- checkout read the same answer, computed from a live count of subscriptions
-- on the offer plan. Every closed state has its own named cause.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('ae000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'founder@flyee.invalid', '', '{}', '{"display_name":"Founder"}', now(), now());

select is(public.founders_offer() ->> 'reason', 'disabled', 'shipped closed, and it says why');

update public.platform_settings set value = value || '{"enabled": true, "seats": 0}' where key = 'founders';
select is(public.founders_offer() ->> 'reason', 'sold_out', 'open with no seats reads as sold out');

update public.platform_settings set value = value || '{"seats": 2}' where key = 'founders';
select ok(
  (public.founders_offer() ->> 'reason') = 'open' and (public.founders_offer() ->> 'seats_left')::int = 2,
  'open with seats left'
);

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-fundador-anual'), period = 'yearly'
from public.memberships m
where m.user_id = 'ae000000-0000-4000-8000-000000000001' and s.org_id = m.org_id and s.status = 'active';
select ok(
  (public.founders_offer() ->> 'seats_taken')::int = 1 and (public.founders_offer() ->> 'seats_left')::int = 1,
  'a live subscription on the offer plan takes a seat'
);

update public.platform_settings set value = value || '{"deadline": "not a date"}' where key = 'founders';
select is(public.founders_offer() ->> 'reason', 'open', 'a malformed deadline never takes the pricing page down');

update public.platform_settings set value = value || jsonb_build_object('deadline', (now() - interval '1 day')::text) where key = 'founders';
select is(public.founders_offer() ->> 'reason', 'expired', 'a past deadline closes the offer');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select ok(
  public.founders_offer() ? 'seats_left',
  'a visitor reads the offer, which is what the public counter shows'
);
select ok(
  exists (select 1 from public.platform_settings where key = 'founders')
  and not exists (select 1 from public.platform_settings where key in ('cli', 'dunning', 'impersonation', 'ai_prices')),
  'commercial promises are public, operational settings are not'
);
reset role;

select * from finish();
rollback;
