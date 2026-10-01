-- ============================================================
-- 0014_meetings: live sessions for subscribers.
--
-- A meeting happens on an external tool (Zoom, Meet, a YouTube live). The
-- platform holds the invitation, the registrations, the reminders and the door:
-- the link is handed out only by meeting_join(), to a registered member with
-- the `meetings` entitlement, from 15 minutes before the start. That click is
-- the attendance figure: the platform does not pretend to know how long
-- somebody stayed on a tool it does not host.
--
-- What members may read (`meetings`) is separate from what they may not
-- (`meeting_links`: the join link and the recording), so a row a member is
-- allowed to see never carries the link.
--
-- Origin: the lifecycle engine of inherited migrations 0112/0113 (states,
-- frozen slug, duplicate, guarded delete), rebuilt for members instead of
-- leads.
-- ============================================================

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title jsonb not null check (public.i18n_ok(title, true)),
  description jsonb not null default '{}'::jsonb check (public.i18n_ok(description)),
  starts_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 600),
  -- rascunho -> inscricoes -> ao_vivo -> encerrado; arquivado from a draft or
  -- an ended meeting.
  state text not null default 'rascunho'
    check (state in ('rascunho', 'inscricoes', 'ao_vivo', 'encerrado', 'arquivado')),
  provider text not null default 'zoom' check (provider in ('zoom', 'meet', 'youtube', 'outro')),
  -- Stamped once, the first time the meeting leaves `rascunho`, never cleared.
  published_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_state_idx on public.meetings (state, starts_at);

alter table public.meetings enable row level security;

create policy "meetings_select_member" on public.meetings
  for select to authenticated
  using (state in ('inscricoes', 'ao_vivo', 'encerrado'));

create policy "meetings_all_superadmin" on public.meetings
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update on table public.meetings to authenticated;

-- The private half: never readable by a member, whatever the meeting's state.
create table public.meeting_links (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  join_url text check (join_url is null or (join_url ~ '^https://[^[:space:]]{4,}$' and char_length(join_url) <= 500)),
  -- An unlisted YouTube upload, shown to entitled members once it ended.
  recording_url text check (
    recording_url is null or (recording_url ~ '^https://[^[:space:]]{4,}$' and char_length(recording_url) <= 500)
  ),
  updated_at timestamptz not null default now()
);

alter table public.meeting_links enable row level security;

create policy "meeting_links_all_superadmin" on public.meeting_links
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

grant select, insert, update, delete on table public.meeting_links to authenticated;

create trigger meeting_links_updated_at
  before update on public.meeting_links
  for each row execute function public.set_updated_at();

create table public.meeting_registrations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  -- The first time the member opened the door (meeting_join).
  joined_at timestamptz,
  -- One column per message, so each is sent at most once per person.
  confirmation_sent_at timestamptz,
  reminder_day_sent_at timestamptz,
  reminder_hour_sent_at timestamptz,
  recording_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index meeting_registrations_user_idx on public.meeting_registrations (user_id);
create index meeting_registrations_org_idx on public.meeting_registrations (org_id);

alter table public.meeting_registrations enable row level security;

create policy "meeting_registrations_select_own" on public.meeting_registrations
  for select to authenticated
  using (user_id = auth.uid());

create policy "meeting_registrations_select_superadmin" on public.meeting_registrations
  for select to authenticated
  using (public.is_superadmin());

-- Written only by the RPCs below (and by the reminder job, as the backend).
grant select on table public.meeting_registrations to authenticated;

-- ---------- Lifecycle ----------

create or replace function public.guard_meeting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    if new.state <> 'rascunho' then
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  -- Published once is published forever, even if it goes back to draft.
  new.published_at := old.published_at;
  if new.state <> 'rascunho' and old.published_at is null then
    new.published_at := now();
  end if;

  -- The slug is in e-mails and calendars the moment the meeting is published
  -- or somebody registered.
  if new.slug is distinct from old.slug
     and (old.published_at is not null
          or exists (select 1 from public.meeting_registrations r where r.meeting_id = old.id)) then
    raise exception 'meeting_slug_frozen' using errcode = 'check_violation';
  end if;

  if new.state = 'arquivado' and old.state not in ('rascunho', 'encerrado', 'arquivado') then
    raise exception 'meeting_archive_requires_end'
      using errcode = 'check_violation', hint = 'End the meeting before archiving it.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_meeting() from public, anon;

create trigger meetings_guard
  before insert or update on public.meetings
  for each row execute function public.guard_meeting();

