begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ============================================================
-- Guides (0030): the written guide of a version, per depth and language.
-- The basic guide is read with FlyeeClub, the advanced one with FlyeeClub Pro,
-- a draft only by the operator, and nobody writes a guide but the upload.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'free-guides@flyee.invalid', '', '{}', '{"display_name":"Free"}', now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit-guides@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('b2000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pro-guides@flyee.invalid', '', '{}', '{"display_name":"Pro"}', now(), now()),
  ('b2000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-guides@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'b2000000-0000-4000-8000-000000000004';

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_b2'
from public.memberships m, public.plans p
where m.user_id = 'b2000000-0000-4000-8000-000000000002' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'b2000000-0000-4000-8000-000000000003' and s.org_id = m.org_id and s.status = 'active';

insert into public.catalog_modules (id, slug, trail, type, name)
values ('b2100000-0000-4000-8000-000000000001', 'video-cut', 'divulgar', 'tool', '{"pt-BR": "Corte de vídeo"}');

insert into public.catalog_module_versions (id, module_id, version, status, storage_path, sha256, size_bytes, guides, published_at)
values
  ('b2100000-0000-4000-8000-000000000011', 'b2100000-0000-4000-8000-000000000001', '1.0.0', 'published',
   'video-cut/1.0.0/video-cut-1.0.0.zip', repeat('a', 64), 1024, '{"pt-BR": ["usar", "abrir_o_capo"]}', now()),
  ('b2100000-0000-4000-8000-000000000012', 'b2100000-0000-4000-8000-000000000001', '1.1.0', 'draft',
   'video-cut/1.1.0/video-cut-1.1.0.zip', repeat('b', 64), 1024, '{"pt-BR": ["usar"]}', null);

update public.catalog_modules set status = 'published' where id = 'b2100000-0000-4000-8000-000000000001';

insert into public.catalog_guides (version_id, depth, locale, body_md) values
  ('b2100000-0000-4000-8000-000000000011', 'usar', 'pt-BR', '# Usar\n\n1. Rode o app.'),
  ('b2100000-0000-4000-8000-000000000011', 'abrir_o_capo', 'pt-BR', '# Por dentro'),
  ('b2100000-0000-4000-8000-000000000012', 'usar', 'pt-BR', '# Rascunho');

create temporary table res (name text primary key, depths text[]);
grant select, insert on res to authenticated;

create function pg_temp.read_as(person uuid, label text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', person, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into res values (
    label,
    coalesce((select array_agg(depth || '@' || version_id::text order by depth, version_id) from public.catalog_guides), '{}')
  );
  execute 'reset role';
end;
$$;

select pg_temp.read_as('b2000000-0000-4000-8000-000000000001', 'free');
select pg_temp.read_as('b2000000-0000-4000-8000-000000000002', 'kit');
select pg_temp.read_as('b2000000-0000-4000-8000-000000000003', 'pro');
select pg_temp.read_as('b2000000-0000-4000-8000-000000000004', 'operator');

select is((select depths from res where name = 'free'), '{}'::text[], 'an account without access reads no guide of a paid app');
select is(
  (select depths from res where name = 'kit'),
  array['usar@b2100000-0000-4000-8000-000000000011'],
  'FlyeeClub reads the basic guide of the released version, not the advanced one'
);
select is(
  (select depths from res where name = 'pro'),
  array['abrir_o_capo@b2100000-0000-4000-8000-000000000011', 'usar@b2100000-0000-4000-8000-000000000011'],
  'FlyeeClub Pro reads both depths of the released version, and no draft'
);
select is(
  (select cardinality(depths) from res where name = 'operator'),
  3,
  'the operator reads the draft too'
);

select ok(
  (select guides ? 'pt-BR' and not guides ? 'en' from public.catalog_module_versions where id = 'b2100000-0000-4000-8000-000000000011'),
  'which guides a version carries is public metadata on the version'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select count(*) from public.catalog_guides$$, '42501', null, 'a visitor cannot read guides at all');
reset role;

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.catalog_guides (version_id, depth, locale, body_md) values ('b2100000-0000-4000-8000-000000000011', 'usar', 'en', 'x')$$,
  '42501', null,
  'not even the operator writes a guide: it comes from the package'
);
select throws_ok(
  $$update public.catalog_guides set body_md = 'changed' where version_id = 'b2100000-0000-4000-8000-000000000011'$$,
  '42501', null,
  'and nobody edits one'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.can_read_guide('b2100000-0000-4000-8000-000000000011', 'abrir_o_capo'), false, 'the rule answers the same for FlyeeClub');
reset role;

update public.catalog_module_versions set status = 'yanked', yanked_at = now(), yank_reason = 'test'
where id = 'b2100000-0000-4000-8000-000000000011';
select pg_temp.read_as('b2000000-0000-4000-8000-000000000002', 'kit_yanked');
select is(
  (select depths from res where name = 'kit_yanked'),
  array['usar@b2100000-0000-4000-8000-000000000011'],
  'a yanked version keeps its guide for whoever has it installed'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select lives_ok(
  $$insert into public.catalog_guides (version_id, depth, locale, body_md) values ('b2100000-0000-4000-8000-000000000012', 'abrir_o_capo', 'pt-BR', '# Por dentro')$$,
  'the upload, as the service role, writes the guides of a version'
);
reset role;

delete from public.catalog_module_versions where id = 'b2100000-0000-4000-8000-000000000012';
select is(
  (select count(*)::int from public.catalog_guides where version_id = 'b2100000-0000-4000-8000-000000000012'),
  0,
  'discarding a draft takes its guide with it'
);

select * from finish();
rollback;
