-- ============================================================
-- 0032_module_personas: which personas an app is a good start for
-- (2026-10-06).
--
-- The home brief's "Para quem é" block shows, for each persona of the site
-- (negocio, agencia, produto, dev: the member segments since 0028), the apps
-- to start with. The brief wrote those apps by hand; the public site shows
-- only published apps and real data. Decided (option 1): the operator marks,
-- per app, the personas it is a good start for, in /admin/catalogo, like the
-- store category: data, never part of a manifest. The block shows up to three
-- published apps per persona; a persona no app is marked for shows none.
-- `outro` is an answer, not a persona, so an app is never marked for it.
-- ============================================================

alter table public.catalog_modules
  add column personas public.member_segment[] not null default '{}'
    check (not ('outro' = any (personas)) and cardinality(personas) <= 4);

comment on column public.catalog_modules.personas is
  'The site personas (member_segment, outro excluded) this app is a good start for, marked by the operator. Read by the "Para quem é" block; empty means none.';

-- Each persona's starters are a filter over published modules.
create index catalog_modules_personas_idx on public.catalog_modules using gin (personas);
