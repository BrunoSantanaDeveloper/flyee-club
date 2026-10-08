-- ============================================================
-- 0039_pro_features: which feature sells FlyeeClub Pro (2026-10-08,
-- docs/PLANO-IMPLEMENTACAO.md 12.4).
--
-- Decided by the owner (docs/PRODUCT.md, "Decisões tomadas 2026-10-08"):
-- FlyeeClub Pro is offered inside the member area, on the click of one of its
-- features, through one upgrade prompt. To judge that, the offer events the
-- prompt records name the feature that was clicked:
--
--   feature   roadmap_propose, roadmap_vote, recipe_install, recipe_workflow,
--             meeting_register, advanced_guide, more_devices; anything else
--             is dropped, like every other property;
--   origin    gains the screens the prompt opens on: roadmap, recipes,
--             meetings, devices (the module page already was `module`).
--
-- admin_pro_features(days) reads them back for /admin/metricas: per feature,
-- the workspaces that saw the prompt, clicked to buy, and bought FlyeeClub Pro
-- (upsell.purchased, offer club) within 14 days after such a click.
-- ============================================================

-- The function of 0026 with the feature and four more origins.
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
        'home', 'revalidation', 'catalog', 'module', 'billing', 'menu', 'checkout', 'email', 'cli', 'site',
        'roadmap', 'recipes', 'meetings', 'devices'
      ) then props ->> 'origin'
    end,
    'feature', case
      when props ->> 'feature' in (
        'roadmap_propose', 'roadmap_vote', 'recipe_install', 'recipe_workflow',
        'meeting_register', 'advanced_guide', 'more_devices'
      ) then props ->> 'feature'
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

-- ---------- What sells FlyeeClub Pro ----------

/**
 * Per feature of FlyeeClub Pro, over the last `target_days` (1 to 400): the
 * workspaces that saw its upgrade prompt, the ones that clicked to buy, and the
 * ones that bought FlyeeClub Pro within 14 days after such a click. A
 * workspace counts once per column. Operators only.
 */
create or replace function public.admin_pro_features(target_days integer default 90)
returns table (feature text, viewed bigint, clicked bigint, purchased bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(target_days, 90), 400)));
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with features(name, position) as (
    values
      ('roadmap_propose', 1), ('roadmap_vote', 2), ('recipe_install', 3), ('recipe_workflow', 4),
      ('meeting_register', 5), ('advanced_guide', 6), ('more_devices', 7)
  ),
  offers as (
    select e.org_id, e.event_name, e.properties ->> 'feature' as name, e.occurred_at
    from public.product_events e
    where e.event_name in ('upsell.viewed', 'upsell.clicked')
      and e.properties ->> 'offer' = 'club'
      and e.properties ? 'feature'
      and e.org_id is not null
      and e.occurred_at >= since
  ),
  purchases as (
    select e.org_id, e.occurred_at
    from public.product_events e
    where e.event_name = 'upsell.purchased'
      and e.properties ->> 'offer' = 'club'
      and e.org_id is not null
      and e.occurred_at >= since
  )
  select
    f.name,
    (select count(distinct o.org_id) from offers o where o.name = f.name and o.event_name = 'upsell.viewed'),
    (select count(distinct o.org_id) from offers o where o.name = f.name and o.event_name = 'upsell.clicked'),
    (select count(distinct p.org_id) from purchases p
      where exists (
        select 1 from offers o
        where o.org_id = p.org_id
          and o.name = f.name
          and o.event_name = 'upsell.clicked'
          and o.occurred_at <= p.occurred_at
          and o.occurred_at > p.occurred_at - interval '14 days'
      ))
  from features f
  order by f.position;
end;
$$;

revoke all on function public.admin_pro_features(integer) from public, anon;
grant execute on function public.admin_pro_features(integer) to authenticated;

-- Whether a published recipe has its step by step written, without reading
-- it. The recipe page offers the step by step through the upgrade prompt to
-- an account without the right, which row-level security keeps from reading
-- catalog_recipe_workflows; it must never offer one that does not exist, and
-- an area with nothing written says "Em breve" instead.
create or replace function public.catalog_recipe_has_workflow(target_recipe text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from catalog_recipe_workflows w
    join catalog_recipes r on r.id = w.recipe_id
    where r.slug = target_recipe
      and r.status = 'published'
      and exists (select 1 from jsonb_each_text(w.body_md) e where btrim(e.value) <> '')
  );
$$;

revoke all on function public.catalog_recipe_has_workflow(text) from public, anon;
grant execute on function public.catalog_recipe_has_workflow(text) to authenticated;
