-- ============================================================
-- 0029_store_categories: two layers in the catalog (2026-10-06).
--
-- The seven stages (catalog_trails) stay the catalog's taxonomy: a module's
-- manifest names its stage, and the member area, the roadmap, the broad-use
-- rule and the CLI API read it. The public store (the home and /catalogo)
-- filters by STORE CATEGORIES instead, the kinds of work of the home brief:
-- Vender, Divulgar, Vídeo, Pesquisa, Construir. A category is data the
-- operator edits in /admin/catalogo, never part of a manifest, so it changes
-- without a new version. An app without one shows only under "Todos".
--
-- Example: the video-editing app is in the stage Divulgar ("get the product
-- found") and in the store category Vídeo.
-- ============================================================

create table public.catalog_store_categories (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name jsonb not null check (public.i18n_ok(name, true)),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_store_categories is
  'The kinds of work the public store filters by (the home and /catalogo). Edited in /admin/catalogo; the stages (catalog_trails) stay the catalog''s taxonomy.';

alter table public.catalog_store_categories enable row level security;

-- Public metadata, like the stages.
create policy "catalog_store_categories_select" on public.catalog_store_categories
  for select to anon, authenticated
  using (true);

create policy "catalog_store_categories_all_superadmin" on public.catalog_store_categories
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_store_categories to anon;
grant select, insert, update, delete on table public.catalog_store_categories to authenticated;

create trigger catalog_store_categories_updated_at
  before update on public.catalog_store_categories
  for each row execute function public.set_updated_at();

insert into public.catalog_store_categories (slug, name, sort) values
  ('sell', '{"pt-BR": "Vender", "en": "Sell"}', 10),
  ('promote', '{"pt-BR": "Divulgar", "en": "Promote"}', 20),
  ('video', '{"pt-BR": "Vídeo", "en": "Video"}', 30),
  ('research', '{"pt-BR": "Pesquisa", "en": "Research"}', 40),
  ('build', '{"pt-BR": "Construir", "en": "Build"}', 50);

-- ---------- A module's store category ----------

-- Optional. A category that is deleted leaves its apps uncategorized (they
-- stay in "Todos"); the console refuses to delete one that apps still use.
alter table public.catalog_modules
  add column store_category text references public.catalog_store_categories (slug)
    on update cascade on delete set null;

create index catalog_modules_store_category_idx on public.catalog_modules (store_category)
  where store_category is not null;

comment on column public.catalog_modules.store_category is
  'The kind of work the public store lists the app under (catalog_store_categories). Data from the console, not the manifest; null means "Todos" only.';
