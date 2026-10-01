-- ============================================================
-- 0015_admin: what the operator consoles read.
--
--   admin_metrics()                  platform totals for /admin;
--   admin_members_overview()         one row per account, with the summary
--                                    tiles computed from the SAME rows;
--   admin_member_dossier(org)        everything about one account;
--   admin_people_without_workspace() the "signed up and cannot use it" case;
--   admin_segment_weekly(weeks)      the five focus metrics, per segment;
--   admin_door_weekly(weeks)         visits and kit purchases per entry door.
--
-- Every function is superadmin-only (the reporting jobs call two of them with
-- the service role). They READ what the product enforces instead of
-- recomputing it, so a console can never disagree with a gate.
--
-- Money rules, learned on the inherited project and kept:
--   * revenue is what is still PAID: a refund flips the invoice, so it simply
--     stops counting;
--   * a comped plan is not revenue: the snapshot price of a subscription with
--     no provider behind it is zero;
--   * currencies are never added together.
--
-- Origin: inherited migrations 0010, 0104, 0106 and 0108, rewritten for the
-- club (no minutes, no trial, segments and devices instead).
-- ============================================================

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only';
  end if;

  select jsonb_build_object(
    'orgs', (select count(*) from public.organizations),
    'users', (select count(*) from public.profiles),
    'new_orgs_30d', (select count(*) from public.organizations where created_at > now() - interval '30 days'),
    'new_users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'subscriptions', (
      select coalesce(jsonb_object_agg(s.status, s.total), '{}'::jsonb)
      from (
        select status::text as status, count(*) as total
        from public.subscriptions
        group by status
      ) s
    ),
    'suspended', (
      select count(*) from public.subscriptions
      where admin_suspended and status in ('trialing', 'active', 'past_due')
    ),
    -- Monthly recurring revenue per currency, from the price each member was
    -- SOLD (the snapshot), normalized to a month.
    'mrr', (
      select coalesce(
        jsonb_agg(jsonb_build_object('currency', m.currency, 'amount_cents', m.amount_cents) order by m.currency),
        '[]'::jsonb
      )
      from (
        select coalesce(s.currency, p.currency) as currency,
               sum(
                 case coalesce(s.period, p.period)
                   when 'monthly' then coalesce(s.price_cents, p.price_cents)::numeric
                   when 'yearly' then round(coalesce(s.price_cents, p.price_cents) / 12.0)
                   when 'weekly' then round(coalesce(s.price_cents, p.price_cents) * 52 / 12.0)
                   else 0
                 end
               )::bigint as amount_cents
        from public.subscriptions s
        join public.plans p on p.id = s.plan_id
        where s.status in ('active', 'past_due')
          and not s.admin_suspended
          and s.provider is not null
          and coalesce(s.price_cents, p.price_cents) > 0
        group by 1
      ) m
    ),
    'kits_30d', (
      select count(*) from public.entitlement_grants
      where kind = 'kit' and source = 'purchase' and revoked_at is null
        and created_at > now() - interval '30 days'
    ),
    'revenue_30d', (
      select coalesce(
        jsonb_agg(jsonb_build_object('currency', r.currency, 'amount_cents', r.amount_cents) order by r.currency),
        '[]'::jsonb
      )
      from (
        select i.currency, sum(i.amount_cents)::bigint as amount_cents
        from public.invoices i
        where i.status = 'paid' and i.paid_at > now() - interval '30 days'
        group by i.currency
      ) r
    ),
    'devices_live', (select count(*) from public.member_devices where revoked_at is null),
    'active_orgs_7d', (
      select count(distinct e.org_id) from public.product_events e
      where e.event_name = 'tool.executed' and e.occurred_at > now() - interval '7 days'
    ),
    'leads_confirmed', (select count(*) from public.leads where confirmed_at is not null and opted_out_at is null)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;

-- ---------- Accounts ----------

/**
 * One row per account (a workspace and the person who owns it), answering the
 * operator's real questions: who this is, which rung they are on and what they
 * pay, whether a machine is connected, whether they use it, and what needs
 * attention. The summary tiles are counted over the same rows, so a tile and
 * the list it filters can never disagree.
 */
