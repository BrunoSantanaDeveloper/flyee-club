-- ============================================================
-- 0037_plans_on_site: which plans the public site lists (2026-10-08,
-- docs/PLANO-IMPLEMENTACAO.md 12.2).
--
-- Decided by the owner (docs/PRODUCT.md, "Decisões tomadas 2026-10-08"): the
-- public site sells only FlyeeClub, the one-time access, and FlyeeClub Pro is
-- offered inside the member area. Where a plan is shown is data, edited in
-- /admin/billing, never a rule in code:
--
--   is_public       the pricing grids of the member area, as before;
--   listed_on_site  the public site: the home, /planos and the Product
--                   structured data. Read together with is_public, so a plan
--                   taken off the grids is off the site too.
--
-- FlyeeClub (kit, kit-usd) is on both; FlyeeClub Pro on the member area only.
-- A new plan starts off the site.
-- ============================================================

alter table public.plans add column listed_on_site boolean not null default false;

comment on column public.plans.listed_on_site is
  'Whether the public site (home, /planos, the Product structured data) lists the plan. Read with is_public: a plan off the grids is off the site. FlyeeClub Pro is offered inside the member area only (docs/PRODUCT.md, 2026-10-08).';

update public.plans set listed_on_site = true where slug in ('kit', 'kit-usd');
