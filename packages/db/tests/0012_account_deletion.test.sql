begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ============================================================
-- Account deletion (0016). The unit is the person plus every workspace they
-- alone belong to; the history goes with it; files are listed for the
-- Storage API only once nothing alive can be pointed at. Refused in the
-- database for yourself, a superadmin, a support visit and a live provider
-- subscription. Plus a catalog tripwire: a new NO ACTION / RESTRICT reference
-- fails here until somebody decides what deletion does with it.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ac000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now()),
  ('ac000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'leaving@flyee.invalid', '', '{}', '{"display_name":"Leaving"}', now(), now()),
  ('ac000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'colleague@flyee.invalid', '', '{}', '{"display_name":"Colleague"}', now(), now());

update public.profiles set is_superadmin = true
where id in ('ac000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000003');

create temporary table ctx as
select (select org_id from public.memberships where user_id = 'ac000000-0000-4000-8000-000000000002') as org;
grant select on ctx to authenticated;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated;

-- Everything an account accumulates.
insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select (select org from ctx), 'kit', p.id, p.limits, 'asaas:kit_ac' from public.plans p where p.slug = 'kit';
insert into public.invoices (org_id, provider, provider_invoice_id, amount_cents, currency, status, paid_at)
values ((select org from ctx), 'asaas', 'kit_ac', 9700, 'BRL', 'paid', now());
insert into public.member_devices (org_id, user_id, device_id, token_family_id)
values ((select org from ctx), 'ac000000-0000-4000-8000-000000000002', 'laptop-ac01', 'cc000000-0000-4000-8000-0000000000f1');
insert into public.oauth_tokens (client_id, org_id, user_id, access_token_hash, scope, family_id, access_expires_at)
select c.id, (select org from ctx), 'ac000000-0000-4000-8000-000000000002', 'h-ac-1', 'catalog:read',
       'cc000000-0000-4000-8000-0000000000f1', now() + interval '1 hour'
from public.oauth_clients c where c.client_id = 'flyee-cli';
insert into public.consent_acceptances (term_id, org_id, user_id)
select t.id, (select org from ctx), 'ac000000-0000-4000-8000-000000000002'
from public.consent_terms t where t.slug = 'terms' and t.locale = 'pt-BR';
insert into public.roadmap_items (id, title) values ('bc000000-0000-4000-8000-000000000001', '{"pt-BR": "Ideia"}');
insert into public.roadmap_votes (item_id, user_id, org_id)
values ('bc000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000002', (select org from ctx));
insert into public.blog_posts (id, slug, title, is_published) values ('bc000000-0000-4000-8000-000000000002', 'post', 'Post', true);
insert into public.blog_comments (post_id, user_id, body)
values ('bc000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000002', 'Ótimo!');
insert into storage.objects (bucket_id, name) values ('avatars', 'ac000000-0000-4000-8000-000000000002/avatar.png');
insert into public.product_events (org_id, actor_id, event_name)
values ((select org from ctx), 'ac000000-0000-4000-8000-000000000002', 'tool.executed');

-- ---------- Refusals ----------

select set_config('request.jwt.claims', '{"sub":"ac000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.admin_account_deletion_preview('ac000000-0000-4000-8000-000000000003')$$,
  'P0001', 'not_authorized',
  'a member cannot even preview a deletion'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('preview', public.admin_account_deletion_preview('ac000000-0000-4000-8000-000000000002'));
select throws_ok(
  $$select public.admin_delete_account('ac000000-0000-4000-8000-000000000002', 'wrong@flyee.invalid', 'Account closed on request')$$,
  'P0001', 'confirmation_mismatch',
  'the typed e-mail is checked in the database, not only in the dialog'
);
select throws_ok(
  $$select public.admin_delete_account('ac000000-0000-4000-8000-000000000002', 'leaving@flyee.invalid', 'short')$$,
  'P0001', 'reason_required',
  'so is the reason'
);
select throws_ok(
  $$select public.admin_delete_account('ac000000-0000-4000-8000-000000000001', 'operator@flyee.invalid', 'Trying to delete myself')$$,
  'P0001', 'self_delete_forbidden',
  'an operator cannot delete their own account'
);
select throws_ok(
  $$select public.admin_delete_account('ac000000-0000-4000-8000-000000000003', 'colleague@flyee.invalid', 'Deleting another operator')$$,
  'P0001', 'target_is_superadmin',
  'nor another operator''s'
);
reset role;

select ok(
  (select jsonb_array_length(payload -> 'workspaces') = 1
          and jsonb_array_length(payload -> 'blockers') = 0
          and (payload -> 'counts' ->> 'devices')::int = 1
          and (payload -> 'counts' ->> 'files')::int = 1
   from res where name = 'preview'),
  'the preview names the workspace that goes with the person and counts what it holds'
);

update public.subscriptions set provider = 'asaas', provider_subscription_id = 'sub_live_ac'
where org_id = (select org from ctx) and status = 'active';
select set_config('request.jwt.claims', '{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.admin_delete_account('ac000000-0000-4000-8000-000000000002', 'leaving@flyee.invalid', 'Account closed on request')$$,
  'P0001', 'provider_subscription_live',
  'an account still being charged by a provider is not deleted until the charge is canceled'
);
reset role;
update public.subscriptions set provider = null, provider_subscription_id = null
where org_id = (select org from ctx) and status = 'active';

-- ---------- The deletion ----------

select set_config('request.jwt.claims', '{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('delete', public.admin_delete_account('ac000000-0000-4000-8000-000000000002', 'Leaving@Flyee.invalid', 'Account closed on request'));
reset role;

select ok(
  not exists (select 1 from public.organizations where id = (select org from ctx))
  and not exists (select 1 from auth.users where id = 'ac000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.profiles where id = 'ac000000-0000-4000-8000-000000000002'),
  'the person and the workspace are gone'
);
select ok(
  not exists (select 1 from public.entitlement_grants where org_id = (select org from ctx))
  and not exists (select 1 from public.member_devices where org_id = (select org from ctx))
  and not exists (select 1 from public.oauth_tokens where org_id = (select org from ctx))
  and not exists (select 1 from public.consent_acceptances where org_id = (select org from ctx))
  and not exists (select 1 from public.roadmap_votes where user_id = 'ac000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.blog_comments where user_id = 'ac000000-0000-4000-8000-000000000002'),
  'with everything the account held'
);
select is(
  (select count(*)::int from public.record_versions where org_id = (select org from ctx)),
  0,
  'including the change history the cascade just wrote'
);
select ok(
  (select actor_id is null and org_id is null from public.product_events where event_name = 'tool.executed'),
  'usage events survive detached from the person and the workspace'
);
select ok(
  (select metadata ? 'email_sha256' and not (metadata ? 'email') and not (metadata ? 'display_name')
   from public.audit_events where action = 'admin.account.deleted'),
  'the permanent audit event keeps a hash of the address, never the address or the name'
);

select set_config('request.jwt.claims', '{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(path) from public.admin_orphaned_account_storage(array[(select org from ctx)], 'ac000000-0000-4000-8000-000000000002')),
  array['ac000000-0000-4000-8000-000000000002/avatar.png'],
  'the files left behind are listed for the Storage API'
);
select throws_ok(
  $$select * from public.admin_orphaned_account_storage(array[(select org_id from public.memberships where user_id = 'ac000000-0000-4000-8000-000000000003')], null)$$,
  'P0001', 'workspace_still_exists',
  'and the listing refuses to point at a workspace that is alive'
);
reset role;

-- ---------- Tripwire ----------

select is(
  (
    select coalesce(array_agg(c.conrelid::regclass::text || '.' || a.attname
                              order by c.conrelid::regclass::text || '.' || a.attname), '{}')
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and n.nspname = 'public'
      and c.confdeltype in ('a', 'r')
  ),
  array[
    'catalog_modules.trail',
    'consent_acceptances.term_id',
    'impersonation_sessions.actor_id',
    'leads.consent_term_id',
    'roadmap_items.trail',
    'subscription_modules.module_id',
    'subscriptions.plan_id'
  ],
  'every NO ACTION / RESTRICT reference is a known one: a new one must be handled by the deletion first'
);

select * from finish();
rollback;
