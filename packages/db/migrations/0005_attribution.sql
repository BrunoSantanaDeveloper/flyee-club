-- ============================================================
-- 0005_attribution: where accounts and purchases came from, and how many
-- people saw each public page.
--
-- Vocabulary: `origem` is the entry door ("porta de entrada" in
-- docs/PRODUCT.md) — the page, partner or channel a link names with
-- `?origem=`. `onda` is the campaign wave. Both names are kept from the links
-- already in circulation.
--
-- Origin: inherited migrations 0051, 0052, 0086 and 0113 (purchase
-- attribution and the per-day visit counter). New here: site_page_views.
-- ============================================================

-- ---------- First touch of an account ----------

create table public.signup_attribution (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  origem text,
  onda text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  captured_at timestamptz not null default now(),
  constraint signup_attribution_lengths check (
    coalesce(length(origem), 0) <= 64
    and coalesce(length(onda), 0) <= 64
    and coalesce(length(utm_source), 0) <= 64
    and coalesce(length(utm_medium), 0) <= 64
    and coalesce(length(utm_campaign), 0) <= 64
    and coalesce(length(utm_content), 0) <= 64
    and coalesce(length(utm_term), 0) <= 64
    and coalesce(length(referrer), 0) <= 255
    and coalesce(length(landing_path), 0) <= 255
  )
);

comment on table public.signup_attribution is
  'First-touch campaign attribution for a workspace, written once at sign-up by the backend. Never updated: a later campaign does not get credit for a sign-up an earlier one produced.';

create index signup_attribution_origem_idx on public.signup_attribution (origem, captured_at desc);
create index signup_attribution_onda_idx on public.signup_attribution (onda, captured_at desc);

alter table public.signup_attribution enable row level security;

create policy "signup_attribution_select_superadmin" on public.signup_attribution
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.signup_attribution to authenticated;

-- ---------- Ad-platform context of an account ----------

-- What the server-side conversion events (Meta CAPI, GA4 Measurement
-- Protocol) need to be matched to a browser, plus the LAST campaign that
-- brought the member to a checkout. Backend only: no policy, no grant.
create table public.meta_attribution (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  fbp text,
  fbc text,
  ga_client_id text,
  email text,
  client_ip text,
  client_user_agent text,
  campaign_origem text,
  campaign_utm_source text,
  campaign_utm_medium text,
  campaign_utm_campaign text,
  campaign_utm_content text,
  campaign_captured_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint meta_attribution_campaign_lengths check (
    coalesce(length(campaign_origem), 0) <= 64
    and coalesce(length(campaign_utm_source), 0) <= 64
    and coalesce(length(campaign_utm_medium), 0) <= 64
    and coalesce(length(campaign_utm_campaign), 0) <= 64
    and coalesce(length(campaign_utm_content), 0) <= 64
  )
);

alter table public.meta_attribution enable row level security;

-- ---------- Purchases credited to a campaign ----------

-- One row per paid invoice whose checkout carried a campaign. Counted only
-- while the invoice stays paid (purchase_attribution_is_paid): refunds and
-- chargebacks drop out of every report without anything being deleted.
create table public.purchase_attributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_key text not null unique check (char_length(invoice_key) <= 200),
  subscription_id uuid,
  plan_slug text check (plan_slug is null or char_length(plan_slug) <= 80),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency in ('BRL', 'USD')),
  paid_at timestamptz not null,
  origem text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  campaign_captured_at timestamptz,
  created_at timestamptz not null default now(),
  constraint purchase_attributions_lengths check (
    coalesce(length(origem), 0) <= 64
    and coalesce(length(utm_source), 0) <= 64
    and coalesce(length(utm_medium), 0) <= 64
    and coalesce(length(utm_campaign), 0) <= 64
    and coalesce(length(utm_content), 0) <= 64
  )
);

create index purchase_attributions_org_idx on public.purchase_attributions (org_id);
create index purchase_attributions_campaign_idx on public.purchase_attributions (utm_campaign, paid_at desc);
create index purchase_attributions_origem_idx on public.purchase_attributions (origem, paid_at desc);

alter table public.purchase_attributions enable row level security;

create policy "purchase_attributions_select_superadmin" on public.purchase_attributions
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.purchase_attributions to authenticated;

create or replace function public.purchase_attribution_is_paid(target_invoice_key text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.invoices i
    where i.provider::text || ':' || i.provider_invoice_id = target_invoice_key
      and i.status = 'paid'
  );
$$;

revoke all on function public.purchase_attribution_is_paid(text) from public, anon;
grant execute on function public.purchase_attribution_is_paid(text) to authenticated;

-- ---------- Public page views, per day and entry door ----------

/**
 * How many times each public page was loaded, per day, entry door and
 * language. A COUNTER, never a log: no visitor, no IP, no user agent. It is
 * the denominator of "page conversion by entry door" in the weekly segment
 * report.
 */
create table public.site_page_views (
  day date not null,
  path text not null,
  origem text not null,
  locale text not null check (locale in ('pt-BR', 'en')),
  views integer not null default 0 check (views >= 0),
  primary key (day, path, origem, locale),
  constraint site_page_views_path_check check (path ~ '^/[a-z0-9/_-]{0,79}$')
);

alter table public.site_page_views enable row level security;

create policy "site_page_views_select_superadmin" on public.site_page_views
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.site_page_views to authenticated;

-- One spelling for a channel, for visits and for purchases alike.
create or replace function public.site_channel(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(left(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9_-]+', '', 'g'), 32), ''),
    'direto'
  );
$$;

revoke all on function public.site_channel(text) from public, anon;
grant execute on function public.site_channel(text) to authenticated;

/**
 * Counts one page load. The backend calls it for a DOCUMENT load of a public
 * page, never for crawlers or signed-in superadmins.
 *
 * The query string is attacker-controlled, so growth is bounded here: at most
 * 30 entry doors per page per day (the rest is counted as "outro") and at most
 * 60 distinct paths per day (the rest is dropped).
 */
create or replace function public.count_site_view(
  target_path text,
  target_origem text default null,
  target_locale text default 'pt-BR'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  channel text := public.site_channel(target_origem);
  clean_path text := lower(coalesce(target_path, ''));
  clean_locale text := case when target_locale = 'en' then 'en' else 'pt-BR' end;
begin
  if auth.role() is distinct from 'service_role' then
    return;
  end if;
  if clean_path !~ '^/[a-z0-9/_-]{0,79}$' then
    return;
  end if;

  if not exists (select 1 from public.site_page_views v where v.day = today and v.path = clean_path)
     and (select count(distinct v.path) from public.site_page_views v where v.day = today) >= 60 then
    return;
  end if;

  if not exists (
       select 1 from public.site_page_views v
       where v.day = today and v.path = clean_path and v.origem = channel)
     and (select count(distinct v.origem) from public.site_page_views v
          where v.day = today and v.path = clean_path) >= 30 then
    channel := 'outro';
  end if;

  insert into public.site_page_views (day, path, origem, locale, views)
  values (today, clean_path, channel, clean_locale, 1)
  on conflict (day, path, origem, locale) do update
    set views = public.site_page_views.views + 1;
end;
$$;

revoke all on function public.count_site_view(text, text, text) from public, anon, authenticated;
