-- ============================================================
-- 0000_init: identity and tenancy.
--
-- One person is one account: every member owns exactly one personal
-- workspace (an organization with a single owner membership), created by the
-- sign-up trigger. Organizations stay a separate table because money,
-- entitlements and devices hang off the workspace, not the person.
--
-- Origin: inherited migrations 0000, 0010, 0019, 0036, 0056, 0061, 0069, 0096
-- and 0105, rewritten as one baseline.
--
-- PRIVILEGE CONVENTION (every migration follows it): this project is
-- "secure by default" — nothing in `public` is reachable by the API roles
-- unless a migration grants it.
--   * tables: an explicit `grant` to `authenticated` (or `anon`) beside the
--     policies that make it meaningful; RLS on every table.
--   * functions: `revoke all ... from public, anon` right after the
--     definition, then an explicit `grant execute` to the roles that may call
--     it. PostgreSQL grants EXECUTE to PUBLIC by default, which is why the
--     revoke is never optional.
--   * the service role is the trusted backend and receives everything through
--     the default privileges below.
-- packages/db/tests/0016_grants_catalog_scan.test.sql fails when a table or
-- function becomes reachable by `anon` without being on its allowlist.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- Older Supabase projects grant every new table, sequence and function to
-- anon and authenticated by default. Revoke that explicitly, so a project of
-- either generation ends up with the same model: the column-level grants
-- below (package paths, token hashes) only protect anything when the API
-- roles hold no table-level privilege. New functions are not executable by
-- PUBLIC either.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;

alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- ---------- Enums ----------

create type public.org_role as enum ('owner', 'admin', 'member');

-- Who the member is, as they describe themselves. `outro` is a real answer
-- and is left out of the focus rule (docs/PRODUCT.md).
create type public.member_segment as enum (
  'produto_proprio',
  'freelancer_agencia',
  'profissional_ia',
  'dev',
  'outro'
);

create type public.ai_tool as enum ('claude_code', 'codex', 'gemini_cli', 'cursor', 'other');

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  is_superadmin boolean not null default false,
  segment public.member_segment,
  ai_tool public.ai_tool,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  marketing_email_opt_out boolean not null default false,
  email_unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_locale_check check (locale in ('pt-BR', 'en')),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 120)
);

create unique index profiles_email_unsubscribe_token_idx on public.profiles (email_unsubscribe_token);

comment on column public.profiles.segment is
  'Self-declared segment. Stamped on product_events by the server, never taken from the client.';
