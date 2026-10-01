begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ============================================================
-- Meetings (0014). The platform holds the invitation, the registrations and
-- the door: the external link is handed out only to a registered member with
-- the entitlement, from 15 minutes before the start, and that first click is
-- the attendance figure. The lifecycle (frozen slug, archive, guarded delete,
-- duplicate) is enforced in the database.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('aa000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('aa000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'club@flyee.invalid', '', '{}', '{"display_name":"Club","segment":"dev"}', now(), now()),
  ('aa000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'aa000000-0000-4000-8000-000000000003';

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_aa'
from public.memberships m, public.plans p
where m.user_id = 'aa000000-0000-4000-8000-000000000001' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'aa000000-0000-4000-8000-000000000002' and s.org_id = m.org_id and s.status = 'active';

insert into public.meetings (id, slug, title, starts_at, duration_minutes, provider)
values ('ba000000-0000-4000-8000-000000000001', 'encontro-outubro', '{"pt-BR": "Encontro de outubro"}', now() + interval '2 hours', 60, 'zoom');
insert into public.meeting_links (meeting_id, join_url)
values ('ba000000-0000-4000-8000-000000000001', 'https://zoom.invalid/j/123');

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated;

select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.meetings), 0, 'a draft meeting is invisible to members');
reset role;

update public.meetings set state = 'inscricoes' where id = 'ba000000-0000-4000-8000-000000000001';
select ok(
  (select published_at is not null from public.meetings where id = 'ba000000-0000-4000-8000-000000000001'),
  'opening registrations publishes the meeting'
);

select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('kit_register', public.register_for_meeting('ba000000-0000-4000-8000-000000000001'));
reset role;
select is((select payload ->> 'code' from res where name = 'kit_register'), 'not_entitled', 'meetings are part of the subscription, not the kit');

select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.meetings), 1, 'a published meeting is visible');
select is((select count(*)::int from public.meeting_links), 0, 'but never its link');
insert into res values ('register', public.register_for_meeting('ba000000-0000-4000-8000-000000000001'));
insert into res values ('early', public.meeting_join('ba000000-0000-4000-8000-000000000001'));
reset role;
select ok(
  (select (payload ->> 'registered')::boolean from res where name = 'register')
  and (select count(*)::int from public.product_events where event_name = 'meeting.registered') = 1,
  'a subscriber registers, and the registration is recorded'
);
select ok(
  (select payload ->> 'code' = 'too_early' from res where name = 'early'),
  'the door stays shut until 15 minutes before the start'
);

update public.meetings set starts_at = now() + interval '10 minutes' where id = 'ba000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('join', public.meeting_join('ba000000-0000-4000-8000-000000000001'));
insert into res values ('join_again', public.meeting_join('ba000000-0000-4000-8000-000000000001'));
reset role;
select ok(
  (select payload ->> 'url' = 'https://zoom.invalid/j/123' from res where name = 'join')
  and (select joined_at is not null from public.meeting_registrations),
  'then the registered member gets the link, and the click is stamped'
);
select is(
  (select count(*)::int from public.product_events where event_name = 'meeting.attended'),
  1,
  'opening the door twice is still one attendance'
);

insert into public.impersonation_sessions (actor_id, target_user_id, reason, session_id, expires_at)
values ('aa000000-0000-4000-8000-000000000003', 'aa000000-0000-4000-8000-000000000002',
        'Checking the meeting room', 'fa000000-0000-4000-8000-000000000001', now() + interval '30 minutes');
select set_config('request.jwt.claims',
  '{"sub":"aa000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"fa000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select is(
  (public.meeting_join('ba000000-0000-4000-8000-000000000001') ->> 'code'),
  'support_session',
  'an operator inside the member''s session does not collect the link'
);
reset role;

-- ---------- Lifecycle ----------

select throws_ok(
  $$update public.meetings set slug = 'renamed' where id = 'ba000000-0000-4000-8000-000000000001'$$,
  '23514', 'meeting_slug_frozen',
  'a published meeting keeps its address'
);
select throws_ok(
  $$update public.meetings set state = 'arquivado' where id = 'ba000000-0000-4000-8000-000000000001'$$,
  '23514', 'meeting_archive_requires_end',
  'a meeting is archived only after it ends'
);

select set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('delete', public.delete_meeting('ba000000-0000-4000-8000-000000000001', null));
insert into res values ('results', public.meeting_results('ba000000-0000-4000-8000-000000000001'));
insert into res values ('copy', to_jsonb(public.duplicate_meeting('ba000000-0000-4000-8000-000000000001')));
reset role;
select is((select payload ->> 'code' from res where name = 'delete'), 'not_draft', 'a published meeting is never deleted');
select ok(
  (select (payload ->> 'registered')::int = 1 and (payload ->> 'joined')::int = 1
          and payload -> 'by_segment' -> 0 ->> 'segment' = 'dev'
   from res where name = 'results'),
  'the results count registrations and attendance, by segment, without naming anybody'
);
select ok(
  (select state = 'rascunho' and slug = 'encontro-outubro-copia' and starts_at is null
   from public.meetings where id = (select (payload #>> '{}')::uuid from res where name = 'copy'))
  and not exists (
    select 1 from public.meeting_registrations where meeting_id = (select (payload #>> '{}')::uuid from res where name = 'copy')
  ),
  'a duplicate copies the content, not the date, the link or the registrations'
);

select * from finish();
rollback;
