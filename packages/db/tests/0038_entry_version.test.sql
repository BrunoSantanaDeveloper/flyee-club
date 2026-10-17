begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- ============================================================
-- The entry version of each app (0040). The account with no purchase is on
-- the free channel and installs the entry version only; any purchase moves it
-- to latest, whatever order the sources merge in. The first released version
-- is the entry version until the operator moves or clears the mark; a marked
-- version is never yanked; the basic guide and video follow the mark.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'free-entry@flyee.invalid', '', '{}', '{"display_name":"Free"}', now(), now()),
  ('c8000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit-entry@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('c8000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pro-entry@flyee.invalid', '', '{}', '{"display_name":"Pro"}', now(), now()),
  ('c8000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-entry@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'c8000000-0000-4000-8000-000000000004';

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_c8'
from public.memberships m, public.plans p
where m.user_id = 'c8000000-0000-4000-8000-000000000002' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'c8000000-0000-4000-8000-000000000003' and s.org_id = m.org_id and s.status = 'active';

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'c8000000-0000-4000-8000-000000000001') as free_org,
  (select org_id from public.memberships where user_id = 'c8000000-0000-4000-8000-000000000002') as kit_org,
  (select org_id from public.memberships where user_id = 'c8000000-0000-4000-8000-000000000003') as pro_org;
grant select on ctx to authenticated;

-- ---------- The channel ----------

select is(
  array[
    public.entitlement_merge('{"update_channel": "latest"}', '{"update_channel": "free"}') ->> 'update_channel',
    public.entitlement_merge('{"update_channel": "free"}', '{"update_channel": "latest"}') ->> 'update_channel',
    public.entitlement_merge('{"update_channel": "free"}', '{"update_channel": "free"}') ->> 'update_channel',
    public.entitlement_merge('{"devices": 1}', '{"update_channel": "free"}') ->> 'update_channel'
  ],
  array['latest', 'latest', 'free', 'free'],
  'the widest channel wins whatever the order, and a channel alone is kept'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  array[
    public.org_entitlements((select free_org from ctx)) -> 'limits' ->> 'update_channel',
    public.org_entitlements((select kit_org from ctx)) -> 'limits' ->> 'update_channel',
    public.org_entitlements((select pro_org from ctx)) -> 'limits' ->> 'update_channel'
  ],
  array['free', 'latest', 'latest'],
  'no purchase is the free channel; FlyeeClub stays latest though the free subscription merges after it'
);

-- ---------- The mark ----------

insert into public.catalog_modules (id, slug, trail, type, name)
values ('c8100000-0000-4000-8000-000000000001', 'motion-loop', 'divulgar', 'skill', '{"pt-BR": "Motion loop"}');

insert into public.catalog_module_versions (id, module_id, version, storage_path, sha256, size_bytes, guides)
values
  ('c8100000-0000-4000-8000-000000000011', 'c8100000-0000-4000-8000-000000000001', '1.0.0',
   'motion-loop/1.0.0/motion-loop-1.0.0.zip', repeat('a', 64), 1024, '{"pt-BR": ["usar", "abrir_o_capo"]}'),
  ('c8100000-0000-4000-8000-000000000012', 'c8100000-0000-4000-8000-000000000001', '1.1.0',
   'motion-loop/1.1.0/motion-loop-1.1.0.zip', repeat('b', 64), 1024, '{"pt-BR": ["usar"]}'),
  ('c8100000-0000-4000-8000-000000000013', 'c8100000-0000-4000-8000-000000000001', '1.2.0',
   'motion-loop/1.2.0/motion-loop-1.2.0.zip', repeat('c', 64), 1024, '{}');

update public.catalog_module_versions set status = 'published' where id = 'c8100000-0000-4000-8000-000000000011';
update public.catalog_module_versions set status = 'published' where id = 'c8100000-0000-4000-8000-000000000012';
update public.catalog_modules set status = 'published' where id = 'c8100000-0000-4000-8000-000000000001';

select is(
  (select array_agg(version || ':' || is_entry::text order by version) from public.catalog_module_versions
   where module_id = 'c8100000-0000-4000-8000-000000000001'),
  array['1.0.0:true', '1.1.0:false', '1.2.0:false'],
  'the first released version is the entry version, and only it'
);

select throws_ok(
  $$update public.catalog_module_versions set is_entry = true where id = 'c8100000-0000-4000-8000-000000000013'$$,
  '23514', null,
  'a draft is never an entry version'
);
select throws_ok(
  $$update public.catalog_module_versions set is_entry = true where id = 'c8100000-0000-4000-8000-000000000012'$$,
  '23505', null,
  'an app has one entry version at most'
);
select throws_ok(
  $$update public.catalog_module_versions set status = 'yanked', yank_reason = 'test' where id = 'c8100000-0000-4000-8000-000000000011'$$,
  '23514', 'entry_version_yank',
  'the entry version is never yanked while it carries the mark'
);

-- ---------- What follows the mark ----------

insert into public.catalog_guides (version_id, depth, locale, body_md) values
  ('c8100000-0000-4000-8000-000000000011', 'usar', 'pt-BR', '# Usar a entrada'),
  ('c8100000-0000-4000-8000-000000000011', 'abrir_o_capo', 'pt-BR', '# Por dentro'),
  ('c8100000-0000-4000-8000-000000000012', 'usar', 'pt-BR', '# Usar a atual');

insert into public.catalog_lessons (id, module_id, depth, locale, title, is_advanced)
values
  ('c8100000-0000-4000-8000-000000000021', 'c8100000-0000-4000-8000-000000000001', 'usar', 'pt-BR', 'Como usar', false),
  ('c8100000-0000-4000-8000-000000000022', 'c8100000-0000-4000-8000-000000000001', 'abrir_o_capo', 'pt-BR', 'Por dentro', true);
insert into public.catalog_lesson_videos (lesson_id, youtube_id)
values ('c8100000-0000-4000-8000-000000000021', 'abcDEF12345'), ('c8100000-0000-4000-8000-000000000022', 'xyzXYZ98765');

create temporary table seen (name text primary key, guides text[], videos int);
grant select, insert on seen to authenticated;

create function pg_temp.look_as(person uuid, label text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', person, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into seen values (
    label,
    coalesce((
      select array_agg(g.depth || '@' || v.version order by v.version, g.depth)
      from public.catalog_guides g join public.catalog_module_versions v on v.id = g.version_id
      -- The test's app only: a live project carries the real apps' guides and videos too.
      where v.module_id = 'c8100000-0000-4000-8000-000000000001'
    ), '{}'),
    (select count(*)::int from public.catalog_lesson_videos where lesson_id::text like 'c8100000-%')
  );
  execute 'reset role';
end;
$$;

select pg_temp.look_as('c8000000-0000-4000-8000-000000000001', 'free');
select pg_temp.look_as('c8000000-0000-4000-8000-000000000002', 'kit');

select is(
  (select guides from seen where name = 'free'),
  array['usar@1.0.0'],
  'the account with no purchase reads the basic guide of the entry version, and nothing else'
);
select is((select videos from seen where name = 'free'), 1, 'and watches the basic video of an app with an entry version');
select is(
  (select guides from seen where name = 'kit'),
  array['usar@1.0.0', 'usar@1.1.0'],
  'FlyeeClub reads the basic guide of every released version, and still no advanced one'
);

-- ---------- Moving the mark ----------

select set_config('request.jwt.claims', '{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.catalog_set_entry_version('c8100000-0000-4000-8000-000000000001', 'c8100000-0000-4000-8000-000000000012')$$,
  '42501', null,
  'a member cannot move the mark'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"c8000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.catalog_set_entry_version('c8100000-0000-4000-8000-000000000001', 'c8100000-0000-4000-8000-000000000013')$$,
  '23514', 'entry_version_invalid',
  'the mark goes only to a published version of the same app'
);
select lives_ok(
  $$select public.catalog_set_entry_version('c8100000-0000-4000-8000-000000000001', 'c8100000-0000-4000-8000-000000000012')$$,
  'the operator moves the mark'
);
reset role;

select is(
  (select array_agg(version order by version) from public.catalog_module_versions
   where module_id = 'c8100000-0000-4000-8000-000000000001' and is_entry),
  array['1.1.0'],
  'in one step: the app never has two entry versions, nor none in between'
);

select pg_temp.look_as('c8000000-0000-4000-8000-000000000001', 'free_moved');
select is(
  (select guides from seen where name = 'free_moved'),
  array['usar@1.1.0'],
  'the basic guide the account with no purchase reads moves with the mark'
);

select set_config('request.jwt.claims', '{"sub":"c8000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.catalog_set_entry_version('c8100000-0000-4000-8000-000000000001', null)$$,
  'the operator clears the mark'
);
reset role;

select pg_temp.look_as('c8000000-0000-4000-8000-000000000001', 'free_cleared');
select ok(
  (select guides = '{}'::text[] and videos = 0 from seen where name = 'free_cleared'),
  'an app without an entry version gives the account with no purchase nothing to read or watch'
);

select lives_ok(
  $$update public.catalog_module_versions set status = 'yanked', yank_reason = 'Quebrou no Windows' where id = 'c8100000-0000-4000-8000-000000000011'$$,
  'a version without the mark is yanked as before'
);

-- ---------- The free sample is gone ----------

select hasnt_column('public', 'catalog_modules', 'is_free_sample', 'the module-wide free sample left: one rule, the entry version');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select lives_ok(
  $$select count(*) from public.catalog_module_versions where is_entry$$,
  'which version is the entry one is metadata a session may read, like is_stable'
);
reset role;

select * from finish();
rollback;
