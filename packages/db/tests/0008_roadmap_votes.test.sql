begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ============================================================
-- Roadmap votes (0009). Voting is a subscription benefit, one vote per member
-- per open item, withdrawable, and the counter is always the number of rows.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('a8000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'club@flyee.invalid', '', '{}', '{"display_name":"Club"}', now(), now());

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_a8'
from public.memberships m, public.plans p
where m.user_id = 'a8000000-0000-4000-8000-000000000001' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id = 'a8000000-0000-4000-8000-000000000002' and s.org_id = m.org_id and s.status = 'active';

insert into public.roadmap_items (id, title, trail, status)
values
  ('b8000000-0000-4000-8000-000000000001', '{"pt-BR": "Guarda de custos de API"}', 'manter', 'proposed'),
  ('b8000000-0000-4000-8000-000000000002', '{"pt-BR": "Já entregue"}', 'construir', 'shipped');

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated;

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('kit_vote', public.cast_roadmap_vote('b8000000-0000-4000-8000-000000000001'));
reset role;
select is((select payload ->> 'code' from res where name = 'kit_vote'), 'not_entitled', 'the kit does not include the vote');

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('vote_1', public.cast_roadmap_vote('b8000000-0000-4000-8000-000000000001'));
insert into res values ('vote_2', public.cast_roadmap_vote('b8000000-0000-4000-8000-000000000001'));
insert into res values ('shipped', public.cast_roadmap_vote('b8000000-0000-4000-8000-000000000002'));
select throws_ok(
  $$insert into public.roadmap_votes (item_id, user_id) values ('b8000000-0000-4000-8000-000000000002', auth.uid())$$,
  '42501', null,
  'there is no way to vote around the RPC'
);
select throws_ok(
  $$update public.roadmap_items set votes_count = 999 where id = 'b8000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'and nobody writes the counter'
);
reset role;

select ok(
  (select (payload ->> 'votes')::int = 1 and (payload ->> 'changed')::boolean from res where name = 'vote_1'),
  'a subscriber votes once and the counter moves'
);
select ok(
  (select (payload ->> 'votes')::int = 1 and not (payload ->> 'changed')::boolean from res where name = 'vote_2'),
  'voting again changes nothing'
);
select is((select payload ->> 'code' from res where name = 'shipped'), 'closed', 'a shipped idea is no longer a choice');
select is(
  (select count(*)::int from public.product_events where event_name = 'roadmap.voted'),
  1,
  'the vote is recorded once as usage'
);

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('withdraw', public.withdraw_roadmap_vote('b8000000-0000-4000-8000-000000000001'));
reset role;
select is(
  (select votes_count from public.roadmap_items where id = 'b8000000-0000-4000-8000-000000000001'),
  0,
  'withdrawing gives the vote back'
);

select * from finish();
rollback;
