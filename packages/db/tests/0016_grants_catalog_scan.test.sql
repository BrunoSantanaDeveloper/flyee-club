begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ============================================================
-- The privilege model, scanned from the catalog (every migration).
--
-- The project is secure by default: nothing in `public` is reachable by the
-- API roles unless a migration grants it. These assertions read the system
-- catalog, so a table or function added later is covered without anybody
-- remembering this file. A failure here means: decide on purpose, then update
-- the allowlist.
-- ============================================================

select is(
  (
    select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  '{}'::text[],
  'every table has row level security'
);

select is(
  (
    select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
      and has_any_column_privilege('anon', c.oid, 'SELECT')
  ),
  array[
    'blog_comments',
    'blog_posts',
    'catalog_lessons',
    'catalog_module_versions',
    'catalog_modules',
    'catalog_recipe_modules',
    'catalog_recipes',
    'catalog_store_categories',
    'catalog_trails',
    'consent_terms',
    'help_articles',
    'help_categories',
    'platform_settings'
  ],
  'an anonymous visitor can read exactly the public catalog, the legal texts, the help center, the blog and the public settings'
);

select is(
  (
    select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'INSERT')
           or has_table_privilege('anon', c.oid, 'UPDATE')
           or has_table_privilege('anon', c.oid, 'DELETE')
           or has_any_column_privilege('anon', c.oid, 'INSERT')
           or has_any_column_privilege('anon', c.oid, 'UPDATE'))
  ),
  '{}'::text[],
  'and can write nothing'
);

select is(
  (
    select coalesce(array_agg(p.proname::text order by p.proname), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ),
  array['catalog_latest_version', 'current_consent_terms', 'roadmap_coming_next', 'verify_module_version'],
  'an anonymous visitor can call exactly four functions (roadmap_coming_next since 0033; founders_offer left in 0038)'
);

select ok(
  not has_column_privilege('anon', 'public.catalog_module_versions', 'storage_path', 'SELECT')
  and not has_column_privilege('authenticated', 'public.catalog_module_versions', 'storage_path', 'SELECT')
  and not has_column_privilege('authenticated', 'public.catalog_module_versions', 'manifest', 'SELECT'),
  'no session can read where a package lives, or its manifest'
);

select ok(
  not has_column_privilege('authenticated', 'public.oauth_tokens', 'access_token_hash', 'SELECT')
  and not has_column_privilege('authenticated', 'public.oauth_tokens', 'refresh_token_hash', 'SELECT'),
  'no session can read token hashes'
);

select is(
  (
    select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_any_column_privilege('authenticated', c.oid, 'SELECT')
  ),
  array[
    'billing_webhook_events',
    'lead_submissions',
    'meta_attribution',
    'newsletter_deliveries',
    'oauth_device_codes',
    'oauth_grants'
  ],
  'the tables only the backend touches are not readable by any session'
);

select is(
  (
    select coalesce(array_agg(p.proname::text order by p.proname), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as setting where setting like 'search_path=%'
      )
  ),
  '{}'::text[],
  'every security definer function pins its search_path'
);

select is(
  (
    select coalesce(array_agg(p.proname::text order by p.proname), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('public', p.oid, 'EXECUTE')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('catalog_latest_version', 'current_consent_terms', 'verify_module_version')
  ),
  '{}'::text[],
  'no other function is left executable by PUBLIC'
);

select * from finish();
rollback;
