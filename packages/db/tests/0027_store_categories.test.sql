begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ============================================================
-- Store categories (0029): the kinds of work the public store filters by,
-- public metadata edited only by the operator; a module's category is
-- optional, must exist, and falls back to "Todos" when its category goes.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member-store@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-store@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'b1000000-0000-4000-8000-000000000002';

insert into public.catalog_modules (id, slug, trail, type, name)
values ('b1100000-0000-4000-8000-000000000001', 'video-cut', 'divulgar', 'tool', '{"pt-BR": "Corte de vídeo"}');

select is(
  (select array_agg(slug order by sort) from public.catalog_store_categories),
  array['sell', 'promote', 'video', 'research', 'build'],
  'the store starts with the kinds of work of the home brief, in their order'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select name ->> 'en' from public.catalog_store_categories where slug = 'video'),
  'Video',
  'anybody reads the categories, in both languages'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.catalog_store_categories (slug, name) values ('mine', '{"pt-BR": "Minha"}')$$,
  '42501', null,
  'a member does not create categories'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.catalog_modules set store_category = 'video' where slug = 'video-cut'$$,
  'the operator puts the video app in the store category Vídeo'
);
select throws_ok(
  $$update public.catalog_modules set store_category = 'nope' where slug = 'video-cut'$$,
  '23503', null,
  'a category that does not exist is refused'
);
select lives_ok(
  $$insert into public.catalog_store_categories (slug, name, sort) values ('design', '{"pt-BR": "Design", "en": "Design"}', 60)$$,
  'and creates a new category'
);
reset role;

select is(
  (select trail || '/' || store_category from public.catalog_modules where slug = 'video-cut'),
  'divulgar/video',
  'the stage and the store category are two layers of the same app'
);

delete from public.catalog_store_categories where slug = 'video';
select is(
  (select store_category from public.catalog_modules where slug = 'video-cut'),
  null,
  'a deleted category leaves its apps uncategorized, listed under "Todos"'
);

select * from finish();
rollback;
