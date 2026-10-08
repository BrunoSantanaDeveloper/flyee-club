begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ============================================================
-- Which plans the public site lists (0037): FlyeeClub, in reais and in
-- dollars. FlyeeClub Pro stays on the member area's grids and off the site,
-- and a plan the operator creates starts off the site.
-- ============================================================

select has_column('public', 'plans', 'listed_on_site', 'a plan says whether the public site lists it');

select is(
  (select array_agg(slug order by slug) from public.plans where listed_on_site),
  array['kit', 'kit-usd'],
  'the site lists FlyeeClub, in reais and in dollars, and nothing else'
);

select ok(
  (select bool_and(is_public and not listed_on_site)
   from public.plans
   where slug in ('club-mensal', 'club-anual', 'club-mensal-usd', 'club-anual-usd')),
  'FlyeeClub Pro stays on the member area''s grids and off the site'
);

insert into public.plans (slug, name, family, period, price_cents)
values ('test-new-plan', 'Test', 'test', 'monthly', 100);
select is(
  (select listed_on_site from public.plans where slug = 'test-new-plan'),
  false,
  'a new plan starts off the site'
);

select * from finish();
rollback;
