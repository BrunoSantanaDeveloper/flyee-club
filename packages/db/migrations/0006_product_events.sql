-- ============================================================
-- 0006_product_events: usage telemetry.
--
-- Events, never content. One closed vocabulary of event names and ONE
-- allowlist of property keys and values, shared by the two writers:
--   * track_product_event()         a signed-in browser session;
--   * track_product_event_server()  the backend (the CLI delivery API, the
--                                   billing webhook, definer functions).
-- Segment, language and AI tool are stamped from the member's profile HERE,
-- never taken from the caller: they are the dimensions the focus decision is
-- made on, so a client must not be able to choose them.
--
-- Origin: inherited migrations 0034, 0048, 0054 and 0104 (the allowlist
-- pattern and the per-actor ceiling). New here: the vocabulary, the stamped
-- dimensions, the server writer, the daily rollup and the purge.
-- ============================================================

-- ---------- Vocabulary ----------

-- The single list of event names. The table check and both writers call it,
-- so adding an event is one `create or replace` of this function.
create or replace function public.product_event_known(event_name text)
returns boolean
language sql
immutable
as $$
  select event_name in (
    'account.created',
    'profile.completed',
    'checkout.started',
    'kit.purchased',
    'subscription.started',
    'upsell.purchased',
    'cli.installed',
    'cli.login',
    'module.installed',
    'module.activated',
    'tool.executed',
    'module.updated',
    'update.denied_token_expired',
    'update.denied_entitlement',
    'token.revalidated',
    'lesson.started',
    'lesson.completed',
    'recipe.installed',
    'roadmap.voted',
    'meeting.registered',
    'meeting.attended',
    'upsell.viewed',
    'upsell.clicked',
    'subscription.cancel_requested',
    'subscription.canceled',
    'waitlist.joined',
    'device.revoked'
  );
$$;

revoke all on function public.product_event_known(text) from public, anon;
grant execute on function public.product_event_known(text) to authenticated;

-- ---------- Events ----------

create table public.product_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  -- Stamped from the actor's profile at write time.
  segment public.member_segment,
  locale text,
  ai_tool public.ai_tool,
  -- When it happened (the CLI may deliver late) and when it arrived.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_events_name_check check (public.product_event_known(event_name)),
  constraint product_events_properties_size_check check (octet_length(properties::text) <= 2048),
  constraint product_events_locale_check check (locale is null or locale in ('pt-BR', 'en'))
);

create index product_events_name_idx on public.product_events (event_name, occurred_at desc);
create index product_events_org_idx on public.product_events (org_id, event_name, occurred_at desc);
create index product_events_actor_idx on public.product_events (actor_id, created_at desc);
create index product_events_occurred_idx on public.product_events (occurred_at);

alter table public.product_events enable row level security;

-- Operational data: only the platform operator reads it. A member's own
-- activation is answered by member_activation_facts() (0011), a definer RPC,
-- precisely because this table is closed.
create policy "product_events_select_superadmin" on public.product_events
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.product_events to authenticated;

-- ---------- The property allowlist ----------

/**
 * Returns only the properties this platform agreed to store, each checked
 * against a closed set of VALUES. Anything else is dropped silently: ids, free
 * text, file names, prompts, paths. This function is the reason the table can
 * be read without a privacy review of every row.
 *
 * `module` and `trail` must name something that exists in the catalog; a slug
 * nobody published is dropped rather than stored as an attacker-chosen string.
 */
