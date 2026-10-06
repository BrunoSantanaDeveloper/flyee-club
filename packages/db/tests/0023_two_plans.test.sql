begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ============================================================
-- Two plans named after the club (0025): the access is "FlyeeClub", the
-- subscription "FlyeeClub Pro" (with the depth layer), the former Pro family
-- is off the grids and refused everywhere a plan is sold or granted, the
-- offers an event may name include consulting, and the terms of use say the
-- names in version 3.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ad000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member-two-plans@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('ad000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-two-plans@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'ad000000-0000-4000-8000-000000000002';

create temporary table ctx as
select (select org_id from public.memberships where user_id = 'ad000000-0000-4000-8000-000000000001') as org;
grant select on ctx to authenticated, service_role;

-- ---------- The names ----------

select is(
  (select array_agg(name order by slug) from public.plans where slug in ('kit', 'kit-usd')),
  array['FlyeeClub', 'FlyeeClub'],
  'the one-time access is the plan called FlyeeClub, in both currencies'
);
select is(
  (select array_agg(distinct name) from public.plans where slug in ('club-mensal', 'club-anual', 'club-mensal-usd', 'club-anual-usd')),
  array['FlyeeClub Pro'],
  'the subscription is FlyeeClub Pro, in both currencies and periods'
);
select ok(
  (select bool_and((limits ->> 'open_the_hood')::int = 1 and (limits ->> 'devices')::int = 3)
   from public.plans where family = 'club'),
  'FlyeeClub Pro carries the depth layer it inherited from the retired Pro, on three machines'
);
select is(
  (select name from public.plans where slug = 'club-fundador-anual'),
  'FlyeeClub Pro · Fundador',
  'the founders price is named after FlyeeClub Pro'
);

-- ---------- The former Pro, off the grids ----------

select is(
  (select count(*)::int from public.plans where family = 'pro' and not is_active and not is_public),
  4,
  'the four Pro rows stay, inactive and unlisted'
);
select is(
  (select count(*)::int from public.plans where family = 'pro'),
  4,
  'and none was deleted'
);

select set_config('request.jwt.claims', '{"sub":"ad000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.grant_entitlement((select org from ctx), (select id from public.plans where slug = 'pro-anual'), 'partner', null)$$,
  'plan_not_found',
  'a courtesy of the retired Pro is refused like a plan that does not exist'
);
select throws_ok(
  $$select public.set_org_plan((select org from ctx), (select id from public.plans where slug = 'pro-mensal'), 'beta')$$,
  'plan_not_found',
  'and so is assigning it'
);
reset role;

-- ---------- The offers an event may name ----------

select is(
  public.product_event_sanitize('upsell.viewed', '{"offer":"consulting","origin":"home","platform":"web"}') ->> 'offer',
  'consulting',
  'consulting is an offer an event may name'
);
select is(
  public.product_event_sanitize('upsell.viewed', '{"offer":"advisory"}') ->> 'offer',
  null,
  'an offer outside the list is dropped, as before'
);

-- ---------- The terms of use ----------

select is(
  (select array_agg(version order by locale) from public.consent_terms where slug = 'terms' and is_active),
  array[3, 3],
  'version 3 of the terms is in force in both languages'
);
select ok(
  (select bool_and(body_md like '%FlyeeClub Pro%' and body_md not like '%flyee.club%')
   from public.consent_terms where slug = 'terms' and version = 3),
  'and it names the two plans, never the old name'
);

select * from finish();
rollback;
