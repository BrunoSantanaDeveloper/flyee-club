begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ============================================================
-- Roadmap proposals (0026). A FlyeeClub Pro member proposes an app into a
-- moderated queue that only the author and the operator see, under a ceiling
-- kept as data; the operator opens it for votes or declines it; the month's
-- leader is the open idea with the most votes cast in the month.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('ae000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kit-proposals@flyee.invalid', '', '{}', '{"display_name":"Kit"}', now(), now()),
  ('ae000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pro-proposals@flyee.invalid', '', '{}', '{"display_name":"Pro"}', now(), now()),
  ('ae000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pro-two-proposals@flyee.invalid', '', '{}', '{"display_name":"Pro two"}', now(), now()),
  ('ae000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-proposals@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'ae000000-0000-4000-8000-000000000004';

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select m.org_id, 'kit', p.id, p.limits, 'asaas:kit_ae'
from public.memberships m, public.plans p
where m.user_id = 'ae000000-0000-4000-8000-000000000001' and p.slug = 'kit';

update public.subscriptions s set plan_id = (select id from public.plans where slug = 'club-mensal')
from public.memberships m
where m.user_id in ('ae000000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000003')
  and s.org_id = m.org_id and s.status = 'active';

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to authenticated;

-- ---------- Who may propose ----------

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('kit', public.propose_roadmap_item('Gerador de propostas comerciais', 'Monta a proposta a partir do briefing.', 'vender', 'pt-BR'));
reset role;
select is((select payload ->> 'code' from res where name = 'kit'), 'not_entitled', 'FlyeeClub alone does not include proposing');

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
insert into res values ('short', public.propose_roadmap_item('Ge', null, null, 'pt-BR'));
insert into res values ('bad_trail', public.propose_roadmap_item('Gerador de propostas', null, 'nao-existe', 'pt-BR'));
insert into res values ('first', public.propose_roadmap_item('Gerador de propostas comerciais', 'Monta a proposta a partir do briefing.', 'vender', 'pt-BR'));
insert into res values ('second', public.propose_roadmap_item('Second idea in English', 'Written by an English member.', null, 'en'));
insert into res values ('third', public.propose_roadmap_item('Terceira ideia', null, 'manter', 'pt-BR'));
insert into res values ('fourth', public.propose_roadmap_item('Quarta ideia', null, null, 'pt-BR'));
reset role;

select is((select payload ->> 'code' from res where name = 'short'), 'invalid_title', 'a title needs at least four characters');
select is((select payload ->> 'code' from res where name = 'bad_trail'), 'invalid_trail', 'a trail must exist in the catalog');
select ok(
  (select (payload ->> 'ok')::boolean and (payload ->> 'open')::int = 1 and (payload ->> 'max')::int = 3 from res where name = 'first'),
  'a FlyeeClub Pro member proposes, and the answer counts what is under review against the ceiling'
);
select is(
  (select status from public.roadmap_items where id = ((select payload from res where name = 'first') ->> 'id')::uuid),
  'submitted',
  'the proposal waits for review'
);
select is(
  (select title from public.roadmap_items where id = ((select payload from res where name = 'second') ->> 'id')::uuid),
  '{"en": "Second idea in English", "pt-BR": "Second idea in English"}'::jsonb,
  'written in English, the text is stored under both keys until the operator translates it'
);
select is((select payload ->> 'code' from res where name = 'fourth'), 'too_many_open', 'the fourth proposal waits for the ceiling of three under review');
select is(
  (select count(*)::int from public.product_events where event_name = 'roadmap.proposed'),
  3,
  'each accepted proposal is recorded once as usage'
);

-- ---------- Who sees the queue ----------

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.roadmap_items where status = 'submitted'),
  0,
  'another member does not see what is under review'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.roadmap_items where status = 'submitted'),
  3,
  'the author sees their own proposals under review'
);
reset role;

-- ---------- The operator opens it for votes ----------

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
update public.roadmap_items set status = 'proposed'
where id = ((select payload from res where name = 'first') ->> 'id')::uuid;
update public.roadmap_items set status = 'declined'
where id = ((select payload from res where name = 'third') ->> 'id')::uuid;
reset role;

select set_config('request.jwt.claims', '{"sub":"ae000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.roadmap_items where proposed_by = 'ae000000-0000-4000-8000-000000000002'),
  2,
  'once reviewed, the idea is public (declined included), and what is still under review stays private'
);
insert into res values ('vote', public.cast_roadmap_vote(((select payload from res where name = 'first') ->> 'id')::uuid));
reset role;

-- ---------- The most voted of the month ----------

select is(
  (public.roadmap_month_leader() ->> 'item_id')::uuid,
  ((select payload from res where name = 'first') ->> 'id')::uuid,
  'the open idea with the most votes cast this month leads'
);
select is((public.roadmap_month_leader() ->> 'votes_in_month')::int, 1, 'with the votes of the month, not of all time');
select is(
  public.roadmap_month_leader((current_date - interval '1 month')::date),
  null,
  'a month nobody voted in has no leader'
);

-- ---------- The custom app as an offer ----------

select is(
  public.product_event_sanitize('upsell.clicked', '{"offer":"custom_app","origin":"home"}') ->> 'offer',
  'custom_app',
  'the custom app card counts like the other offers'
);

select * from finish();
rollback;
