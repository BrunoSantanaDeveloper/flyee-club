-- ============================================================
-- 0012_impersonation: support access to a member's account.
--
-- An operator works inside a member's account to see a reported problem where
-- it happens. The session is minted by the backend into a parallel cookie and
-- recorded here. Two functions tell the rest of the schema about it:
--   is_impersonated()      the calling JWT belongs to a support session, live
--                          OR NOT. This is the write fence, and it never
--                          expires: a fence that lifted on expiry would turn a
--                          stale support session into a full-privilege
--                          session of the member.
--   impersonation_active() the support session is still within its window.
--
-- What support may NOT do is enforced in the database, because member writes
-- go from the browser straight to the API and never pass through the app:
-- consent, votes, lesson progress, devices, tokens and grants are read-only
-- during a visit. Credentials and /admin are blocked in the middleware.
--
-- Origin: inherited migration 0057.
-- ============================================================

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  target_org_id uuid references public.organizations (id) on delete set null,
  reason text not null check (length(btrim(reason)) >= 8),
  -- auth.sessions.id of the impersonated session, matched against the JWT
  -- `session_id` claim.
  session_id uuid not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text
);

comment on table public.impersonation_sessions is
  'Support access to a member account. Written by the backend only; visible to the member whose account was visited.';

create index impersonation_sessions_actor_idx on public.impersonation_sessions (actor_id, started_at desc);
create index impersonation_sessions_target_idx on public.impersonation_sessions (target_user_id, started_at desc);

alter table public.impersonation_sessions enable row level security;

create policy "impersonation_sessions_select_own" on public.impersonation_sessions
  for select to authenticated
  using (target_user_id = auth.uid());

create policy "impersonation_sessions_select_superadmin" on public.impersonation_sessions
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.impersonation_sessions to authenticated;

create or replace function public.is_impersonated()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.impersonation_sessions s
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  );
$$;

comment on function public.is_impersonated() is
  'True when the calling JWT belongs to a support-impersonation session, live or not. Drives the write fence; never expires.';

revoke all on function public.is_impersonated() from public, anon;
grant execute on function public.is_impersonated() to authenticated;

create or replace function public.impersonation_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.impersonation_sessions s
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.ended_at is null
      and s.expires_at > now()
  );
$$;

revoke all on function public.impersonation_active() from public, anon;
grant execute on function public.impersonation_active() to authenticated;

create or replace function public.guard_impersonation_readonly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_impersonated() then
    raise exception 'impersonation_read_only: support sessions cannot write %', tg_table_name
      using errcode = '42501',
            hint = 'Leave the support session and ask the member to perform this action.';
  end if;
  return null;
end;
$$;

revoke all on function public.guard_impersonation_readonly() from public, anon;

-- Statement-level, so a write that matches zero rows is refused too.
create trigger guard_impersonation_consent_acceptances
  after insert or update or delete on public.consent_acceptances
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_roadmap_votes
  after insert or update or delete on public.roadmap_votes
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_lesson_progress
  after insert or update or delete on public.lesson_progress
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_member_devices
  after insert or update or delete on public.member_devices
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_oauth_grants
  after insert or update or delete on public.oauth_grants
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_oauth_tokens
  after insert or update or delete on public.oauth_tokens
  for each statement execute function public.guard_impersonation_readonly();

create trigger guard_impersonation_entitlement_grants
  after insert or update or delete on public.entitlement_grants
  for each statement execute function public.guard_impersonation_readonly();

-- How long a support visit lasts.
insert into public.platform_settings (key, value, is_public)
values ('impersonation', '{"max_minutes": 30}'::jsonb, false)
on conflict (key) do nothing;
