begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ============================================================
-- Messages and scheduled jobs (0023).
--
-- A message that must go out once is claimed in the statement that marks it
-- as sent, so a job that runs twice finds nothing left. Only the backend may
-- claim; the operator starts a send to the list, the backend delivers it.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ab000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member","locale":"en"}', now(), now()),
  ('ab000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'late@flyee.invalid', '', '{}', '{"display_name":"Late"}', now(), now()),
  ('ab000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'ab000000-0000-4000-8000-000000000003'::uuid;

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'ab000000-0000-4000-8000-000000000001'::uuid) as org,
  (select org_id from public.memberships where user_id = 'ab000000-0000-4000-8000-000000000002'::uuid) as late_org,
  (select id from public.oauth_clients where client_id = 'flyee-cli') as cli;
grant select on ctx to authenticated, service_role;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated, service_role;

-- ---------- CLI connection reminder ----------

insert into public.member_devices (org_id, user_id, device_id, name)
select org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'laptop-0001', 'notebook' from ctx;

insert into public.oauth_tokens (client_id, org_id, user_id, access_token_hash, refresh_token_hash, scope, family_id, device_id,
  access_expires_at, refresh_expires_at, revoked_at, created_at)
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-due', 'ref-due', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f1'::uuid, 'laptop-0001', now() + interval '1 hour', now() + interval '4 days', null::timestamptz, now() - interval '26 days' from ctx
union all
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-far', 'ref-far', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f2'::uuid, 'desktop-0002', now() + interval '1 hour', now() + interval '20 days', null, now() - interval '10 days' from ctx
union all
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-revoked', 'ref-revoked', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f3'::uuid, 'old-0003', now() + interval '1 hour', now() + interval '2 days', now(), now() - interval '28 days' from ctx
union all
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-lapsed', 'ref-lapsed', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f4'::uuid, 'gone-0004', now() - interval '3 days', now() - interval '1 day', null, now() - interval '31 days' from ctx;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.claim_token_reminders()$$,
  '42501', null,
  'a member cannot claim reminders'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res
select 'reminders', coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.claim_token_reminders() r;
insert into res
select 'reminders_again', coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.claim_token_reminders() r;
reset role;

select is(
  (select jsonb_array_length(payload) from res where name = 'reminders'), 1,
  'only the live connection that expires inside the window is claimed (not the far one, the revoked one or the lapsed one)'
);
select is(
  (select payload -> 0 ->> 'device_name' from res where name = 'reminders'), 'notebook',
  'the reminder carries the name the member gave the machine'
);
select is(
  (select jsonb_array_length(payload) from res where name = 'reminders_again'), 0,
  'a second run finds nothing: the reminder goes out once per connection'
);

-- ---------- Retention of sign-in leftovers ----------

insert into public.oauth_device_codes (client_id, device_code_hash, user_code, scope, expires_at)
select cli, 'old-code', 'ABCDEFGH', 'profile:read', now() - interval '3 days' from ctx
union all
select cli, 'fresh-code', 'JKLMNPQR', 'profile:read', now() + interval '5 minutes' from ctx;

insert into public.oauth_grants (client_id, org_id, user_id, code_hash, code_challenge, redirect_uri, scope, expires_at)
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'old-grant', 'c', 'http://127.0.0.1:1/callback', 'profile:read', now() - interval '2 days' from ctx;

-- Two rows of one machine, both long dead: only the older one may go.
insert into public.oauth_tokens (client_id, org_id, user_id, access_token_hash, refresh_token_hash, scope, family_id, device_id,
  access_expires_at, refresh_expires_at, revoked_at, created_at)
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-stale-1', 'ref-stale-1', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f5'::uuid, 'attic-0005', now() - interval '200 days', now() - interval '170 days', now() - interval '180 days', now() - interval '200 days' from ctx
union all
select cli, org, 'ab000000-0000-4000-8000-000000000001'::uuid, 'acc-stale-2', 'ref-stale-2', 'profile:read',
       'cb000000-0000-4000-8000-0000000000f5'::uuid, 'attic-0005', now() - interval '180 days', now() - interval '150 days', null, now() - interval '180 days' from ctx;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('purge', public.purge_oauth_leftovers());
reset role;

select is(
  (select (payload ->> 'device_codes')::int from res where name = 'purge'), 1,
  'an expired device code is removed and a pending one stays'
);
select is((select (payload ->> 'grants')::int from res where name = 'purge'), 1, 'an expired authorization code is removed');
select ok(
  (select count(*)::int from public.oauth_tokens where access_token_hash = 'acc-stale-1') = 0
  and (select count(*)::int from public.oauth_tokens where access_token_hash = 'acc-stale-2') = 1,
  'old token rows go, but the newest row of each machine stays (it tells a login from a revalidation)'
);
select is(
  (select count(*)::int from public.oauth_tokens where access_token_hash in ('acc-due', 'acc-far')), 2,
  'live connections are never touched'
);

-- ---------- End of a paid period that does not renew ----------

update public.subscriptions
set plan_id = (select id from public.plans where slug = 'club-anual'), status = 'active', renews = false,
    current_period_start = now() - interval '355 days', current_period_end = now() + interval '10 days'
where org_id = (select org from ctx);

update public.subscriptions
set plan_id = (select id from public.plans where slug = 'club-mensal'), status = 'active', renews = true,
    current_period_start = now() - interval '20 days', current_period_end = now() + interval '10 days'
where org_id = (select late_org from ctx);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res select 'terms', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.claim_term_end_notices() t;
insert into res select 'terms_again', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.claim_term_end_notices() t;
reset role;

select ok(
  (select jsonb_array_length(payload) from res where name = 'terms') = 1
  and (select payload -> 0 ->> 'org_id' from res where name = 'terms') = (select org::text from ctx),
  'only the period that does not renew is announced, never a subscription that renews by itself'
);
select is((select jsonb_array_length(payload) from res where name = 'terms_again'), 0, 'the notice goes out once per period');

update public.subscriptions set current_period_end = now() + interval '370 days' where org_id = (select org from ctx);
select is(
  (select term_notice_sent_at from public.subscriptions where org_id = (select org from ctx)), null,
  'a new period clears the mark, so the next ending is announced too'
);

-- ---------- Meeting e-mails ----------

insert into public.meetings (id, slug, title, starts_at, duration_minutes, provider, state)
values ('bb000000-0000-4000-8000-000000000001'::uuid, 'sessao-de-hoje', '{"pt-BR": "Sessão de hoje", "en": "Today''s session"}', now() + interval '40 minutes', 60, 'zoom', 'rascunho');
update public.meetings set state = 'inscricoes' where id = 'bb000000-0000-4000-8000-000000000001'::uuid;

insert into public.meeting_registrations (meeting_id, user_id, org_id, created_at)
select 'bb000000-0000-4000-8000-000000000001'::uuid, 'ab000000-0000-4000-8000-000000000001'::uuid, org, now() - interval '3 days' from ctx
union all
select 'bb000000-0000-4000-8000-000000000001'::uuid, 'ab000000-0000-4000-8000-000000000002'::uuid, late_org, now() - interval '10 minutes' from ctx;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res select 'due', coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.due_meeting_emails() d;
insert into res
select 'hour', coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
from public.claim_meeting_emails('bb000000-0000-4000-8000-000000000001'::uuid, 'hour') c;
insert into res
select 'hour_again', coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
from public.claim_meeting_emails('bb000000-0000-4000-8000-000000000001'::uuid, 'hour') c;
insert into res
select 'confirm_one', coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
from public.claim_meeting_emails('bb000000-0000-4000-8000-000000000001'::uuid, 'confirmation', 'ab000000-0000-4000-8000-000000000002'::uuid) c;
insert into res select 'due_after', coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.due_meeting_emails() d;
reset role;

select is(
  (select payload from res where name = 'due'),
  '[{"kind": "hour", "meeting_id": "bb000000-0000-4000-8000-000000000001"}]'::jsonb,
  'a session starting within the hour is due for its hour reminder only'
);
select ok(
  (select jsonb_array_length(payload) from res where name = 'hour') = 1
  and (select payload -> 0 ->> 'email' from res where name = 'hour') = 'member@flyee.invalid'
  and (select payload -> 0 ->> 'locale' from res where name = 'hour') = 'en',
  'the reminder goes to whoever registered ahead, with the address and the language they read'
);
select is(
  (select jsonb_array_length(payload) from res where name = 'hour_again'), 0,
  'someone who registered minutes ago is not reminded, and nobody is reminded twice'
);
select ok(
  (select jsonb_array_length(payload) from res where name = 'confirm_one') = 1
  and (select payload -> 0 ->> 'email' from res where name = 'confirm_one') = 'late@flyee.invalid'
  and (select confirmation_sent_at from public.meeting_registrations
       where meeting_id = 'bb000000-0000-4000-8000-000000000001'::uuid and user_id = 'ab000000-0000-4000-8000-000000000001'::uuid) is null,
  'a confirmation is claimed for the one person who just registered'
);
select is((select payload from res where name = 'due_after'), '[]'::jsonb, 'once claimed, the session is no longer due');

insert into public.meeting_links (meeting_id, recording_url) values ('bb000000-0000-4000-8000-000000000001'::uuid, 'https://video.invalid/r/1');
update public.meetings set state = 'ao_vivo' where id = 'bb000000-0000-4000-8000-000000000001'::uuid;
update public.meetings set state = 'encerrado' where id = 'bb000000-0000-4000-8000-000000000001'::uuid;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res select 'due_recording', coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.due_meeting_emails() d;
reset role;
select is(
  (select payload -> 0 ->> 'kind' from res where name = 'due_recording'), 'recording',
  'an ended session with a recording is due for the recording notice'
);

-- ---------- Messages to the confirmed list ----------

insert into public.leads (email, locale, source, confirmed_at, opted_out_at)
values
  ('pt-reader@flyee.invalid', 'pt-BR', 'waitlist', now(), null),
  ('en-reader@flyee.invalid', 'en', 'waitlist', now(), null),
  ('gone@flyee.invalid', 'pt-BR', 'waitlist', now(), now()),
  ('pending@flyee.invalid', 'pt-BR', 'waitlist', null, null);

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.create_newsletter_send('{"pt-BR": "Abrimos"}', '{"pt-BR": "A loja abriu."}')$$,
  '42501', null,
  'a member cannot write to the list'
);
select is((select count(*)::int from public.newsletter_sends), 0, 'nor read what was sent to it');
reset role;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.create_newsletter_send('{"pt-BR": "Abrimos", "en": "We are open"}', '{"pt-BR": "A loja abriu."}')$$,
  '22023', null,
  'a language with a subject and no text is refused'
);
insert into res
select 'audience', coalesce(jsonb_object_agg(a.locale, a.readers), '{}'::jsonb)
from public.newsletter_audience(array['pt-BR', 'en']) a;
insert into res values ('send', to_jsonb(public.create_newsletter_send('{"pt-BR": "Abrimos"}', '{"pt-BR": "A loja abriu."}')));
reset role;

