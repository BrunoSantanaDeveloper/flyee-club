-- ============================================================
-- 0011_delivery: what the CLI delivery API (/api/cli/*) records and enforces.
--
--   member_devices     one row per machine running the CLI, with the device
--                      ceiling of the member's tier;
--   cli_requests       one row per API call: the rate-limit window and the
--                      volume trail;
--   module_downloads   one row per package handed out.
--
-- The API authenticates with an OAuth token, not a Supabase session, so it
-- calls everything here with the service role and passes the token's user and
-- workspace explicitly.
--
-- Origin: inherited migration 0088 (`mcp_requests` and its rate allowance) and
-- 0033 (the device pattern). The rest is new.
-- ============================================================

-- ---------- Devices ----------

create table public.member_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Generated once by the CLI and kept on the machine. Not a hardware id.
  device_id text not null check (device_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  name text check (name is null or char_length(name) <= 80),
  os text check (os is null or os in ('windows', 'macos', 'linux', 'other')),
  os_version text check (os_version is null or char_length(os_version) <= 40),
  ai_tool public.ai_tool,
  cli_version text check (cli_version is null or public.semver_ok(cli_version)),
  core_version text check (core_version is null or public.semver_ok(core_version)),
  -- [{"slug": "...", "version": "1.2.0"}], as the CLI last reported it.
  installed_modules jsonb not null default '[]'::jsonb check (jsonb_typeof(installed_modules) = 'array'),
  -- Whether the member said this project is their own or a client's. Drives
  -- the Pro offer, never access.
  project_kind text check (project_kind is null or project_kind in ('own', 'client')),
  token_family_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_update_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  unique (user_id, device_id)
);

create index member_devices_org_idx on public.member_devices (org_id) where revoked_at is null;
create index member_devices_family_idx on public.member_devices (token_family_id) where token_family_id is not null;

alter table public.member_devices enable row level security;

create policy "member_devices_select_member" on public.member_devices
  for select to authenticated
  using (public.is_org_member(org_id) or public.is_superadmin());

-- Written only by register_member_device / revoke_member_device.
grant select on table public.member_devices to authenticated;

-- ---------- Request trail and rate window ----------

create table public.cli_requests (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  token_id uuid references public.oauth_tokens (id) on delete set null,
  device_id text,
  endpoint text not null check (char_length(endpoint) <= 60),
  status text not null default 'ok' check (
    status in ('ok', 'denied_scope', 'denied_entitlement', 'denied_device', 'denied_rate', 'error')
  ),
  created_at timestamptz not null default now()
);

create index cli_requests_window_idx on public.cli_requests (org_id, created_at desc);

alter table public.cli_requests enable row level security;

create policy "cli_requests_select_superadmin" on public.cli_requests
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.cli_requests to authenticated;

create table public.module_downloads (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  device_id text,
  module_id uuid not null references public.catalog_modules (id) on delete cascade,
  version_id uuid not null references public.catalog_module_versions (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index module_downloads_org_idx on public.module_downloads (org_id, created_at desc);
create index module_downloads_version_idx on public.module_downloads (version_id);

alter table public.module_downloads enable row level security;

create policy "module_downloads_select_superadmin" on public.module_downloads
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.module_downloads to authenticated;

/**
 * May this workspace make another call, and another download? The ceilings are
 * configuration (`platform_settings` key `cli`): `rate.per_minute`,
 * `rate.per_hour`, `downloads_per_day`. Only calls that went through count.
 */
create or replace function public.cli_rate_allowance(target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  settings jsonb;
  per_minute integer;
  per_hour integer;
  downloads_per_day integer;
  used_minute integer;
  used_hour integer;
  used_downloads integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select value into settings from public.platform_settings where key = 'cli';
  per_minute := greatest(coalesce((settings -> 'rate' ->> 'per_minute')::int, 60), 1);
  per_hour := greatest(coalesce((settings -> 'rate' ->> 'per_hour')::int, 600), 1);
  downloads_per_day := greatest(coalesce((settings ->> 'downloads_per_day')::int, 200), 1);

  select count(*) into used_minute
  from public.cli_requests
  where org_id = target_org and status = 'ok' and created_at >= now() - interval '1 minute';

  select count(*) into used_hour
  from public.cli_requests
  where org_id = target_org and status = 'ok' and created_at >= now() - interval '1 hour';

  select count(*) into used_downloads
  from public.module_downloads
  where org_id = target_org and created_at >= now() - interval '1 day';

  return jsonb_build_object(
    'allowed', used_minute < per_minute and used_hour < per_hour,
    'per_minute_used', used_minute,
    'per_minute_limit', per_minute,
    'per_hour_used', used_hour,
    'per_hour_limit', per_hour,
    'downloads_allowed', used_downloads < downloads_per_day,
    'downloads_used', used_downloads,
    'downloads_limit', downloads_per_day
  );
end;
$$;

revoke all on function public.cli_rate_allowance(uuid) from public, anon;
grant execute on function public.cli_rate_allowance(uuid) to authenticated;

-- Retention of the request trail (a cron calls it).
create or replace function public.purge_cli_requests(target_keep interval default interval '30 days')
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
  delete from public.cli_requests where created_at < now() - greatest(target_keep, interval '2 days');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_cli_requests(interval) from public, anon, authenticated;

-- ---------- Registering a device ----------

/**
 * The CLI reports the machine it runs on. Creates the device on first sight,
 * refreshes it afterwards, and enforces the tier's ceiling (`limits.devices`
 * from org_entitlements): a device that would exceed it is refused with
 * `device_limit_reached`, and nothing is written.
 *
 * A device the member revoked comes back only through a NEW login (a
 * different token family): the old chain was revoked with it.
 *
 * The first registration of a device is the `cli.installed` event.
 */
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
  target_updated boolean default false
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
  live_devices integer;
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

  -- Serialize per workspace: two machines registering at once must not both
  -- pass a ceiling of one.
  perform pg_advisory_xact_lock(hashtextextended('member-devices:' || target_org::text, 0));

  entitlements := public.org_entitlements(target_org);
  if not coalesce((entitlements ->> 'active')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'not_entitled', 'suspended', entitlements -> 'suspended');
  end if;
  device_limit := coalesce((entitlements -> 'limits' ->> 'devices')::numeric::integer, 0);

  select * into existing from public.member_devices
  where user_id = target_user and device_id = target_device_id
  for update;

  select count(*) into live_devices
  from public.member_devices d
  where d.org_id = target_org and d.revoked_at is null
    and (existing.id is null or d.id <> existing.id);

  if existing.id is not null and existing.revoked_at is not null then
    if target_token_family is null or target_token_family is not distinct from existing.token_family_id then
      return jsonb_build_object('ok', false, 'code', 'device_revoked');
    end if;
    revived := true;
  end if;

  if (existing.id is null or revived) and live_devices >= device_limit then
    return jsonb_build_object(
      'ok', false,
      'code', 'device_limit_reached',
      'limit', device_limit,
      'live_devices', live_devices
    );
  end if;

  if existing.id is null then
    insert into public.member_devices (
      org_id, user_id, device_id, name, os, os_version, ai_tool, cli_version, core_version,
      installed_modules, project_kind, token_family_id, last_update_at
    ) values (
      target_org, target_user, target_device_id, left(nullif(btrim(target_name), ''), 80), clean_os,
      left(nullif(btrim(target_os_version), ''), 40), clean_ai, clean_cli, clean_core,
      coalesce(clean_modules, '[]'::jsonb), clean_kind, target_token_family,
      case when target_updated then now() end
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
      'first_seen_at', saved.first_seen_at,
      'last_update_at', saved.last_update_at
    ),
    'limit', device_limit,
    'live_devices', live_devices + 1
  );
end;
$$;

revoke all on function public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean)
  from public, anon, authenticated;

