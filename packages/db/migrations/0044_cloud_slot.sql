-- ============================================================
-- 0044_cloud_slot: one Claude Code session in the cloud per account, out of
-- the device ceiling (the product's request of 2026-10-20, item 4, decision D1).
--
-- Each cloud session starts on a new machine with no ~/.flyee and registers a
-- new device_id, so it took the account's one place: a member with the PC
-- connected could not use the cloud, and a second cloud session was refused.
-- Now:
--   - member_devices.cloud: null for a computer, 'claude_code' for a cloud
--     session, fixed when the row is created (a row never changes kind);
--   - plans.limits.cloud_sessions = 1 in every plan (the free plan is the base
--     every account merges from, so every account has one);
--   - computers count against limits.devices with cloud rows left out; a
--     cloud registration past cloud_sessions revokes the oldest cloud session
--     and its token chain (reason 'replaced', a device.revoked event, an audit
--     row), never a computer; with cloud_sessions at 0 a new cloud session
--     is a computer, as before (refused at the ceiling, device_limit_reached);
--   - oauth_device_codes.cloud: the login by code carries the mark too, so
--     /ativar does not ask a cloud session to disconnect a computer.
-- The mark is declared by the CLI (CLAUDE_CODE_REMOTE): the risk is accepted
-- in D1 and bounded, one place, taken back by the next real cloud session.
-- ============================================================

alter table public.member_devices
  add column cloud text constraint member_devices_cloud_check check (cloud in ('claude_code'));

comment on column public.member_devices.cloud is
  'Null for a computer; ''claude_code'' for a Claude Code session in the cloud, which takes the account''s cloud place (limits.cloud_sessions) instead of a computer''s (0044). Fixed at creation.';

create or replace function public.guard_member_device_kind()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cloud is distinct from old.cloud then
    raise exception 'member_device_kind_fixed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_member_device_kind() from public, anon, authenticated;

create trigger member_devices_kind_fixed
  before update of cloud on public.member_devices
  for each row execute function public.guard_member_device_kind();

alter table public.oauth_device_codes
  add column cloud text constraint oauth_device_codes_cloud_check check (cloud in ('claude_code'));

comment on column public.oauth_device_codes.cloud is
  'The cloud mark of the machine asking for the code (POST /api/oauth/device, cloud=claude_code), read by /ativar (0044).';

update public.plans
set limits = limits || '{"cloud_sessions": 1}'::jsonb
where not (limits ? 'cloud_sessions');

-- The reason of a replaced cloud session, in the one allowlist of usage events.
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
        'suspended', 'canceled', 'refund', 'replaced'
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

-- 'replaced' among the reasons a device is revoked with.
create or replace function public.revoke_member_device(target_device uuid, target_reason text default 'member')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  device public.member_devices%rowtype;
  caller uuid := auth.uid();
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  reason text := case when target_reason in ('member', 'admin', 'suspended', 'canceled', 'replaced') then target_reason else 'member' end;
  revoked_tokens integer := 0;
begin
  if not is_service then
    if caller is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;
    -- Support looks; it does not disconnect a member's machine on its own.
    if public.is_impersonated() then
      return jsonb_build_object('ok', false, 'code', 'support_session');
    end if;
  end if;

  select * into device from public.member_devices where id = target_device for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not is_service and not (public.is_org_member(device.org_id) or public.is_superadmin()) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if device.revoked_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  update public.member_devices
  set revoked_at = now(), revoke_reason = reason
  where id = device.id;

  update public.oauth_tokens
  set revoked_at = now()
  where revoked_at is null
    and (
      (device.token_family_id is not null and family_id = device.token_family_id)
      or (user_id = device.user_id and device_id = device.device_id)
    );
  get diagnostics revoked_tokens = row_count;

  perform public.product_event_insert(
    device.user_id, device.org_id, 'device.revoked',
    jsonb_build_object('reason', reason, 'platform', 'server'), null
  );

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    device.org_id, caller, 'member.device_revoked', 'member_device', device.id::text,
    jsonb_build_object('reason', reason, 'tokens_revoked', revoked_tokens)
  );

  return jsonb_build_object('ok', true, 'changed', true, 'tokensRevoked', revoked_tokens);