create or replace function public.admin_members_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  -- The weekly digest job has no session: it reads this as the backend.
  if not (public.is_superadmin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not_authorized';
  end if;

  with live_sub as (
    select distinct on (s.org_id)
      s.org_id, s.id, s.status, s.admin_suspended, s.provider, s.period, s.price_cents, s.currency,
      s.current_period_end, s.cancel_at_period_end, s.renews, s.past_due_since, s.coupon_code_snapshot,
      p.slug as plan_slug, p.name as plan_name, p.tier as plan_tier, p.is_free,
      (s.status in ('trialing', 'active')
        or coalesce(public.billing_past_due_grace_ends(s) > now(), false)) as counts
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.status in ('trialing', 'active', 'past_due')
    order by s.org_id, s.created_at desc
  ),
  live_grants as (
    select g.org_id,
      max(case p.tier when 'pro' then 3 when 'club' then 2 when 'kit' then 1 else 0 end) as rank,
      jsonb_agg(jsonb_build_object(
        'id', g.id, 'kind', g.kind, 'plan', p.slug, 'source', g.source,
        'createdAt', g.created_at, 'expiresAt', g.expires_at
      ) order by g.created_at) as grants
    from public.entitlement_grants g
    left join public.plans p on p.id = g.plan_id
    where g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now())
    group by g.org_id
  ),
  devices as (
    select d.org_id,
      count(*) filter (where d.revoked_at is null) as live,
      max(d.last_seen_at) filter (where d.revoked_at is null) as last_seen_at,
      max(d.last_update_at) filter (where d.revoked_at is null) as last_update_at
    from public.member_devices d
    group by d.org_id
  ),
  installed as (
    select d.org_id, count(distinct item ->> 'slug') as modules
    from public.member_devices d
    cross join lateral jsonb_array_elements(d.installed_modules) as item
    where d.revoked_at is null
    group by d.org_id
  ),
  usage as (
    select e.org_id,
      count(*) filter (where e.occurred_at > now() - interval '30 days') as executions_30d,
      max(e.occurred_at) as last_execution_at
    from public.product_events e
    where e.event_name = 'tool.executed' and e.org_id is not null
    group by e.org_id
  ),
  revenue as (
    select i.org_id,
      coalesce(sum(i.amount_cents) filter (where i.currency = 'BRL'), 0)::bigint as brl,
      coalesce(sum(i.amount_cents) filter (where i.currency = 'USD'), 0)::bigint as usd
    from public.invoices i
    where i.status = 'paid'
    group by i.org_id
  ),
  shaped as (
    select
      o.id as org_id,
      o.created_at,
      p.id as user_id,
      p.display_name,
      p.segment,
      p.ai_tool,
      p.locale,
      u.email,
      u.last_sign_in_at,
      u.email_confirmed_at,
      u.banned_until,
      ls.id as subscription_id,
      ls.status,
      ls.admin_suspended,
      ls.provider,
      ls.period,
      ls.price_cents,
      ls.currency,
      ls.current_period_end,
      ls.cancel_at_period_end,
      ls.renews,
      ls.plan_slug,
      ls.plan_name,
      ls.is_free,
      greatest(
        coalesce(lg.rank, 0),
        case when ls.counts then (case ls.plan_tier when 'pro' then 3 when 'club' then 2 when 'kit' then 1 else 0 end) else 0 end
      ) as tier_rank,
      coalesce(lg.grants, '[]'::jsonb) as grants,
      coalesce(dv.live, 0) as devices_live,
      dv.last_seen_at,
      dv.last_update_at,
      coalesce(ins.modules, 0) as installed_modules,
      coalesce(us.executions_30d, 0) as executions_30d,
      us.last_execution_at,
      coalesce(rv.brl, 0) as revenue_brl,
      coalesce(rv.usd, 0) as revenue_usd,
      sa.origem,
      sa.onda,
      sa.utm_source,
      sa.utm_campaign
    from public.organizations o
    left join public.profiles p on p.id = o.created_by
    left join auth.users u on u.id = p.id
    left join live_sub ls on ls.org_id = o.id
    left join live_grants lg on lg.org_id = o.id
    left join devices dv on dv.org_id = o.id
    left join installed ins on ins.org_id = o.id
    left join usage us on us.org_id = o.id
    left join revenue rv on rv.org_id = o.id
    left join public.signup_attribution sa on sa.org_id = o.id
  ),
  flagged as (
    select s.*,
      case s.tier_rank when 3 then 'pro' when 2 then 'club' when 1 then 'kit' else null end as tier,
      (s.status = 'past_due') as is_past_due,
      (s.tier_rank > 0 and s.devices_live = 0) as no_device,
      (s.tier_rank > 0 and s.devices_live > 0
        and coalesce(s.last_update_at, s.last_seen_at) < now() - interval '25 days') as stale_update,
      -- A plan with no provider behind it that is not the free one: given by
      -- the team, charged to nobody.
      (s.subscription_id is not null and s.provider is null and not coalesce(s.is_free, false)) as comped
    from shaped s
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'accounts', count(*),
      'kit', count(*) filter (where tier = 'kit'),
      'club', count(*) filter (where tier = 'club'),
      'pro', count(*) filter (where tier = 'pro'),
      'noAccess', count(*) filter (where tier is null),
      'pastDue', count(*) filter (where is_past_due),
      'noDevice', count(*) filter (where no_device),
      'staleUpdate', count(*) filter (where stale_update),
      'suspended', count(*) filter (where coalesce(admin_suspended, false)),
      'cancelScheduled', count(*) filter (where coalesce(cancel_at_period_end, false))
    ),
    'members', coalesce(jsonb_agg(
      jsonb_build_object(
        'orgId', org_id,
        'userId', user_id,
        'name', display_name,
        'email', email,
        'createdAt', created_at,
        'lastSignInAt', last_sign_in_at,
        'confirmed', email_confirmed_at is not null,
        'bannedUntil', banned_until,
        'segment', segment,
        'aiTool', ai_tool,
        'locale', locale,
        'tier', tier,
        'plan', case when subscription_id is null then null else jsonb_build_object(
          'slug', plan_slug,
          'name', plan_name,
          'status', status,
          'period', period,
          'priceCents', price_cents,
          'currency', currency,
          'renewsAt', case when renews and not cancel_at_period_end then current_period_end end,
          'endsAt', case when cancel_at_period_end or not renews then current_period_end end,
          'provider', provider,
          'comped', comped
        ) end,
        'grants', grants,
        'devices', jsonb_build_object(
          'live', devices_live, 'lastSeenAt', last_seen_at, 'lastUpdateAt', last_update_at
        ),
        'installedModules', installed_modules,
        'executions30d', executions_30d,
        'lastExecutionAt', last_execution_at,
        'revenue', jsonb_build_object('BRL', revenue_brl, 'USD', revenue_usd),
        'attribution', jsonb_strip_nulls(jsonb_build_object(
          'origem', origem, 'onda', onda, 'utmSource', utm_source, 'utmCampaign', utm_campaign
        )),
        'flags', jsonb_build_object(
          'pastDue', is_past_due,
          'suspended', coalesce(admin_suspended, false),
          'cancelScheduled', coalesce(cancel_at_period_end, false),
          'noDevice', no_device,
          'staleUpdate', stale_update,
          'comped', comped,
          'neverSignedIn', last_sign_in_at is null
        )
      )
      order by created_at desc
    ), '[]'::jsonb)
  )
  into result
  from flagged;

  return result;
