begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ============================================================
-- The phase 6 consoles (0021): payers per currency in the weekly segment
-- report, catalog usage per module and version, and the meeting registrant
-- list. Operator-only, pinned on a small world whose answers are known.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'brl@flyee.invalid', '', '{}', '{"display_name":"Real","segment":"dev"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'usd@flyee.invalid', '', '{}', '{"display_name":"Dollar","segment":"dev"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'b1000000-0000-4000-8000-000000000003';

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'b1000000-0000-4000-8000-000000000001') as brl_org,
  (select org_id from public.memberships where user_id = 'b1000000-0000-4000-8000-000000000002') as usd_org,
  date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date as this_week;
grant select on ctx to authenticated;

-- Two devs paid this week, one in each currency.
insert into public.invoices (org_id, plan_id, provider, provider_invoice_id, amount_cents, currency, status, paid_at)
select (select brl_org from ctx), p.id, 'asaas', 'b1_brl', 9700, 'BRL', 'paid', now() from public.plans p where p.slug = 'kit';
insert into public.invoices (org_id, plan_id, provider, provider_invoice_id, amount_cents, currency, status, paid_at)
select (select usd_org from ctx), p.id, 'stripe', 'b1_usd', 2900, 'USD', 'paid', now()
from public.plans p where p.slug = 'kit' limit 1;

-- One module with one released version.
insert into public.catalog_modules (id, slug, trail, type, name)
values ('b1000000-0000-4000-8000-0000000000a1', 'deploy-check', 'publicar', 'skill', '{"pt-BR": "Checagem de deploy"}');
insert into public.catalog_module_versions (id, module_id, version, storage_path, sha256, size_bytes, manifest, status)
values ('b1000000-0000-4000-8000-0000000000b1', 'b1000000-0000-4000-8000-0000000000a1', '1.0.0',
        'deploy-check/1.0.0/deploy-check-1.0.0.zip', repeat('e', 64), 4096,
        '{"files": ["SKILL.md", "check.sh"], "entry": "SKILL.md", "license": "member"}', 'published');

-- Two downloads (one recent, one old), one live machine with it installed and
-- one disconnected machine that still lists it.
insert into public.module_downloads (org_id, module_id, version_id, created_at)
values
  ((select brl_org from ctx), 'b1000000-0000-4000-8000-0000000000a1', 'b1000000-0000-4000-8000-0000000000b1', now()),
  ((select usd_org from ctx), 'b1000000-0000-4000-8000-0000000000a1', 'b1000000-0000-4000-8000-0000000000b1', now() - interval '45 days');
insert into public.member_devices (org_id, user_id, device_id, installed_modules, revoked_at)
values
  ((select brl_org from ctx), 'b1000000-0000-4000-8000-000000000001', 'laptop-b101', '[{"slug": "deploy-check", "version": "1.0.0"}]', null),
  ((select usd_org from ctx), 'b1000000-0000-4000-8000-000000000002', 'laptop-b102', '[{"slug": "deploy-check", "version": "1.0.0"}]', now());

-- Three executions in 30 days by two accounts, one older than that.
insert into public.product_events (org_id, actor_id, event_name, properties, occurred_at)
values
  ((select brl_org from ctx), 'b1000000-0000-4000-8000-000000000001', 'tool.executed', '{"module": "deploy-check"}', now()),
  ((select brl_org from ctx), 'b1000000-0000-4000-8000-000000000001', 'tool.executed', '{"module": "deploy-check"}', now() - interval '2 days'),
  ((select usd_org from ctx), 'b1000000-0000-4000-8000-000000000002', 'tool.executed', '{"module": "deploy-check"}', now() - interval '3 days'),
  ((select usd_org from ctx), 'b1000000-0000-4000-8000-000000000002', 'tool.executed', '{"module": "deploy-check"}', now() - interval '40 days');

