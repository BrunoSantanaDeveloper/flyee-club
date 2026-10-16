begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ============================================================
-- catalog_module_versions is read through COLUMN grants (migration 0008):
-- anon and authenticated read every column but the package's address, its
-- manifest and its author. A column added later needs its own grant, and
-- `guides` (0030) shipped without one: every session read that named it was
-- refused, /admin/catalogo included, until migration 0042. The scan below
-- fails on the next column that forgets it.
-- ============================================================

select is(
  (select coalesce(array_agg(a.attname::text order by a.attnum), '{}')
   from pg_attribute a
   where a.attrelid = 'public.catalog_module_versions'::regclass
     and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('storage_path', 'manifest', 'created_by')
     and not has_column_privilege('authenticated', a.attrelid, a.attnum, 'select')),
  '{}'::text[],
  'a signed-in session reads every column of a version but its address, manifest and author'
);

select is(
  (select coalesce(array_agg(a.attname::text order by a.attnum), '{}')
   from pg_attribute a
   where a.attrelid = 'public.catalog_module_versions'::regclass
     and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('storage_path', 'manifest', 'created_by')
     and not has_column_privilege('anon', a.attrelid, a.attnum, 'select')),
  '{}'::text[],
  'and so does a visitor, for the versions RLS lets them see'
);

select ok(
  not has_column_privilege('anon', 'public.catalog_module_versions', 'storage_path', 'select')
    and not has_column_privilege('authenticated', 'public.catalog_module_versions', 'storage_path', 'select')
    and not has_column_privilege('anon', 'public.catalog_module_versions', 'manifest', 'select')
    and not has_column_privilege('authenticated', 'public.catalog_module_versions', 'manifest', 'select'),
  'the package address and the manifest stay closed to every session'
);

select ok(
  has_column_privilege('anon', 'public.catalog_module_versions', 'guides', 'select')
    and has_column_privilege('authenticated', 'public.catalog_module_versions', 'guides', 'select'),
  'which guides a version carries is public metadata, as 0030 says'
);

select * from finish();
rollback;
