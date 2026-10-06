begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ============================================================
-- org_entitlements: the single answer to "what may this workspace use?"
-- (0004). Walks one workspace up the ladder and back down:
-- free -> kit (a grant) -> club (a subscription) -> a courtesy grant on top,
-- then suspension, the dunning grace window, a refund, and an unconfirmed PIX.
-- More sources never mean fewer rights, and the answer always names its tier
-- and its sources.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('a3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now()),
  ('a3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'stranger@flyee.invalid', '', '{}', '{"display_name":"Stranger"}', now(), now());

update public.profiles set is_superadmin = true where id = 'a3000000-0000-4000-8000-000000000002';

create temporary table ctx as
select (select org_id from public.memberships where user_id = 'a3000000-0000-4000-8000-000000000001') as org;
grant select on ctx to authenticated, service_role;

create temporary table snap (name text primary key, payload jsonb);
grant select, insert on snap to authenticated, service_role;

-- Reads the answer exactly as the screens do: as the member.
create function pg_temp.take(label text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  insert into snap values (label, public.org_entitlements((select org from ctx)));
end;
$$;

-- ---------- Free ----------

select pg_temp.take('free');
select ok(
  (select (payload ->> 'active')::boolean and payload ->> 'tier' is null
          and (payload -> 'limits' ->> 'catalog_access')::int = 0
   from snap where name = 'free'),
  'a new account is active on the free plan, with no tier and no catalog access'
);
select is(
  (select payload -> 'sources' -> 0 ->> 'type' from snap where name = 'free'),
  'free',
  'and says the free plan is where that comes from'
);

-- ---------- The kit: a grant from a paid invoice ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.grant_entitlement_on_invoice((select org from ctx), (select id from public.plans where slug = 'kit'), 'asaas', 'pay_kit_1', 9700, 'BRL');
reset role;

select pg_temp.take('kit');
select ok(
  (select payload ->> 'tier' = 'kit'
          and (payload -> 'limits' ->> 'catalog_access')::int = 1
          and (payload -> 'limits' ->> 'devices')::int = 1
          and (payload -> 'limits' ->> 'advanced_lessons')::int = 0
   from snap where name = 'kit'),
  'the kit unlocks the catalog on one device, without the subscription layer'
);
select ok(
  (select exists (select 1 from jsonb_array_elements(payload -> 'sources') s where s ->> 'kind' = 'kit')
   from snap where name = 'kit'),
  'and the kit grant is listed as a source'
);

-- ---------- The club: a subscription on top ----------

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.set_org_plan((select org from ctx), (select id from public.plans where slug = 'club-mensal'), 'beta');
reset role;

select pg_temp.take('club');
select ok(
  (select payload ->> 'tier' = 'club'
          and (payload -> 'limits' ->> 'devices')::int = 3
          and (payload -> 'limits' ->> 'advanced_lessons')::int = 1
          and (payload -> 'limits' ->> 'recipes')::int = 1
   from snap where name = 'club'),
  'the subscription adds its layer and raises the device ceiling'
);
select is(
  (select jsonb_array_length(payload -> 'sources') from snap where name = 'club'),
  2,
  'the answer lists both the kit and the subscription'
);
select is(
  public.entitlement_merge('{"devices": 3, "recipes": 1}', '{"devices": 1, "recipes": 0, "update_channel": "latest"}'),
  '{"devices": 3, "recipes": 1, "update_channel": "latest"}'::jsonb,
  'merging never lowers a number: whichever source merges last, the greater ceiling wins'
);

-- ---------- A courtesy grant on top (FlyeeClub Pro; the retired Pro is refused, test 0023) ----------

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into snap values ('comp', public.grant_entitlement((select org from ctx), (select id from public.plans where slug = 'club-anual'), 'partner', null));
reset role;

select pg_temp.take('comp_layer');
select ok(
  (select payload ->> 'tier' = 'club'
          and (payload -> 'limits' ->> 'open_the_hood')::int = 1
          and (payload -> 'limits' ->> 'commercial_license')::int = 1
          and exists (select 1 from jsonb_array_elements(payload -> 'sources') s where s ->> 'kind' = 'comp')
   from snap where name = 'comp_layer'),
  'a courtesy grant of FlyeeClub Pro is listed as a source and carries the depth layer and the commercial license'
);
select ok(
  exists (select 1 from public.audit_events where action = 'admin.org.entitlement_granted'),
  'and the courtesy is audited'
);

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.revoke_entitlement_grant(((select payload from snap where name = 'comp') ->> 'grantId')::uuid, 'Partnership ended');
reset role;

-- ---------- Suspension and dunning ----------

update public.subscriptions set admin_suspended = true
where org_id = (select org from ctx) and status = 'active';
select pg_temp.take('suspended');
select ok(
  (select not (payload ->> 'active')::boolean and (payload ->> 'suspended')::boolean from snap where name = 'suspended'),
  'a suspended workspace is not active, whatever it bought'
);

update public.subscriptions set admin_suspended = false, status = 'past_due', past_due_since = now() - interval '2 days'
where org_id = (select org from ctx) and status = 'active';
select pg_temp.take('grace');
select ok(
  (select (payload ->> 'active')::boolean and (payload ->> 'past_due_grace')::boolean and payload ->> 'tier' = 'club'
   from snap where name = 'grace'),
  'a failed charge keeps the subscription inside the configured grace window'
);

update public.subscriptions set past_due_since = now() - interval '30 days'
where org_id = (select org from ctx) and status = 'past_due';
select pg_temp.take('lapsed');
select ok(
  (select (payload ->> 'active')::boolean and payload ->> 'tier' = 'kit'
          and (payload -> 'limits' ->> 'devices')::int = 1
          and not (payload ->> 'past_due_grace')::boolean
   from snap where name = 'lapsed'),
  'past the window the subscription stops counting, and the kit still does'
);

-- ---------- A refund ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.revoke_grant_for_invoice('asaas', 'pay_kit_1', 'refund');
reset role;
select pg_temp.take('refunded');
select ok(
  (select payload ->> 'tier' is null and (payload -> 'limits' ->> 'catalog_access')::int = 0 from snap where name = 'refunded'),
  'a refunded kit stops granting access'
);

-- ---------- An unconfirmed PIX inside its window ----------

update public.subscriptions set status = 'canceled', canceled_at = now()
where org_id = (select org from ctx) and status = 'past_due';
insert into public.subscriptions (org_id, plan_id, status, provider, provider_subscription_id, period, provisional_until)
values ((select org from ctx), (select id from public.plans where slug = 'club-mensal'), 'incomplete', 'asaas', 'sub_pix_1', 'monthly',
        now() + interval '6 hours');
select pg_temp.take('provisional');
select ok(
  (select payload ->> 'tier' = 'club'
          and exists (select 1 from jsonb_array_elements(payload -> 'sources') s where s ->> 'type' = 'provisional')
   from snap where name = 'provisional'),
  'a PIX not yet confirmed releases the plan while its provisional window is open'
);

-- ---------- Who may ask ----------

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.org_entitlements((select org from ctx))$$,
  'P0001', 'not a member of this organization',
  'nobody reads another workspace''s entitlements'
);
select is(
  public.org_has_entitlement((select org from ctx), 'catalog_access'),
  false,
  'and the yes/no form answers false instead of raising, so it is safe inside a policy'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select ok(
  (public.org_entitlements((select org from ctx)) ->> 'active')::boolean,
  'the CLI delivery API, which has no session, asks with the service role'
);
reset role;

select * from finish();
rollback;
