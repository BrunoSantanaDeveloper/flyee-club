-- ============================================================
-- 0042_version_guides_readable: the sessions can read which guides a version
-- carries (2026-10-16).
--
-- catalog_module_versions is read through COLUMN grants (migration 0008), so
-- no session ever reads the package's address or its manifest. A column added
-- later needs a grant of its own: 0040 gave one to `is_entry`, and 0030 gave
-- none to `guides`, which it calls public metadata. Every session read that
-- named the column was refused with "permission denied for table": the catalog
-- console (/admin/catalogo and each app's page), the guide of an app in the
-- member area and on the public page, and the "Em breve" check of the Pro
-- areas. The service role, which the upload and the CLI API use, was never
-- affected. pgTAP 0040_version_columns_readable now fails on the next column
-- that forgets its grant.
-- ============================================================

grant select (guides) on table public.catalog_module_versions to anon, authenticated;
