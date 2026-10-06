-- ============================================================
-- 0030_guides: written guides, carried by each version of an app
-- (2026-10-06).
--
-- The home brief promises "a short guide per app, with the steps and
-- examples, made for using, not watching", and advanced guides in FlyeeClub
-- Pro. The platform had only a video per depth. Decided: every version of an
-- app ships its own guide inside the package, at a fixed path
-- (`guides/<pt-BR|en>/<usar|abrir-o-capo>.md`, docs/CLI-CONTRACT.md §7), so a
-- guide never describes a different app than the one installed. The video of
-- a depth (catalog_lessons) stays optional, shown inside the guide.
--
--   - catalog_module_versions.guides: which guides a version carries, as
--     public metadata ({"pt-BR": ["usar", "abrir_o_capo"], "en": ["usar"]}).
--     It is how a page tells "locked" from "does not exist".
--   - catalog_guides: the text, written by the upload pipeline (service role)
--     and never edited: a corrected guide is a new version, like any file.
--   - can_read_guide(version, depth): the one rule, the same as the video's:
--     the advanced depth needs `advanced_lessons` (FlyeeClub Pro), the basic
--     one the app's entitlement (FlyeeClub), or nothing for a free sample.
-- ============================================================

alter table public.catalog_module_versions
  add column guides jsonb not null default '{}'::jsonb check (jsonb_typeof(guides) = 'object');

comment on column public.catalog_module_versions.guides is
  'Which written guides the version''s package carries, by language and depth. Public metadata; the text is in catalog_guides.';

create table public.catalog_guides (
  version_id uuid not null references public.catalog_module_versions (id) on delete cascade,
  depth text not null check (depth in ('usar', 'abrir_o_capo')),
  locale text not null check (locale in ('pt-BR', 'en')),
  body_md text not null check (char_length(body_md) between 1 and 200000),
  created_at timestamptz not null default now(),
  primary key (version_id, depth, locale)
);

comment on table public.catalog_guides is
  'The written guide of a version, per depth and language, from the package (guides/<locale>/<depth>.md). Read through can_read_guide; written only by the upload.';

-- May the caller read this guide? The rule of can_watch_lesson (0008), keyed
-- by version: a draft is the operator's, a released or yanked version is read
-- by whoever may use the app at that depth.
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

  select v.status as version_status, m.status as module_status, m.is_free_sample, m.entitlement_key
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
  return guide.is_free_sample or public.org_has_entitlement(caller_org, guide.entitlement_key);
end;
$$;

revoke all on function public.can_read_guide(uuid, text) from public, anon;
grant execute on function public.can_read_guide(uuid, text) to authenticated;

alter table public.catalog_guides enable row level security;

create policy "catalog_guides_select_entitled" on public.catalog_guides
  for select to authenticated
  using (public.can_read_guide(version_id, depth));

-- Read only. The upload writes with the service role; nobody edits a guide.
grant select on table public.catalog_guides to authenticated;
