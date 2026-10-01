begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ============================================================
-- The catalog (0008).
--
-- Metadata is public; what is sold is not. A released version is frozen
-- (members verify its checksum), withdrawn only by yanking, never deleted.
-- The package location never reaches a session. Lesson videos and recipe
-- workflows are released by entitlement, inside the database.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'free@flyee.invalid', '', '{}', '{"display_name":"Free"}', now(), now()),
  ('a6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('a6000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'club@flyee.invalid', '', '{}', '{"display_name":"Club"}', now(), now());

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_a6'
from public.memberships m, public.plans p
where m.user_id = 'a6000000-0000-4000-8000-000000000002' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'a6000000-0000-4000-8000-000000000003' and s.org_id = m.org_id and s.status = 'active';

insert into public.catalog_modules (id, slug, trail, type, name, summary)
values ('b6000000-0000-4000-8000-000000000001', 'deploy-guard', 'publicar', 'skill',
        '{"pt-BR": "Guarda de deploy", "en": "Deploy guard"}', '{"pt-BR": "Confere antes de publicar."}');

insert into public.catalog_module_versions (id, module_id, version, storage_path, sha256, size_bytes, permissions)
values
  ('b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000001', '1.2.0',
   'modules/deploy-guard/1.2.0/deploy-guard-1.2.0.zip', repeat('a', 64), 2048, '[{"kind": "fs:read", "scope": "./", "reason": "Reads the project"}]'),
  ('b6000000-0000-4000-8000-000000000012', 'b6000000-0000-4000-8000-000000000001', '1.10.0',
   'modules/deploy-guard/1.10.0/deploy-guard-1.10.0.zip', repeat('b', 64), 4096, '[]'),
  ('b6000000-0000-4000-8000-000000000013', 'b6000000-0000-4000-8000-000000000001', '2.0.0-beta.1',
   'modules/deploy-guard/2.0.0-beta.1/deploy-guard-2.0.0-beta.1.zip', repeat('c', 64), 4096, '[]');

-- ---------- Shape ----------

select throws_ok(
  $$insert into public.catalog_module_versions (module_id, version, storage_path, sha256, size_bytes)
    values ('b6000000-0000-4000-8000-000000000001', '1.0', 'x', repeat('d', 64), 1)$$,
  '23514', null,
  'a version must be semver'
);
select throws_ok(
  $$update public.catalog_modules set status = 'published' where id = 'b6000000-0000-4000-8000-000000000001'$$,
  '23514', 'module_has_no_published_version',
  'a module cannot go public with nothing to install'
);

update public.catalog_module_versions set status = 'published'
where id in ('b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000012');
update public.catalog_modules set status = 'published' where id = 'b6000000-0000-4000-8000-000000000001';

select ok(
  (select published_at is not null from public.catalog_modules where slug = 'deploy-guard')
  and (select bool_and(published_at is not null) from public.catalog_module_versions where status = 'published'),
  'publishing stamps the module and its versions'
);
select is(
  (select version from public.catalog_latest_version('b6000000-0000-4000-8000-000000000001')),
  '1.10.0',
  'the latest version is the highest semver, not the last string in alphabetical order'
);

-- ---------- Frozen once released ----------

select throws_ok(
  $$update public.catalog_module_versions set sha256 = repeat('e', 64) where id = 'b6000000-0000-4000-8000-000000000011'$$,
  '23514', 'version_released_immutable',
  'the checksum of a released version can never change'
);
select throws_ok(
  $$delete from public.catalog_module_versions where id = 'b6000000-0000-4000-8000-000000000011'$$,
  '23514', 'version_released_immutable',
  'a released version is never deleted'
);
select throws_ok(
  $$update public.catalog_module_versions set status = 'draft' where id = 'b6000000-0000-4000-8000-000000000011'$$,
  '23514', 'invalid_version_transition',
  'and never goes back to draft'
);
select throws_ok(
  $$update public.catalog_module_versions set status = 'yanked' where id = 'b6000000-0000-4000-8000-000000000011'$$,
  '23514', null,
  'withdrawing a version requires a reason'
);

update public.catalog_module_versions set is_stable = true where id = 'b6000000-0000-4000-8000-000000000011';
update public.catalog_module_versions set status = 'yanked', yank_reason = 'Broke on Windows'
where id = 'b6000000-0000-4000-8000-000000000011';

