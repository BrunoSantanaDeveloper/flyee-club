begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ============================================================
-- What the CLI delivery API records and enforces (0010, 0011).
--
-- Devices count against the tier's ceiling, two registrations cannot both
-- slip under it, revoking a device kills its whole token family, a revoked
-- device comes back only through a new login, a workspace's tokens can be cut
-- at once, and the activation facts read real state.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member","segment":"dev","ai_tool":"codex"}', now(), now()),
  ('a7000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'other@flyee.invalid', '', '{}', '{"display_name":"Other"}', now(), now());

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'a7000000-0000-4000-8000-000000000001') as org,
  (select org_id from public.memberships where user_id = 'a7000000-0000-4000-8000-000000000002') as other_org,
  (select id from public.oauth_clients where client_id = 'flyee-cli') as cli;
grant select on ctx to authenticated, service_role;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated, service_role;

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select (select org from ctx), 'kit', p.id, p.limits, 'asaas:kit_a7' from public.plans p where p.slug = 'kit';

-- ---------- Registering ----------

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.register_member_device('a7000000-0000-4000-8000-000000000001', (select org from ctx), 'laptop-0001')$$,
  '42501', null,
  'a session cannot register a device; only the delivery API can'
);
select ok(
  (public.member_activation_facts() ->> 'has_access')::boolean
  and not (public.member_activation_facts() ->> 'has_device')::boolean,
  'before any device, the facts say: access yes, device no'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('d1', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'laptop-0001', 'c7000000-0000-4000-8000-0000000000f1',
  'Work laptop', 'macos', '15.1', 'claude_code', '0.3.0', '0.9.0', '[{"slug":"deploy-guard","version":"1.2.0"}]', 'own', false));
insert into res values ('d1_again', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'laptop-0001', 'c7000000-0000-4000-8000-0000000000f1',
  null, null, null, null, '0.3.1', null, null, null, true));
insert into res values ('d2', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'desktop-0002', 'c7000000-0000-4000-8000-0000000000f2'));
insert into res values ('bad', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'x', null));
insert into res values ('foreign', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select other_org from ctx), 'laptop-0003', null));
reset role;

select is((select payload ->> 'code' from res where name = 'd1'), 'created', 'the first call creates the device');
select ok(
  (select payload ->> 'code' = 'updated' from res where name = 'd1_again')
  and (select cli_version = '0.3.1' and last_update_at is not null and name = 'Work laptop'
       from public.member_devices where device_id = 'laptop-0001'),
  'later calls refresh what changed and keep what was not sent'
);
select ok(
  (select payload ->> 'code' = 'device_limit_reached' and (payload ->> 'limit')::int = 1 from res where name = 'd2'),
  'a second machine on the kit hits the ceiling of one device'
);
select is((select payload ->> 'code' from res where name = 'bad'), 'invalid_device', 'a malformed device id is refused');
select is((select payload ->> 'code' from res where name = 'foreign'), 'not_authorized', 'nobody registers a device into somebody else''s workspace');
select is(
  -- This member's machines only: a live project records real installs too.
  (select count(*)::int from public.product_events
   where event_name = 'cli.installed' and actor_id = 'a7000000-0000-4000-8000-000000000001'),
  1,
  'the first registration of a machine is the install event, and only the first'
);

-- The subscription raises the ceiling.
update public.subscriptions set plan_id = (select id from public.plans where slug = 'club-mensal')
where org_id = (select org from ctx) and status = 'active';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('d2_club', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'desktop-0002', 'c7000000-0000-4000-8000-0000000000f2'));
reset role;
select is((select payload ->> 'code' from res where name = 'd2_club'), 'created', 'on the subscription the second machine fits');

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.member_devices), 0, 'nobody sees another account''s devices');
reset role;

-- ---------- Revoking ----------

insert into public.oauth_tokens (client_id, org_id, user_id, access_token_hash, refresh_token_hash, scope, family_id, device_id,
                                 access_expires_at, refresh_expires_at)
values
  ((select cli from ctx), (select org from ctx), 'a7000000-0000-4000-8000-000000000001', 'h-access-1', 'h-refresh-1', 'catalog:read',
   'c7000000-0000-4000-8000-0000000000f1', 'laptop-0001', now() + interval '1 hour', now() + interval '30 days'),
  ((select cli from ctx), (select org from ctx), 'a7000000-0000-4000-8000-000000000001', 'h-access-2', 'h-refresh-2', 'catalog:read',
   'c7000000-0000-4000-8000-0000000000f1', 'laptop-0001', now() + interval '1 hour', now() + interval '30 days'),
  ((select cli from ctx), (select org from ctx), 'a7000000-0000-4000-8000-000000000001', 'h-access-3', 'h-refresh-3', 'catalog:read',
   'c7000000-0000-4000-8000-0000000000f2', 'desktop-0002', now() + interval '1 hour', now() + interval '30 days');

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('revoke', public.revoke_member_device((select id from public.member_devices where device_id = 'laptop-0001')));
reset role;

select ok(
  (select (payload ->> 'tokensRevoked')::int = 2 from res where name = 'revoke')
  and (select count(*)::int from public.oauth_tokens where family_id = 'c7000000-0000-4000-8000-0000000000f1' and revoked_at is null) = 0
  and (select count(*)::int from public.oauth_tokens where family_id = 'c7000000-0000-4000-8000-0000000000f2' and revoked_at is null) = 1,
  'revoking a machine revokes its whole token family and nothing else'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('same_family', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'laptop-0001', 'c7000000-0000-4000-8000-0000000000f1'));
insert into res values ('new_login', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'laptop-0001', 'c7000000-0000-4000-8000-0000000000f9'));
reset role;
select is((select payload ->> 'code' from res where name = 'same_family'), 'device_revoked', 'the revoked chain cannot bring the machine back');
select is((select payload ->> 'code' from res where name = 'new_login'), 'revived', 'a new login can');

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.revoke_member_tokens((select org from ctx), 'canceled')$$,
  '42501', 'not_authorized',
  'a member cannot mass-revoke tokens'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.revoke_member_tokens((select org from ctx), 'canceled');
reset role;
select is(
  (select count(*)::int from public.oauth_tokens where org_id = (select org from ctx) and revoked_at is null),
  0,
  'losing access cuts every token of the workspace at once'
);

-- ---------- Suspension and rate ----------

update public.subscriptions set admin_suspended = true where org_id = (select org from ctx) and status = 'active';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('suspended', public.register_member_device(
  'a7000000-0000-4000-8000-000000000001', (select org from ctx), 'tablet-0004', null));
reset role;
select is((select payload ->> 'code' from res where name = 'suspended'), 'not_entitled', 'a suspended workspace registers nothing');
update public.subscriptions set admin_suspended = false where org_id = (select org from ctx) and status = 'active';

insert into public.cli_requests (org_id, endpoint, status)
select (select org from ctx), 'catalog', 'ok' from generate_series(1, 60);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select ok(
  not (public.cli_rate_allowance((select org from ctx)) ->> 'allowed')::boolean,
  'sixty calls in a minute exhaust the per-minute ceiling'
);
reset role;

-- ---------- Activation ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.track_product_event_server('a7000000-0000-4000-8000-000000000001', (select org from ctx), 'tool.executed', '{}', null, 'cli');
reset role;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select ok(
  (select bool_and(value::boolean) from jsonb_each_text(public.member_activation_facts())),
  'after a profile, access, a device and a first execution, every activation fact is true'
);
reset role;

select * from finish();
rollback;
