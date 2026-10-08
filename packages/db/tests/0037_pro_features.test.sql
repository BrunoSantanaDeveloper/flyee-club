begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ============================================================
-- What sells FlyeeClub Pro (0039): the offer events of the upgrade prompt
-- keep the feature that was clicked and the screen it opened on, and
-- admin_pro_features() reads them back per feature for the operators. A
-- purchase counts for a feature when a click on it came at most 14 days
-- before; a workspace counts once per column. The recipe page learns whether a
-- step by step exists without reading it.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'buyer@flyee.invalid', '', '{}', '{"display_name":"Buyer"}', now(), now()),
  ('c9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'looker@flyee.invalid', '', '{}', '{"display_name":"Looker"}', now(), now()),
  ('c9000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'operator-pro@flyee.invalid', '', '{}', '{"display_name":"Operator"}', now(), now());

update public.profiles set is_superadmin = true where id = 'c9000000-0000-4000-8000-000000000003';

create temporary table ctx as
select
  (select org_id from public.memberships where user_id = 'c9000000-0000-4000-8000-000000000001') as buyer,
  (select org_id from public.memberships where user_id = 'c9000000-0000-4000-8000-000000000002') as looker;
grant select on ctx to authenticated;

-- ---------- The allowlist ----------

select is(
  public.product_event_sanitize(
    'upsell.clicked',
    '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb
  ),
  '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb,
  'an offer event keeps the feature clicked and the screen it opened on'
);

select is(
  public.product_event_sanitize(
    'upsell.viewed',
    '{"offer": "club", "origin": "settings", "feature": "everything"}'::jsonb
  ),
  '{"offer": "club"}'::jsonb,
  'a feature or a screen outside the lists is dropped'
);

-- ---------- The report ----------

-- The buyer saw and clicked "vote" four days ago and bought FlyeeClub Pro
-- yesterday; the looker saw "vote" and clicked "install the recipe" twenty
-- days before a purchase, too long before it to count.
insert into public.product_events (org_id, event_name, properties, occurred_at)
select (select buyer from ctx), 'upsell.viewed', '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb, now() - interval '4 days'
union all
select (select buyer from ctx), 'upsell.viewed', '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb, now() - interval '3 days'
union all
select (select buyer from ctx), 'upsell.clicked', '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb, now() - interval '4 days'
union all
select (select buyer from ctx), 'upsell.purchased', '{"offer": "club"}'::jsonb, now() - interval '1 day'
union all
select (select looker from ctx), 'upsell.viewed', '{"offer": "club", "origin": "roadmap", "feature": "roadmap_vote"}'::jsonb, now() - interval '30 days'
union all
select (select looker from ctx), 'upsell.clicked', '{"offer": "club", "origin": "recipes", "feature": "recipe_install"}'::jsonb, now() - interval '30 days'
union all
select (select looker from ctx), 'upsell.purchased', '{"offer": "club"}'::jsonb, now() - interval '10 days'
union all
select (select looker from ctx), 'upsell.clicked', '{"offer": "kit", "origin": "recipes", "feature": "recipe_install"}'::jsonb, now() - interval '12 days';

create temporary table report as
select * from public.admin_pro_features(90) where false;
grant select, insert on report to authenticated;

select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
insert into report select * from public.admin_pro_features(90);
reset role;

select is(
  (select array_agg(feature order by feature) from report),
  array['advanced_guide', 'meeting_register', 'more_devices', 'recipe_install', 'recipe_workflow', 'roadmap_propose', 'roadmap_vote'],
  'one row per feature of FlyeeClub Pro, with nothing as zero'
);

select ok(
  (select viewed = 2 and clicked = 1 and purchased = 1 from report where feature = 'roadmap_vote'),
  '"vote": two workspaces saw it, each once, one clicked, and that one bought within 14 days'
);

select ok(
  (select viewed = 0 and clicked = 1 and purchased = 0 from report where feature = 'recipe_install'),
  'a click twenty days before a purchase sells nothing, and a click on the FlyeeClub offer is not one on Pro'
);

select ok(
  (select viewed = 0 and clicked = 0 and purchased = 0 from report where feature = 'meeting_register'),
  'a feature nobody clicked reads zero'
);

select is(
  (select purchased from public.admin_pro_features(2) where feature = 'roadmap_vote'),
  0::bigint,
  'the window is honoured: two days back, the click of four days ago is out'
);

select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_pro_features(90)$$,
  '42501', null,
  'a member cannot read the report'
);
reset role;

-- ---------- Whether a recipe has its step by step ----------

insert into public.catalog_recipes (id, slug, name, status)
values
  ('c9000000-0000-4000-8000-000000000031', 'written-recipe', '{"pt-BR": "Com passo a passo"}', 'published'),
  ('c9000000-0000-4000-8000-000000000032', 'blank-recipe', '{"pt-BR": "Sem passo a passo"}', 'published');
insert into public.catalog_recipe_workflows (recipe_id, body_md)
values
  ('c9000000-0000-4000-8000-000000000031', '{"pt-BR": "1. Rode a primeira ferramenta."}'),
  ('c9000000-0000-4000-8000-000000000032', '{"pt-BR": "  "}');

select set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  array[public.catalog_recipe_has_workflow('written-recipe'), public.catalog_recipe_has_workflow('blank-recipe')],
  array[true, false],
  'an account without recipes learns which recipe has its step by step written'
);
select is(
  (select count(*)::int from public.catalog_recipe_workflows),
  0,
  'and still reads none of them'
);
reset role;

select * from finish();
rollback;
