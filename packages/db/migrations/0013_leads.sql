-- ============================================================
-- 0013_leads: people without an account — the waitlist and the newsletter.
--
-- The e-mail address is the identity, and it is only trusted after the person
-- clicks the confirmation link (double opt-in): a form post proves nothing
-- about who owns an address. Until then the row is `unconfirmed` and receives
-- nothing but that one confirmation message.
--
-- Rules that hold everywhere below:
--   * a repeated sign-up NEVER rewrites the name or anything else stored for an
--     existing address, and the answer to the visitor is the same whether the
--     address was new or already known (no e-mail oracle);
--   * consent is a snapshot pinned on the row: term id, version and the text
--     that was on screen;
--   * an opt-out is lifted only by confirming again from the inbox;
--   * erasure removes the row AND its change history.
--
-- Origin: inherited migration 0112, reshaped around the e-mail (it was keyed
-- by phone and tied to live events).
-- ============================================================

create extension if not exists citext with schema extensions;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  name text,
  phone text,
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  segment public.member_segment,
  source text not null default 'waitlist' check (source in ('waitlist', 'newsletter', 'contact', 'meeting')),
  -- First touch: the entry door, the campaign wave, a coupon, the UTM set.
  origem text,
  onda text,
  cupom text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  -- The consent that was given, exactly as shown.
  consent_term_id uuid references public.consent_terms (id),
  consent_term_version integer,
  consent_text text,
  consent_accepted_at timestamptz,
  -- Double opt-in. Only the hash of the token is stored.
  confirm_token_hash text unique,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  email_unsubscribe_token uuid not null unique default gen_random_uuid(),
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_email_check check (
    char_length(email::text) <= 254 and email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint leads_name_check check (name is null or char_length(btrim(name)) between 1 and 120),
  constraint leads_phone_check check (phone is null or phone ~ '^[1-9][0-9]{7,14}$'),
  constraint leads_token_hash_check check (confirm_token_hash is null or confirm_token_hash ~ '^[0-9a-f]{64}$'),
  constraint leads_lengths check (
    coalesce(length(origem), 0) <= 64
    and coalesce(length(onda), 0) <= 64
    and coalesce(length(cupom), 0) <= 64
    and coalesce(length(utm_source), 0) <= 64
    and coalesce(length(utm_medium), 0) <= 64
    and coalesce(length(utm_campaign), 0) <= 64
    and coalesce(length(utm_content), 0) <= 64
    and coalesce(length(utm_term), 0) <= 64
    and coalesce(length(referrer), 0) <= 255
    and coalesce(length(landing_path), 0) <= 255
  ),
  constraint leads_consent_whole check (
    (consent_term_id is null and consent_term_version is null and consent_text is null and consent_accepted_at is null)
    or (consent_term_id is not null and consent_term_version is not null and consent_text is not null and consent_accepted_at is not null)
  )
);

comment on table public.leads is
  'Contacts without an account (waitlist, newsletter). Superadmin-only. Consent pinned on the row; erasure through purge_lead / purge_expired_leads, which also remove the change history.';

create index leads_created_idx on public.leads (created_at desc);
create index leads_origem_idx on public.leads (origem, created_at desc);
create index leads_confirmed_idx on public.leads (confirmed_at) where confirmed_at is not null and opted_out_at is null;

alter table public.leads enable row level security;

create policy "leads_select_superadmin" on public.leads
  for select to authenticated
  using (public.is_superadmin());

create policy "leads_update_superadmin" on public.leads
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- The console reads the list and records an opt-out. Rows are created by
-- submit_lead and removed by the purge functions only.
grant select on table public.leads to authenticated;
grant update (opted_out_at) on table public.leads to authenticated;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

select public.enable_row_versioning('public.leads');

