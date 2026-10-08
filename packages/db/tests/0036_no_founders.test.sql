begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- ============================================================
-- The founders offer is gone (0038): no reading of seats and deadline, no
-- switch, and its plan, kept for history, sells and grants nothing.
-- ============================================================

select hasnt_function('public', 'founders_offer', 'no function reads a founders offer any more');

select ok(
  not exists (select 1 from public.platform_settings where key = 'founders'),
  'the founders switch is gone from the settings'
);

select ok(
  (select not is_active and not is_public and not listed_on_site
   from public.plans where slug = 'club-fundador-anual'),
  'the founders plan stays for history, inactive and off every grid and the site'
);

select * from finish();
rollback;
