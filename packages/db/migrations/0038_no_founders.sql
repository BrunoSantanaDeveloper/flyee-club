-- ============================================================
-- 0038_no_founders: the founders offer leaves the platform (2026-10-08,
-- docs/PLANO-IMPLEMENTACAO.md 12.3).
--
-- Decided by the owner (docs/PRODUCT.md, "Decisões tomadas 2026-10-08"): a
-- founders price was a concept of the MedChina codebase this platform was
-- copied from, and FlyeeClub does not have it. Its page, console tab and
-- texts leave with the code of this change; here:
--
--   founders_offer()     the public reading of the seats and the deadline,
--                        dropped (it was one of the functions anon may call);
--   platform_settings    the `founders` switch, deleted;
--   club-fundador-anual  the plan stays, as every plan does, because a
--                        subscription may name it in history; inactive and
--                        off every grid and the site, nothing sells or
--                        grants it.
--
-- `founders` stays among the offers product_event_sanitize accepts, so the
-- events already recorded keep reading.
-- ============================================================

drop function public.founders_offer();

delete from public.platform_settings where key = 'founders';

update public.plans
set is_active = false, is_public = false, listed_on_site = false
where slug = 'club-fundador-anual';
