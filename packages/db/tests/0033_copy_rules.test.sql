begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ============================================================
-- The copy rules (docs/PRODUCT.md, 2026-10-07): no dash (— or –), no
-- exclamation mark, no emoji and none of the banned words in a text a person
-- reads. Here: every text the migrations seed, the legal texts in force among
-- them (history tables and switched-off versions are records, not pages).
-- The texts the app ships are checked by apps/web/src/lib/i18n/copy-rules.test.ts.
-- ============================================================

create function pg_temp.copy_rule_hits()
returns table (tbl text, col text, kind text, snippet text)
language plpgsql as $f$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.table_name not in ('record_versions', 'audit_events', 'schema_migrations')
      and (c.data_type in ('text', 'jsonb', 'json', 'character varying') or c.udt_name = 'citext')
  loop
    return query execute format(
      $q$
        select %L::text, %L::text, h.kind, substring(s.v from h.ctx)
        from (select %I::text as v from public.%I %s) s
        cross join lateral (values
          ('dash', '[–—]', '.{0,60}[–—].{0,60}'),
          ('exclamation', '[[:alnum:]]!', '.{0,60}[[:alnum:]]!.{0,20}'),
          ('emoji', '[☀-➿⬀-⯿️\U0001F000-\U0001FAFF]',
                    '.{0,40}[☀-➿⬀-⯿️\U0001F000-\U0001FAFF].{0,40}'),
          ('word', '\m(desbloque|potencializ|sem esfor[cç]o|solu[cç](ão|ões) inovador|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it.?s not just)',
                   '.{0,60}\m(?:desbloque|potencializ|sem esfor[cç]o|solu[cç](?:ão|ões) inovador|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it.?s not just).{0,60}')
        ) as h(kind, pat, ctx)
        where s.v ~* h.pat
      $q$,
      r.table_name, r.column_name, r.column_name, r.table_name,
      case when r.table_name = 'consent_terms' then 'where is_active' else '' end
    );
  end loop;
end
$f$;

select is_empty(
  $$ select tbl, col, kind, snippet from pg_temp.copy_rule_hits() $$,
  'no seeded text in force has a dash, an exclamation mark, an emoji or a banned word'
);

select ok(
  (select count(*) = 2 and bool_and(version >= case slug when 'cli-connection' then 2 else 5 end)
   from public.consent_terms
   where locale = 'en' and is_active and slug in ('cli-connection', 'terms')),
  'migration 0035 put version 2 of the English CLI connection term and version 5 of the English terms in force, or a later one (the English 6 came with migration 0041)'
);
select ok(
  (select n.body_md = replace(o.body_md, 'It unlocks the app store', 'It gives access to the app store')
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = 4 and not o.is_active
   where n.slug = 'terms' and n.locale = 'en' and n.version = 5),
  'the English terms differ from version 4, kept on record, by that verb alone'
);
select ok(
  (select n.body_md = replace(o.body_md, 'your plan unlocks', 'your plan includes')
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = 1 and not o.is_active
   where n.slug = 'cli-connection' and n.locale = 'en' and n.version = 2),
  'and so does the English CLI connection term from version 1'
);
select ok(
  (select count(*) = 2 and bool_and(case slug when 'cli-connection' then version = 1 else version >= 4 end)
   from public.consent_terms
   where locale = 'pt-BR' and is_active and slug in ('cli-connection', 'terms')),
  'the Portuguese texts, already inside the rules, kept their versions through 0035 (the Portuguese terms 5 came with migration 0041)'
);

select * from finish();
rollback;
