begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ============================================================
-- catalog_modules.showcase (migration 0043): the example of an app answering
-- a request, per language, read by the store like the name and the summary.
-- ============================================================

insert into public.catalog_modules (id, slug, trail, type, name, summary)
values ('b4300000-0000-4000-8000-000000000001', 'example-check', 'planejar', 'tool',
        '{"pt-BR": "Exemplo"}', '{"pt-BR": "Um app de teste."}');

select is(
  (select showcase from public.catalog_modules where id = 'b4300000-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  'an app starts with no example'
);

select ok(
  has_column_privilege('anon', 'public.catalog_modules', 'showcase', 'select')
    and has_column_privilege('authenticated', 'public.catalog_modules', 'showcase', 'select'),
  'a visitor and a member read the example, as they read the name'
);

select throws_ok(
  $$ update public.catalog_modules set showcase = '[]'::jsonb where id = 'b4300000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'the example is an object by language, never a list'
);

select lives_ok(
  $$ update public.catalog_modules
     set showcase = '{"pt-BR": {"request": "Me ajuda?", "reply": [{"text": "Claro."}]}}'::jsonb
     where id = 'b4300000-0000-4000-8000-000000000001' $$,
  'and holds one language or both'
);

select * from finish();
rollback;
