begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ============================================================
-- Usage telemetry (0006).
--
-- Events, never content: one vocabulary, one allowlist of property keys AND
-- values, shared by the browser writer and the server writer. Segment,
-- language and AI tool come from the profile, never from the caller. A support
-- visit leaves no trace in the member's behaviour, and every writer has a
-- ceiling.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a5000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member","segment":"dev","ai_tool":"claude_code","locale":"en"}', now(), now()),
  ('a5000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'a5000000-0000-4000-8000-000000000002';

insert into public.catalog_modules (slug, trail, type, name)
values ('deploy-guard', 'publicar', 'skill', '{"pt-BR": "Guarda de deploy"}');

create temporary table ctx as
select (select org_id from public.memberships where user_id = 'a5000000-0000-4000-8000-000000000001') as org;
grant select on ctx to authenticated, service_role;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated, service_role;

-- ---------- The browser writer ----------

select set_config('request.jwt.claims', '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.track_product_event('upsell.viewed', '{"offer":"club","origin":"home","module":"no-such-module","prompt":"secret text","platform":"cli"}');
select public.track_product_event('kit.purchased', '{"offer":"kit"}');
select public.track_product_event('anything.else', '{}');
select is((select count(*)::int from public.product_events), 0, 'a member cannot read the events table');
reset role;

select is(
  (select properties from public.product_events where event_name = 'upsell.viewed'),
  '{"offer": "club", "origin": "home", "platform": "web"}'::jsonb,
  'only allowlisted keys with allowlisted values survive; an unknown module and free text are dropped, and the browser is always "web"'
);
select ok(
  (select segment = 'dev' and locale = 'en' and ai_tool = 'claude_code' and org_id = (select org from ctx)
   from public.product_events where event_name = 'upsell.viewed'),
  'segment, language and AI tool are stamped from the profile'
);
select is(
  (select count(*)::int from public.product_events where event_name in ('kit.purchased', 'anything.else')),
  0,
  'the browser may not report a purchase, nor an event outside the vocabulary'
);

-- ---------- The server writer ----------

select set_config('request.jwt.claims', '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.track_product_event_server('a5000000-0000-4000-8000-000000000001', null, 'tool.executed', '{}', null, 'cli')$$,
  '42501', null,
  'only the backend may use the server writer'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('exec', to_jsonb(public.track_product_event_server(
  'a5000000-0000-4000-8000-000000000001', null, 'tool.executed',
  '{"module":"deploy-guard","trail":"publicar","version":"1.2.0","cli_version":"not-a-version","platform":"web"}',
  now() + interval '3 days', 'cli')));
reset role;

select is((select payload from res where name = 'exec'), 'true'::jsonb, 'the backend records a CLI event');
select ok(
  (select properties = '{"module": "deploy-guard", "trail": "publicar", "version": "1.2.0", "platform": "cli"}'::jsonb
   from public.product_events where event_name = 'tool.executed'),
  'a published module and a valid version are kept, a malformed version is dropped, and the platform is forced to "cli"'
);
select ok(
  (select occurred_at <= now() + interval '1 minute' from public.product_events where event_name = 'tool.executed'),
  'a timestamp in the future is not believed'
);
select throws_ok(
  $$insert into public.product_events (event_name) values ('made.up')$$,
  '23514', null,
  'the table itself refuses a name outside the vocabulary'
);

-- ---------- Ceilings ----------

update public.platform_settings set value = jsonb_set(value, '{events_per_hour}', '2') where key = 'cli';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('cli_2', to_jsonb(public.track_product_event_server('a5000000-0000-4000-8000-000000000001', null, 'module.installed', '{}', null, 'cli')));
insert into res values ('cli_3', to_jsonb(public.track_product_event_server('a5000000-0000-4000-8000-000000000001', null, 'module.installed', '{}', null, 'cli')));
reset role;
select ok(
  (select payload = 'true'::jsonb from res where name = 'cli_2') and (select payload = 'false'::jsonb from res where name = 'cli_3'),
  'CLI events stop at the configured hourly ceiling per member'
);

insert into public.product_events (actor_id, event_name, created_at)
select 'a5000000-0000-4000-8000-000000000001', 'upsell.clicked', now() from generate_series(1, 120);
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.track_product_event('upsell.clicked', '{"offer":"pro"}');
reset role;
select is(
  (select count(*)::int from public.product_events where event_name = 'upsell.clicked'),
  120,
  'a browser over 120 events in the hour is dropped silently'
);

-- ---------- Support visits ----------

delete from public.product_events where event_name = 'upsell.clicked';
insert into public.impersonation_sessions (actor_id, target_user_id, reason, session_id, expires_at)
values ('a5000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001',
        'Checking the upsell card', 'f5000000-0000-4000-8000-000000000001', now() + interval '30 minutes');
select set_config('request.jwt.claims',
  '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f5000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select public.track_product_event('upsell.clicked', '{"offer":"pro"}');
reset role;
select is(
  (select count(*)::int from public.product_events where event_name = 'upsell.clicked'),
  0,
  'what an operator does inside a member''s session is not the member''s behaviour'
);

-- ---------- Rollup and retention ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('rollup_1', to_jsonb(public.rollup_product_events((now() at time zone 'America/Sao_Paulo')::date)));
insert into res values ('rollup_2', to_jsonb(public.rollup_product_events((now() at time zone 'America/Sao_Paulo')::date)));
reset role;
select ok(
  (select payload::int > 0 from res where name = 'rollup_1')
  and (select payload from res where name = 'rollup_1') = (select payload from res where name = 'rollup_2'),
  'the daily rollup is idempotent: running it twice writes the same rows'
);
select is(
  (select events from public.product_events_daily where event_name = 'tool.executed' and module = 'deploy-guard'),
  1,
  'and keeps the module dimension'
);

insert into public.product_events (actor_id, event_name, occurred_at)
values ('a5000000-0000-4000-8000-000000000001', 'cli.login', now() - interval '100 days'),
       ('a5000000-0000-4000-8000-000000000001', 'cli.login', now() - interval '30 days');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.purge_product_events(interval '1 day');
reset role;
select is(
  (select count(*)::int from public.product_events where event_name = 'cli.login'),
  1,
  'the purge never keeps less than three months, whatever it is asked'
);

select * from finish();
rollback;
