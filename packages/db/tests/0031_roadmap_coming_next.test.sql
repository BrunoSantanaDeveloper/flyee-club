begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ============================================================
-- "Próximos na loja" (0033): a visitor reads the planned and building ideas
-- with the month an idea won and the commissioned mark, nothing else of the
-- roadmap; only the operator writes those marks.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b4000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member-next@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('b4000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-next@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'b4000000-0000-4000-8000-000000000002';

insert into public.roadmap_items (id, title, status) values
  ('b4100000-0000-4000-8000-000000000001', '{"pt-BR": "Em construção"}', 'building'),
  ('b4100000-0000-4000-8000-000000000002', '{"pt-BR": "Vencedora"}', 'proposed'),
  ('b4100000-0000-4000-8000-000000000003', '{"pt-BR": "Contratada"}', 'planned'),
  ('b4100000-0000-4000-8000-000000000004', '{"pt-BR": "Em análise"}', 'submitted'),
  ('b4100000-0000-4000-8000-000000000005', '{"pt-BR": "Recusada"}', 'declined'),
  ('b4100000-0000-4000-8000-000000000006', '{"pt-BR": "Entregue"}', 'shipped');

select set_config('request.jwt.claims', '{"sub":"b4000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.roadmap_items set status = 'planned', won_month = '2026-10-01' where id = 'b4100000-0000-4000-8000-000000000002'$$,
  'the operator plans the month''s leader and records the month it won'
);
select lives_ok(
  $$update public.roadmap_items set commissioned = true where id = 'b4100000-0000-4000-8000-000000000003'$$,
  'and marks an idea that came from a paid request'
);
select throws_ok(
  $$update public.roadmap_items set won_month = '2026-10-15' where id = 'b4100000-0000-4000-8000-000000000002'$$,
  '23514', null,
  'a won month is a month, its first day'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.roadmap_items set commissioned = false where id = 'b4100000-0000-4000-8000-000000000003';
reset role;
select is(
  (select commissioned from public.roadmap_items where id = 'b4100000-0000-4000-8000-000000000003'),
  true,
  'a member cannot change the marks (the write reaches no row)'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select array_agg(title ->> 'pt-BR' order by title ->> 'pt-BR') from public.roadmap_coming_next()),
  array['Contratada', 'Em construção', 'Vencedora'],
  'a visitor reads only the planned and building ideas'
);
select is(
  (select title ->> 'pt-BR' from public.roadmap_coming_next() limit 1),
  'Em construção',
  'building first'
);
select throws_ok($$select count(*) from public.roadmap_items$$, '42501', null, 'and never the roadmap itself');
reset role;

select * from finish();
rollback;