end;
$$;
revoke all on function public.revoke_member_device(uuid, text) from public, anon;
grant execute on function public.revoke_member_device(uuid, text) to authenticated;

drop function public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean, text);

create or replace function public.register_member_device(
  target_user uuid,
  target_org uuid,
  target_device_id text,
  target_token_family uuid default null,
  target_name text default null,
  target_os text default null,
  target_os_version text default null,
  target_ai_tool text default null,
  target_cli_version text default null,
  target_core_version text default null,
  target_installed_modules jsonb default null,
  target_project_kind text default null,
  target_updated boolean default false,
  target_ai_tool_detail text default null,
  target_cloud text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.member_devices%rowtype;
  saved public.member_devices%rowtype;
  entitlements jsonb;
  device_limit integer;
  cloud_limit integer;
  live_devices integer;
  live_cloud integer;
  kind text;
  replaced integer := 0;
  stale record;
  created boolean := false;
  revived boolean := false;
  clean_os text := case when target_os in ('windows', 'macos', 'linux', 'other') then target_os end;
  clean_ai public.ai_tool := case
    when target_ai_tool = any (enum_range(null::public.ai_tool)::text[]) then target_ai_tool::public.ai_tool
  end;
  clean_cli text := case when public.semver_ok(target_cli_version) then target_cli_version end;
  clean_core text := case when public.semver_ok(target_core_version) then target_core_version end;
  clean_kind text := case when target_project_kind in ('own', 'client') then target_project_kind end;
  clean_modules jsonb := case
    when jsonb_typeof(target_installed_modules) = 'array' and jsonb_array_length(target_installed_modules) <= 500
      then target_installed_modules
  end;
  clean_cloud text := case when target_cloud = 'claude_code' then target_cloud end;
  detail text := lower(btrim(coalesce(target_ai_tool_detail, '')));
  clean_detail text;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;
  if target_user is null or target_org is null
     or target_device_id is null or target_device_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_device');
  end if;
  if not exists (
    select 1 from public.memberships m where m.org_id = target_org and m.user_id = target_user
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  -- Only beside `other`, and only a name the operator lists.
  if clean_ai = 'other' and detail ~ '^[a-z0-9][a-z0-9_-]{0,31}$' and exists (
    select 1 from public.platform_settings s
    where s.key = 'cli'
      and jsonb_typeof(s.value -> 'known_tools') = 'array'
      and (s.value -> 'known_tools') ? detail
  ) then
    clean_detail := detail;
  end if;

  -- Serialize per workspace: two machines registering at once must not both
  -- pass a ceiling of one.
  perform pg_advisory_xact_lock(hashtextextended('member-devices:' || target_org::text, 0));

  entitlements := public.org_entitlements(target_org);
  if not coalesce((entitlements ->> 'active')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'not_entitled', 'suspended', entitlements -> 'suspended');
  end if;
  device_limit := coalesce((entitlements -> 'limits' ->> 'devices')::numeric::integer, 0);
  cloud_limit := coalesce((entitlements -> 'limits' ->> 'cloud_sessions')::numeric::integer, 0);
  -- With no cloud place, a new cloud session is a computer, as before this migration.
  if cloud_limit <= 0 then
    clean_cloud := null;
  end if;

  select * into existing from public.member_devices
  where user_id = target_user and device_id = target_device_id
  for update;

  -- A row keeps the kind it was created with; only a new row takes the one reported.
  kind := case when existing.id is not null then existing.cloud else clean_cloud end;

  select count(*) into live_devices
  from public.member_devices d
  where d.org_id = target_org and d.revoked_at is null and d.cloud is null
    and (existing.id is null or d.id <> existing.id);

  select count(*) into live_cloud
  from public.member_devices d
  where d.org_id = target_org and d.revoked_at is null and d.cloud is not null
    and (existing.id is null or d.id <> existing.id);

  if existing.id is not null and existing.revoked_at is not null then
    if target_token_family is null or target_token_family is not distinct from existing.token_family_id then
      return jsonb_build_object('ok', false, 'code', 'device_revoked');
    end if;
    revived := true;
  end if;

  if existing.id is null or revived then
    if kind is null and live_devices >= device_limit then
      return jsonb_build_object(
        'ok', false,
        'code', 'device_limit_reached',
        'limit', device_limit,
        'live_devices', live_devices
      );
    end if;
    if kind is not null then
      if cloud_limit <= 0 then
        return jsonb_build_object(
          'ok', false,
          'code', 'device_limit_reached',
          'limit', device_limit,
          'live_devices', live_devices
        );
      end if;
      -- The newest session takes the place of the oldest: only cloud rows, never a computer.
      for stale in
        select d.id from public.member_devices d
        where d.org_id = target_org and d.revoked_at is null and d.cloud is not null
          and (existing.id is null or d.id <> existing.id)
        order by d.last_seen_at asc, d.first_seen_at asc
        limit greatest(live_cloud - cloud_limit + 1, 0)
      loop
        perform public.revoke_member_device(stale.id, 'replaced');
        replaced := replaced + 1;
      end loop;
    end if;
  end if;

  if existing.id is null then
    insert into public.member_devices (
      org_id, user_id, device_id, name, os, os_version, ai_tool, ai_tool_detail, cli_version, core_version,
      installed_modules, project_kind, token_family_id, last_update_at, cloud
    ) values (
      target_org, target_user, target_device_id, left(nullif(btrim(target_name), ''), 80), clean_os,
      left(nullif(btrim(target_os_version), ''), 40), clean_ai, clean_detail, clean_cli, clean_core,
      coalesce(clean_modules, '[]'::jsonb), clean_kind, target_token_family,
      case when target_updated then now() end, clean_cloud
    )
    returning * into saved;
    created := true;
  else
    update public.member_devices set
      org_id = target_org,
      name = coalesce(left(nullif(btrim(target_name), ''), 80), name),
      os = coalesce(clean_os, os),
      os_version = coalesce(left(nullif(btrim(target_os_version), ''), 40), os_version),
      ai_tool = coalesce(clean_ai, ai_tool),
      ai_tool_detail = case when clean_ai is null then ai_tool_detail else clean_detail end,
      cli_version = coalesce(clean_cli, cli_version),
      core_version = coalesce(clean_core, core_version),
      installed_modules = coalesce(clean_modules, installed_modules),
      project_kind = coalesce(clean_kind, project_kind),
      token_family_id = coalesce(target_token_family, token_family_id),
      last_seen_at = now(),
      last_update_at = case when target_updated then now() else last_update_at end,
      revoked_at = null,
      revoke_reason = null
    where id = existing.id
    returning * into saved;
  end if;

  if created or revived then
    perform public.product_event_insert(
      target_user, target_org, 'cli.installed',
      jsonb_strip_nulls(jsonb_build_object(
        'platform', 'cli',
        'os', saved.os,
        'ai_tool', saved.ai_tool,
        'cli_version', saved.cli_version,
        'core_version', saved.core_version,
        'project_kind', saved.project_kind
      )),
      null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case when created then 'created' when revived then 'revived' else 'updated' end,
    'device', jsonb_build_object(
      'id', saved.id,
      'device_id', saved.device_id,
      'name', saved.name,
      'cloud', saved.cloud,
      'first_seen_at', saved.first_seen_at,
      'last_update_at', saved.last_update_at
    ),
    'limit', device_limit,
    -- Computers only: a cloud session never takes a computer's place.
    'live_devices', live_devices + case when saved.cloud is null then 1 else 0 end,
    'cloud_replaced', replaced
  );
end;
$$;

revoke all on function public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean, text, text)
  from public, anon, authenticated;
