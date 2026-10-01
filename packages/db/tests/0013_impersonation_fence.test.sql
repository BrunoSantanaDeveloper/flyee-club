begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ============================================================
-- The support-visit fence (0012). Member writes go from the browser straight
-- to the API, so the fence lives in the database. It never expires: a fence
-- that lifted when the visit ended would turn a stale support session into a
-- full-privilege session of the member.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ad000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now()),
  ('ad000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('ad000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'other-operator@flyee.invalid', '', '{}', '{"display_name":"Other operator"}', now(), now());

update public.profiles set is_superadmin = true
where id in ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000003');

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'ad000000-0000-4000-8000-000000000002' and s.org_id = m.org_id and s.status = 'active';

insert into public.roadmap_items (id, title) values ('bd000000-0000-4000-8000-000000000001', '{"pt-BR": "Ideia"}');
insert into public.member_devices (id, org_id, user_id, device_id)
select 'bd000000-0000-4000-8000-000000000002', m.org_id, m.user_id, 'laptop-ad01'
from public.memberships m where m.user_id = 'ad000000-0000-4000-8000-000000000002';

insert into public.impersonation_sessions (actor_id, target_user_id, reason, session_id, expires_at)
values
  ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000002',
   'Member reported a broken install', 'fd000000-0000-4000-8000-000000000001', now() + interval '30 minutes'),
  -- An operator visiting another operator's account.
  ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000003',
   'Checking a console permission', 'fd000000-0000-4000-8000-000000000002', now() + interval '30 minutes');

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"fd000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select ok(public.is_impersonated() and public.impersonation_active(), 'inside the visit both signals are on');
insert into res values ('vote', public.cast_roadmap_vote('bd000000-0000-4000-8000-000000000001'));
insert into res values ('revoke', public.revoke_member_device('bd000000-0000-4000-8000-000000000002'));
insert into res values ('profile', public.update_member_profile(null, 'outro', null, null, null));
reset role;

select is((select payload ->> 'code' from res where name = 'vote'), 'support_session', 'support does not vote in the member''s name');
select is((select payload ->> 'code' from res where name = 'revoke'), 'support_session', 'nor disconnect the member''s machine');
select ok(
  exists (select 1 from public.audit_events where action = 'member.profile_updated' and (metadata ->> 'support_session')::boolean),
  'a profile fix made during a visit is audited as made by support'
);

select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"fd000000-0000-4000-8000-000000000001"}', true);
select throws_ok(
  $$insert into public.member_devices (org_id, user_id, device_id)
    select org_id, user_id, 'tablet-ad02' from public.memberships where user_id = 'ad000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'even a privileged write carrying the visit''s claims is refused by the table fence'
);
select throws_ok(
  $$delete from public.roadmap_votes where user_id = 'ad000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'and the fence is per statement, so a write that touches no row is refused too'
);

update public.impersonation_sessions set ended_at = now(), ended_reason = 'done'
where session_id = 'fd000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"fd000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select ok(
  public.is_impersonated() and not public.impersonation_active(),
  'after the visit ends the session is no longer active, and the fence still holds'
);
reset role;

select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"fd000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_user_superadmin('ad000000-0000-4000-8000-000000000002', true, 'from a visit')$$,
  'P0001', 'not_authorized',
  'visiting another operator does not borrow their power to grant the platform role'
);
select throws_ok(
  $$delete from public.organizations where id = (select org_id from public.memberships where user_id = 'ad000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'nor to delete a workspace'
);
reset role;

select * from finish();
rollback;