end;
$$;

revoke all on function public.admin_members_overview() from public, anon;
grant execute on function public.admin_members_overview() to authenticated;

/**
 * Everything the platform knows about ONE account, fired when the operator
 * opens it. Privacy is structural: no token or hash, no unsubscribe token, no
 * consent text, no audit metadata, and the fiscal document only as its kind
 * plus the last two digits.
 */
create or replace function public.admin_member_dossier(target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  org public.organizations%rowtype;
  owner public.profiles%rowtype;
  owner_auth record;
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized';
  end if;

  select * into org from public.organizations where id = target_org;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into owner from public.profiles where id = org.created_by;
  select u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
         nullif(btrim(coalesce(u.raw_app_meta_data ->> 'provider', '')), '') as auth_provider
    into owner_auth
  from auth.users u where u.id = owner.id;

  return jsonb_build_object(
    'ok', true,
    'generatedAt', now(),
    'account', jsonb_build_object(
      'orgId', org.id,
      'workspaceName', org.name,
      'createdAt', org.created_at,
      'userId', owner.id,
      'name', owner.display_name,
      'email', owner_auth.email,
      'authProvider', owner_auth.auth_provider,
      'confirmed', owner_auth.email_confirmed_at is not null,
      'lastSignInAt', owner_auth.last_sign_in_at,
      'bannedUntil', owner_auth.banned_until,
      'segment', owner.segment,
      'aiTool', owner.ai_tool,
      'locale', owner.locale,
      'timezone', owner.timezone,
      'marketingOptOut', owner.marketing_email_opt_out,
      'isSuperadmin', coalesce(owner.is_superadmin, false),
      'twoFactor', exists (
        select 1 from auth.mfa_factors f where f.user_id = owner.id and f.status = 'verified'
      ),
      'billingDocument', case
        when org.billing_cpf_cnpj is null then null
        else jsonb_build_object(
          'kind', case when char_length(org.billing_cpf_cnpj) = 11 then 'cpf' else 'cnpj' end,
          'lastDigits', right(org.billing_cpf_cnpj, 2)
        )
      end
    ),
    'entitlements', public.org_entitlements(target_org),
    'money', jsonb_build_object(
      'paid', (
        select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
        from (select i.currency, sum(i.amount_cents)::bigint as total
              from public.invoices i where i.org_id = target_org and i.status = 'paid' group by i.currency) x
      ),
      'refunded', (
        select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
        from (select i.currency, sum(i.amount_cents)::bigint as total
              from public.invoices i where i.org_id = target_org and i.status = 'refunded' group by i.currency) x
      ),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'plan', p.slug, 'status', s.status, 'period', s.period,
          'priceCents', s.price_cents, 'currency', s.currency, 'coupon', s.coupon_code_snapshot,
          'provider', s.provider, 'renews', s.renews, 'paymentMethod', s.payment_method,
          'createdAt', s.created_at, 'currentPeriodEnd', s.current_period_end,
          'cancelAtPeriodEnd', s.cancel_at_period_end, 'cancelReason', s.cancel_reason,
          'cancelNote', s.cancel_note, 'canceledAt', s.canceled_at,
          'pastDueSince', s.past_due_since, 'suspended', s.admin_suspended
        ) order by s.created_at desc)
        from public.subscriptions s
        join public.plans p on p.id = s.plan_id
        where s.org_id = target_org
      ), '[]'::jsonb),
      'grants', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id, 'kind', g.kind, 'plan', p.slug, 'source', g.source,
          'priceCents', g.price_cents, 'currency', g.currency, 'note', g.note,
          'createdAt', g.created_at, 'expiresAt', g.expires_at,
          'revokedAt', g.revoked_at, 'revokeReason', g.revoke_reason
        ) order by g.created_at desc)
        from public.entitlement_grants g
        left join public.plans p on p.id = g.plan_id
        where g.org_id = target_org
      ), '[]'::jsonb),
      'invoices', coalesce((
        select jsonb_agg(row_data)
        from (
          select jsonb_build_object(
            'id', i.id, 'amountCents', i.amount_cents, 'currency', i.currency, 'status', i.status,
            'paidAt', i.paid_at, 'createdAt', i.created_at, 'provider', i.provider,
            'hasFiscalDocument', i.fiscal_document_url is not null
          ) as row_data
          from public.invoices i
          where i.org_id = target_org
          order by i.created_at desc
          limit 20
        ) recent
      ), '[]'::jsonb)
    ),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'os', d.os, 'aiTool', d.ai_tool,
        'cliVersion', d.cli_version, 'coreVersion', d.core_version,
        'modules', jsonb_array_length(d.installed_modules), 'projectKind', d.project_kind,
        'firstSeenAt', d.first_seen_at, 'lastSeenAt', d.last_seen_at, 'lastUpdateAt', d.last_update_at,
        'revokedAt', d.revoked_at, 'revokeReason', d.revoke_reason
      ) order by d.last_seen_at desc)
      from public.member_devices d where d.org_id = target_org
    ), '[]'::jsonb),
    'tokens', jsonb_build_object(
      'liveFamilies', (
        select count(distinct t.family_id) from public.oauth_tokens t
        where t.org_id = target_org and t.revoked_at is null
          and coalesce(t.refresh_expires_at, t.access_expires_at) > now()
      ),
      'nextRevalidationAt', (
        select min(t.refresh_expires_at) from public.oauth_tokens t
        where t.org_id = target_org and t.revoked_at is null and t.refresh_expires_at > now()
      )
    ),
    'usage', jsonb_build_object(
      'executions30d', (
        select count(*) from public.product_events e
        where e.org_id = target_org and e.event_name = 'tool.executed'
          and e.occurred_at > now() - interval '30 days'
      ),
      'firstExecutionAt', (
        select min(e.occurred_at) from public.product_events e
        where e.org_id = target_org and e.event_name = 'tool.executed'
      ),
      'lastExecutionAt', (
        select max(e.occurred_at) from public.product_events e
        where e.org_id = target_org and e.event_name = 'tool.executed'
      ),
      'topModules30d', coalesce((
        select jsonb_agg(jsonb_build_object('module', module, 'executions', total) order by total desc)
        from (
          select e.properties ->> 'module' as module, count(*) as total
          from public.product_events e
          where e.org_id = target_org and e.event_name = 'tool.executed'
            and e.occurred_at > now() - interval '30 days'
            and e.properties ? 'module'
          group by 1
          order by 2 desc
          limit 10
        ) top
      ), '[]'::jsonb),
      'weeks', coalesce((
        select jsonb_agg(jsonb_build_object('weekStart', week_start, 'executions', total) order by week_start)
        from (
          select date_trunc('week', (e.occurred_at at time zone 'America/Sao_Paulo'))::date as week_start,
                 count(*) as total
          from public.product_events e
          where e.org_id = target_org and e.event_name = 'tool.executed'
            and e.occurred_at > now() - interval '8 weeks'
          group by 1
        ) weekly
      ), '[]'::jsonb),
      'denied30d', (
        select count(*) from public.product_events e
        where e.org_id = target_org
          and e.event_name in ('update.denied_token_expired', 'update.denied_entitlement')
          and e.occurred_at > now() - interval '30 days'
      ),
      'downloads30d', (
        select count(*) from public.module_downloads d
        where d.org_id = target_org and d.created_at > now() - interval '30 days'
      ),
      'lessonsStarted', (select count(*) from public.lesson_progress l where l.org_id = target_org),
      'lessonsCompleted', (
        select count(*) from public.lesson_progress l where l.org_id = target_org and l.completed_at is not null
      ),
      'roadmapVotes', (select count(*) from public.roadmap_votes v where v.org_id = target_org),
      'meetingsRegistered', (select count(*) from public.meeting_registrations r where r.org_id = target_org),
      'meetingsJoined', (
        select count(*) from public.meeting_registrations r
        where r.org_id = target_org and r.joined_at is not null
      )
    ),
    'consent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug, 'locale', t.locale, 'version', t.version,
        'acceptedAt', a.accepted_at, 'revokedAt', a.revoked_at
      ) order by a.accepted_at desc)
      from public.consent_acceptances a
      join public.consent_terms t on t.id = a.term_id
      where a.org_id = target_org
    ), '[]'::jsonb),
    'access', jsonb_build_object(
      'signIns30d', (
        select count(*) from public.access_events a
        where a.user_id = owner.id and a.impersonated_by is null
          and a.created_at > now() - interval '30 days'
      ),
      'supportVisits', (
        select count(*) from public.impersonation_sessions s where s.target_user_id = owner.id
      )
    ),
    'attribution', (
      select to_jsonb(sa) - 'org_id' from public.signup_attribution sa where sa.org_id = target_org
    )
  );
