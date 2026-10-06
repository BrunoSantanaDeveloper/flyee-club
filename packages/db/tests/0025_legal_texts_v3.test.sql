begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ============================================================
-- Legal texts, version 3 (0027): the cookie policy names the segment cookie
-- and the click measurement, the privacy policy names the platform FlyeeClub,
-- both in both languages; version 2 stays on record, switched off.
-- ============================================================

select is(
  (select count(*)::int from public.consent_terms
   where slug in ('privacy', 'cookies') and version = 3 and is_active),
  4,
  'version 3 of the privacy and cookie policies is in force in both languages'
);
select is(
  (select count(*)::int from public.consent_terms
   where slug in ('privacy', 'cookies') and version = 2 and not is_active),
  4,
  'version 2 stays on record, switched off'
);
select ok(
  (select body_md like '%**Segmento**%90 dias%' and body_md like '%cliques nas páginas%'
   from public.consent_terms where slug = 'cookies' and locale = 'pt-BR' and is_active),
  'the Portuguese cookie policy names the segment cookie, its window and the click measurement'
);
select ok(
  (select body_md like '%**Segment**%90 days%' and body_md like '%clicks on the pages%'
   from public.consent_terms where slug = 'cookies' and locale = 'en' and is_active),
  'the English cookie policy says the same'
);
select ok(
  (select bool_and(body_md like '%FlyeeClub%' and body_md not like '%flyee.club%')
   from public.consent_terms where slug = 'privacy' and is_active),
  'the privacy policy names the platform FlyeeClub, never the old name'
);
select ok(
  (select bool_and(replace(n.body_md, 'FlyeeClub', 'flyee.club') = o.body_md)
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = 2
   where n.slug = 'privacy' and n.version = 3),
  'and nothing else in it changed'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select version from public.current_consent_terms('en') where slug = 'cookies'),
  3,
  'the public legal pages read version 3'
);
reset role;

select * from finish();
rollback;
