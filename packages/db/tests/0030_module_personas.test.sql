begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ============================================================
-- Module personas (0032): the personas an app is a good start for, marked by
-- the operator, read by anybody on a published app, never `outro`.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member-personas@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('b3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-personas@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'b3000000-0000-4000-8000-000000000002';

insert into public.catalog_modules (id, slug, trail, type, name)
values ('b3100000-0000-4000-8000-000000000001', 'copy-lp', 'vender', 'skill', '{"pt-BR": "Copy LP"}');

insert into public.catalog_module_versions (id, module_id, version, status, storage_path, sha256, size_bytes, published_at)
values ('b3100000-0000-4000-8000-000000000011', 'b3100000-0000-4000-8000-000000000001', '1.0.0', 'published',
        'copy-lp/1.0.0/copy-lp-1.0.0.zip', repeat('c', 64), 1024, now());

select is(
  (select personas::text[] from public.catalog_modules where slug = 'copy-lp'),
  '{}'::text[],
  'an app starts marked for no persona'
);

select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.catalog_modules set personas = '{negocio,agencia,produto}', status = 'published' where slug = 'copy-lp'$$,
  'the operator marks the personas an app is a good start for'
);
select throws_ok(
  $$update public.catalog_modules set personas = '{negocio,outro}' where slug = 'copy-lp'$$,
  '23514', null,
  'outro is an answer, not a persona'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.catalog_modules set personas = '{dev}' where slug = 'copy-lp';
reset role;
select is(
  (select personas::text[] from public.catalog_modules where slug = 'copy-lp'),
  array['negocio', 'agencia', 'produto'],
  'a member cannot change them (the write reaches no row)'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select personas::text[] from public.catalog_modules where slug = 'copy-lp'),
  array['negocio', 'agencia', 'produto'],
  'a visitor reads the personas of a published app'
);
select is(
  (select count(*)::int from public.catalog_modules where 'agencia' = any (personas)),
  1,
  'and filters the published apps by persona'
);
reset role;

select * from finish();
rollback;