-- The per-network window. Pseudonymous (a salted hash), short-lived (purged
-- after a day), and deliberately NOT a column on the person.
create table public.lead_submissions (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index lead_submissions_window_idx on public.lead_submissions (ip_hash, created_at desc);

alter table public.lead_submissions enable row level security;

-- ---------- Sign-up ----------

/**
 * A waitlist or newsletter sign-up. Service role only: the caller is the
 * server action behind the form, after its honeypot.
 *
 * `payload`: email (required), consent (must be true), name, phone, locale,
 * segment, source, and the first-touch fields (origem, onda, cupom, utm_*,
 * referrer, landing_path).
 *
 * Returns `send_confirmation`: whether the caller should e-mail the link built
 * from the token whose hash it passed. It is false for an address that is
 * already confirmed and subscribed, which is the only case with nothing to
 * confirm; the visitor is told the same thing either way.
 */
create or replace function public.submit_lead(
  payload jsonb,
  target_ip_hash text,
  target_confirm_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  data jsonb := coalesce(payload, '{}'::jsonb);
  clean_email text := lower(btrim(coalesce(data ->> 'email', '')));
  clean_name text := nullif(left(btrim(coalesce(data ->> 'name', '')), 120), '');
  clean_phone text := nullif(regexp_replace(coalesce(data ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  clean_locale text := case when data ->> 'locale' = 'en' then 'en' else 'pt-BR' end;
  clean_source text := case
    when data ->> 'source' in ('waitlist', 'newsletter', 'contact', 'meeting') then data ->> 'source'
    else 'waitlist'
  end;
  clean_segment public.member_segment := case
    when data ->> 'segment' = any (enum_range(null::public.member_segment)::text[])
      then (data ->> 'segment')::public.member_segment
  end;
  window_limit integer;
  recent integer;
  term public.consent_terms%rowtype;
  existing public.leads%rowtype;
  new_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;
  if char_length(clean_email) > 254
     or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_email');
  end if;
  if target_confirm_token_hash is null or target_confirm_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if target_ip_hash is not null and target_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if coalesce((data ->> 'consent')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'consent_required');
  end if;
  if clean_phone is not null and clean_phone !~ '^[1-9][0-9]{7,14}$' then
    clean_phone := null;
  end if;

  -- Per-network window, counted before anything is written about the person.
  if target_ip_hash is not null then
    select greatest(coalesce((value ->> 'per_network_hour')::integer, 10), 1) into window_limit
    from public.platform_settings where key = 'leads';
    window_limit := coalesce(window_limit, 10);

    select count(*) into recent
    from public.lead_submissions s
    where s.ip_hash = target_ip_hash and s.created_at > now() - interval '1 hour';
    if recent >= window_limit then
      return jsonb_build_object('ok', false, 'code', 'rate_limited');
    end if;
    insert into public.lead_submissions (ip_hash) values (target_ip_hash);
  end if;

  select t.* into term
  from public.consent_terms t
  where t.slug = 'newsletter' and t.is_active
  order by case when t.locale = clean_locale then 0 when t.locale = 'en' then 1 else 2 end
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'consent_term_missing');
  end if;

  select * into existing from public.leads where email = clean_email for update;

  if found then
    -- Already confirmed and subscribed: nothing to do, nothing to send, and
    -- nothing stored is touched.
    if existing.confirmed_at is not null and existing.opted_out_at is null then
      return jsonb_build_object('ok', true, 'code', 'already_confirmed', 'send_confirmation', false);
    end if;

    -- Unconfirmed, or opted out and asking again: issue a fresh link. The
    -- opt-out itself stays until the link is clicked.
    update public.leads set
      confirm_token_hash = target_confirm_token_hash,
      confirm_sent_at = now()
    where id = existing.id;
    return jsonb_build_object(
      'ok', true, 'code', 'pending', 'send_confirmation', true,
      'leadId', existing.id, 'locale', existing.locale
    );
  end if;

  insert into public.leads (
    email, name, phone, locale, segment, source,
    origem, onda, cupom, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path,
    consent_term_id, consent_term_version, consent_text, consent_accepted_at,
    confirm_token_hash, confirm_sent_at
  ) values (
    clean_email, clean_name, clean_phone, clean_locale, clean_segment, clean_source,
    case when data ? 'origem' then public.site_channel(data ->> 'origem') end,
    nullif(left(btrim(coalesce(data ->> 'onda', '')), 64), ''),
    nullif(left(upper(btrim(coalesce(data ->> 'cupom', ''))), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'utm_source', '')), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'utm_medium', '')), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'utm_campaign', '')), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'utm_content', '')), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'utm_term', '')), 64), ''),
    nullif(left(btrim(coalesce(data ->> 'referrer', '')), 255), ''),
    nullif(left(btrim(coalesce(data ->> 'landing_path', '')), 255), ''),
    term.id, term.version, term.body_md, now(),
    target_confirm_token_hash, now()
  )
  returning id into new_id;

  return jsonb_build_object(
    'ok', true, 'code', 'created', 'send_confirmation', true, 'leadId', new_id, 'locale', clean_locale
  );
