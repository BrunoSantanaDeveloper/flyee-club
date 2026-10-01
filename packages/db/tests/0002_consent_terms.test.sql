begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ============================================================
-- Consent terms and acceptances (0001, 0018).
--
-- The legal pages render consent_terms, so the text a member accepted is the
-- text the site shows. A published text is immutable; a revision is a new
-- version. Acceptance happens only through accept_terms(): idempotent per
-- version, never during a support visit, never a direct insert.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now()),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'a2000000-0000-4000-8000-000000000002';

create temporary table results (name text primary key, payload jsonb);
grant select, insert on results to authenticated;

-- ---------- What the legal pages read ----------

select is(
  (select array_agg(slug order by slug) from public.current_consent_terms('en') where locale = 'en'),
  array['cli-connection', 'cookies', 'newsletter', 'privacy', 'terms'],
  'every term is published in English'
);
select is(
  (select count(*)::int from public.current_consent_terms('pt-BR') where locale = 'pt-BR'),
  5,
  'and in Portuguese'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select count(*)::int from public.consent_terms),
  10,
  'an anonymous visitor reads the texts in force, which is what the legal pages render'
);
reset role;

-- ---------- Publishing ----------

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.publish_consent_term('terms', 'pt-BR', 'Termos', 'Texto')$$,
  '42501', 'not_authorized',
  'a member cannot publish a legal text'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.publish_consent_term('terms', 'pt-BR', 'Termos de Uso', 'Texto revisado.');
select public.publish_consent_term('beta-program', 'pt-BR', 'Programa beta', 'Só em português.');
reset role;

select is(
  (select version from public.consent_terms where slug = 'terms' and locale = 'pt-BR' and is_active),
  2,
  'a revision is published as the next version'
);
select is(
  (select count(*)::int from public.consent_terms where slug = 'terms' and locale = 'pt-BR' and is_active),
  1,
  'and the previous version stops being the one in force'
);
select is(
  (select locale from public.current_consent_terms('en') where slug = 'beta-program'),
  'pt-BR',
  'a text with no English version falls back to Portuguese instead of disappearing'
);
select throws_ok(
  $$update public.consent_terms set body_md = 'silently changed' where slug = 'privacy' and locale = 'en'$$,
  '23514', 'consent_term_immutable',
  'a published text cannot be edited, not even by the database owner'
);

-- ---------- Accepting ----------

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into results values ('first', public.accept_terms(array['privacy', 'cookies'], 'en', '{"source":"signup","evil":"<script>"}'));
insert into results values ('second', public.accept_terms(array['privacy'], 'en'));
select throws_ok(
  $$insert into public.consent_acceptances (term_id, org_id, user_id)
    select id, public.current_org_id(), auth.uid() from public.consent_terms where slug = 'terms' limit 1$$,
  '42501', null,
  'there is no direct way to record an acceptance'
);
select throws_ok(
  $$select public.accept_terms(array['does-not-exist'], 'en')$$,
  '22023', 'unknown_term',
  'accepting a term that does not exist is refused'
);
reset role;

select is(
  (select count(*)::int from public.consent_acceptances where user_id = 'a2000000-0000-4000-8000-000000000001'),
  2,
  'accepting records one row per term'
);
select ok(
  (select bool_and((entry ->> 'already')::boolean) from results, jsonb_array_elements(payload) as entry where name = 'second'),
  'accepting the same version again changes nothing and says so'
);
select is(
  (select metadata from public.consent_acceptances a join public.consent_terms t on t.id = a.term_id
   where a.user_id = 'a2000000-0000-4000-8000-000000000001' and t.slug = 'privacy'),
  '{"source": "signup"}'::jsonb,
  'only allowlisted context is stored with the acceptance'
);

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.accept_terms(array['terms'], 'pt-BR');
reset role;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.publish_consent_term('terms', 'pt-BR', 'Termos de Uso', 'Terceira versão.');
reset role;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.accept_terms(array['terms'], 'pt-BR');
reset role;

select is(
  (select array_agg(t.version order by t.version) from public.consent_acceptances a
   join public.consent_terms t on t.id = a.term_id
   where a.user_id = 'a2000000-0000-4000-8000-000000000001' and t.slug = 'terms'),
  array[2, 3],
  'a new version is a new acceptance, and the old one stays as history'
);

select throws_ok(
  $$update public.consent_acceptances set metadata = '{}'::jsonb
    where user_id = 'a2000000-0000-4000-8000-000000000001'$$,
  '23514', 'consent_history_immutable',
  'an acceptance cannot be rewritten; it can only be revoked'
);

-- ---------- Never during a support visit ----------

insert into public.impersonation_sessions (actor_id, target_user_id, reason, session_id, expires_at)
values ('a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
        'Investigating a reported problem', 'f2000000-0000-4000-8000-000000000001', now() + interval '30 minutes');

select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select throws_ok(
  $$select public.accept_terms(array['newsletter'], 'pt-BR')$$,
  '42501', 'support_session_cannot_consent',
  'an operator inside the member''s session cannot consent in the member''s name'
);
reset role;

select * from finish();
rollback;