end;
$$;

revoke all on function public.admin_member_dossier(uuid) from public, anon;
grant execute on function public.admin_member_dossier(uuid) to authenticated;

/**
 * Profiles with no workspace. The sign-up trigger creates the workspace for
 * every account, so anybody listed here is an exception worth an operator's
 * look: the workspace was removed, or the trigger failed.
 */
create or replace function public.admin_people_without_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not (public.is_superadmin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not_authorized';
  end if;

  with person as (
    select
      p.id as user_id,
      p.display_name,
      p.is_superadmin,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      u.banned_until,
      nullif(btrim(coalesce(u.raw_app_meta_data ->> 'provider', '')), '') as auth_provider
    from public.profiles p
    join auth.users u on u.id = p.id
    where not exists (select 1 from public.memberships m where m.user_id = p.id)
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'people', count(*),
      'neverSignedIn', count(*) filter (where last_sign_in_at is null)
    ),
    'people', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', user_id,
          'name', display_name,
          'email', email,
          'createdAt', created_at,
          'lastSignInAt', last_sign_in_at,
          'confirmed', email_confirmed_at is not null,
          'bannedUntil', banned_until,
          'isSuperadmin', coalesce(is_superadmin, false),
          'authProvider', auth_provider
        )
        order by created_at desc
      ),
      '[]'::jsonb
    )
  )
  into result
  from person;

  return result;
