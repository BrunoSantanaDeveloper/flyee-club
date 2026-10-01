-- ============================================================
-- 0008_catalog: the tool catalog the CLI installs from.
--
-- The platform stores WHAT exists (trails, modules, versions with their
-- checksum and declared permissions, lessons, recipes) and serves the package
-- bytes. The module contents themselves are the product and are built in a
-- separate project.
--
-- Public versus gated, by construction:
--   * metadata is public: what the club offers, each version's checksum and
--     permissions, lesson titles. A visitor and a search engine may read it.
--   * what is sold is NOT in a public table: the package location
--     (`storage_path`) and manifest are columns no API role may select, the
--     lesson video id lives in catalog_lesson_videos and the recipe workflow in
--     catalog_recipe_workflows, both behind entitlement policies.
--
-- New in the baseline (the inherited project had no catalog).
-- ============================================================

-- ---------- Helpers ----------

-- A localized text: {"pt-BR": "...", "en": "..."}. Only the two site
-- languages, only strings. `require_default` demands the Portuguese text.
create or replace function public.i18n_ok(value jsonb, require_default boolean default false)
returns boolean
language sql
immutable
as $$
  select value is not null
    and jsonb_typeof(value) = 'object'
    and not exists (
      select 1 from jsonb_each(value) as entry
      where entry.key not in ('pt-BR', 'en') or jsonb_typeof(entry.value) <> 'string'
    )
    and (not require_default or nullif(btrim(value ->> 'pt-BR'), '') is not null);
$$;

revoke all on function public.i18n_ok(jsonb, boolean) from public, anon;
grant execute on function public.i18n_ok(jsonb, boolean) to authenticated;

create or replace function public.semver_ok(value text)
returns boolean
language sql
immutable
as $$
  select value is not null
    and value ~ '^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})(-[0-9A-Za-z][0-9A-Za-z.-]{0,19})?$';
$$;

revoke all on function public.semver_ok(text) from public, anon;
grant execute on function public.semver_ok(text) to authenticated;

-- Sort key: major, minor, patch, then releases after their own pre-releases.
create or replace function public.semver_sort_key(value text)
returns integer[]
language sql
immutable
as $$
  select array[
    split_part(split_part(value, '-', 1), '.', 1)::integer,
    split_part(split_part(value, '-', 1), '.', 2)::integer,
    split_part(split_part(value, '-', 1), '.', 3)::integer,
    case when position('-' in value) = 0 then 1 else 0 end
  ];
$$;

revoke all on function public.semver_sort_key(text) from public, anon;
grant execute on function public.semver_sort_key(text) to authenticated;

-- Stamps the first publication of a row whose lifecycle is a `status` column.
create or replace function public.set_catalog_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_catalog_published_at() from public, anon;

-- ---------- Trails (the seven stages of a product) ----------

create table public.catalog_trails (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,29}$'),
  name jsonb not null check (public.i18n_ok(name, true)),
  description jsonb not null default '{}'::jsonb check (public.i18n_ok(description)),
  icon text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_trails enable row level security;

create policy "catalog_trails_select" on public.catalog_trails
  for select to anon, authenticated
  using (true);

create policy "catalog_trails_all_superadmin" on public.catalog_trails
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_trails to anon;
grant select, insert, update, delete on table public.catalog_trails to authenticated;

create trigger catalog_trails_updated_at
  before update on public.catalog_trails
  for each row execute function public.set_updated_at();

