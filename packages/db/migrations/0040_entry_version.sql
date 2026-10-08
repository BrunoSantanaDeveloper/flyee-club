-- ============================================================
-- 0040_entry_version: the entry version of each app (2026-10-08,
-- docs/PLANO-IMPLEMENTACAO.md 12.5, items 9.1 to 9.3).
--
-- Decided by the owner (docs/PRODUCT.md, "Decisões tomadas 2026-10-06", and
-- option 1 of 2026-10-08): an account with no purchase installs the entry
-- version of each app and nothing newer. No new version ever enters its
-- channel, so it is never updated, without anything blocking it. One rule
-- only: the module-wide free sample (catalog_modules.is_free_sample), the
-- stand-in until each app had an entry version, leaves the platform.
--
--   - entitlement_merge: the update channel is a right too, so the widest one
--     wins whatever the order (latest, then stable, then free). Every account
--     carries the free plan twice, as the floor and as its own subscription,
--     merged after the grants: without this, the free plan's channel would
--     have overwritten the one a FlyeeClub purchase grants.
--   - the free plan's update_channel becomes "free"; the paid plans keep
--     "latest".
--   - catalog_module_versions.is_entry: at most one per module, only on a
--     published version. A module's first released version is marked when it
--     is published; the operator moves or clears the mark from the console
--     (catalog_set_entry_version). The entry version cannot be yanked while
--     marked: move or clear the mark first (the rule of 2026-10-06). Public
--     metadata, like is_stable; no page shows it.
--   - can_read_guide: the basic guide of the entry version opens to every
--     account; can_watch_lesson: the basic video of an app with an entry
--     version too. The advanced depth still needs advanced_lessons.
--   - catalog_modules.is_free_sample is dropped. Every module keeps its first
--     released version as its entry version.
-- ============================================================

-- ---------- The channel is merged as a right ----------

