-- ============================================================
-- 0021_admin_consoles: what the phase 6 operator consoles read that the
-- baseline did not answer.
--
--   admin_segment_weekly(weeks)       now also counts payers PER CURRENCY, so
--                                     "revenue per member" divides each
--                                     currency by its own payers;
--   admin_catalog_stats()             per module and per version: downloads,
--                                     machines that have it installed,
--                                     executions and lessons;
--   admin_meeting_registrants(meeting) who registered for a meeting and who
--                                     opened the door, with the e-mail the
--                                     console needs to reach them.
--
-- Superadmin only, like every report in 0015. The weekly digest job calls the
-- segment report with the service role, which stays allowed.
-- ============================================================

-- ---------- Weekly segment report, with payers per currency ----------

-- The return type changes, which CREATE OR REPLACE cannot do: drop, then create.
drop function if exists public.admin_segment_weekly(integer);

/**
 * One row per week and segment, for the last `target_weeks` weeks (weeks start
 * on Monday, Brasília time). The five metrics that decide the focus segment:
 *
 *   1. kit_buyers        kit purchases that are still paid;
 *      page_views        all public page loads of the week (visitors have no
 *                        segment, so this is the same figure on every row);
 *      page_conversion   kit_buyers / page_views;
 *   2. access_cohort     accounts whose FIRST access (kit or paid
 *                        subscription) started that week;
 *      activated_7d      of those, the ones that ran a tool within 7 days;
 *   3. weekly_active     accounts that ran a tool in at least 3 of the 4 weeks
 *                        ending with this one;
 *   4. kit_to_club_60d   of the week's kit buyers, how many started a paid
 *                        subscription within 60 days (still filling in for
 *                        weeks younger than that);
 *   5. payers_90d        accounts with a paid invoice in the 90 days ending
 *                        with the week, in any currency;
 *      payers_90d_brl / payers_90d_usd, revenue_90d_brl / revenue_90d_usd
 *                        the same per currency: revenue per member is each
 *                        currency over its own payers, never a mix.
 *
 * `outro` is reported like any other segment; leaving it out of the focus rule
 * is the reader's job.
 */