end;
$$;

revoke all on function public.submit_lead(jsonb, text, text) from public, anon, authenticated;

/**
 * The confirmation link was opened. Valid for seven days after it was sent.
 * Confirming also lifts an opt-out: asking again from the inbox is the proof
 * that the owner of the address wants it. The first confirmation is the
 * `waitlist.joined` event.
 */
create or replace function public.confirm_lead(target_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead public.leads%rowtype;
  first_time boolean;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;
  if target_token_hash is null or target_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  select * into lead from public.leads
  where confirm_token_hash = target_token_hash
  for update;
  if not found or lead.confirm_sent_at is null or lead.confirm_sent_at < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  first_time := lead.confirmed_at is null;

  update public.leads set
    confirmed_at = coalesce(confirmed_at, now()),
    opted_out_at = null,
    confirm_token_hash = null
  where id = lead.id;

  if first_time then
    perform public.product_event_insert(
      null, null, 'waitlist.joined',
      jsonb_strip_nulls(jsonb_build_object('origem', lead.origem, 'platform', 'server')), null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case when first_time then 'confirmed' else 'resubscribed' end,
    'locale', lead.locale
  );
end;
$$;

revoke all on function public.confirm_lead(text) from public, anon, authenticated;

-- The one-click link in every message. Answers the same for a known and an
-- unknown token.
create or replace function public.unsubscribe_lead(target_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    return false;
  end if;
  update public.leads set opted_out_at = coalesce(opted_out_at, now())
  where email_unsubscribe_token = target_token;
  return true;
end;
$$;

revoke all on function public.unsubscribe_lead(uuid) from public, anon, authenticated;

-- ---------- Erasure ----------

create or replace function public.purge_leads_internal(target_leads uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer := 0;
begin
  if target_leads is null or cardinality(target_leads) = 0 then
    return 0;
  end if;

  delete from public.leads where id = any (target_leads);
  get diagnostics removed = row_count;

  -- The versioning trigger just snapshotted every deleted row. An erasure that
  -- leaves the history behind erased nothing.
  delete from public.record_versions
  where table_name = 'leads' and record_id = any (target_leads);

  return removed;
end;
$$;

revoke all on function public.purge_leads_internal(uuid[]) from public, anon, authenticated;

create or replace function public.purge_lead(target_lead uuid, target_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if not public.is_superadmin() or public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  removed := public.purge_leads_internal(array[target_lead]);
  if removed = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- The id and the operator's reason only: the name and the address are
  -- exactly what was just erased.
  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null, auth.uid(), 'admin.leads.purged', 'lead', target_lead::text,
    case when nullif(btrim(target_reason), '') is null then '{}'::jsonb
         else jsonb_build_object('reason', left(btrim(target_reason), 500)) end
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.purge_lead(uuid, text) from public, anon;
grant execute on function public.purge_lead(uuid, text) to authenticated;

/**
 * Daily retention: an address that never confirmed is gone after 7 days, an
 * opted-out one after 6 months, and the per-network window after a day.
 */
create or replace function public.purge_expired_leads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  doomed uuid[];
  removed integer;
begin
  if auth.role() is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  select coalesce(array_agg(l.id), '{}') into doomed
  from public.leads l
  where (l.confirmed_at is null and l.created_at < now() - interval '7 days'
         and coalesce(l.confirm_sent_at, l.created_at) < now() - interval '7 days')
     or (l.opted_out_at is not null and l.opted_out_at < now() - interval '6 months');

  removed := public.purge_leads_internal(doomed);

  delete from public.lead_submissions where created_at < now() - interval '1 day';

  if removed > 0 then
    insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
    values (null, null, 'leads.retention_purged', 'lead', null, jsonb_build_object('count', removed));
  end if;

  return jsonb_build_object('ok', true, 'removed', removed);
end;
$$;

revoke all on function public.purge_expired_leads() from public, anon, authenticated;
