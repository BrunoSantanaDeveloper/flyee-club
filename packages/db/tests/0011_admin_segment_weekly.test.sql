begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ============================================================
-- The weekly focus report (0015). One row per week and segment with the five
-- metrics that decide the focus segment, computed from purchases, devices,
-- executions and paid invoices. Pinned on a small world whose answers are
-- known in advance.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ab000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dev@flyee.invalid', '', '{}', '{"display_name":"Dev","segment":"dev"}', now(), now()),
  ('ab000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'freela@flyee.invalid', '', '{}', '{"display_name":"Freela","segment":"agencia"}', now(), now()),
  ('ab000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'regular@flyee.invalid', '', '{}', '{"display_name":"Regular","segment":"negocio"}', now(), now()),
  ('ab000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'ab000000-0000-4000-8000-000000000004';

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'ab000000-0000-4000-8000-000000000001') as dev_org,
  (select org_id from public.memberships where user_id = 'ab000000-0000-4000-8000-000000000002') as freela_org,
  (select org_id from public.memberships where user_id = 'ab000000-0000-4000-8000-000000000003') as regular_org,
  date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date as this_week;
grant select on ctx to authenticated;

-- The dev bought the kit this week, entering through a partner page, and ran
-- a tool the same day.
insert into public.signup_attribution (org_id, origem) values ((select dev_org from ctx), 'parceiro');
insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key, created_at)
select (select dev_org from ctx), 'kit', p.id, p.limits, 'asaas:kit_dev', greatest(now() - interval '1 hour', (select this_week from ctx)::timestamp at time zone 'America/Sao_Paulo')
from public.plans p where p.slug = 'kit';
insert into public.invoices (org_id, plan_id, provider, provider_invoice_id, amount_cents, currency, status, paid_at)
select (select dev_org from ctx), p.id, 'asaas', 'kit_dev', 9700, 'BRL', 'paid', now() from public.plans p where p.slug = 'kit';
insert into public.product_events (org_id, actor_id, event_name, occurred_at)
values ((select dev_org from ctx), 'ab000000-0000-4000-8000-000000000001', 'tool.executed', now());

-- The freelancer bought the kit this week too and subscribed right after.
insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key, created_at)
select (select freela_org from ctx), 'kit', p.id, p.limits, 'asaas:kit_freela', greatest(now() - interval '2 hours', (select this_week from ctx)::timestamp at time zone 'America/Sao_Paulo')
from public.plans p where p.slug = 'kit';
update public.subscriptions set status = 'canceled' where org_id = (select freela_org from ctx);
insert into public.subscriptions (org_id, plan_id, status, provider, provider_subscription_id, period, current_period_start, price_cents, currency)
select (select freela_org from ctx), p.id, 'active', 'asaas', 'sub_freela', 'monthly', now(), 6700, 'BRL'
from public.plans p where p.slug = 'club-mensal';

-- The regular ran tools in three of the last four weeks.
insert into public.product_events (org_id, actor_id, event_name, occurred_at)
values
  ((select regular_org from ctx), 'ab000000-0000-4000-8000-000000000003', 'tool.executed', now()),
  ((select regular_org from ctx), 'ab000000-0000-4000-8000-000000000003', 'tool.executed', now() - interval '7 days'),
  ((select regular_org from ctx), 'ab000000-0000-4000-8000-000000000003', 'tool.executed', now() - interval '14 days');

-- Public visits this week.
insert into public.site_page_views (day, path, origem, locale, views)
values
  ((now() at time zone 'America/Sao_Paulo')::date, '/', 'parceiro', 'pt-BR', 40),
  ((now() at time zone 'America/Sao_Paulo')::date, '/planos', 'direto', 'en', 60);

create temporary table report as select * from public.admin_segment_weekly(4) where false;
grant select, insert on report to authenticated;
create temporary table doors as select * from public.admin_door_weekly(4) where false;
grant select, insert on doors to authenticated;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_segment_weekly(4)$$, 'P0001', 'not_authorized', 'the report is for the operator only');
reset role;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
insert into report select * from public.admin_segment_weekly(4);
insert into doors select * from public.admin_door_weekly(4);
reset role;

select is((select count(*)::int from report), 24, 'four weeks times six segments (the five declared ones and "unknown")');
select ok(
  (select kit_buyers = 1 and access_cohort = 1 and activated_7d = 1
   from report where week_start = (select this_week from ctx) and segment = 'dev'),
  'the dev counts as a kit buyer, in this week''s access cohort, and activated within seven days'
);
select ok(
  (select page_views = 100 and page_conversion = round(1::numeric / 100, 4)
   from report where week_start = (select this_week from ctx) and segment = 'dev'),
  'page views are the week''s public loads, and conversion divides the segment''s buyers by them'
);
select is(
  (select kit_to_club_60d from report where week_start = (select this_week from ctx) and segment = 'agencia'),
  1,
  'the freelancer counts as a kit buyer who moved to the subscription'
);
select is(
  (select weekly_active from report where week_start = (select this_week from ctx) and segment = 'negocio'),
  1,
  'three active weeks out of four make the regular a weekly user'
);
select ok(
  (select revenue_90d_brl = 9700 and revenue_90d_usd = 0 and payers_90d = 1
   from report where week_start = (select this_week from ctx) and segment = 'dev'),
  'revenue is the paid invoices of the last 90 days, per currency'
);
select ok(
  (select page_views = 40 and kit_buyers = 1 from doors where week_start = (select this_week from ctx) and origem = 'parceiro')
  and (select page_views = 60 and kit_buyers = 1 from doors where week_start = (select this_week from ctx) and origem = 'direto'),
  'the door report puts each purchase on the door that brought the buyer, and an untracked arrival on "direto"'
);

select * from finish();
rollback;