select ok(
  (select yanked_at is not null and not is_stable from public.catalog_module_versions where id = 'b6000000-0000-4000-8000-000000000011'),
  'a yanked version is stamped and is nobody''s stable version'
);
select throws_ok(
  $$delete from public.catalog_modules where id = 'b6000000-0000-4000-8000-000000000001'$$,
  '23514', 'module_was_published',
  'a module that was ever public is archived, never deleted'
);

-- ---------- What a visitor may read ----------

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.catalog_modules), 1, 'a visitor reads the published catalog');
select is(
  (select count(*)::int from public.catalog_module_versions),
  2,
  'and the released versions, yanked included, but never a draft'
);
select throws_ok(
  $$select storage_path from public.catalog_module_versions$$,
  '42501', null,
  'the package location is not readable by any session'
);
select throws_ok(
  $$select manifest from public.catalog_module_versions$$,
  '42501', null,
  'nor is the manifest'
);
select ok(
  (select public.verify_module_version('deploy-guard', '1.2.0') ->> 'status' = 'yanked'
          and not (public.verify_module_version('deploy-guard', '1.2.0') ? 'storage_path')
          and public.verify_module_version('deploy-guard', '1.2.0') ->> 'sha256' = repeat('a', 64)),
  'the verification lookup tells anybody the checksum and that the version was withdrawn, and nothing about where it lives'
);
select is(
  public.verify_module_version('deploy-guard', '2.0.0-beta.1'),
  null,
  'a draft version does not exist from outside'
);
reset role;

-- ---------- Lessons ----------

insert into public.catalog_lessons (id, module_id, depth, locale, title, is_advanced)
values
  ('b6000000-0000-4000-8000-000000000021', 'b6000000-0000-4000-8000-000000000001', 'usar', 'pt-BR', 'Como usar', false),
  ('b6000000-0000-4000-8000-000000000022', 'b6000000-0000-4000-8000-000000000001', 'abrir_o_capo', 'pt-BR', 'Por dentro', true);
insert into public.catalog_lesson_videos (lesson_id, youtube_id)
values ('b6000000-0000-4000-8000-000000000021', 'abcDEF12345'), ('b6000000-0000-4000-8000-000000000022', 'xyzXYZ98765');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.catalog_lessons), 2, 'lesson titles are public');
select throws_ok($$select youtube_id from public.catalog_lesson_videos$$, '42501', null, 'the video ids are not');
reset role;

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.catalog_lesson_videos), 0, 'an account without access sees no video');
select is(
  (public.record_lesson_progress('b6000000-0000-4000-8000-000000000021') ->> 'code'),
  'not_entitled',
  'and cannot record progress on a lesson it cannot open'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(lesson_id) from public.catalog_lesson_videos),
  array['b6000000-0000-4000-8000-000000000021'::uuid],
  'the kit opens the basic lesson and not the advanced one'
);
select public.record_lesson_progress('b6000000-0000-4000-8000-000000000021');
select public.record_lesson_progress('b6000000-0000-4000-8000-000000000021', true);
select public.record_lesson_progress('b6000000-0000-4000-8000-000000000021', true);
reset role;

select is(
  (select array_agg(event_name order by event_name) from public.product_events where actor_id = 'a6000000-0000-4000-8000-000000000002'),
  array['lesson.completed', 'lesson.started'],
  'starting and finishing a lesson are each recorded once'
);

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.catalog_lesson_videos), 2, 'the subscription opens the advanced lesson too');
reset role;

-- ---------- Recipes ----------

insert into public.catalog_recipes (id, slug, name, status)
values ('b6000000-0000-4000-8000-000000000031', 'launch-week', '{"pt-BR": "Semana de lançamento"}', 'published');
insert into public.catalog_recipe_workflows (recipe_id, body_md)
values ('b6000000-0000-4000-8000-000000000031', '{"pt-BR": "1. Rode a guarda de deploy."}');

select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.catalog_recipes) * 10 + (select count(*)::int from public.catalog_recipe_workflows),
  10,
  'the kit sees that a recipe exists, but not its workflow'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.catalog_recipe_workflows), 1, 'the subscription opens the workflow');
reset role;

select * from finish();
rollback;