-- A meeting: the BRL dev registered and joined, the USD dev only registered.
insert into public.meetings (id, slug, title, starts_at, state)
values ('b1000000-0000-4000-8000-0000000000c1', 'encontro-b1', '{"pt-BR": "Encontro"}', now() + interval '1 day', 'inscricoes');
insert into public.meeting_registrations (meeting_id, user_id, org_id, joined_at, created_at)
values
  ('b1000000-0000-4000-8000-0000000000c1', 'b1000000-0000-4000-8000-000000000001', (select brl_org from ctx), now(), now() - interval '2 hours'),
  ('b1000000-0000-4000-8000-0000000000c1', 'b1000000-0000-4000-8000-000000000002', (select usd_org from ctx), null, now() - interval '1 hour');

create temporary table report as select * from public.admin_segment_weekly(1) where false;
grant select, insert on report to authenticated;
create temporary table stats (value jsonb);
grant select, insert on stats to authenticated;
create temporary table registrants (value jsonb);
grant select, insert on registrants to authenticated;

-- ---------- A member is refused ----------

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.admin_catalog_stats()$$, '42501', 'not_authorized', 'catalog usage is for the operator only');
select throws_ok(
  $$select public.admin_meeting_registrants('b1000000-0000-4000-8000-0000000000c1')$$,
  '42501', 'not_authorized',
  'a member cannot list who registered for a meeting'
);
reset role;

-- ---------- The operator reads ----------

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
insert into report select * from public.admin_segment_weekly(1);
insert into stats select public.admin_catalog_stats();
insert into registrants select public.admin_meeting_registrants('b1000000-0000-4000-8000-0000000000c1');
reset role;

select ok(
  (select payers_90d = 2 and payers_90d_brl = 1 and payers_90d_usd = 1
   from report where week_start = (select this_week from ctx) and segment = 'dev'),
  'payers are counted overall and per currency'
);
select ok(
  (select revenue_90d_brl = 9700 and revenue_90d_usd = 2900
   from report where week_start = (select this_week from ctx) and segment = 'dev'),
  'each currency keeps its own revenue'
);

create temporary table module_stats as
select item from stats, jsonb_array_elements(stats.value -> 'modules') as item
where item ->> 'moduleId' = 'b1000000-0000-4000-8000-0000000000a1';
create temporary table version_stats as
select item from stats, jsonb_array_elements(stats.value -> 'versions') as item
where item ->> 'versionId' = 'b1000000-0000-4000-8000-0000000000b1';

select ok(
  (select (item ->> 'downloads')::int = 2 and (item ->> 'downloads30d')::int = 1 from module_stats),
  'downloads are counted all-time and in the last 30 days'
);
select is(
  (select (item ->> 'installs')::int from module_stats),
  1,
  'installs count live machines only: a disconnected machine is not an install'
);
select ok(
  (select (item ->> 'executions30d')::int = 3 and (item ->> 'activeAccounts30d')::int = 2 from module_stats),
  'executions and the accounts behind them are counted in the last 30 days'
);
select ok(
  (select (item ->> 'downloads')::int = 2 and (item ->> 'downloads30d')::int = 1 from version_stats),
  'downloads are also counted per version'
);
select ok(
  (select (item ->> 'files')::int = 2 and item ->> 'entry' = 'SKILL.md' and item ->> 'license' = 'member' from version_stats),
  'a version says what its package declares, without exposing the manifest itself'
);

select is(
  (select jsonb_array_length(value) from registrants),
  2,
  'every registration is listed'
);
select ok(
  (select value -> 0 ->> 'email' = 'brl@flyee.invalid' and value -> 0 ->> 'joinedAt' is not null from registrants),
  'the oldest registration comes first, with the e-mail and the moment the door was opened'
);
select ok(
  (select value -> 1 ->> 'name' = 'Dollar' and value -> 1 ->> 'joinedAt' is null from registrants),
  'a registration that never opened the door says so'
);

select * from finish();
rollback;
