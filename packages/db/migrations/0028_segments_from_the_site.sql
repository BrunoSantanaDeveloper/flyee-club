-- ============================================================
-- 0028_segments_from_the_site: the segments are the site's personas
-- (2026-10-06).
--
-- The public site offers four audiences (the home brief): your business,
-- your agency, your digital product, your dev work. The metrics, the focus
-- rule and the onboarding measured five others, one of which the site never
-- offered ("profissional que usa IA") and none of which was "your business".
-- Decided: the segments ARE the personas, plus `outro`:
--
--   produto_proprio    → produto
--   freelancer_agencia → agencia
--   profissional_ia    → retired: its rows become `outro` (no persona says
--                        it), and its slot is renamed `negocio`
--   dev, outro         → unchanged
--
-- Renaming a value carries every column typed `member_segment` (profiles,
-- leads, product_events) and every function that reads `enum_range`. What
-- stores a segment as TEXT (the daily rollup) is rewritten here. The retired
-- value's rows are moved BEFORE its slot takes the new name, so no row reads
-- `negocio` without someone having said it.
-- ============================================================

-- ---------- The retired value's rows ----------

update public.profiles set segment = 'outro' where segment = 'profissional_ia';
update public.leads set segment = 'outro' where segment = 'profissional_ia';
update public.product_events set segment = 'outro' where segment = 'profissional_ia';

-- The rollup is keyed by segment, so its rows are summed into `outro`, never
-- overwritten. `actors` becomes an upper bound on the merged rows: the raw
-- events behind a day may already be purged, so distinct people cannot be
-- counted again.
insert into public.product_events_daily (day, event_name, segment, locale, ai_tool, module, events, actors)
select day, event_name, 'outro', locale, ai_tool, module, sum(events)::integer, sum(actors)::integer
from public.product_events_daily
where segment = 'profissional_ia'
group by day, event_name, locale, ai_tool, module
on conflict (day, event_name, segment, locale, ai_tool, module) do update
set events = public.product_events_daily.events + excluded.events,
    actors = public.product_events_daily.actors + excluded.actors;

delete from public.product_events_daily where segment = 'profissional_ia';

-- No row carries the new names yet, so these never collide.
update public.product_events_daily set segment = 'produto' where segment = 'produto_proprio';
update public.product_events_daily set segment = 'agencia' where segment = 'freelancer_agencia';

-- ---------- The names ----------

alter type public.member_segment rename value 'produto_proprio' to 'produto';
alter type public.member_segment rename value 'freelancer_agencia' to 'agencia';
alter type public.member_segment rename value 'profissional_ia' to 'negocio';

comment on type public.member_segment is
  'The audience a member belongs to, the personas of the public site (2026-10-06): negocio, agencia, produto, dev, plus outro, which the focus rule leaves out.';
