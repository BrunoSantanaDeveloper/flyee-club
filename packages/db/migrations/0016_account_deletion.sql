-- ============================================================
-- 0016_account_deletion: permanent removal of an account and everything it
-- holds, from the platform console.
--
-- Three traps make this more than "delete the user":
--   1. the data is not on the user. `organizations.created_by` is SET NULL, so
--      deleting the auth user alone leaves the workspace, its purchases and
--      its devices alive with nobody able to reach them. The unit is the
--      person PLUS every workspace they are the only member of.
--   2. the cascade is not erasure. `record_versions` has an org_id but no
--      foreign key, and the versioning trigger snapshots every row the cascade
--      deletes, so the history is purged explicitly, AFTER the cascade.
--   3. files are outside the transaction. Storage objects go through the
--      Storage API after the commit, listed by admin_orphaned_account_storage,
--      which refuses anything that still exists and is therefore safe to retry.
--
-- Order used by the server action: preview -> cancel any live provider
-- subscription (a failure there deletes nothing) -> admin_delete_account in
-- ONE transaction -> purge files.
--
-- What survives on purpose: the platform-level audit event (counts and a hash
-- of the address, never the address or the name), product_events with the
-- actor and workspace detached, and backups until retention prunes them.
--
-- Origin: inherited migrations 0099, 0101 and 0105.
-- ============================================================

-- Workspaces that die with the person: the ones nobody else belongs to.
create or replace function public.account_deletion_workspaces(target_user uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(m.org_id), '{}'::uuid[])
  from public.memberships m
  where m.user_id = target_user
    and not exists (
      select 1 from public.memberships other
      where other.org_id = m.org_id and other.user_id <> target_user
    );
$$;

revoke all on function public.account_deletion_workspaces(uuid) from public, anon, authenticated;

-- Workspaces the person OWNS that other people still belong to. Deleting the
-- owner would orphan them, so their presence blocks the deletion.
create or replace function public.account_deletion_shared_workspaces(target_user uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(m.org_id), '{}'::uuid[])
  from public.memberships m
  where m.user_id = target_user
    and m.role = 'owner'
    and exists (
      select 1 from public.memberships other
      where other.org_id = m.org_id and other.user_id <> target_user
    );
$$;

revoke all on function public.account_deletion_shared_workspaces(uuid) from public, anon, authenticated;

create or replace function public.account_deletion_counts(target_orgs uuid[], target_user uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'subscriptions', (select count(*) from public.subscriptions where org_id = any (target_orgs)),
    'invoices', (select count(*) from public.invoices where org_id = any (target_orgs)),
    'grants', (select count(*) from public.entitlement_grants where org_id = any (target_orgs)),
    'devices', (select count(*) from public.member_devices where org_id = any (target_orgs)),
    'tokens', (select count(*) from public.oauth_tokens where org_id = any (target_orgs)),
    'consents', (select count(*) from public.consent_acceptances where org_id = any (target_orgs)),
    'lessons', (select count(*) from public.lesson_progress where user_id = target_user),
    'votes', (select count(*) from public.roadmap_votes where user_id = target_user),
    'meetings', (select count(*) from public.meeting_registrations where user_id = target_user),
    'comments', (select count(*) from public.blog_comments where user_id = target_user),
    'files', (
      select count(*) from storage.objects o
      where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = target_user::text
    )
  );
$$;

revoke all on function public.account_deletion_counts(uuid[], uuid) from public, anon, authenticated;

-- Files that belonged to the account. Today only the avatar folder: packages
-- and backups are the platform's, not the member's.
create or replace function public.account_deletion_storage(target_orgs uuid[], target_user uuid)
returns table (bucket text, path text)
language sql
security definer
set search_path = public
stable
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where target_user is not null
    and o.bucket_id = 'avatars'
    and (storage.foldername(o.name))[1] = target_user::text;
$$;

revoke all on function public.account_deletion_storage(uuid[], uuid) from public, anon, authenticated;

create or replace function public.admin_account_deletion_preview(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  target_profile public.profiles%rowtype;
  doomed uuid[];
  shared uuid[];
  blockers text[] := '{}';
begin
  if not public.is_superadmin() or public.is_impersonated() then
    raise exception 'not_authorized';
  end if;

  select * into target_profile from public.profiles where id = target_user;
  if not found then
    raise exception 'user_not_found';
  end if;

  doomed := public.account_deletion_workspaces(target_user);
  shared := public.account_deletion_shared_workspaces(target_user);

  if target_user = auth.uid() then
    blockers := array_append(blockers, 'self');
  end if;
  if target_profile.is_superadmin then
    blockers := array_append(blockers, 'superadmin');
  end if;
  if cardinality(shared) > 0 then
    blockers := array_append(blockers, 'shared_workspace');
  end if;

  return jsonb_build_object(
    'userId', target_user,
    'email', (select u.email from auth.users u where u.id = target_user),
    'displayName', target_profile.display_name,
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.created_at)
      from public.organizations o where o.id = any (doomed)
    ), '[]'::jsonb),
    'sharedWorkspaces', coalesce((
      select jsonb_agg(o.name order by o.name)
      from public.organizations o where o.id = any (shared)
    ), '[]'::jsonb),
    'counts', public.account_deletion_counts(doomed, target_user),
    'providerSubscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'provider', s.provider,
        'providerSubscriptionId', s.provider_subscription_id,
        'status', s.status
      ))
      from public.subscriptions s
      where s.org_id = any (doomed)
        and s.status <> 'canceled'
        and nullif(btrim(coalesce(s.provider_subscription_id, '')), '') is not null
    ), '[]'::jsonb),
    'blockers', to_jsonb(blockers)
  );