create or replace function public.product_event_sanitize(target_event text, target_properties jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  props jsonb := coalesce(target_properties, '{}'::jsonb);
  semver constant text := '^[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}(-[0-9A-Za-z.-]{1,20})?$';
  module_value text;
  trail_value text;
begin
  if jsonb_typeof(props) <> 'object' then
    return '{}'::jsonb;
  end if;

  module_value := lower(props ->> 'module');
  if module_value is not null and not exists (
    select 1 from public.catalog_modules m where m.slug = module_value
  ) then
    module_value := null;
  end if;

  trail_value := lower(props ->> 'trail');
  if trail_value is not null and not exists (
    select 1 from public.catalog_trails t where t.slug = trail_value
  ) then
    trail_value := null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'platform', case when props ->> 'platform' in ('web', 'cli', 'server') then props ->> 'platform' end,
    'module', module_value,
    'trail', trail_value,
    'version', case when props ->> 'version' ~ semver then props ->> 'version' end,
    'from_version', case when props ->> 'from_version' ~ semver then props ->> 'from_version' end,
    'to_version', case when props ->> 'to_version' ~ semver then props ->> 'to_version' end,
    'depth', case when props ->> 'depth' in ('usar', 'abrir_o_capo') then props ->> 'depth' end,
    'lesson_locale', case when props ->> 'lesson_locale' in ('pt-BR', 'en') then props ->> 'lesson_locale' end,
    'ai_tool', case
      when props ->> 'ai_tool' = any (enum_range(null::public.ai_tool)::text[]) then props ->> 'ai_tool'
    end,
    'os', case when props ->> 'os' in ('windows', 'macos', 'linux', 'other') then props ->> 'os' end,
    'cli_version', case when props ->> 'cli_version' ~ semver then props ->> 'cli_version' end,
    'core_version', case when props ->> 'core_version' ~ semver then props ->> 'core_version' end,
    'project_kind', case when props ->> 'project_kind' in ('own', 'client') then props ->> 'project_kind' end,
    'tier_from', case when props ->> 'tier_from' in ('none', 'kit', 'club', 'pro') then props ->> 'tier_from' end,
    'tier_to', case when props ->> 'tier_to' in ('none', 'kit', 'club', 'pro') then props ->> 'tier_to' end,
    'period', case when props ->> 'period' in ('once', 'monthly', 'yearly') then props ->> 'period' end,
    'offer', case
      when props ->> 'offer' in ('kit', 'club', 'pro', 'mentoring', 'founders') then props ->> 'offer'
    end,
    'reason', case
      when props ->> 'reason' in (
        'too_expensive', 'not_using', 'missing_tool', 'switched', 'technical', 'temporary', 'other',
        'token_expired', 'no_entitlement', 'device_limit', 'yanked', 'member', 'admin',
        'suspended', 'canceled', 'refund'
      ) then props ->> 'reason'
    end,
    'origin', case
      when props ->> 'origin' in (
        'home', 'revalidation', 'catalog', 'module', 'billing', 'menu', 'checkout', 'email', 'cli', 'site'
      ) then props ->> 'origin'
    end,
    'days_since_update', case
      when props ->> 'days_since_update' in ('0_7', '8_14', '15_24', '25_30', '31_plus')
        then props ->> 'days_since_update'
    end,
    -- The entry door, normalized exactly like the page-view counter (0005).
    'origem', case when props ? 'origem' then public.site_channel(props ->> 'origem') end
  ));
end;
$$;

revoke all on function public.product_event_sanitize(text, jsonb) from public, anon, authenticated;

-- ---------- The one insert path ----------