insert into public.catalog_trails (slug, name, description, icon, sort) values
  ('planejar', '{"pt-BR": "Planejar", "en": "Plan"}',
   '{"pt-BR": "Decidir o que construir e para quem.", "en": "Decide what to build and for whom."}', 'NiCompass', 10),
  ('construir', '{"pt-BR": "Construir", "en": "Build"}',
   '{"pt-BR": "Do rascunho ao código que funciona.", "en": "From a draft to working code."}', 'NiCode', 20),
  ('publicar', '{"pt-BR": "Publicar", "en": "Ship"}',
   '{"pt-BR": "Colocar no ar com segurança.", "en": "Go live safely."}', 'NiRocket', 30),
  ('divulgar', '{"pt-BR": "Divulgar", "en": "Promote"}',
   '{"pt-BR": "Fazer o produto ser encontrado.", "en": "Get the product found."}', 'NiMegaphone', 40),
  ('vender', '{"pt-BR": "Vender", "en": "Sell"}',
   '{"pt-BR": "Transformar interesse em receita.", "en": "Turn interest into revenue."}', 'NiWallet', 50),
  ('escalar', '{"pt-BR": "Escalar", "en": "Scale"}',
   '{"pt-BR": "Crescer sem quebrar o que funciona.", "en": "Grow without breaking what works."}', 'NiChartLine', 60),
  ('manter', '{"pt-BR": "Manter", "en": "Maintain"}',
   '{"pt-BR": "Manter tudo funcionando quando a IA muda.", "en": "Keep everything working when the AI changes."}', 'NiRefresh', 70);

-- ---------- Modules ----------

create table public.catalog_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  trail text not null references public.catalog_trails (slug) on update cascade,
  type text not null check (type in ('skill', 'workflow', 'framework', 'tool')),
  icon text,
  name jsonb not null check (public.i18n_ok(name, true)),
  summary jsonb not null default '{}'::jsonb check (public.i18n_ok(summary)),
  description_md jsonb not null default '{}'::jsonb check (public.i18n_ok(description_md)),
  compatible_ais public.ai_tool[] not null default '{}',
  -- Keys the member must provide themself: [{name, env, url, required, purpose}].
  external_credentials jsonb not null default '[]'::jsonb check (jsonb_typeof(external_credentials) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Installable without any purchase: the free samples of the ladder.
  is_free_sample boolean not null default false,
  -- The limit key that unlocks this module (org_entitlements).
  entitlement_key text not null default 'catalog_access' check (entitlement_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  sort integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalog_modules_trail_idx on public.catalog_modules (trail, sort) where status = 'published';

alter table public.catalog_modules enable row level security;

create policy "catalog_modules_select_published" on public.catalog_modules
  for select to anon, authenticated
  using (status = 'published');

create policy "catalog_modules_all_superadmin" on public.catalog_modules
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_modules to anon;
grant select, insert, update, delete on table public.catalog_modules to authenticated;

create trigger catalog_modules_updated_at
  before update on public.catalog_modules
  for each row execute function public.set_updated_at();

-- ---------- Versions ----------

/**
 * One uploaded package of a module. Once it leaves `draft` its bytes are
 * frozen: the version string, the checksum, the size, the manifest and the
 * declared permissions never change again, because members verify exactly
 * those. A mistake is fixed by yanking the version and publishing a new one.
 *
 * Lifecycle: draft -> published -> yanked. A yanked version stays visible (the
 * verification page must be able to say "withdrawn, and why") but is never
 * served for download.
 */
create table public.catalog_module_versions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.catalog_modules (id) on delete cascade,
  version text not null check (public.semver_ok(version)),
  -- Reserved for a stable/latest channel split. Every member is on the same
  -- channel in v1.
  is_stable boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'yanked')),
  -- Where the ZIP lives in the private `modules` bucket. No API role may
  -- select this column; downloads are signed URLs minted by the backend.
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  changelog jsonb not null default '{}'::jsonb check (public.i18n_ok(changelog)),
  min_core_version text check (min_core_version is null or public.semver_ok(min_core_version)),
  compatible_ais public.ai_tool[] not null default '{}',
  -- [{kind, scope, reason}] with kind in fs:read, fs:write, network, shell, env.
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  published_at timestamptz,
  yanked_at timestamptz,
  yank_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (module_id, version),
  constraint catalog_module_versions_yank_reason check (status <> 'yanked' or nullif(btrim(yank_reason), '') is not null)
);

create index catalog_module_versions_module_idx
  on public.catalog_module_versions (module_id, published_at desc)
  where status = 'published';

alter table public.catalog_module_versions enable row level security;