create function public.admin_segment_weekly(target_weeks integer default 8)
returns table (
  week_start date,
  segment text,
  kit_buyers integer,
  page_views bigint,
  page_conversion numeric,
  access_cohort integer,
  activated_7d integer,
  weekly_active integer,
  kit_to_club_60d integer,
  payers_90d integer,
  revenue_90d_brl bigint,
  revenue_90d_usd bigint,
  payers_90d_brl integer,
  payers_90d_usd integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  span integer := least(greatest(coalesce(target_weeks, 8), 1), 52);
  this_week date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not (public.is_superadmin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not_authorized';
  end if;

  return query
  with weeks as (
    select (this_week - n * 7)::date as wk
    from generate_series(0, span - 1) as n
  ),
  segments as (
    select unnest(enum_range(null::public.member_segment))::text as seg
    union all
    select 'unknown'
  ),
  org_segment as (
    select o.id as org_id, coalesce(p.segment::text, 'unknown') as seg
    from public.organizations o
    left join public.profiles p on p.id = o.created_by
  ),
  kit_purchases as (
    select g.org_id, g.created_at as bought_at,
           date_trunc('week', (g.created_at at time zone 'America/Sao_Paulo'))::date as wk
    from public.entitlement_grants g
    where g.kind = 'kit' and g.source = 'purchase' and g.revoked_at is null
  ),
  -- A subscription that was really charged at least once: a provider behind
  -- it and a period that started.
  paid_subscriptions as (
    select s.org_id, min(coalesce(s.current_period_start, s.created_at)) as started_at
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.provider is not null
      and s.current_period_start is not null
      and p.tier in ('club', 'pro')
    group by s.org_id
  ),
  first_access as (
    select access.org_id, min(access.at) as access_at
    from (
      select k.org_id, k.bought_at as at from kit_purchases k
      union all
      select ps.org_id, ps.started_at from paid_subscriptions ps
    ) as access
    group by access.org_id
  ),
  executions as (
    select e.org_id, e.occurred_at,
           date_trunc('week', (e.occurred_at at time zone 'America/Sao_Paulo'))::date as wk
    from public.product_events e
    where e.event_name = 'tool.executed' and e.org_id is not null
  ),
  active_weeks as (
    select distinct ex.org_id, ex.wk from executions ex
  ),
  views as (
    select date_trunc('week', v.day::timestamp)::date as wk, sum(v.views)::bigint as total
    from public.site_page_views v
    group by 1
  ),
  kit_stats as (
    select k.wk, os.seg,
      count(*)::integer as buyers,
      count(*) filter (
        where exists (
          select 1 from paid_subscriptions ps
          where ps.org_id = k.org_id
            and ps.started_at >= k.bought_at
            and ps.started_at < k.bought_at + interval '60 days'
        )
      )::integer as converted
    from kit_purchases k
    join org_segment os on os.org_id = k.org_id
    group by k.wk, os.seg
  ),
  cohort_stats as (
    select date_trunc('week', (fa.access_at at time zone 'America/Sao_Paulo'))::date as wk, os.seg,
      count(*)::integer as cohort,
      count(*) filter (
        where exists (
          select 1 from executions ex
          where ex.org_id = fa.org_id
            and ex.occurred_at >= fa.access_at
            and ex.occurred_at < fa.access_at + interval '7 days'
        )
      )::integer as activated
    from first_access fa
    join org_segment os on os.org_id = fa.org_id
    group by 1, os.seg
  ),
  active_stats as (
    select w.wk, os.seg, count(*)::integer as active
    from weeks w
    join lateral (
      select aw.org_id
      from active_weeks aw
      where aw.wk between w.wk - 21 and w.wk
      group by aw.org_id
      having count(*) >= 3
    ) as regular on true
    join org_segment os on os.org_id = regular.org_id
    group by w.wk, os.seg
  ),
  revenue_stats as (
    select w.wk, os.seg,
      count(distinct i.org_id)::integer as payers,
      count(distinct i.org_id) filter (where i.currency = 'BRL')::integer as payers_brl,
      count(distinct i.org_id) filter (where i.currency = 'USD')::integer as payers_usd,
      coalesce(sum(i.amount_cents) filter (where i.currency = 'BRL'), 0)::bigint as brl,
      coalesce(sum(i.amount_cents) filter (where i.currency = 'USD'), 0)::bigint as usd
    from weeks w
    join public.invoices i
      on i.status = 'paid'
     and i.paid_at is not null
     and (i.paid_at at time zone 'America/Sao_Paulo')::date > w.wk + 7 - 90
     and (i.paid_at at time zone 'America/Sao_Paulo')::date <= w.wk + 6
    join org_segment os on os.org_id = i.org_id
    group by w.wk, os.seg
  )
  select
    w.wk,
    s.seg,
    coalesce(ks.buyers, 0),
    coalesce(v.total, 0),
    case when coalesce(v.total, 0) > 0 then round(coalesce(ks.buyers, 0)::numeric / v.total, 4) end,
    coalesce(cs.cohort, 0),
    coalesce(cs.activated, 0),
    coalesce(ast.active, 0),
    coalesce(ks.converted, 0),
    coalesce(rs.payers, 0),
    coalesce(rs.brl, 0),
    coalesce(rs.usd, 0),
    coalesce(rs.payers_brl, 0),
    coalesce(rs.payers_usd, 0)
  from weeks w
  cross join segments s
  left join kit_stats ks on ks.wk = w.wk and ks.seg = s.seg
  left join cohort_stats cs on cs.wk = w.wk and cs.seg = s.seg
  left join active_stats ast on ast.wk = w.wk and ast.seg = s.seg
  left join revenue_stats rs on rs.wk = w.wk and rs.seg = s.seg
  left join views v on v.wk = w.wk
  order by w.wk desc, s.seg;
end;
$$;

revoke all on function public.admin_segment_weekly(integer) from public, anon;
grant execute on function public.admin_segment_weekly(integer) to authenticated;

-- ---------- Catalog usage ----------

/**
 * What happened to each module and each version, for the catalog console:
 * downloads (all time and 30 days), the machines that report the module
 * installed right now, executions and the accounts behind them in 30 days,
 * lessons started and finished. Counts only.
 *
 * For a version it also says what the package declares that the console
 * cannot read on its own (the manifest is outside every API column grant):
 * how many files it ships, its entry file and its license.
 */
create or replace function public.admin_catalog_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'moduleId', m.id,
        'downloads', (select count(*) from public.module_downloads d where d.module_id = m.id),
        'downloads30d', (
          select count(*) from public.module_downloads d
          where d.module_id = m.id and d.created_at > now() - interval '30 days'
        ),
        'installs', (
          select count(*) from public.member_devices dv
          where dv.revoked_at is null
            and exists (
              select 1 from jsonb_array_elements(dv.installed_modules) as item
              where item ->> 'slug' = m.slug
            )
        ),
        'executions30d', (
          select count(*) from public.product_events e
          where e.event_name = 'tool.executed'
            and e.properties ->> 'module' = m.slug
            and e.occurred_at > now() - interval '30 days'
        ),
        'activeAccounts30d', (
          select count(distinct e.org_id) from public.product_events e
          where e.event_name = 'tool.executed'
            and e.properties ->> 'module' = m.slug
            and e.occurred_at > now() - interval '30 days'
        ),
        'lessonsStarted', (
          select count(*) from public.lesson_progress lp
          join public.catalog_lessons l on l.id = lp.lesson_id
          where l.module_id = m.id
        ),
        'lessonsCompleted', (
          select count(*) from public.lesson_progress lp
          join public.catalog_lessons l on l.id = lp.lesson_id
          where l.module_id = m.id and lp.completed_at is not null
        )
      ))
      from public.catalog_modules m
    ), '[]'::jsonb),
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'versionId', s.id,
        'downloads', s.downloads,
        'downloads30d', s.downloads_30d,
        'files', s.files,
        'entry', s.entry,
        'license', s.license
      ))
      from (
        select v.id,
          count(d.id) as downloads,
          count(d.id) filter (where d.created_at > now() - interval '30 days') as downloads_30d,
          case when jsonb_typeof(v.manifest -> 'files') = 'array' then jsonb_array_length(v.manifest -> 'files') end as files,
          v.manifest ->> 'entry' as entry,
          v.manifest ->> 'license' as license
        from public.catalog_module_versions v
        left join public.module_downloads d on d.version_id = v.id
        group by v.id
      ) as s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_catalog_stats() from public, anon;
grant execute on function public.admin_catalog_stats() to authenticated;

-- ---------- Meeting registrants ----------

/**
 * Who registered for one meeting and who opened the door, oldest registration
 * first, with what each person was already sent. The e-mail comes from the
 * auth table, which the console cannot read on its own.
 */
create or replace function public.admin_meeting_registrants(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', r.user_id,
      'name', p.display_name,
      'email', u.email,
      'segment', p.segment,
      'locale', p.locale,
      'registeredAt', r.created_at,
      'joinedAt', r.joined_at,
      'confirmationSentAt', r.confirmation_sent_at,
      'reminderDaySentAt', r.reminder_day_sent_at,
      'reminderHourSentAt', r.reminder_hour_sent_at,
      'recordingSentAt', r.recording_sent_at
    ) order by r.created_at)
    from public.meeting_registrations r
    join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.meeting_id = target_meeting
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_meeting_registrants(uuid) from public, anon;
grant execute on function public.admin_meeting_registrants(uuid) to authenticated;