end;
$$;

revoke all on function public.admin_account_deletion_preview(uuid) from public, anon;
grant execute on function public.admin_account_deletion_preview(uuid) to authenticated;

create or replace function public.admin_delete_account(target_user uuid, confirm_email text, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  target_email text;
  doomed uuid[];
  counts jsonb;
begin
  if not public.is_superadmin() or public.is_impersonated() then
    raise exception 'not_authorized';
  end if;

  if target_user = auth.uid() then
    raise exception 'self_delete_forbidden'
      using hint = 'Another superadmin has to do it.';
  end if;

  select * into target_profile from public.profiles where id = target_user for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  if target_profile.is_superadmin then
    raise exception 'target_is_superadmin'
      using hint = 'Remove the platform role first (set_user_superadmin), then delete the account.';
  end if;

  -- The typed confirmation is checked HERE: a dialog-only check is a check a
  -- direct RPC call skips.
  select u.email into target_email from auth.users u where u.id = target_user;
  if lower(btrim(coalesce(confirm_email, ''))) <> lower(coalesce(target_email, target_user::text)) then
    raise exception 'confirmation_mismatch';
  end if;

  if length(btrim(coalesce(reason, ''))) < 8 then
    raise exception 'reason_required';
  end if;

  if cardinality(public.account_deletion_shared_workspaces(target_user)) > 0 then
    raise exception 'shared_workspace'
      using hint = 'This person owns a workspace other people still belong to. Remove the other members first.';
  end if;

  doomed := public.account_deletion_workspaces(target_user);

  -- Lock the workspaces before counting: a write racing the deletion either
  -- lands before it (and is deleted with it) or fails its FK after it.
  perform 1 from public.organizations where id = any (doomed) for update;

  if exists (
    select 1 from public.subscriptions s
    where s.org_id = any (doomed)
      and s.status <> 'canceled'
      and nullif(btrim(coalesce(s.provider_subscription_id, '')), '') is not null
  ) then
    raise exception 'provider_subscription_live'
      using hint = 'Cancel it at the provider first: deleting the account would leave the card being charged.';
  end if;

  counts := public.account_deletion_counts(doomed, target_user);

  -- 1. Rows that hold the account's data, holder before held. Today every
  --    reference into deletable data cascades, so these are explicit rather
  --    than required; they keep the order stated instead of left to the
  --    cascade queue, and the test fails if a new NO ACTION reference appears.
  delete from public.lesson_progress where user_id = target_user or org_id = any (doomed);
  delete from public.roadmap_votes where user_id = target_user or org_id = any (doomed);
  delete from public.meeting_registrations where user_id = target_user or org_id = any (doomed);
  delete from public.consent_acceptances where org_id = any (doomed);
  delete from public.oauth_device_codes where user_id = target_user or org_id = any (doomed);
  delete from public.oauth_grants where org_id = any (doomed);
  delete from public.oauth_tokens where org_id = any (doomed);
  delete from public.member_devices where org_id = any (doomed);
  delete from public.entitlement_grants where org_id = any (doomed);

  -- 2. The workspaces: everything else cascades from organizations.
  delete from public.organizations where id = any (doomed);

  -- 3. Their history, including the snapshots steps 1 and 2 just wrote.
  delete from public.record_versions where org_id = any (doomed);

  -- 4. The person: profile, notifications, sign-in trail, sessions and MFA
  --    factors all cascade from auth.users.
  delete from auth.users where id = target_user;

  -- Platform-level and permanent, so it carries no name and no address: a
  -- hash answers "was this address deleted?" without keeping the address.
  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null,
    auth.uid(),
    'admin.account.deleted',
    'user',
    target_user::text,
    jsonb_build_object(
      'email_sha256', encode(sha256(convert_to(lower(coalesce(target_email, '')), 'UTF8')), 'hex'),
      'reason', left(btrim(reason), 500),
      'workspaces', cardinality(doomed),
      'counts', counts
    )
  );

  return jsonb_build_object(
    'ok', true,
    'deletedWorkspaces', to_jsonb(doomed),
    'counts', counts
  );
end;
$$;

comment on function public.admin_delete_account(uuid, text, text) is
  'Permanently deletes an account and every workspace it alone belongs to, with their change history. Superadmin-only, never yourself, never a superadmin, never from a support visit, never while a provider subscription is live.';

revoke all on function public.admin_delete_account(uuid, text, text) from public, anon;
grant execute on function public.admin_delete_account(uuid, text, text) to authenticated;

/**
 * The files left behind by a deleted account, for the Storage API to remove.
 * It REFUSES any workspace or person that still exists: it feeds a
 * service-role delete and must never be able to point at a live account.
 */
create or replace function public.admin_orphaned_account_storage(target_orgs uuid[], target_user uuid default null)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_superadmin() or public.is_impersonated() then
    raise exception 'not_authorized';
  end if;

  if exists (select 1 from public.organizations o where o.id = any (coalesce(target_orgs, '{}'::uuid[]))) then
    raise exception 'workspace_still_exists';
  end if;

  if target_user is not null and exists (select 1 from auth.users u where u.id = target_user) then
    raise exception 'user_still_exists';
  end if;

  return query
    select s.bucket, s.path
    from public.account_deletion_storage(target_orgs, target_user) s;
end;
$$;

revoke all on function public.admin_orphaned_account_storage(uuid[], uuid) from public, anon;
grant execute on function public.admin_orphaned_account_storage(uuid[], uuid) to authenticated;
