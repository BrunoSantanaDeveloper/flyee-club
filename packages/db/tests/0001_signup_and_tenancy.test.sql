begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ============================================================
-- Sign-up and tenancy (0000, 0001, 0003).
--
-- One person is one account: the sign-up trigger creates the profile AND the
-- personal workspace for every new auth user, puts it on the free plan, and
-- reads only the metadata it knows how to validate. Then the fences: a member
-- sees only their own rows, cannot create a second workspace, cannot attach
-- anybody to their workspace, and edits the metric dimensions only through
-- the audited RPC.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana@flyee.invalid', '', '{}', '{"display_name":"Ana Souza","segment":"dev","ai_tool":"codex","locale":"en"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bruno@flyee.invalid', '', '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'carla@flyee.invalid', '', '{"provider":"google"}', '{"full_name":"Carla Lima","segment":"astronaut","ai_tool":"nope","locale":"fr"}', now(), now());

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'a1000000-0000-4000-8000-000000000001') as ana_org,
  (select org_id from public.memberships where user_id = 'a1000000-0000-4000-8000-000000000002') as bruno_org,
  (select org_id from public.memberships where user_id = 'a1000000-0000-4000-8000-000000000003') as carla_org;
grant select on ctx to authenticated, anon, service_role;

create temporary table results (name text primary key, payload jsonb);
grant select, insert on results to authenticated;

-- ---------- The trigger ----------

select is(
  (select row(display_name, segment::text, ai_tool::text, locale)::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000001'),
  row('Ana Souza', 'dev', 'codex', 'en')::text,
  'the profile takes the name, segment, AI tool and language from the sign-up metadata'
);
select is(
  (select row(display_name, locale)::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000002'),
  row('bruno', 'pt-BR')::text,
  'with no metadata, the name falls back to the e-mail local part and the language to Portuguese'
);
select is(
  (select row(display_name, segment::text, ai_tool::text, locale)::text from public.profiles where id = 'a1000000-0000-4000-8000-000000000003'),
  row('Carla Lima', null, null, 'pt-BR')::text,
  'an OAuth full name is used, and unknown segment, tool and language are ignored instead of failing the sign-up'
);
select is(
  (select count(*)::int from public.memberships where user_id = 'a1000000-0000-4000-8000-000000000001' and role = 'owner'),
  1,
  'every account owns exactly one workspace'
);
select ok(
  (select name = 'Ana Souza' and slug ~ '^ana-souza-a1000000$' from public.organizations where id = (select ana_org from ctx)),
  'the workspace is named after the member, with an accent-safe slug and an id suffix'
);
select is(
  (select p.slug from public.subscriptions s join public.plans p on p.id = s.plan_id
   where s.org_id = (select ana_org from ctx) and s.status = 'active'),
  'gratuito',
  'a new workspace starts on the free plan'
);

-- ---------- What a member sees ----------

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(public.current_org_id(), (select ana_org from ctx), 'current_org_id() answers with the caller''s own workspace');
select is((select count(*)::int from public.organizations), 1, 'a member sees one workspace: their own');
select is((select count(*)::int from public.profiles), 1, 'and one profile: their own');
select is((select count(*)::int from public.subscriptions), 1, 'and only their own subscription');

select throws_ok(
  $$select public.create_organization('Second', 'second-workspace')$$,
  'P0001', 'workspace_limit_reached',
  'a member cannot create a second workspace'
);
select throws_ok(
  $$insert into public.memberships (org_id, user_id, role)
    values ((select ana_org from ctx), 'a1000000-0000-4000-8000-000000000002', 'member')$$,
  '42501', null,
  'a member cannot attach another person to their workspace'
);
select throws_ok(
  $$update public.profiles set segment = 'outro' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'the metric dimensions are not writable directly: they go through the audited RPC'
);
select throws_ok(
  $$update public.profiles set is_superadmin = true where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'nor is the platform-operator flag'
);
select throws_ok(
  $$delete from public.organizations where id = (select ana_org from ctx)$$,
  '42501', null,
  'a member cannot delete their workspace with a direct write'
);
select lives_ok(
  $$update public.profiles set display_name = 'Ana S.' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'the display name is a plain column write'
);

insert into results values (
  'ana_profile',
  public.update_member_profile(null, 'freelancer_agencia', 'claude_code', 'pt-BR', 'America/Sao_Paulo')
);
select throws_ok(
  $$select public.update_member_profile(null, 'astronaut', null, null, null)$$,
  '22023', 'invalid_segment',
  'an unknown segment is refused by the RPC'
);
select throws_ok(
  $$select public.update_member_profile(null, null, null, null, 'Mars/Olympus')$$,
  '22023', 'invalid_timezone',
  'and so is a timezone the database does not know'
);
reset role;

select is(
  (select name from public.organizations where id = (select ana_org from ctx)),
  'Ana S.',
  'renaming the member renames the personal workspace that carried the old name'
);
select ok(
  (select (payload ->> 'completed')::boolean = false
          and payload -> 'changed' ?& array['segment', 'ai_tool', 'locale']
   from results where name = 'ana_profile'),
  'the RPC reports what changed, and a profile that was already complete is not "completed" again'
);
select ok(
  exists (
    select 1 from public.audit_events
    where action = 'member.profile_updated'
      and actor_id = 'a1000000-0000-4000-8000-000000000001'
      and metadata ->> 'segment' = 'freelancer_agencia'
  ),
  'the change of segment is audited'
);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
insert into results values ('carla_profile', public.update_member_profile(null, 'dev', 'cursor', null, null));
reset role;

select is(
  (select (payload ->> 'completed')::boolean from results where name = 'carla_profile'),
  true,
  'the first time segment and AI tool are both known, the RPC says the profile was completed'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501', null,
  'an anonymous visitor cannot read profiles at all'
);
reset role;

select * from finish();
rollback;