-- ---------- Member actions ----------

create or replace function public.register_for_meeting(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  meeting public.meetings%rowtype;
  inserted integer := 0;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  caller_org := public.current_org_id();
  if not public.org_has_entitlement(caller_org, 'meetings') then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  select * into meeting from public.meetings where id = target_meeting;
  if not found or meeting.state not in ('inscricoes', 'ao_vivo') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  insert into public.meeting_registrations (meeting_id, user_id, org_id)
  values (target_meeting, caller, caller_org)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    perform public.product_event_insert(
      caller, caller_org, 'meeting.registered', jsonb_build_object('platform', 'web'), null
    );
  end if;

  return jsonb_build_object('ok', true, 'registered', true, 'changed', inserted > 0);
end;
$$;

revoke all on function public.register_for_meeting(uuid) from public, anon;
grant execute on function public.register_for_meeting(uuid) to authenticated;

create or replace function public.cancel_meeting_registration(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  -- A registration that was already used stays: it is the attendance record.
  delete from public.meeting_registrations
  where meeting_id = target_meeting and user_id = auth.uid() and joined_at is null;
  get diagnostics removed = row_count;

  return jsonb_build_object('ok', true, 'registered', false, 'changed', removed > 0);
end;
$$;

revoke all on function public.cancel_meeting_registration(uuid) from public, anon;
grant execute on function public.cancel_meeting_registration(uuid) to authenticated;

/**
 * Opens the door. Needs a registration and the `meetings` entitlement at the
 * moment of joining (a member who cancelled meanwhile no longer gets in), and
 * the door opens 15 minutes before the start. The first successful call stamps
 * `joined_at` and is the `meeting.attended` event.
 */
create or replace function public.meeting_join(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  meeting public.meetings%rowtype;
  registration public.meeting_registrations%rowtype;
  link text;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- The link reaches whoever calls this. A support visit must not collect it
  -- in the member's name, nor mark the member as present.
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  caller_org := public.current_org_id();
  if not public.org_has_entitlement(caller_org, 'meetings') then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  select * into meeting from public.meetings where id = target_meeting;
  if not found or meeting.state not in ('inscricoes', 'ao_vivo') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into registration from public.meeting_registrations
  where meeting_id = target_meeting and user_id = caller
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_registered');
  end if;

  if meeting.state <> 'ao_vivo'
     and (meeting.starts_at is null or now() < meeting.starts_at - interval '15 minutes') then
    return jsonb_build_object('ok', false, 'code', 'too_early', 'starts_at', meeting.starts_at);
  end if;

  select l.join_url into link from public.meeting_links l where l.meeting_id = target_meeting;
  if link is null then
    return jsonb_build_object('ok', false, 'code', 'link_missing');
  end if;

  if registration.joined_at is null then
    update public.meeting_registrations set joined_at = now() where id = registration.id;
    perform public.product_event_insert(
      caller, caller_org, 'meeting.attended', jsonb_build_object('platform', 'web'), null
    );
  end if;

  return jsonb_build_object('ok', true, 'url', link, 'provider', meeting.provider);
end;
$$;

revoke all on function public.meeting_join(uuid) from public, anon;
grant execute on function public.meeting_join(uuid) to authenticated;

-- The recording of an ended meeting, for any member with the entitlement
-- (registered or not: the recording is part of what the subscription is).
create or replace function public.meeting_recording(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  meeting public.meetings%rowtype;
  link text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not (public.is_superadmin() or public.org_has_entitlement(public.current_org_id(), 'meetings')) then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  select * into meeting from public.meetings where id = target_meeting;
  if not found or meeting.state <> 'encerrado' then
    return jsonb_build_object('ok', false, 'code', 'not_available');
  end if;

  select l.recording_url into link from public.meeting_links l where l.meeting_id = target_meeting;
  if link is null then
    return jsonb_build_object('ok', false, 'code', 'not_available');
  end if;
  return jsonb_build_object('ok', true, 'url', link);
end;
$$;

revoke all on function public.meeting_recording(uuid) from public, anon;
grant execute on function public.meeting_recording(uuid) to authenticated;

-- ---------- Console ----------

-- One row per meeting with its two counters, for the list screen.
create or replace function public.meetings_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_data order by sort_bucket, sort_time)
    from (
      select
        jsonb_build_object(
          'id', m.id,
          'slug', m.slug,
          'title', m.title,
          'state', m.state,
          'provider', m.provider,
          'starts_at', m.starts_at,
          'duration_minutes', m.duration_minutes,
          'published_at', m.published_at,
          'has_join_url', exists (select 1 from public.meeting_links l where l.meeting_id = m.id and l.join_url is not null),
          'has_recording', exists (select 1 from public.meeting_links l where l.meeting_id = m.id and l.recording_url is not null),
          'registered', (select count(*) from public.meeting_registrations r where r.meeting_id = m.id),
          'joined', (select count(*) from public.meeting_registrations r where r.meeting_id = m.id and r.joined_at is not null)
        ) as row_data,
        case m.state when 'ao_vivo' then 0 when 'inscricoes' then 1 when 'rascunho' then 2 when 'encerrado' then 3 else 4 end as sort_bucket,
        -- Upcoming soonest first, the past newest first, undated last.
        case
          when m.state in ('inscricoes', 'ao_vivo', 'rascunho') then extract(epoch from coalesce(m.starts_at, 'infinity'::timestamptz))
          else -extract(epoch from coalesce(m.starts_at, '-infinity'::timestamptz))
        end as sort_time
      from public.meetings m
    ) as listed
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.meetings_overview() from public, anon;
grant execute on function public.meetings_overview() to authenticated;

-- Registered -> opened the door, overall and by segment. Counts only: no
-- names, no addresses.
create or replace function public.meeting_results(target_meeting uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  registered integer;
  joined integer;
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.meetings where id = target_meeting) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select count(*), count(*) filter (where r.joined_at is not null)
    into registered, joined
  from public.meeting_registrations r
  where r.meeting_id = target_meeting;

  return jsonb_build_object(
    'ok', true,
    'registered', registered,
    'joined', joined,
    'by_segment', coalesce((
      select jsonb_agg(jsonb_build_object('segment', segment, 'registered', total, 'joined', present) order by total desc)
      from (
        select coalesce(p.segment::text, 'unknown') as segment,
               count(*) as total,
               count(*) filter (where r.joined_at is not null) as present
        from public.meeting_registrations r
        join public.profiles p on p.id = r.user_id
        where r.meeting_id = target_meeting
        group by 1
      ) as segments
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.meeting_results(uuid) from public, anon;
grant execute on function public.meeting_results(uuid) to authenticated;

-- Copies the content and the settings, never the date, the links or the
-- registrations. The copy starts as a draft.
create or replace function public.duplicate_meeting(target_meeting uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.meetings%rowtype;
  new_slug text;
  suffix integer := 2;
  new_id uuid;
begin
  if not public.is_superadmin() or public.is_impersonated() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into source from public.meetings where id = target_meeting;
  if not found then
    raise exception 'meeting_not_found';
  end if;

  new_slug := left(source.slug, 52) || '-copia';
  while exists (select 1 from public.meetings where slug = new_slug) loop
    new_slug := left(source.slug, 50) || '-copia-' || suffix;
    suffix := suffix + 1;
  end loop;

  insert into public.meetings (slug, title, description, duration_minutes, provider, state)
  values (new_slug, source.title, source.description, source.duration_minutes, source.provider, 'rascunho')
  returning id into new_id;

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'admin.meeting.duplicated', 'meeting', new_id::text,
          jsonb_build_object('from', source.slug, 'slug', new_slug));

  return new_id;
end;
$$;

revoke all on function public.duplicate_meeting(uuid) from public, anon;
grant execute on function public.duplicate_meeting(uuid) to authenticated;

-- Only a draft that was never published and has no registrations is deleted.
-- Anything else is archived.
create or replace function public.delete_meeting(target_meeting uuid, target_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting public.meetings%rowtype;
begin
  if not public.is_superadmin() or public.is_impersonated() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into meeting from public.meetings where id = target_meeting for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if meeting.state <> 'rascunho' then
    return jsonb_build_object('ok', false, 'code', 'not_draft');
  end if;
  if meeting.published_at is not null then
    return jsonb_build_object('ok', false, 'code', 'was_published');
  end if;
  if exists (select 1 from public.meeting_registrations r where r.meeting_id = meeting.id) then
    return jsonb_build_object('ok', false, 'code', 'has_registrations');
  end if;

  delete from public.meetings where id = meeting.id;

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), 'admin.meeting.deleted', 'meeting', meeting.id::text,
          jsonb_strip_nulls(jsonb_build_object('slug', meeting.slug, 'reason', nullif(left(btrim(coalesce(target_reason, '')), 300), ''))));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_meeting(uuid, text) from public, anon;
grant execute on function public.delete_meeting(uuid, text) to authenticated;
