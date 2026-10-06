-- ============================================================
-- 0026_roadmap_proposals: the custom app, the minimal honest way (2026-10-06).
--
-- The home brief promised two routes to an app the store does not have:
-- propose it for a vote, where the most voted of each month goes into
-- production, or commission it. The platform builds the first and points the
-- second at the contact form (no quote, no payment, no tracking: that is a
-- phase of its own, if ever).
--
--   - A FlyeeClub Pro member (the `roadmap_vote` right) proposes an item
--     through `propose_roadmap_item`. It lands in a moderated queue (status
--     `submitted`), visible to its author and to the operator only, until the
--     console opens it for votes (`proposed`) or declines it. The queue has a
--     ceiling per member, data in platform_settings.
--   - `roadmap_month_leader(month)` names the open idea with the most votes
--     CAST in that month: the number the roadmap shows, and what the operator
--     acts on at the turn of the month.
--   - `roadmap.proposed` joins the usage events; `custom_app` joins the offers
--     an event may name (the card on the home that leads to the contact form).
-- ============================================================

-- ---------- The queue ----------

alter table public.roadmap_items
  add column proposed_by uuid references public.profiles (id) on delete set null,
  add column submitted_at timestamptz;

comment on column public.roadmap_items.proposed_by is
  'The member who proposed the idea (null for an idea the operator wrote). Stays after moderation, so the author follows it.';

alter table public.roadmap_items drop constraint roadmap_items_status_check;
alter table public.roadmap_items
  add constraint roadmap_items_status_check
  check (status in ('submitted', 'proposed', 'planned', 'building', 'shipped', 'declined'));

-- A proposal under review is the author's and the operator's business only.
drop policy "roadmap_items_select_member" on public.roadmap_items;
create policy "roadmap_items_select_member" on public.roadmap_items
  for select to authenticated
  using (status <> 'submitted' or proposed_by = auth.uid() or public.is_superadmin());

create index roadmap_items_proposed_by_idx on public.roadmap_items (proposed_by) where proposed_by is not null;

-- The ceiling of proposals one member may have under review at once.
insert into public.platform_settings (key, value, is_public)
values ('roadmap', '{"max_open_proposals": 3}'::jsonb, false)
on conflict (key) do nothing;

-- ---------- Proposing ----------

/**
 * A member's proposal, into the moderated queue. Needs the `roadmap_vote`
 * right (FlyeeClub Pro); refused during a support visit; at most
 * `platform_settings.roadmap.max_open_proposals` under review per member.
 *
 * The text is stored under the member's language. Written in English it is
 * stored under both keys, because the default rendering needs a Portuguese
 * text; the operator translates it on review (the console edits both).
 */
create or replace function public.propose_roadmap_item(
  target_title text,
  target_description text default null,
  target_trail text default null,
  target_locale text default 'pt-BR'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  title_text text := left(btrim(coalesce(target_title, '')), 120);
  description_text text := nullif(left(btrim(coalesce(target_description, '')), 1000), '');
  trail_slug text := nullif(btrim(coalesce(target_trail, '')), '');
  lang text := case when target_locale = 'en' then 'en' else 'pt-BR' end;
  ceiling integer;
  open_count integer;
  item_id uuid;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  caller_org := public.current_org_id();
  if not public.org_has_entitlement(caller_org, 'roadmap_vote') then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  if char_length(title_text) < 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_title');
  end if;
  if trail_slug is not null and not exists (select 1 from public.catalog_trails t where t.slug = trail_slug) then
    return jsonb_build_object('ok', false, 'code', 'invalid_trail');
  end if;

  select coalesce((value ->> 'max_open_proposals')::integer, 3) into ceiling
  from public.platform_settings where key = 'roadmap';
  ceiling := coalesce(ceiling, 3);

  select count(*)::integer into open_count
  from public.roadmap_items
  where proposed_by = caller and status = 'submitted';
  if open_count >= ceiling then
    return jsonb_build_object('ok', false, 'code', 'too_many_open', 'open', open_count, 'max', ceiling);
  end if;

  insert into public.roadmap_items (title, description, trail, status, proposed_by, created_by, submitted_at)
  values (
    jsonb_build_object('pt-BR', title_text) || case when lang = 'en' then jsonb_build_object('en', title_text) else '{}'::jsonb end,
    case
      when description_text is null then '{}'::jsonb
      else jsonb_build_object('pt-BR', description_text)
        || case when lang = 'en' then jsonb_build_object('en', description_text) else '{}'::jsonb end
    end,
    trail_slug,
    'submitted',
    caller,
    caller,
    now()
  )
  returning id into item_id;

  perform public.product_event_insert(
    caller, caller_org, 'roadmap.proposed',
    jsonb_build_object('trail', trail_slug, 'platform', 'web'), null
  );

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (caller_org, caller, 'roadmap.item.proposed', 'roadmap_item', item_id::text,
          jsonb_strip_nulls(jsonb_build_object('trail', trail_slug, 'locale', lang)));

  return jsonb_build_object('ok', true, 'id', item_id, 'open', open_count + 1, 'max', ceiling);
end;
$$;

revoke all on function public.propose_roadmap_item(text, text, text, text) from public, anon;
grant execute on function public.propose_roadmap_item(text, text, text, text) to authenticated;

-- ---------- The most voted of the month ----------

/**
 * The open idea (`proposed`) with the most votes cast in the month, ties to
 * the older idea. Null when nobody voted that month. Definer, because members
 * read only their own votes; the answer carries counts, never who voted.
 */
create or replace function public.roadmap_month_leader(target_month date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', coalesce(target_month, current_date))::date as month_start,
           (date_trunc('month', coalesce(target_month, current_date)) + interval '1 month')::date as month_end
  ),
  counted as (
    select i.id, i.title, i.trail, i.votes_count, i.created_at, count(v.*)::integer as votes_in_month
    from public.roadmap_items i
    join bounds b on true
    join public.roadmap_votes v on v.item_id = i.id and v.created_at >= b.month_start and v.created_at < b.month_end
    where i.status = 'proposed'
    group by i.id
  )
  select jsonb_build_object(
    'item_id', c.id,
    'title', c.title,
    'trail', c.trail,
    'votes_in_month', c.votes_in_month,
    'votes_total', c.votes_count,
    'month_start', b.month_start
  )
  from counted c, bounds b
  order by c.votes_in_month desc, c.created_at asc
  limit 1;
$$;

revoke all on function public.roadmap_month_leader(date) from public, anon;
grant execute on function public.roadmap_month_leader(date) to authenticated;

-- ---------- The event and the offer ----------

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
    'roadmap.proposed',
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

-- The function of migration 0025 with one more offer: the custom app card.
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
      when props ->> 'offer' in ('kit', 'club', 'pro', 'mentoring', 'consulting', 'custom_app', 'founders')
        then props ->> 'offer'
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