create policy "catalog_module_versions_select_released" on public.catalog_module_versions
  for select to anon, authenticated
  using (
    status in ('published', 'yanked')
    and exists (
      select 1 from public.catalog_modules m
      where m.id = catalog_module_versions.module_id and m.status = 'published'
    )
  );

create policy "catalog_module_versions_all_superadmin" on public.catalog_module_versions
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- COLUMN grants on purpose: `storage_path` and `manifest` are not in the list,
-- so no session can read them even through a row it is allowed to see. Rows
-- are inserted by the upload route (service role) only.
grant select (
  id, module_id, version, is_stable, status, sha256, size_bytes, changelog, min_core_version,
  compatible_ais, permissions, published_at, yanked_at, yank_reason, created_at
) on table public.catalog_module_versions to anon, authenticated;
grant update (is_stable, status, changelog, yank_reason) on table public.catalog_module_versions to authenticated;
grant delete on table public.catalog_module_versions to authenticated;

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
    else
      new.yanked_at := now();
      -- A withdrawn version is nobody's recommended version.
      new.is_stable := false;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_module_version() from public, anon;

create trigger catalog_module_versions_guard
  before update or delete on public.catalog_module_versions
  for each row execute function public.guard_module_version();

select public.enable_row_versioning('public.catalog_module_versions');

-- A module becomes public only once it has something to install, and a module
-- that was ever public is archived, never deleted (installed copies exist).
create or replace function public.guard_catalog_module()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null then
      raise exception 'module_was_published'
        using errcode = 'check_violation',
              hint = 'Archive a module that was ever published; members have it installed.';
    end if;
    return old;
  end if;

  if new.slug is distinct from old.slug and old.published_at is not null then
    raise exception 'module_slug_frozen' using errcode = 'check_violation';
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1 from public.catalog_module_versions v
      where v.module_id = new.id and v.status = 'published'
    ) then
      raise exception 'module_has_no_published_version' using errcode = 'check_violation';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$$;

revoke all on function public.guard_catalog_module() from public, anon;

create trigger catalog_modules_guard
  before update or delete on public.catalog_modules
  for each row execute function public.guard_catalog_module();

/**
 * The newest released version of a module. `stable_only` restricts it to
 * versions marked stable (reserved for the channel split).
 */
create or replace function public.catalog_latest_version(target_module uuid, stable_only boolean default false)
returns table (
  id uuid,
  version text,
  is_stable boolean,
  sha256 text,
  size_bytes bigint,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.version, v.is_stable, v.sha256, v.size_bytes, v.published_at
  from public.catalog_module_versions v
  join public.catalog_modules m on m.id = v.module_id
  where v.module_id = target_module
    and v.status = 'published'
    and m.status = 'published'
    and (not coalesce(stable_only, false) or v.is_stable)
  order by public.semver_sort_key(v.version) desc, v.published_at desc
  limit 1;
$$;

revoke all on function public.catalog_latest_version(uuid, boolean) from public;
grant execute on function public.catalog_latest_version(uuid, boolean) to anon, authenticated;

/**
 * What anybody may check about a released package: its checksum, size,
 * declared permissions and whether it was withdrawn. This is the data behind
 * the public verification page, and it never includes the package location.
 * Returns NULL for an unknown, draft or unpublished-module version: the three
 * are indistinguishable from outside.
 */
create or replace function public.verify_module_version(target_slug text, target_version text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', m.slug,
    'version', v.version,
    'is_stable', v.is_stable,
    'status', v.status,
    'sha256', v.sha256,
    'size_bytes', v.size_bytes,
    'permissions', v.permissions,
    'compatible_ais', to_jsonb(v.compatible_ais),
    'published_at', v.published_at,
    'yanked_at', v.yanked_at
  )
  from public.catalog_module_versions v
  join public.catalog_modules m on m.id = v.module_id
  where m.slug = lower(btrim(target_slug))
    and v.version = btrim(target_version)
    and m.status = 'published'
    and v.status in ('published', 'yanked');
$$;

revoke all on function public.verify_module_version(text, text) from public;
grant execute on function public.verify_module_version(text, text) to anon, authenticated;

-- Private bucket with NO object policies: only the service role reads or
-- writes packages; a download is a short-lived signed URL.
insert into storage.buckets (id, name, public)
values ('modules', 'modules', false)
on conflict (id) do nothing;

-- ---------- Lessons ----------

/**
 * A short video per module, per depth and language. Titles and durations are
 * public metadata. The video itself is an unlisted YouTube upload whose id is
 * kept in catalog_lesson_videos: "unlisted" only hides a video from search, so
 * the id is what must not be handed to someone without access.
 */
create table public.catalog_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.catalog_modules (id) on delete cascade,
  depth text not null check (depth in ('usar', 'abrir_o_capo')),
  locale text not null check (locale in ('pt-BR', 'en')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  video_provider text not null default 'youtube' check (video_provider = 'youtube'),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  -- Advanced lessons need the `advanced_lessons` entitlement (subscription).
  is_advanced boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, depth, locale)
);

