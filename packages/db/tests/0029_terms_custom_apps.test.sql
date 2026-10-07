begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ============================================================
-- Terms of use, version 4 (0031): an app built on demand joins the store for
-- every member, unless an exclusivity agreement is made before hiring; the
-- rest of the text is version 3's, word for word.
-- ============================================================

select is(
  (select array_agg(version >= 4 order by locale) from public.consent_terms where slug = 'terms' and is_active),
  array[true, true],
  'version 4 of the terms, or a later one, is in force in both languages (the English 5 came with migration 0035)'
);
select ok(
  (select body_md like '%entra na loja para todos os integrantes%' and body_md like '%acordo de exclusividade%'
   from public.consent_terms where slug = 'terms' and locale = 'pt-BR' and version = 4),
  'the Portuguese text says a commissioned app is public unless exclusivity is agreed'
);
select ok(
  (select body_md like '%joins the store for every member%' and body_md like '%exclusivity agreement%'
   from public.consent_terms where slug = 'terms' and locale = 'en' and version = 4),
  'and so does the English one'
);
select ok(
  (select bool_and(length(n.body_md) > length(o.body_md) and position(o.title in n.title) = 1)
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = 3
   where n.slug = 'terms' and n.version = 4 and not o.is_active),
  'version 3 stays on record, switched off'
);

select * from finish();
rollback;