create or replace function public.entitlement_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(
        key,
        case
          when jsonb_typeof(left_value) = 'number' and jsonb_typeof(right_value) = 'number'
            then to_jsonb(greatest((left_value #>> '{}')::numeric, (right_value #>> '{}')::numeric))
          when right_value is null or jsonb_typeof(right_value) = 'null' then left_value
          -- The widest channel wins, whatever the order of the sources (0040).
          when key = 'update_channel' then
            case
              when (case left_value #>> '{}' when 'latest' then 3 when 'stable' then 2 when 'free' then 1 else 0 end)
                 > (case right_value #>> '{}' when 'latest' then 3 when 'stable' then 2 when 'free' then 1 else 0 end)
                then left_value
              else right_value
            end
          else right_value
        end
      )
      from (
        select
          coalesce(l.key, r.key) as key,
          l.value as left_value,
          r.value as right_value
        from jsonb_each(coalesce(a, '{}'::jsonb)) as l
        full join jsonb_each(coalesce(b, '{}'::jsonb)) as r on r.key = l.key
      ) as pairs
    ),
    '{}'::jsonb
  );
$$;

-- The account with no purchase is on the free channel; a purchase moves it.
update public.plans
set limits = limits || '{"update_channel": "free"}'::jsonb,
    description = 'Conta sem compra: a versão de entrada de cada app e a novidade por e-mail.'
where is_free;

-- ---------- The entry version ----------

alter table public.catalog_module_versions
  add column is_entry boolean not null default false,
  add constraint catalog_module_versions_entry_published check (not is_entry or status = 'published');

comment on column public.catalog_module_versions.is_entry is
  'The entry version of the app: the one version an account with no purchase installs (channel free). At most one per module, always published; the first released version is marked when it is published (0040).';

create unique index catalog_module_versions_one_entry
  on public.catalog_module_versions (module_id)
  where is_entry;

-- Public metadata, like is_stable. Written only through catalog_set_entry_version.
grant select (is_entry) on table public.catalog_module_versions to anon, authenticated;

-- Every module keeps its first released version as its entry version.
update public.catalog_module_versions v
set is_entry = true
where v.id in (
  select distinct on (module_id) id
  from public.catalog_module_versions
  where status = 'published'
  order by module_id, published_at asc nulls last, created_at asc
)
and not exists (
  select 1 from public.catalog_module_versions e
  where e.module_id = v.module_id and e.is_entry
);

-- The guard of 0008, plus the entry version: marked on the first release,
-- never yanked while marked.
create or replace function public.guard_module_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and pg_trigger_depth() = 1 then
      raise exception 'version_released_immutable'
        using errcode = 'check_violation',
              hint = 'A released version is never deleted. Yank it instead.';
    end if;
    return old;
  end if;

  if old.status <> 'draft' then
    if new.module_id is distinct from old.module_id
       or new.version is distinct from old.version
       or new.storage_path is distinct from old.storage_path
       or new.sha256 is distinct from old.sha256
       or new.size_bytes is distinct from old.size_bytes
       or new.manifest is distinct from old.manifest
       or new.permissions is distinct from old.permissions
       or new.compatible_ais is distinct from old.compatible_ais
       or new.min_core_version is distinct from old.min_core_version then
      raise exception 'version_released_immutable'
        using errcode = 'check_violation',
              hint = 'Publish a new version instead of editing a released one.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'published')
      or (old.status = 'published' and new.status = 'yanked')
    ) then
      raise exception 'invalid_version_transition' using errcode = 'check_violation';
    end if;
    if new.status = 'published' then
      new.published_at := coalesce(new.published_at, now());
      -- The first version a module releases is its entry version.
      if not exists (
        select 1 from public.catalog_module_versions v
        where v.module_id = new.module_id and v.id <> new.id and v.status in ('published', 'yanked')
      ) then
        new.is_entry := true;
      end if;
    else
      if old.is_entry then
        raise exception 'entry_version_yank'
          using errcode = 'check_violation',
                hint = 'Mark another entry version, or clear the mark, before yanking this one.';
      end if;
      new.yanked_at := now();
      -- A withdrawn version is nobody's recommended version.
      new.is_stable := false;
    end if;
  end if;

  return new;
end;
$$;

/**
 * Moves the entry version of a module to a published version, or clears it
 * when target_version is null. Superadmin only (the catalog console, which
 * records the audit event). One transaction for the swap, so a module never
 * has two entry versions, nor loses its mark halfway.
 */
create or replace function public.catalog_set_entry_version(target_module uuid, target_version uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_superadmin' using errcode = '42501';
  end if;
  if target_version is not null and not exists (
    select 1 from public.catalog_module_versions v
    where v.id = target_version and v.module_id = target_module and v.status = 'published'
  ) then
    raise exception 'entry_version_invalid'
      using errcode = 'check_violation',
            hint = 'The entry version must be a published version of the same module.';
  end if;

  -- Clear first, then mark: a unique index is checked row by row, so one
  -- statement touching both rows could see two entry versions on its way.
  update public.catalog_module_versions
  set is_entry = false
  where module_id = target_module and is_entry and id is distinct from target_version;

  if target_version is not null then
    update public.catalog_module_versions
    set is_entry = true
    where id = target_version and not is_entry;
  end if;
end;
$$;

revoke all on function public.catalog_set_entry_version(uuid, uuid) from public, anon;
grant execute on function public.catalog_set_entry_version(uuid, uuid) to authenticated;

-- ---------- Guides and lessons follow the entry version ----------

create or replace function public.can_watch_lesson(target_lesson uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lesson record;
  caller_org uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_superadmin() then
    return true;
  end if;

  select l.is_advanced, l.module_id, m.status, m.entitlement_key
    into lesson
  from public.catalog_lessons l
  join public.catalog_modules m on m.id = l.module_id
  where l.id = target_lesson;

  if not found or lesson.status <> 'published' then
    return false;
  end if;

  caller_org := public.current_org_id();
  if lesson.is_advanced then
    return public.org_has_entitlement(caller_org, 'advanced_lessons');
  end if;
  -- An app with an entry version teaches its basic use to every account.
  return exists (
    select 1 from public.catalog_module_versions v
    where v.module_id = lesson.module_id and v.is_entry
  ) or public.org_has_entitlement(caller_org, lesson.entitlement_key);
end;
$$;

create or replace function public.can_read_guide(target_version uuid, target_depth text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  guide record;
  caller_org uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_superadmin() then
    return true;
  end if;

  select v.status as version_status, v.is_entry, m.status as module_status, m.entitlement_key
    into guide
  from public.catalog_module_versions v
  join public.catalog_modules m on m.id = v.module_id
  where v.id = target_version;

  if not found or guide.module_status <> 'published' or guide.version_status not in ('published', 'yanked') then
    return false;
  end if;

  caller_org := public.current_org_id();
  if target_depth = 'abrir_o_capo' then
    return public.org_has_entitlement(caller_org, 'advanced_lessons');
  end if;
  -- The basic guide of the entry version travels with the version every account installs.
  return guide.is_entry or public.org_has_entitlement(caller_org, guide.entitlement_key);
end;
$$;

-- ---------- The free sample leaves ----------

alter table public.catalog_modules drop column is_free_sample;