alter table public.catalog_lessons enable row level security;

create policy "catalog_lessons_select_published" on public.catalog_lessons
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_modules m
      where m.id = catalog_lessons.module_id and m.status = 'published'
    )
  );

create policy "catalog_lessons_all_superadmin" on public.catalog_lessons
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_lessons to anon;
grant select, insert, update, delete on table public.catalog_lessons to authenticated;

create trigger catalog_lessons_updated_at
  before update on public.catalog_lessons
  for each row execute function public.set_updated_at();

-- May the caller watch this lesson? One rule, used by the video policy and by
-- record_lesson_progress, so the page and the progress write cannot disagree.
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

  select l.is_advanced, m.status, m.is_free_sample, m.entitlement_key
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
  -- A free sample teaches anyone with an account.
  return lesson.is_free_sample or public.org_has_entitlement(caller_org, lesson.entitlement_key);
end;
$$;

revoke all on function public.can_watch_lesson(uuid) from public, anon;
grant execute on function public.can_watch_lesson(uuid) to authenticated;

create table public.catalog_lesson_videos (
  lesson_id uuid primary key references public.catalog_lessons (id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  updated_at timestamptz not null default now()
);

alter table public.catalog_lesson_videos enable row level security;

create policy "catalog_lesson_videos_select_entitled" on public.catalog_lesson_videos
  for select to authenticated
  using (public.can_watch_lesson(lesson_id));

create policy "catalog_lesson_videos_all_superadmin" on public.catalog_lesson_videos
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update, delete on table public.catalog_lesson_videos to authenticated;

create trigger catalog_lesson_videos_updated_at
  before update on public.catalog_lesson_videos
  for each row execute function public.set_updated_at();

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.catalog_lessons (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create index lesson_progress_org_idx on public.lesson_progress (org_id);

alter table public.lesson_progress enable row level security;

create policy "lesson_progress_select_own" on public.lesson_progress
  for select to authenticated
  using (user_id = auth.uid());

create policy "lesson_progress_select_superadmin" on public.lesson_progress
  for select to authenticated
  using (public.is_superadmin());

-- Written only by record_lesson_progress(), which is also what emits the
-- lesson events: a direct write could claim progress on a lesson the member
-- cannot open.
grant select on table public.lesson_progress to authenticated;

/**
 * Marks a lesson as started (first call) or completed. Emits `lesson.started`
 * and `lesson.completed` exactly once each per member and lesson.
 */
create or replace function public.record_lesson_progress(target_lesson uuid, target_completed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  lesson record;
  existing public.lesson_progress%rowtype;
  props jsonb;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- A support visit must not move the member's own progress.
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;
  if not public.can_watch_lesson(target_lesson) then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  select l.depth, l.locale, m.slug, m.trail
    into lesson
  from public.catalog_lessons l
  join public.catalog_modules m on m.id = l.module_id
  where l.id = target_lesson;

  caller_org := public.current_org_id();
  props := jsonb_build_object(
    'module', lesson.slug,
    'trail', lesson.trail,
    'depth', lesson.depth,
    'lesson_locale', lesson.locale,
    'platform', 'web'
  );

  select * into existing from public.lesson_progress
  where user_id = caller and lesson_id = target_lesson
  for update;

  if not found then
    insert into public.lesson_progress (user_id, lesson_id, org_id, completed_at)
    values (caller, target_lesson, caller_org, case when target_completed then now() end);
    perform public.product_event_insert(caller, caller_org, 'lesson.started', props, null);
    if target_completed then
      perform public.product_event_insert(caller, caller_org, 'lesson.completed', props, null);
    end if;
    return jsonb_build_object('ok', true, 'started', true, 'completed', coalesce(target_completed, false));
  end if;

  if target_completed and existing.completed_at is null then
    update public.lesson_progress set completed_at = now()
    where user_id = caller and lesson_id = target_lesson;
    perform public.product_event_insert(caller, caller_org, 'lesson.completed', props, null);
    return jsonb_build_object('ok', true, 'started', false, 'completed', true);
  end if;

  return jsonb_build_object('ok', true, 'started', false, 'completed', existing.completed_at is not null);
end;
$$;

revoke all on function public.record_lesson_progress(uuid, boolean) from public, anon;
grant execute on function public.record_lesson_progress(uuid, boolean) to authenticated;

-- ---------- Recipes ----------

/**
 * A recipe chains modules toward one result. Its name, summary and the list of
 * modules are public; the workflow text (how to chain them) is what the
 * subscription sells and lives in catalog_recipe_workflows.
 */
create table public.catalog_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  name jsonb not null check (public.i18n_ok(name, true)),
  summary jsonb not null default '{}'::jsonb check (public.i18n_ok(summary)),
  icon text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_recipes enable row level security;

create policy "catalog_recipes_select_published" on public.catalog_recipes
  for select to anon, authenticated
  using (status = 'published');

create policy "catalog_recipes_all_superadmin" on public.catalog_recipes
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_recipes to anon;
grant select, insert, update, delete on table public.catalog_recipes to authenticated;

create trigger catalog_recipes_updated_at
  before update on public.catalog_recipes
  for each row execute function public.set_updated_at();

create trigger catalog_recipes_published_at
  before insert or update on public.catalog_recipes
  for each row execute function public.set_catalog_published_at();

create table public.catalog_recipe_modules (
  recipe_id uuid not null references public.catalog_recipes (id) on delete cascade,
  module_id uuid not null references public.catalog_modules (id) on delete cascade,
  sort integer not null default 0,
  primary key (recipe_id, module_id)
);

alter table public.catalog_recipe_modules enable row level security;

create policy "catalog_recipe_modules_select_published" on public.catalog_recipe_modules
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_recipes r
      where r.id = catalog_recipe_modules.recipe_id and r.status = 'published'
    )
  );

create policy "catalog_recipe_modules_all_superadmin" on public.catalog_recipe_modules
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select on table public.catalog_recipe_modules to anon;
grant select, insert, update, delete on table public.catalog_recipe_modules to authenticated;

create table public.catalog_recipe_workflows (
  recipe_id uuid primary key references public.catalog_recipes (id) on delete cascade,
  body_md jsonb not null default '{}'::jsonb check (public.i18n_ok(body_md)),
  updated_at timestamptz not null default now()
);

alter table public.catalog_recipe_workflows enable row level security;

create policy "catalog_recipe_workflows_select_entitled" on public.catalog_recipe_workflows
  for select to authenticated
  using (
    exists (
      select 1 from public.catalog_recipes r
      where r.id = catalog_recipe_workflows.recipe_id and r.status = 'published'
    )
    and (select public.org_has_entitlement(public.current_org_id(), 'recipes'))
  );

create policy "catalog_recipe_workflows_all_superadmin" on public.catalog_recipe_workflows
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update, delete on table public.catalog_recipe_workflows to authenticated;

create trigger catalog_recipe_workflows_updated_at
  before update on public.catalog_recipe_workflows
  for each row execute function public.set_updated_at();
