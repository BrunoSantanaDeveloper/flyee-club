begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ============================================================
-- Tracking terms (0022): the Pixel and GA4 also load in the member dashboard,
-- so version 2 of the privacy and cookie policies is the one in force, in both
-- languages, and version 1 stays on record, switched off.
-- ============================================================

select is(
  (select count(*)::int from public.consent_terms
   where slug in ('privacy', 'cookies') and version = 2 and is_active),
  4,
  'version 2 of the privacy and cookie policies is in force in both languages'
);

select is(
  (select count(*)::int from public.consent_terms
   where slug in ('privacy', 'cookies') and version = 1 and not is_active),
  4,
  'version 1 stays on record, switched off'
);

select ok(
  (select body_md like '%painel de integrante%' from public.consent_terms
   where slug = 'cookies' and locale = 'pt-BR' and is_active),
  'the Portuguese cookie policy names the member dashboard'
);

select ok(
  (select body_md like '%member dashboard%' from public.consent_terms
   where slug = 'cookies' and locale = 'en' and is_active),
  'the English cookie policy names the member dashboard'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select version from public.current_consent_terms('en') where slug = 'privacy'),
  2,
  'the public legal pages read version 2'
);
reset role;

select * from finish();
rollback;