end;
$$;

revoke all on function public.admin_people_without_workspace() from public, anon;
grant execute on function public.admin_people_without_workspace() to authenticated;

-- ---------- The focus metrics ----------

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
 *   5. payers_90d, revenue_90d_brl, revenue_90d_usd
 *                        paid invoices in the 90 days ending with the week.
 *
 * `outro` is reported like any other segment; leaving it out of the focus rule
 * is the reader's job.
 */
create or replace function public.admin_segment_weekly(target_weeks integer default 8)
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
  revenue_90d_usd bigint
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
    coalesce(rs.usd, 0)
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

/**
 * Visits and kit purchases per entry door and week: the page-conversion half
 * of the first focus metric, cut the only way a visit can be cut. A purchase
 * is credited to the door of the account's FIRST touch (signup_attribution).
 */
create or replace function public.admin_door_weekly(target_weeks integer default 8)
returns table (
  week_start date,
  origem text,
  page_views bigint,
  kit_buyers integer,
  page_conversion numeric
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
  with views as (
    select date_trunc('week', v.day::timestamp)::date as wk, v.origem as door, sum(v.views)::bigint as total
    from public.site_page_views v
    where v.day >= this_week - (span - 1) * 7
    group by 1, 2
  ),
  buyers as (
    select date_trunc('week', (g.created_at at time zone 'America/Sao_Paulo'))::date as wk,
           public.site_channel(sa.origem) as door,
           count(*)::integer as total
    from public.entitlement_grants g
    left join public.signup_attribution sa on sa.org_id = g.org_id
    where g.kind = 'kit' and g.source = 'purchase' and g.revoked_at is null
      and g.created_at >= (this_week - (span - 1) * 7)::timestamp at time zone 'America/Sao_Paulo'
    group by 1, 2
  )
  select
    coalesce(v.wk, b.wk),
    coalesce(v.door, b.door),
    coalesce(v.total, 0),
    coalesce(b.total, 0),
    case when coalesce(v.total, 0) > 0 then round(coalesce(b.total, 0)::numeric / v.total, 4) end
  from views v
  full join buyers b on b.wk = v.wk and b.door = v.door
  order by 1 desc, 3 desc, 2;
end;
$$;

revoke all on function public.admin_door_weekly(integer) from public, anon;
grant execute on function public.admin_door_weekly(integer) to authenticated;