-- ---------- Revoking ----------

/**
 * Cuts one machine off: the device is marked revoked and EVERY token of its
 * family is revoked with it, so the CLI on that machine stops updating at its
 * next call. The member does it from /settings/devices; an operator may do it
 * for them; the backend calls it with the service role.
 */
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
  reason text := case when target_reason in ('member', 'admin', 'suspended', 'canceled') then target_reason else 'member' end;
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

/**
 * Kills every live token of a workspace: a suspension, an account deletion, or
 * a cancellation that left the workspace with no catalog access. The devices
 * stay listed; they simply have to log in again, and will only succeed if the
 * workspace is entitled.
 */
create or replace function public.revoke_member_tokens(target_org uuid, target_reason text default 'canceled')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked integer := 0;
  reason text := case when target_reason in ('member', 'admin', 'suspended', 'canceled') then target_reason else 'admin' end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (public.is_superadmin() and not public.is_impersonated()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_org is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  update public.oauth_tokens
  set revoked_at = now()
  where org_id = target_org and revoked_at is null;
  get diagnostics revoked = row_count;

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_org, auth.uid(), 'member.tokens_revoked', 'organization', target_org::text,
    jsonb_build_object('reason', reason, 'tokens_revoked', revoked)
  );

  return jsonb_build_object('ok', true, 'tokensRevoked', revoked);
end;
$$;

revoke all on function public.revoke_member_tokens(uuid, text) from public, anon;
grant execute on function public.revoke_member_tokens(uuid, text) to authenticated;

-- ---------- Activation ----------

/**
 * The four facts the activation checklist is drawn from, read from real state:
 * who the member said they are, whether they have access, whether a machine is
 * connected and whether a tool ever ran. A definer RPC because the last two
 * live in tables a member cannot read rows of.
 */
create or replace function public.member_activation_facts()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  profile public.profiles%rowtype;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  caller_org := public.current_org_id();
  select * into profile from public.profiles where id = caller;

  return jsonb_build_object(
    'has_profile_segment', profile.segment is not null and profile.ai_tool is not null,
    'has_access', public.org_has_entitlement(caller_org, 'catalog_access'),
    'has_device', exists (
      select 1 from public.member_devices d
      where d.org_id = caller_org and d.revoked_at is null
    ),
    'has_first_execution', exists (
      select 1 from public.product_events e
      where e.org_id = caller_org and e.event_name = 'tool.executed'
    )
  );
end;
$$;

revoke all on function public.member_activation_facts() from public, anon;
grant execute on function public.member_activation_facts() to authenticated;
