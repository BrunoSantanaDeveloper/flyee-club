begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- ============================================================
-- Store badges (0034): how long an app is "Novo" is public data the store
-- reads and only the operator changes.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('b5000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'member-badges@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now());

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select (value ->> 'new_badge_days')::int from public.platform_settings where key = 'catalog'),
  30,
  'a visitor reads how many days an app stays "Novo" (30 to start)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b5000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.platform_settings set value = '{"new_badge_days": 365}' where key = 'catalog';
reset role;
select is(
  (select (value ->> 'new_badge_days')::int from public.platform_settings where key = 'catalog'),
  30,
  'a member cannot change it (the write reaches no row)'
);

select ok(
  (select is_public from public.platform_settings where key = 'catalog'),
  'the setting is public, because the public store reads it'
);

select * from finish();
rollback;
