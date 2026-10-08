-- ============================================================
-- 0036_ai_tool_detail: the tool the CLI found when no tested AI is there
-- (2026-10-08, docs/PLANO-IMPLEMENTACAO.md 12.1).
--
-- The product's core keeps a registry of AI tools in two tiers. "Tested" are
-- the four of the `ai_tool` enum. "Compatible by the standard" are the tools
-- that read AGENTS.md and .agents/skills (GitHub Copilot, OpenCode,
-- Antigravity, Kimi Code, Windsurf, Aider): a machine where only one of those
-- is found reports `ai_tool = 'other'` and names the tool in
-- `ai_tool_detail`. The finished CLI already sends it, and the delivery API
-- refused the whole report, so that login never completed.
--
-- The name is kept on the device only when the machine reports `other` and
-- the operator lists the name in `platform_settings.cli.known_tools` (edited
-- in the Entrega tab of /admin/catalogo, seeded with the core's six names).
-- Anything else is dropped, never refused: a name is a measurement, not a
-- reason to stop a member at the door. It is what phase 10.4 counts to
-- promote a tool to the enum.
-- ============================================================

alter table public.member_devices
  add column ai_tool_detail text
    check (ai_tool_detail is null or ai_tool_detail ~ '^[a-z0-9][a-z0-9_-]{0,31}$');

comment on column public.member_devices.ai_tool_detail is
  'The tool of the "compatible by the standard" tier the CLI found when the machine reports ai_tool = other, kept only when platform_settings.cli.known_tools lists it (0036).';

update public.platform_settings
set value = jsonb_set(
  value,
  '{known_tools}',
  '["copilot", "opencode", "antigravity", "kimi", "windsurf", "aider"]'::jsonb
)
where key = 'cli' and not (value ? 'known_tools');

-- ---------- Registering a device, with the tool's name ----------

/**
 * The function of 0011 with one more argument, `target_ai_tool_detail`. A
 * report that names an AI tool decides the detail too: the detail is kept,
 * replaced or cleared with it. A report that names no AI tool keeps both.
 */
drop function public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean);

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
  target_ai_tool_detail text default null
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
      org_id, user_id, device_id, name, os, os_version, ai_tool, ai_tool_detail, cli_version, core_version,
      installed_modules, project_kind, token_family_id, last_update_at
    ) values (
      target_org, target_user, target_device_id, left(nullif(btrim(target_name), ''), 80), clean_os,
      left(nullif(btrim(target_os_version), ''), 40), clean_ai, clean_detail, clean_cli, clean_core,
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
      'first_seen_at', saved.first_seen_at,
      'last_update_at', saved.last_update_at
    ),
    'limit', device_limit,
    'live_devices', live_devices + 1
  );
end;
$$;

revoke all on function public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean, text)
  from public, anon, authenticated;
