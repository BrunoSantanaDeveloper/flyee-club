-- ============================================================
-- 0009_roadmap: what the club builds next, voted by members.
--
-- Voting is a subscription benefit (`roadmap_vote`). One vote per member per
-- item, withdrawable. The counter on the item is maintained by a trigger, so
-- the number shown is always the number of rows.
--
-- New in the baseline.
-- ============================================================

create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null check (public.i18n_ok(title, true)),
  description jsonb not null default '{}'::jsonb check (public.i18n_ok(description)),
  trail text references public.catalog_trails (slug) on update cascade,
  status text not null default 'proposed'
    check (status in ('proposed', 'planned', 'building', 'shipped', 'declined')),
  votes_count integer not null default 0 check (votes_count >= 0),
  -- Set when the idea became a module, so "shipped" links to something.
  shipped_module_id uuid references public.catalog_modules (id) on delete set null,
  sort integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roadmap_items_status_idx on public.roadmap_items (status, votes_count desc);

alter table public.roadmap_items enable row level security;

create policy "roadmap_items_select_member" on public.roadmap_items
  for select to authenticated
  using (true);

create policy "roadmap_items_all_superadmin" on public.roadmap_items
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- `votes_count` is not in the update grant: only the trigger moves it.
grant select, insert, delete on table public.roadmap_items to authenticated;
grant update (title, description, trail, status, shipped_module_id, sort) on table public.roadmap_items to authenticated;

create trigger roadmap_items_updated_at
  before update on public.roadmap_items
  for each row execute function public.set_updated_at();

create table public.roadmap_votes (
  item_id uuid not null references public.roadmap_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index roadmap_votes_user_idx on public.roadmap_votes (user_id);
create index roadmap_votes_org_idx on public.roadmap_votes (org_id);

alter table public.roadmap_votes enable row level security;

create policy "roadmap_votes_select_own" on public.roadmap_votes
  for select to authenticated
  using (user_id = auth.uid());

create policy "roadmap_votes_select_superadmin" on public.roadmap_votes
  for select to authenticated
  using (public.is_superadmin());

-- Written only by cast_roadmap_vote / withdraw_roadmap_vote.
grant select on table public.roadmap_votes to authenticated;

create or replace function public.sync_roadmap_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.roadmap_items set votes_count = votes_count + 1 where id = new.item_id;
    return new;
  end if;
  update public.roadmap_items set votes_count = greatest(votes_count - 1, 0) where id = old.item_id;
  return old;
end;
$$;

revoke all on function public.sync_roadmap_votes_count() from public, anon;

create trigger roadmap_votes_count
  after insert or delete on public.roadmap_votes
  for each row execute function public.sync_roadmap_votes_count();

/**
 * One vote per member per item. Needs the `roadmap_vote` entitlement, and the
 * item must still be open (a shipped or declined idea is no longer a choice).
 * Voting twice is not an error: the second call changes nothing.
 */
create or replace function public.cast_roadmap_vote(target_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_org uuid;
  item public.roadmap_items%rowtype;
  inserted integer := 0;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  caller_org := public.current_org_id();
  if not public.org_has_entitlement(caller_org, 'roadmap_vote') then
    return jsonb_build_object('ok', false, 'code', 'not_entitled');
  end if;

  select * into item from public.roadmap_items where id = target_item;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if item.status not in ('proposed', 'planned', 'building') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  insert into public.roadmap_votes (item_id, user_id, org_id)
  values (target_item, caller, caller_org)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    perform public.product_event_insert(
      caller, caller_org, 'roadmap.voted',
      jsonb_build_object('trail', item.trail, 'platform', 'web'), null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'voted', true,
    'changed', inserted > 0,
    'votes', (select votes_count from public.roadmap_items where id = target_item)
  );
end;
$$;

revoke all on function public.cast_roadmap_vote(uuid) from public, anon;
grant execute on function public.cast_roadmap_vote(uuid) to authenticated;

-- Taking a vote back needs no entitlement: a member who left the subscription
-- may still withdraw what they voted for.
create or replace function public.withdraw_roadmap_vote(target_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  removed integer := 0;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_impersonated() then
    return jsonb_build_object('ok', false, 'code', 'support_session');
  end if;

  delete from public.roadmap_votes where item_id = target_item and user_id = caller;
  get diagnostics removed = row_count;

  return jsonb_build_object(
    'ok', true,
    'voted', false,
    'changed', removed > 0,
    'votes', (select votes_count from public.roadmap_items where id = target_item)
  );
end;
$$;

revoke all on function public.withdraw_roadmap_vote(uuid) from public, anon;
grant execute on function public.withdraw_roadmap_vote(uuid) to authenticated;
