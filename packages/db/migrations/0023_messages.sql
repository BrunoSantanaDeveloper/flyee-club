-- ============================================================
-- Phase 8: what the scheduled jobs and the e-mails need from the database.
--
-- One rule runs through this file. A message that must go out once is CLAIMED
-- here, in the same statement that marks it as sent, and only then sent by the
-- job. A job that runs twice, or two workers at once, find nothing left to
-- claim: the worst case is a message that was claimed and not delivered, never
-- one delivered twice.
--
-- Everything is callable by the backend alone (service role), except what the
-- operator starts from a console.
-- ============================================================

-- ---------- CLI connection reminder ----------

-- A machine's connection lasts 30 days from its last update and each update
-- rotates the token into a new row of the same family, so the live row of a
-- family is the one whose expiry counts. `reminder_sent_at` (0010) marks it.
create or replace function public.claim_token_reminders(target_within interval default interval '5 days')
returns table (
  family_id uuid,
  user_id uuid,
  org_id uuid,
  device_id text,
  device_name text,
  refresh_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with due as (
    select t.id
    from public.oauth_tokens t
    where t.revoked_at is null
      and t.reminder_sent_at is null
      and t.refresh_expires_at is not null
      and t.refresh_expires_at > now()
      and t.refresh_expires_at <= now() + least(greatest(target_within, interval '1 day'), interval '15 days')
    order by t.refresh_expires_at
    limit 500
    for update skip locked
  ),
  claimed as (
    update public.oauth_tokens t
    set reminder_sent_at = now()
    from due
    where t.id = due.id
    returning t.family_id, t.user_id, t.org_id, t.device_id, t.refresh_expires_at
  )
  select c.family_id, c.user_id, c.org_id, c.device_id, d.name, c.refresh_expires_at
  from claimed c
  left join public.member_devices d
    on d.user_id = c.user_id and d.device_id = c.device_id and d.revoked_at is null;
end;
$$;

revoke all on function public.claim_token_reminders(interval) from public, anon, authenticated;

-- ---------- Retention of sign-in leftovers ----------

-- Device codes and authorization codes live minutes; token rows pile up one
-- per update. None of them is history worth keeping: the machine's own record
-- is member_devices, and the sign-in trail is access_events.
create or replace function public.purge_oauth_leftovers()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  codes integer := 0;
  grants integer := 0;
  tokens integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.oauth_device_codes where expires_at < now() - interval '1 day';
  get diagnostics codes = row_count;

  delete from public.oauth_grants where expires_at < now() - interval '1 day';
  get diagnostics grants = row_count;

  -- A token that was revoked, or whose refresh window closed, 90 days ago.
  -- The newest row of each machine always stays: it is what tells a login
  -- from the revalidation of a lapsed machine (startFamily, lib/oauth).
  delete from public.oauth_tokens t
  where coalesce(t.revoked_at, t.refresh_expires_at, t.access_expires_at) < now() - interval '90 days'
    and (t.revoked_at is not null or coalesce(t.refresh_expires_at, t.access_expires_at) < now())
    and exists (
      select 1 from public.oauth_tokens newer
      where newer.client_id = t.client_id
        and newer.user_id = t.user_id
        and newer.device_id is not distinct from t.device_id
        and newer.created_at > t.created_at
    );
  get diagnostics tokens = row_count;

  return jsonb_build_object('device_codes', codes, 'grants', grants, 'tokens', tokens);
end;
$$;

revoke all on function public.purge_oauth_leftovers() from public, anon, authenticated;

-- ---------- End of a paid period that does not renew ----------

-- A yearly plan paid in installments is one purchase (renews = false): nothing
-- tells the member before the day it stops. One notice, about two weeks ahead.
alter table public.subscriptions add column term_notice_sent_at timestamptz;

comment on column public.subscriptions.term_notice_sent_at is
  'When the "your paid period is ending" notice went out for this period. Cleared when the period changes.';

-- A new purchase moves the end of the period: the notice is owed again.
create or replace function public.reset_term_notice()
returns trigger
language plpgsql
as $$
begin
  if new.current_period_end is distinct from old.current_period_end then
    new.term_notice_sent_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.reset_term_notice() from public, anon, authenticated;

create trigger subscriptions_reset_term_notice
  before update on public.subscriptions
  for each row execute function public.reset_term_notice();

create or replace function public.claim_term_end_notices(target_within interval default interval '15 days')
returns table (
  subscription_id uuid,
  org_id uuid,
  plan_name text,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with due as (
    select s.id
    from public.subscriptions s
    where s.status = 'active'
      and s.renews = false
      and s.term_notice_sent_at is null
      and s.current_period_end is not null
      and s.current_period_end > now()
      and s.current_period_end <= now() + least(greatest(target_within, interval '1 day'), interval '60 days')
    order by s.current_period_end
    limit 200
    for update skip locked
  ),
  claimed as (
    update public.subscriptions s
    set term_notice_sent_at = now()
    from due
    where s.id = due.id
    returning s.id, s.org_id, s.plan_id, s.current_period_end
  )
  select c.id, c.org_id, p.name, c.current_period_end
  from claimed c
  join public.plans p on p.id = c.plan_id;
end;
$$;

revoke all on function public.claim_term_end_notices(interval) from public, anon, authenticated;

-- ---------- Meeting e-mails ----------

-- Which (meeting, message) pairs have someone to write to right now. The
-- windows: the day reminder from 24 hours before, never inside the last two;
-- the hour reminder from 60 minutes before until the session starts; the
-- recording once an ended session has one. A registration made inside a
-- window already got its confirmation and is left out of that reminder.
create or replace function public.due_meeting_emails()
returns table (meeting_id uuid, kind text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select m.id, 'day'::text
  from public.meetings m
  where m.state = 'inscricoes'
    and m.starts_at is not null
    and m.starts_at > now() + interval '2 hours'
    and m.starts_at <= now() + interval '24 hours'
    and exists (
      select 1 from public.meeting_registrations r
      where r.meeting_id = m.id and r.reminder_day_sent_at is null
        and r.created_at < m.starts_at - interval '26 hours'
    )
  union all
  select m.id, 'hour'::text
  from public.meetings m
  where m.state in ('inscricoes', 'ao_vivo')
    and m.starts_at is not null
    and m.starts_at > now()
    and m.starts_at <= now() + interval '60 minutes'
    and exists (
      select 1 from public.meeting_registrations r
      where r.meeting_id = m.id and r.reminder_hour_sent_at is null
        and r.created_at < m.starts_at - interval '90 minutes'
    )
  union all
  select m.id, 'recording'::text
  from public.meetings m
  join public.meeting_links l on l.meeting_id = m.id and l.recording_url is not null
  where m.state = 'encerrado'
    and exists (
      select 1 from public.meeting_registrations r
      where r.meeting_id = m.id and r.recording_sent_at is null
    );
end;
$$;

revoke all on function public.due_meeting_emails() from public, anon, authenticated;

-- Marks one message as sent for a batch of registrations and hands back who
-- to write to, in the language and the time zone each one reads. `target_user`
-- narrows it to one person: the confirmation of a registration just made.
create or replace function public.claim_meeting_emails(
  target_meeting uuid,
  target_kind text,
  target_user uuid default null,
  target_limit integer default 200
)
returns table (
  registration_id uuid,
  user_id uuid,
  email text,
  display_name text,
  locale text,
  timezone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting public.meetings%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_kind not in ('confirmation', 'day', 'hour', 'recording') then
    raise exception 'unknown_kind' using errcode = '22023';
  end if;

  select * into meeting from public.meetings m where m.id = target_meeting;
  if not found then
    return;
  end if;

  return query
  with due as (
    select r.id
    from public.meeting_registrations r
    where r.meeting_id = target_meeting
      and (target_user is null or r.user_id = target_user)
      and case target_kind
        when 'confirmation' then r.confirmation_sent_at is null
        when 'day' then r.reminder_day_sent_at is null
          and (meeting.starts_at is null or r.created_at < meeting.starts_at - interval '26 hours')
        when 'hour' then r.reminder_hour_sent_at is null
          and (meeting.starts_at is null or r.created_at < meeting.starts_at - interval '90 minutes')
        else r.recording_sent_at is null
      end
    order by r.created_at
    limit least(greatest(target_limit, 1), 500)
    for update skip locked
  ),
  claimed as (
    update public.meeting_registrations r
    set confirmation_sent_at = case when target_kind = 'confirmation' then now() else r.confirmation_sent_at end,
        reminder_day_sent_at = case when target_kind = 'day' then now() else r.reminder_day_sent_at end,
        reminder_hour_sent_at = case when target_kind = 'hour' then now() else r.reminder_hour_sent_at end,
        recording_sent_at = case when target_kind = 'recording' then now() else r.recording_sent_at end
    from due
    where r.id = due.id
    returning r.id, r.user_id
  )
  select c.id, c.user_id, u.email::text, p.display_name, p.locale, p.timezone
  from claimed c
  join public.profiles p on p.id = c.user_id
  join auth.users u on u.id = c.user_id
  where u.email is not null;
end;
$$;

revoke all on function public.claim_meeting_emails(uuid, text, uuid, integer) from public, anon, authenticated;

-- ---------- Messages to the confirmed list ----------

-- What the operator writes to the waitlist (the opening notice, the news).
-- A send is a row here; who received it is newsletter_deliveries, which is
-- also what keeps a retry from writing to the same person twice.
create table public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  -- Per language: {"pt-BR": "...", "en": "..."}. A language left out is not sent.
  subject jsonb not null check (public.i18n_ok(subject)),
  body_md jsonb not null check (public.i18n_ok(body_md)),
  -- Narrows the audience to one origin of the list; null writes to all of it.
  source text check (source is null or source in ('waitlist', 'newsletter', 'contact', 'meeting')),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  delivered integer not null default 0 check (delivered >= 0),
  last_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint newsletter_sends_languages check (subject <> '{}'::jsonb and body_md <> '{}'::jsonb)
);

create table public.newsletter_deliveries (
  send_id uuid not null references public.newsletter_sends (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (send_id, lead_id)
);

create index newsletter_deliveries_lead_idx on public.newsletter_deliveries (lead_id);

alter table public.newsletter_sends enable row level security;
alter table public.newsletter_deliveries enable row level security;

create policy "newsletter_sends_select_superadmin" on public.newsletter_sends
  for select to authenticated
  using (public.is_superadmin());

-- Written only by the functions below (the console and the job).
grant select on table public.newsletter_sends to authenticated;

-- Who a send would reach: confirmed, not opted out, in a language the message
-- was written in, from the chosen origin.
create or replace function public.newsletter_audience(target_languages text[], target_source text default null)
returns table (locale text, readers integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select l.locale, count(*)::integer
  from public.leads l
  where l.confirmed_at is not null
    and l.opted_out_at is null
    and l.locale = any (coalesce(target_languages, array[]::text[]))
    and (target_source is null or l.source = target_source)
  group by l.locale
  order by l.locale;
end;
$$;

revoke all on function public.newsletter_audience(text[], text) from public, anon;
grant execute on function public.newsletter_audience(text[], text) to authenticated;

create or replace function public.create_newsletter_send(
  target_subject jsonb,
  target_body_md jsonb,
  target_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry text;
  created uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    raise exception 'not_allowed_in_support_session' using errcode = '42501';
  end if;

  -- A language is sent only when both its subject and its text are written.
  for entry in select jsonb_object_keys(coalesce(target_subject, '{}'::jsonb)) loop
    if btrim(coalesce(target_subject ->> entry, '')) = '' or btrim(coalesce(target_body_md ->> entry, '')) = '' then
      raise exception 'incomplete_language' using errcode = '22023';
    end if;
    if char_length(target_subject ->> entry) > 150 or char_length(target_body_md ->> entry) > 20000 then
      raise exception 'too_long' using errcode = '22001';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(coalesce(target_body_md, '{}'::jsonb))) <>
     (select count(*) from jsonb_object_keys(coalesce(target_subject, '{}'::jsonb))) then
    raise exception 'incomplete_language' using errcode = '22023';
  end if;

  insert into public.newsletter_sends (subject, body_md, source, created_by)
  values (target_subject, target_body_md, target_source, auth.uid())
  returning id into created;

  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null, auth.uid(), 'newsletter.created', 'newsletter_send', created::text,
    jsonb_build_object('languages', (select jsonb_agg(k) from jsonb_object_keys(target_subject) k), 'source', target_source)
  );

  return created;
end;
$$;

revoke all on function public.create_newsletter_send(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_newsletter_send(jsonb, jsonb, text) to authenticated;

-- The next readers of a send, claimed: the delivery row is written before the
-- message leaves, so a second worker (or a retry) never picks them again.
create or replace function public.claim_newsletter_batch(target_send uuid, target_limit integer default 100)
returns table (
  lead_id uuid,
  email text,
  locale text,
  unsubscribe_token uuid,
  subject text,
  body_md text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  send public.newsletter_sends%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into send from public.newsletter_sends s where s.id = target_send for update;
  if not found or send.status in ('sent', 'failed') then
    return;
  end if;
  if send.status = 'queued' then
    update public.newsletter_sends s set status = 'sending', started_at = now() where s.id = target_send;
  end if;

  return query
  with due as (
    select l.id
    from public.leads l
    where l.confirmed_at is not null
      and l.opted_out_at is null
      and send.subject ? l.locale
      and (send.source is null or l.source = send.source)
      and not exists (
        select 1 from public.newsletter_deliveries d where d.send_id = target_send and d.lead_id = l.id
      )
    order by l.created_at
    limit least(greatest(target_limit, 1), 100)
    for update of l skip locked
  ),
  claimed as (
    insert into public.newsletter_deliveries (send_id, lead_id)
    select target_send, due.id from due
    on conflict do nothing
    returning newsletter_deliveries.lead_id
  )
  select l.id, l.email::text, l.locale, l.email_unsubscribe_token,
         send.subject ->> l.locale, send.body_md ->> l.locale
  from claimed c
  join public.leads l on l.id = c.lead_id;
end;
$$;

revoke all on function public.claim_newsletter_batch(uuid, integer) from public, anon, authenticated;

-- Closes a batch: counts what was delivered, or gives the readers back when
-- the provider refused the whole request (the batch is all or nothing).
create or replace function public.settle_newsletter_batch(
  target_send uuid,
  target_leads uuid[],
  target_delivered boolean,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if target_delivered then
    update public.newsletter_sends s
    set delivered = s.delivered + coalesce(array_length(target_leads, 1), 0)
    where s.id = target_send;
  else
    delete from public.newsletter_deliveries d
    where d.send_id = target_send and d.lead_id = any (coalesce(target_leads, array[]::uuid[]));
    update public.newsletter_sends s
    set status = 'failed', last_error = left(coalesce(target_error, 'send_failed'), 300), finished_at = now()
    where s.id = target_send;
  end if;
end;
$$;

revoke all on function public.settle_newsletter_batch(uuid, uuid[], boolean, text) from public, anon, authenticated;

create or replace function public.finish_newsletter_send(target_send uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.newsletter_sends s
  set status = 'sent', finished_at = now()
  where s.id = target_send and s.status = 'sending';
end;
$$;

revoke all on function public.finish_newsletter_send(uuid) from public, anon, authenticated;

-- Erasing a lead takes its delivery rows with it (the cascade above); the
-- send keeps its count, which names nobody.

-- ---------- Who a message is written to ----------

-- The address, the language and the preferences of a set of members, in one
-- read. The address lives in auth.users, which only the backend reaches; an
-- account that is banned or has no address is left out, so no job writes to it.
create or replace function public.member_recipients(target_users uuid[])
returns table (
  user_id uuid,
  email text,
  display_name text,
  locale text,
  timezone text,
  marketing_email_opt_out boolean,
  email_unsubscribe_token uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select p.id, u.email::text, p.display_name, p.locale, p.timezone,
         p.marketing_email_opt_out, p.email_unsubscribe_token
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = any (coalesce(target_users, array[]::uuid[]))
    and u.email is not null
    and (u.banned_until is null or u.banned_until <= now());
end;
$$;

revoke all on function public.member_recipients(uuid[]) from public, anon, authenticated;
