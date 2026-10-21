begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ============================================================
-- One Claude Code session in the cloud per account, out of the device
-- ceiling (migration 0044, the product's request of 2026-10-20, item 4).
--
-- A FlyeeClub account with a ceiling of one and its PC connected registers a
-- cloud session; a second cloud session replaces the first and its tokens,
-- never the PC; a second PC is still refused; a row never changes kind; and
-- with cloud_sessions at 0 a new cloud session is a computer, as before:
-- refused at the ceiling, given a computer's place when one is free.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a4400000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cloud-member@flyee.invalid', '', '{}', '{"display_name":"Cloud member","segment":"dev","ai_tool":"claude_code"}', now(), now());

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'a4400000-0000-4000-8000-000000000001') as org,
  (select id from public.oauth_clients where client_id = 'flyee-cli') as cli;
grant select on ctx to service_role;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to service_role;

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select (select org from ctx), 'kit', p.id, p.limits, 'asaas:kit_a44' from public.plans p where p.slug = 'kit';

select ok(
  not exists (select 1 from public.plans where not (limits ? 'cloud_sessions')),
  'every plan carries its cloud place'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('pc', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'pc-0000001', target_token_family => 'c4400000-0000-4000-8000-0000000000a1'));
insert into res values ('cloud_1', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'cloud-0000001', target_token_family => 'c4400000-0000-4000-8000-0000000000b1',
  target_cloud => 'claude_code'));
reset role;

select is((select payload ->> 'code' from res where name = 'pc'), 'created', 'the PC takes the one computer place');
select ok(
  (select payload ->> 'code' = 'created' and payload -> 'device' ->> 'cloud' = 'claude_code' from res where name = 'cloud_1'),
  'with the PC connected, a cloud session is still created'
);
select is((select (payload ->> 'live_devices')::int from res where name = 'cloud_1'), 1, 'and the computers stay at one');

insert into public.oauth_tokens (client_id, org_id, user_id, access_token_hash, refresh_token_hash, scope, family_id, device_id,
                                 access_expires_at, refresh_expires_at)
values
  ((select cli from ctx), (select org from ctx), 'a4400000-0000-4000-8000-000000000001', 'h44-access-pc', 'h44-refresh-pc',
   'catalog:read', 'c4400000-0000-4000-8000-0000000000a1', 'pc-0000001', now() + interval '1 hour', now() + interval '30 days'),
  ((select cli from ctx), (select org from ctx), 'a4400000-0000-4000-8000-000000000001', 'h44-access-c1', 'h44-refresh-c1',
   'catalog:read', 'c4400000-0000-4000-8000-0000000000b1', 'cloud-0000001', now() + interval '1 hour', now() + interval '30 days');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('cloud_2', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'cloud-0000002', target_token_family => 'c4400000-0000-4000-8000-0000000000b2',
  target_cloud => 'claude_code'));
insert into res values ('pc_2', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'pc-0000002', target_token_family => 'c4400000-0000-4000-8000-0000000000a2'));
reset role;

select ok(
  (select payload ->> 'code' = 'created' and (payload ->> 'cloud_replaced')::int = 1 from res where name = 'cloud_2'),
  'a second cloud session is created and replaces one'
);
select ok(
  (select revoked_at is not null and revoke_reason = 'replaced' from public.member_devices where device_id = 'cloud-0000001'),
  'the older cloud session is revoked as replaced'
);
select is(
  (select count(*)::int from public.oauth_tokens where device_id = 'cloud-0000001' and revoked_at is null),
  0,
  'and its tokens with it'
);
select ok(
  (select revoked_at is null from public.member_devices where device_id = 'pc-0000001')
  and (select count(*)::int from public.oauth_tokens where device_id = 'pc-0000001' and revoked_at is null) = 1,
  'the PC stays connected, tokens included: a cloud place never takes a computer'
);
select is((select (payload ->> 'live_devices')::int from res where name = 'cloud_2'), 1, 'live_devices still counts one computer');
select ok(
  exists (
    select 1 from public.product_events
    where actor_id = 'a4400000-0000-4000-8000-000000000001' and event_name = 'device.revoked'
      and properties ->> 'reason' = 'replaced'
  ),
  'the replacement is a device.revoked event with its reason'
);
select is(
  (select payload ->> 'code' from res where name = 'pc_2'),
  'device_limit_reached',
  'a second PC is still refused: the cloud rows leave the computer count as it was'
);

select throws_ok(
  $$ update public.member_devices set cloud = 'claude_code' where device_id = 'pc-0000001' $$,
  '23514',
  null,
  'a row never changes kind'
);

-- With no cloud place, the answer is the one of today.
update public.plans set limits = limits || '{"cloud_sessions": 0}'::jsonb where is_free;
update public.entitlement_grants set limits = limits || '{"cloud_sessions": 0}'::jsonb where org_id = (select org from ctx);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('cloud_none', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'cloud-0000003', target_token_family => 'c4400000-0000-4000-8000-0000000000b3',
  target_cloud => 'claude_code'));
reset role;
select is((select payload ->> 'code' from res where name = 'cloud_none'), 'device_limit_reached', 'with cloud_sessions at 0 and the PC in the one place, the device limit');
select ok(
  (select revoked_at is null from public.member_devices where device_id = 'cloud-0000002'),
  'and the session in place is left alone'
);

-- A second computer place: the cloud session takes it, as a computer.
update public.entitlement_grants set limits = limits || '{"devices": 2}'::jsonb where org_id = (select org from ctx);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('cloud_as_pc', public.register_member_device(
  target_user => 'a4400000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'cloud-0000004', target_token_family => 'c4400000-0000-4000-8000-0000000000b4',
  target_cloud => 'claude_code'));
reset role;
select ok(
  (select payload ->> 'code' = 'created' and payload -> 'device' ->> 'cloud' is null from res where name = 'cloud_as_pc'),
  'with cloud_sessions at 0, a cloud session is registered as a computer'
);
select is((select (payload ->> 'live_devices')::int from res where name = 'cloud_as_pc'), 2, 'and it counts among the computers');

select * from finish();
rollback;
