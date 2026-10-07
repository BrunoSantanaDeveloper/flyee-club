-- ============================================================
-- 0033_roadmap_coming_next: "Próximos na loja" (2026-10-06).
--
-- The home brief lists the apps on their way, each with a badge: "Em
-- produção", "Mais votado de {mês}" or "Em desenvolvimento, sai para todos"
-- (a commissioned app, public by default since 0031). The roadmap had the
-- states but forgot which month an idea won (roadmap_month_leader looks only
-- at open ideas, and the winner is planned right after), and had no mark for
-- a commissioned app. Decided (option 1):
--
--   - won_month: the first day of the month an idea was the most voted,
--     recorded when the operator plans the month's leader from the console;
--   - commissioned: set by the operator for an idea that came from a paid
--     request;
--   - roadmap_coming_next(): what a visitor may read of it, the planned and
--     building ideas with their title, state and those two marks. The
--     roadmap itself stays members-only.
-- ============================================================

alter table public.roadmap_items
  add column won_month date check (won_month is null or won_month = date_trunc('month', won_month)::date),
  add column commissioned boolean not null default false;

comment on column public.roadmap_items.won_month is
  'The first day of the month this idea was the most voted (roadmap_month_leader), recorded when the operator planned it. Shown as "Mais votado de {mês}".';
comment on column public.roadmap_items.commissioned is
  'An idea that came from a paid request: built on demand and public by default (terms of use, version 4). Shown as "Em desenvolvimento, sai para todos".';

-- The console writes the two marks; row access stays the superadmin policy.
grant update (won_month, commissioned) on table public.roadmap_items to authenticated;

/**
 * The apps on their way, for the public site: planned and building ideas
 * only (never one under review, declined, merely proposed or already
 * shipped), with nothing but what the badge needs. Ordered as the block
 * reads: building first, then planned, newest win first.
 */
create or replace function public.roadmap_coming_next()
returns table (
  id uuid,
  title jsonb,
  status text,
  won_month date,
  commissioned boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.title, i.status, i.won_month, i.commissioned
  from public.roadmap_items i
  where i.status in ('planned', 'building')
  order by case i.status when 'building' then 0 else 1 end, i.won_month desc nulls last, i.sort, i.created_at;
$$;

revoke all on function public.roadmap_coming_next() from public;
grant execute on function public.roadmap_coming_next() to anon, authenticated;