select is(
  (select payload from res where name = 'audience'), '{"pt-BR": 1, "en": 1}'::jsonb,
  'the audience counts confirmed readers who have not left, per language'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res
select 'batch', coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
from public.claim_newsletter_batch((select (payload #>> '{}')::uuid from res where name = 'send')) b;
insert into res
select 'batch_again', coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
from public.claim_newsletter_batch((select (payload #>> '{}')::uuid from res where name = 'send')) b;
select public.settle_newsletter_batch(
  (select (payload #>> '{}')::uuid from res where name = 'send'),
  array(select (entry ->> 'lead_id')::uuid from res, jsonb_array_elements(payload) entry where name = 'batch'),
  true
);
select public.finish_newsletter_send((select (payload #>> '{}')::uuid from res where name = 'send'));
reset role;

select ok(
  (select jsonb_array_length(payload) from res where name = 'batch') = 1
  and (select payload -> 0 ->> 'email' from res where name = 'batch') = 'pt-reader@flyee.invalid'
  and (select payload -> 0 ->> 'subject' from res where name = 'batch') = 'Abrimos',
  'a send written in one language reaches only readers of that language, confirmed and still on the list'
);
select is((select jsonb_array_length(payload) from res where name = 'batch_again'), 0, 'a reader is claimed once per send');
select ok(
  (select status = 'sent' and delivered = 1 and finished_at is not null from public.newsletter_sends limit 1),
  'the send is closed with the number delivered'
);

-- ---------- Who a message is written to ----------

update auth.users set banned_until = now() + interval '1 day' where id = 'ab000000-0000-4000-8000-000000000002'::uuid;
update public.profiles set marketing_email_opt_out = true where id = 'ab000000-0000-4000-8000-000000000001'::uuid;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.member_recipients(array['ab000000-0000-4000-8000-000000000001'::uuid])$$,
  '42501', null,
  'nobody with a session reads the addresses of other members, the operator included'
);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res
select 'recipients', coalesce(jsonb_agg(to_jsonb(r) order by r.email), '[]'::jsonb)
from public.member_recipients(array[
  'ab000000-0000-4000-8000-000000000001'::uuid,
  'ab000000-0000-4000-8000-000000000002'::uuid,
  'ab000000-0000-4000-8000-0000000000ff'::uuid
]) r;
reset role;

select is(
  (select jsonb_array_length(payload) from res where name = 'recipients'), 1,
  'a banned account and an unknown id are left out'
);
select ok(
  (select payload -> 0 ->> 'email' = 'member@flyee.invalid'
      and payload -> 0 ->> 'locale' = 'en'
      and (payload -> 0 ->> 'marketing_email_opt_out')::boolean
      and payload -> 0 ->> 'email_unsubscribe_token' is not null
   from res where name = 'recipients'),
  'a recipient carries the address, the language, the news preference and the unsubscribe token'
);

select * from finish();
rollback;