comment on column public.profiles.marketing_email_opt_out is
  'Stops newsletters and digests. Transactional e-mail (receipts, token reminders) is not affected.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  -- Brazilian billing profile, required by Asaas to issue a charge (and the
  -- NFS-e). Digits only; a USD purchase through Stripe needs none of it.
  billing_cpf_cnpj text,
  billing_postal_code text,
  billing_address_number text,
  billing_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_billing_cpf_cnpj_check
    check (billing_cpf_cnpj is null or billing_cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint organizations_billing_postal_code_check
    check (billing_postal_code is null or billing_postal_code ~ '^[0-9]{8}$'),
  constraint organizations_billing_phone_check
    check (billing_phone is null or billing_phone ~ '^[0-9]{10,11}$')
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_org_idx on public.memberships (org_id);

-- ---------- Helper functions (security definer, used by policies) ----------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.has_org_role(target_org uuid, roles public.org_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

revoke all on function public.has_org_role(uuid, public.org_role[]) from public, anon;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- The workspace the caller acts for. One person owns one workspace, so the
-- oldest membership is THE workspace; every RPC that needs "my org" asks here
-- instead of trusting an id sent by the client.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc, m.id asc
  limit 1;
$$;

revoke all on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated;

create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  -- lower() runs first, so only lower-case accents need mapping. The two
  -- translate() arguments MUST stay the same length (79 chars): a mismatch
  -- silently shifts every mapping after the offending character.
  select trim(
    both '-' from
    regexp_replace(
      translate(
        lower(value),
        'áàâãäåāăąçćčĉċďđéèêëēĕėęěğĝġģíìîïĩīĭįıĺľłļñńňņóòôõöøōŏőŕřšśşŝťţúùûüũūŭůűųýÿŷžźż',
        'aaaaaaaaacccccddeeeeeeeeeggggiiiiiiiiillllnnnnooooooooorrssssttuuuuuuuuuuyyyzzz'
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

comment on function public.slugify(text) is
  'Accent-aware slug: transliterates Latin letters before collapsing separators. Used for workspace slugs.';

revoke all on function public.slugify(text) from public, anon;
grant execute on function public.slugify(text) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon;

create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.timezone := nullif(btrim(new.timezone), '');
  if new.timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_profile_timezone() from public, anon;

-- ---------- Guards ----------

/**
 * `profiles.is_superadmin` is the platform-operator flag. The column grants
 * below already keep a member from writing it, and this trigger is the second
 * fence: it keys on WHO is asking (is_superadmin() reads the database, which
 * PostgREST cannot forge), so a future policy or grant change cannot quietly
 * reopen self-promotion.
 *
 * A session with no JWT (service role, migration, psql) passes: that is how
 * the FIRST superadmin is made, and the only way back in if the set is ever
 * emptied.
 */
create or replace function public.guard_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `before update of is_superadmin` fires whenever the column is MENTIONED,
  -- so a write that merely carries the same value is not a change.
  if new.is_superadmin is not distinct from old.is_superadmin then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if not public.is_superadmin() then
    raise exception 'superadmin_not_self_assignable'
      using errcode = '42501',
            hint = 'Only a platform superadmin can grant this role.';
  end if;

  if new.id = auth.uid() then
    raise exception 'superadmin_self_change_forbidden'
      using errcode = '42501',
            hint = 'Ask another superadmin: removing your own role could leave the platform with no operator.';
  end if;

  return new;
end;
$$;

comment on function public.guard_superadmin_flag() is
  'Refuses any change to profiles.is_superadmin that does not come from an existing superadmin acting on somebody else (or from a session with no JWT: service role, migration, psql).';

revoke all on function public.guard_superadmin_flag() from public, anon;

/**
 * A workspace is never deleted by a direct write. Deleting one erases the
 * member's purchases, grants, devices and their change history, and leaves
 * stored files behind unless the audited path cleans them: that path is
 * admin_delete_account (0016), which runs as a superadmin outside a support
 * visit. There is deliberately no DELETE policy on organizations either; this
 * trigger stands behind the missing policy, because a policy is one careless
 * migration away from coming back.
 */
create or replace function public.guard_organization_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No JWT at all: the service role, a migration, psql.
  if auth.uid() is null then
    return old;
  end if;

  if public.is_superadmin() and not public.is_impersonated() then
    return old;
  end if;

  raise exception 'workspace_delete_not_self_service'
    using errcode = '42501',
          hint = 'Deleting a workspace also erases its purchases, devices and change history. That runs through the audited path in the platform console (admin_delete_account), never through a direct write.';
end;
$$;

comment on function public.guard_organization_delete() is
  'Refuses any workspace deletion that is not the audited path: a session with no JWT (service role/migration) or a superadmin outside a support visit.';

revoke all on function public.guard_organization_delete() from public, anon;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_select_superadmin" on public.profiles
  for select to authenticated
  using (public.is_superadmin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- A member edits the name and the avatar directly. Segment, AI tool, locale
-- and timezone go through update_member_profile (0001), which audits them;
-- is_superadmin goes through set_user_superadmin. The column list is the fence.
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

create policy "organizations_select_member" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "organizations_select_superadmin" on public.organizations
  for select to authenticated
  using (public.is_superadmin());

create policy "organizations_update_owner" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner']::public.org_role[]))
  with check (public.has_org_role(id, array['owner']::public.org_role[]));

-- Only the display name is edited directly; the billing profile goes through
-- update_billing_profile (0003). Creation goes through create_organization and
-- the sign-up trigger; there is no INSERT or DELETE grant.
grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;

create policy "memberships_select_member" on public.memberships
  for select to authenticated
  using (public.is_org_member(org_id));

create policy "memberships_select_superadmin" on public.memberships
  for select to authenticated
  using (public.is_superadmin());

-- Read-only for members: with one person per workspace there is no roster to
-- manage, and a member able to insert a membership could attach another
-- person to their own entitlements.
grant select on table public.memberships to authenticated;

-- ---------- Workspace creation ----------

/**
 * Creates a workspace and its owner membership. Refuses a SECOND workspace for
 * the same person: entitlements, device ceilings and the founders offer are
 * per workspace, so a second one would hand out a second set of each.
 * Superadmins are exempt (operators legitimately create accounts).
 *
 * Normal sign-up never reaches this: handle_new_user creates the personal
 * workspace. It exists for /auth/complete-profile, the safety net for an
 * account that somehow has none.
 */
create or replace function public.create_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
  clean_name text := nullif(btrim(org_name), '');
  clean_slug text := nullif(btrim(org_slug), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if clean_name is null or clean_slug is null then
    raise exception 'invalid_workspace' using errcode = '22023';
  end if;

  if not public.is_superadmin()
     and exists (select 1 from public.memberships m where m.user_id = auth.uid()) then
    raise exception 'workspace_limit_reached'
      using hint = 'One workspace per person.';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (clean_name, clean_slug, auth.uid())
  returning id into new_org;

  insert into public.memberships (org_id, user_id, role)
  values (new_org, auth.uid(), 'owner');

  return new_org;
end;
$$;

comment on function public.create_organization(text, text) is
  'Creates a workspace and its owner membership. Refuses a second workspace for the same person.';

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- ---------- Sign-up bootstrap ----------

/**
 * Creates the profile AND the personal workspace for every new auth user,
 * e-mail or OAuth alike. The workspace takes the member's name: nothing asks
 * for an organization, because here an organization is just the account.
 *
 * Metadata read (all optional): display_name (or the provider's full_name /
 * name), avatar_url (or picture), segment, ai_tool, locale. An unknown value
 * is ignored rather than failing the sign-up.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  member_name text;
  member_slug text;
  new_org uuid;
begin
  member_name := left(
    coalesce(
      nullif(btrim(meta ->> 'display_name'), ''),
      nullif(btrim(meta ->> 'full_name'), ''),
      nullif(btrim(meta ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    120
  );

  insert into public.profiles (id, display_name, avatar_url, segment, ai_tool, locale)
  values (
    new.id,
    member_name,
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', '')),
    case
      when meta ->> 'segment' = any (enum_range(null::public.member_segment)::text[])
        then (meta ->> 'segment')::public.member_segment
    end,
    case
      when meta ->> 'ai_tool' = any (enum_range(null::public.ai_tool)::text[])
        then (meta ->> 'ai_tool')::public.ai_tool
    end,
    case when meta ->> 'locale' in ('pt-BR', 'en') then meta ->> 'locale' else 'pt-BR' end
  );

  -- Fall back to "member" when the name is all punctuation or emoji, so the
  -- slug never degenerates to just the id suffix.
  member_slug := coalesce(nullif(public.slugify(member_name), ''), 'member');

  insert into public.organizations (name, slug, created_by)
  values (member_name, member_slug || '-' || substr(new.id::text, 1, 8), new.id)
  returning id into new_org;

  insert into public.memberships (org_id, user_id, role)
  values (new_org, new.id, 'owner');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Triggers ----------

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

create trigger guard_superadmin_flag
  before update of is_superadmin on public.profiles
  for each row execute function public.guard_superadmin_flag();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger guard_organization_delete
  before delete on public.organizations
  for each row execute function public.guard_organization_delete();
