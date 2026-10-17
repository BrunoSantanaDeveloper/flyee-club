begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ============================================================
-- The copy rules (docs/PRODUCT.md, 2026-10-07): no dash (— or –), no
-- exclamation mark, no emoji and none of the banned words in a text a person
-- reads. Here: every text the migrations seed, the legal texts in force among
-- them (history tables and switched-off versions are records, not pages).
-- The texts the app ships are checked by apps/web/src/lib/i18n/copy-rules.test.ts.
-- ============================================================

-- An emoji is what the app calls one (lib/i18n/copy-rules.ts, the e2e text
-- check): a code point with the Unicode property Extended_Pictographic, © aside.
-- Postgres has no such property, so the class lists its ranges, generated from
-- that property; copy-rules.test.ts fails when the two drift and prints the
-- class to paste. Status marks such as ✓ ✗ △ ○ are not emoji (2026-10-17).
create function pg_temp.emoji_class() returns text language sql immutable as $emoji$
  select '['
    || '\u00AE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9-\u21AA\u231A-\u231B'
    || '\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA-\u25AB\u25B6\u25C0'
    || '\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614-\u2615\u2618\u261D\u2620'
    || '\u2622-\u2623\u2626\u262A\u262E-\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653'
    || '\u265F-\u2660\u2663\u2665-\u2666\u2668\u267B\u267E-\u267F\u2692-\u2697\u2699'
    || '\u269B-\u269C\u26A0-\u26A1\u26A7\u26AA-\u26AB\u26B0-\u26B1\u26BD-\u26BE\u26C4-\u26C5\u26C8'
    || '\u26CE-\u26CF\u26D1\u26D3-\u26D4\u26E9-\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702'
    || '\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721'
    || '\u2728\u2733-\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757'
    || '\u2763-\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C'
    || '\u2B50\u2B55\u3030\u303D\u3297\u3299\U0001F004\U0001F02C-\U0001F02F'
    || '\U0001F094-\U0001F09F\U0001F0AF-\U0001F0B0\U0001F0C0\U0001F0CF-\U0001F0D0\U0001F0F6-\U0001F0FF\U0001F170-\U0001F171\U0001F17E-\U0001F17F\U0001F18E'
    || '\U0001F191-\U0001F19A\U0001F1AE-\U0001F1E5\U0001F201-\U0001F20F\U0001F21A\U0001F22F\U0001F232-\U0001F23A\U0001F23C-\U0001F23F\U0001F249-\U0001F25F'
    || '\U0001F266-\U0001F321\U0001F324-\U0001F393\U0001F396-\U0001F397\U0001F399-\U0001F39B\U0001F39E-\U0001F3F0\U0001F3F3-\U0001F3F5\U0001F3F7-\U0001F3FA\U0001F400-\U0001F4FD'
    || '\U0001F4FF-\U0001F53D\U0001F549-\U0001F54E\U0001F550-\U0001F567\U0001F56F-\U0001F570\U0001F573-\U0001F57A\U0001F587\U0001F58A-\U0001F58D\U0001F590'
    || '\U0001F595-\U0001F596\U0001F5A4-\U0001F5A5\U0001F5A8\U0001F5B1-\U0001F5B2\U0001F5BC\U0001F5C2-\U0001F5C4\U0001F5D1-\U0001F5D3\U0001F5DC-\U0001F5DE'
    || '\U0001F5E1\U0001F5E3\U0001F5E8\U0001F5EF\U0001F5F3\U0001F5FA-\U0001F64F\U0001F680-\U0001F6C5\U0001F6CB-\U0001F6D2'
    || '\U0001F6D5-\U0001F6E5\U0001F6E9\U0001F6EB-\U0001F6F0\U0001F6F3-\U0001F6FF\U0001F7DA-\U0001F7FF\U0001F80C-\U0001F80F\U0001F848-\U0001F84F\U0001F85A-\U0001F85F'
    || '\U0001F888-\U0001F88F\U0001F8AE-\U0001F8AF\U0001F8BC-\U0001F8BF\U0001F8C2-\U0001F8CF\U0001F8D9-\U0001F8FF\U0001F90C-\U0001F93A\U0001F93C-\U0001F945\U0001F947-\U0001F9FF'
    || '\U0001FA58-\U0001FA5F\U0001FA6E-\U0001FAFF\U0001FC00-\U0001FFFD'
    || ']'
$emoji$;

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
          ('emoji', pg_temp.emoji_class(), '.{0,40}' || pg_temp.emoji_class() || '.{0,40}'),
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
  '✓ passou · ✗ reprovou · △ aviso · ○ não medido' !~ pg_temp.emoji_class(),
  'the status marks of a guide are not emoji, as on the site'
);
select ok(
  'Pronto 🎉' ~ pg_temp.emoji_class() and '✔ feito' ~ pg_temp.emoji_class() and 'Nota ⭐' ~ pg_temp.emoji_class(),
  'an emoji is still refused'
);
select ok(
  '© 2026 FlyeeClub → Entrar' !~ pg_temp.emoji_class(),
  '© and → stay, as the brief keeps them'
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
