begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ============================================================
-- Segments (0028): the segments are the public site's personas, plus
-- `outro`. A sign-up and the profile RPC take the new names and refuse the
-- old ones; the reports list exactly these.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('af000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'business@flyee.invalid', '', '{}', '{"display_name":"Business","segment":"negocio"}', now(), now()),
  ('af000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'legacy@flyee.invalid', '', '{}', '{"display_name":"Legacy","segment":"produto_proprio"}', now(), now());

select is(
  enum_range(null::public.member_segment)::text[],
  array['produto', 'agencia', 'negocio', 'dev', 'outro'],
  'the segments are the four personas of the site and outro'
);

select is(
  (select segment::text from public.profiles where id = 'af000000-0000-4000-8000-000000000001'),
  'negocio',
  'a sign-up from the business persona stamps the profile'
);
select is(
  (select segment::text from public.profiles where id = 'af000000-0000-4000-8000-000000000002'),
  null,
  'an old name in a sign-up is ignored, like any unknown value'
);

select set_config('request.jwt.claims', '{"sub":"af000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.update_member_profile(null, 'profissional_ia', null, null, null)$$,
  '22023', 'invalid_segment',
  'the retired segment is refused by the profile RPC'
);
select lives_ok(
  $$select public.update_member_profile(null, 'agencia', null, null, null)$$,
  'and a persona is accepted'
);
reset role;

select is(
  (select segment::text from public.profiles where id = 'af000000-0000-4000-8000-000000000002'),
  'agencia',
  'the profile reads the new name'
);

select * from finish();
rollback;
