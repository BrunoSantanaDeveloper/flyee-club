-- ============================================================
-- 0034_store_badges: how long an app is "Novo" in the store (2026-10-06).
--
-- The home brief's store cards carry "Novo" and "Usa sua conta {serviço}",
-- both hand-written in the brief. Decided (option 1): both come from data.
-- "Usa sua conta" is the names of the app's required external credentials
-- (catalog_modules.external_credentials, written in the console). "Novo" is
-- an app first published at most N days ago (catalog_modules.published_at,
-- kept from the first publication); N is this setting, public because the
-- public store reads it, edited in /admin/catalogo.
-- ============================================================

insert into public.platform_settings (key, value, is_public)
values ('catalog', '{"new_badge_days": 30}'::jsonb, true)
on conflict (key) do nothing;
