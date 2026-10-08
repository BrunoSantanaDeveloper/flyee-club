begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ============================================================
-- The tool's name beside `other` (0036). The CLI names the tool of the
-- "compatible by the standard" tier it found; the device keeps the name only
-- when the machine reports `other` and the operator lists the name. Anything
-- else is dropped, and the registration never fails because of it.
-- ============================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'member-tools@flyee.invalid', '', '{}', '{"display_name":"Member"}', now(), now());

create temporary table ctx as
select (select org_id from public.memberships where user_id = 'a8000000-0000-4000-8000-000000000001') as org;
grant select on ctx to service_role;

create temporary table res (name text primary key, payload jsonb);
grant select, insert on res to service_role;

insert into public.entitlement_grants (org_id, kind, plan_id, limits, invoice_key)
select (select org from ctx), 'kit', p.id, p.limits, 'asaas:kit_a8' from public.plans p where p.slug = 'kit';

-- ---------- The shape ----------

select has_column('public', 'member_devices', 'ai_tool_detail', 'a device carries the name of the tool beside other');

select is(
  (select value -> 'known_tools' from public.platform_settings where key = 'cli'),
  '["copilot", "opencode", "antigravity", "kimi", "windsurf", "aider"]'::jsonb,
  'the six tools of the core''s "compatible by the standard" tier are known to start'
);

select hasnt_function(
  'public', 'register_member_device',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'jsonb', 'text', 'boolean'],
  'the registration without the name is gone, so the API cannot reach a function that drops it'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.register_member_device(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, boolean, text)',
    'execute'
  ),
  'only the delivery API registers a machine, as before'
);

-- ---------- What is kept ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('copilot', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => 'copilot'));
reset role;
select ok(
  (select payload ->> 'code' = 'created' from res where name = 'copilot')
  and (select ai_tool = 'other' and ai_tool_detail = 'copilot' from public.member_devices where device_id = 'tools-0001'),
  'a machine where only GitHub Copilot is found keeps the name beside other'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('windsurf', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => ' Windsurf '));
reset role;
select is(
  (select ai_tool_detail from public.member_devices where device_id = 'tools-0001'),
  'windsurf',
  'the name is read without its case and its spaces, and a new report replaces the old name'
);

-- ---------- What is dropped, never refused ----------

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('unlisted', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => 'zed'));
reset role;
select ok(
  (select payload ->> 'code' = 'updated' from res where name = 'unlisted')
  and (select ai_tool_detail is null from public.member_devices where device_id = 'tools-0001'),
  'a name the operator does not list is dropped, and the machine is still registered'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('malformed', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => 'Copilot; drop table x'));
reset role;
select ok(
  (select payload ->> 'code' = 'updated' from res where name = 'malformed')
  and (select ai_tool_detail is null from public.member_devices where device_id = 'tools-0001'),
  'a name that is not a short token is dropped too'
);

-- A report that names no AI tool keeps what the machine said before.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('copilot_again', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => 'copilot'));
insert into res values ('silent', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_cli_version => '1.0.1'));
reset role;
select ok(
  (select ai_tool = 'other' and ai_tool_detail = 'copilot' and cli_version = '1.0.1'
   from public.member_devices where device_id = 'tools-0001'),
  'a report that names no AI tool keeps the tool and its name'
);

-- The name belongs to `other` only.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('tested', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'claude_code', target_ai_tool_detail => 'copilot'));
reset role;
select ok(
  (select ai_tool = 'claude_code' and ai_tool_detail is null from public.member_devices where device_id = 'tools-0001'),
  'once a tested AI is found, the machine reports it and the name beside other is cleared'
);

-- ---------- The operator's list decides ----------

update public.platform_settings
set value = jsonb_set(value, '{known_tools}', (value -> 'known_tools') || '["zed"]'::jsonb)
where key = 'cli';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into res values ('listed', public.register_member_device(
  target_user => 'a8000000-0000-4000-8000-000000000001', target_org => (select org from ctx),
  target_device_id => 'tools-0001', target_ai_tool => 'other', target_ai_tool_detail => 'zed'));
reset role;
select is(
  (select ai_tool_detail from public.member_devices where device_id = 'tools-0001'),
  'zed',
  'a tool the operator adds to the list is kept from the next report on'
);

select throws_ok(
  $$update public.member_devices set ai_tool_detail = 'Zed Editor' where device_id = 'tools-0001'$$,
  '23514', null,
  'the column itself refuses a name that is not a short token'
);

select * from finish();
rollback;