-- Internal. Every writer ends here, so the stamping cannot be skipped.
create or replace function public.product_event_insert(
  target_actor uuid,
  target_org uuid,
  target_event text,
  target_properties jsonb,
  target_occurred_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  resolved_org uuid := target_org;
  happened timestamptz := coalesce(target_occurred_at, now());
begin
  if target_actor is not null then
    select * into actor from public.profiles where id = target_actor;
    if resolved_org is null then
      select m.org_id into resolved_org
      from public.memberships m
      where m.user_id = target_actor
      order by m.created_at asc, m.id asc
      limit 1;
    end if;
  end if;

  -- A device clock is not evidence. Nothing in the future, nothing older than
  -- a week (an offline queue), otherwise "now".
  if happened > now() + interval '5 minutes' or happened < now() - interval '7 days' then
    happened := now();
  end if;

  insert into public.product_events (
    org_id, actor_id, event_name, properties, segment, locale, ai_tool, occurred_at
  ) values (
    resolved_org,
    actor.id,
    target_event,
    public.product_event_sanitize(target_event, target_properties),
    actor.segment,
    actor.locale,
    actor.ai_tool,
    happened
  );
end;
$$;

revoke all on function public.product_event_insert(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;

-- ---------- Writer 1: the browser session ----------

/**
 * What a signed-in browser may report on its own word: only what it alone can
 * see (an offer shown, an offer clicked). Purchases, installs, executions and
 * everything else that counts toward a metric come from the server writer.
 *
 * Never raises and never blocks the screen: an unknown event, a support
 * session or a caller over the hourly ceiling is dropped silently.
 */
create or replace function public.track_product_event(target_event text, target_properties jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then return; end if;
  if target_event is null or target_event not in ('upsell.viewed', 'upsell.clicked') then
    return;
  end if;
  -- A support visit must not show up as the member's behaviour.
  if public.is_impersonated() then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('product-events:' || caller::text, 0));

  if (select count(*) from public.product_events
      where actor_id = caller and created_at > now() - interval '1 hour') >= 120 then
    return;
  end if;

  perform public.product_event_insert(
    caller,
    null,
    target_event,
    coalesce(target_properties, '{}'::jsonb) || jsonb_build_object('platform', 'web'),
    null
  );
end;
$$;

revoke all on function public.track_product_event(text, jsonb) from public, anon;
grant execute on function public.track_product_event(text, jsonb) to authenticated;

-- ---------- Writer 2: the backend ----------

/**
 * Records an event on behalf of a member (or of nobody: a waitlist sign-up has
 * no account). Service role only. `platform` is forced to `cli` or `server`,
 * so a CLI batch can never pass itself off as the web.
 *
 * Returns false when the event was dropped: unknown name, or the actor is over
 * the hourly ceiling for CLI events (`platform_settings` key `cli`,
 * `events_per_hour`, default 600).
 */
create or replace function public.track_product_event_server(
  target_actor uuid,
  target_org uuid,
  target_event text,
  target_properties jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default null,
  target_platform text default 'server'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  platform text := case when target_platform = 'cli' then 'cli' else 'server' end;
  ceiling integer;
begin
  if auth.role() is distinct from 'service_role' then
    return false;
  end if;
  if target_event is null or not public.product_event_known(target_event) then
    return false;
  end if;

  if target_actor is not null and platform = 'cli' then
    select greatest(coalesce((value ->> 'events_per_hour')::integer, 600), 1) into ceiling
    from public.platform_settings where key = 'cli';
    ceiling := coalesce(ceiling, 600);

    perform pg_advisory_xact_lock(hashtextextended('product-events:' || target_actor::text, 0));
    if (select count(*) from public.product_events
        where actor_id = target_actor
          and created_at > now() - interval '1 hour'
          and properties ->> 'platform' = 'cli') >= ceiling then
      return false;
    end if;
  end if;

  perform public.product_event_insert(
    target_actor,
    target_org,
    target_event,
    coalesce(target_properties, '{}'::jsonb) || jsonb_build_object('platform', platform),
    target_occurred_at
  );
  return true;
end;
$$;

revoke all on function public.track_product_event_server(uuid, uuid, text, jsonb, timestamptz, text)
  from public, anon, authenticated;

-- ---------- Daily rollup and retention ----------

-- What the reports read. Raw events are kept 13 months; the rollup stays.
create table public.product_events_daily (
  day date not null,
  event_name text not null,
  segment text not null default '-',
  locale text not null default '-',
  ai_tool text not null default '-',
  module text not null default '-',
  events integer not null default 0,
  actors integer not null default 0,
  primary key (day, event_name, segment, locale, ai_tool, module)
);

alter table public.product_events_daily enable row level security;

create policy "product_events_daily_select_superadmin" on public.product_events_daily
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.product_events_daily to authenticated;

-- Idempotent: recomputes one São Paulo day from the raw events.
create or replace function public.rollup_product_events(target_day date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  day_to_roll date := coalesce(target_day, ((now() at time zone 'America/Sao_Paulo')::date - 1));
  written integer := 0;
begin
  if auth.role() is distinct from 'service_role' and not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.product_events_daily where day = day_to_roll;

  insert into public.product_events_daily (day, event_name, segment, locale, ai_tool, module, events, actors)
  select
    day_to_roll,
    e.event_name,
    coalesce(e.segment::text, '-'),
    coalesce(e.locale, '-'),
    coalesce(e.ai_tool::text, '-'),
    coalesce(e.properties ->> 'module', '-'),
    count(*)::integer,
    count(distinct e.actor_id)::integer
  from public.product_events e
  where (e.occurred_at at time zone 'America/Sao_Paulo')::date = day_to_roll
  group by 2, 3, 4, 5, 6;
  get diagnostics written = row_count;

  return written;
end;
$$;

revoke all on function public.rollup_product_events(date) from public, anon;
grant execute on function public.rollup_product_events(date) to authenticated;

create or replace function public.purge_product_events(target_keep interval default interval '13 months')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- Never less than three months, whatever the caller asks.
  delete from public.product_events
  where occurred_at < now() - greatest(target_keep, interval '3 months');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_product_events(interval) from public, anon, authenticated;
