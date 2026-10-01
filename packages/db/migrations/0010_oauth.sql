-- ============================================================
-- 0010_oauth: the OAuth 2.1 authorization server that issues member tokens.
--
-- The `flyee` CLI is its first-party client. Tokens are opaque (only hashes
-- are stored), access tokens are short, and the refresh token rotates on every
-- use and lives 30 days: "30 days without an update" and "the refresh token
-- expired" are the same fact, which is what brings a member back to the
-- dashboard to revalidate.
--
-- Origin: inherited migration 0088 (the OAuth half). New here: first-party
-- clients with loopback redirects on any port (RFC 8252 §7.3), token families,
-- the device a token belongs to, and the device authorization grant (RFC 8628)
-- for machines without a browser.
--
-- Every table here is written by the backend only. The token and code tables
-- carry no policy for members beyond reading their own connections.
-- ============================================================

create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text not null,
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  client_secret_hash text,
  client_uri text,
  logo_uri text,
  -- Ours: skips nothing in the consent screen, but is what the device ceiling,
  -- the revalidation screen and the token reminders apply to.
  first_party boolean not null default false,
  -- Native apps listen on an ephemeral loopback port, so for these clients the
  -- redirect URI is compared ignoring the port. Never set for a web client.
  loopback_any_port boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.oauth_clients is
  'OAuth clients. `flyee-cli` is seeded; others register through RFC 7591. Backend only.';

alter table public.oauth_clients enable row level security;

create policy "oauth_clients_select_superadmin" on public.oauth_clients
  for select to authenticated
  using (public.is_superadmin());

grant select on table public.oauth_clients to authenticated;

select public.enable_row_versioning('public.oauth_clients');

-- Authorization codes: single use, PKCE (S256) only.
create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  redirect_uri text not null,
  scope text not null,
  -- The stable id the CLI generated for this machine, carried into the token.
  device_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.oauth_grants enable row level security;

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  scope text not null,
  -- Every rotation writes a new row with the SAME family. Revoking a family
  -- kills the whole chain, which is how a stolen refresh token is contained.
  family_id uuid not null default gen_random_uuid(),
  device_id text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  last_used_at timestamptz,
  -- When the "revalidate in 5 days" reminder went out for this family.
  reminder_sent_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_tokens_org_idx on public.oauth_tokens (org_id, created_at desc);
create index oauth_tokens_family_idx on public.oauth_tokens (family_id);
create index oauth_tokens_device_idx on public.oauth_tokens (user_id, device_id) where device_id is not null;
create index oauth_tokens_refresh_due_idx on public.oauth_tokens (refresh_expires_at)
  where revoked_at is null and refresh_expires_at is not null;

alter table public.oauth_tokens enable row level security;

create policy "oauth_tokens_select_member" on public.oauth_tokens
  for select to authenticated
  using (public.is_org_member(org_id) or public.is_superadmin());

-- The hashes are not in the list: a member sees their connections, never the
-- material a token is checked against.
grant select (
  id, client_id, org_id, user_id, scope, family_id, device_id, access_expires_at,
  refresh_expires_at, last_used_at, revoked_at, created_at
) on table public.oauth_tokens to authenticated;

-- Device authorization grant (RFC 8628): `npx flyee login` on a machine with no
-- browser prints a short code; the member types it at /ativar on any device.
create table public.oauth_device_codes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  device_code_hash text not null unique,
  -- Eight characters from an alphabet without 0, O, 1 and I.
  user_code text not null unique check (user_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  scope text not null,
  device_id text,
  expires_at timestamptz not null,
  interval_seconds integer not null default 5 check (interval_seconds between 1 and 60),
  last_polled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'consumed')),
  user_id uuid references public.profiles (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_device_codes_approval check (
    status not in ('approved', 'consumed') or (user_id is not null and org_id is not null)
  )
);

create index oauth_device_codes_expiry_idx on public.oauth_device_codes (expires_at);

alter table public.oauth_device_codes enable row level security;

-- The CLI. Public client (no secret), PKCE, loopback redirect on any port.
insert into public.oauth_clients (
  client_id, client_name, redirect_uris, token_endpoint_auth_method, first_party, loopback_any_port, client_uri
) values (
  'flyee-cli',
  'flyee CLI',
  array['http://127.0.0.1/callback', 'http://localhost/callback'],
  'none',
  true,
  true,
  'https://flyee.club'
)
on conflict (client_id) do nothing;
