-- ============================================================
-- The commercial rules of the home brief (2026-10-06):
--
--   1. the one-time access is valid for a TERM (12 months), not forever, and
--      does not renew by itself: the member buys it again, and the new term
--      starts when the current one ends;
--   2. the access may be paid in card installments (the checkout's rule);
--   3. every paid plan may be used in client projects: the commercial license
--      is no longer what sets Pro apart;
--   4. a refund is asked through support (unchanged).
--
-- Version 2 of the terms of use says the same, in both languages. A published
-- text never changes (guard_consent_term_text, migration 0001): version 1 is
-- switched off and version 2 is published.
-- ============================================================

-- ---------- The term of a one-time access ----------

alter table public.plans add column access_months integer;

alter table public.plans add constraint plans_access_months_check
  check (access_months is null or access_months > 0);
-- A recurring plan has a period; only an access purchase has a term.
alter table public.plans add constraint plans_access_months_kind
  check (kind = 'access' or access_months is null);

comment on column public.plans.access_months is
  'How long a one-time access lasts, in months from the paid invoice; null means it never ends. Only for kind = access.';

update public.plans set access_months = 12 where kind = 'access';

-- ---------- Client projects on every paid plan ----------

update public.plans
set limits = limits || '{"commercial_license": 1}'::jsonb
where not is_free and not is_addon;

-- ---------- What a grant records about its end ----------

alter table public.entitlement_grants add column end_notice_sent_at timestamptz;
alter table public.entitlement_grants add column ended_handled_at timestamptz;

comment on column public.entitlement_grants.end_notice_sent_at is
  'When the "your access ends on" notice went out for this grant.';
comment on column public.entitlement_grants.ended_handled_at is
  'When the end of this grant was settled: the member told, the CLI tokens revoked if nothing else kept the access.';

-- ---------- Granting with a term, and renewing by buying again ----------

-- A paid access with a term starts when the member's current access ENDS, so
-- renewing early never throws away the days already paid for. Without a term
-- (access_months null) the grant has no end date, as before.
create or replace function public.grant_entitlement_on_invoice(
  target_org uuid,
  target_plan uuid,
  target_provider text,
  target_provider_invoice_id text,
  target_price_cents integer default null,
  target_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.plans%rowtype;
  grant_row public.entitlement_grants%rowtype;
  key text;
  grant_kind text;
  starts timestamptz := now();
  ends timestamptz := null;
begin
  if auth.role() is distinct from 'service_role'
     or target_org is null
     or target_plan is null
     or target_provider not in ('stripe', 'asaas')
     or nullif(btrim(target_provider_invoice_id), '') is null then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  select * into plan_row from public.plans where id = target_plan;
  if not found or plan_row.kind <> 'access' then
    return jsonb_build_object('ok', false, 'code', 'not_an_access_plan');
  end if;
  if not exists (select 1 from public.organizations where id = target_org) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  key := target_provider || ':' || btrim(target_provider_invoice_id);
  grant_kind := case when plan_row.tier = 'kit' then 'kit' else 'license' end;

  if plan_row.access_months is not null then
    -- Chained after the latest access of the same kind that is still to end.
    select greatest(now(), max(g.expires_at)) into starts
    from public.entitlement_grants g
    where g.org_id = target_org
      and g.kind = grant_kind
      and g.revoked_at is null
      and g.expires_at is not null
      and g.expires_at > now();
    starts := coalesce(starts, now());
    ends := starts + make_interval(months => plan_row.access_months);
  end if;

  insert into public.entitlement_grants (
    org_id, kind, plan_id, limits, price_cents, currency, invoice_key, source, starts_at, expires_at
  ) values (
    target_org,
    grant_kind,
    plan_row.id,
    plan_row.limits,
    coalesce(target_price_cents, plan_row.price_cents),
    coalesce(nullif(btrim(target_currency), ''), plan_row.currency),
    key,
    'purchase',
    starts,
    ends
  )
  on conflict (invoice_key) do nothing
  returning * into grant_row;

  if grant_row.id is null then
    select * into grant_row from public.entitlement_grants where invoice_key = key;
    return jsonb_build_object(
      'ok', true,
      'code', case when grant_row.revoked_at is null then 'already_granted' else 'revoked' end,
      'grantId', grant_row.id,
      'startsAt', grant_row.starts_at,
      'expiresAt', grant_row.expires_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'granted',
    'grantId', grant_row.id,
    'kind', grant_row.kind,
    'startsAt', grant_row.starts_at,
    'expiresAt', grant_row.expires_at
  );
end;
$$;

revoke all on function public.grant_entitlement_on_invoice(uuid, uuid, text, text, integer, text)
  from public, anon, authenticated;

-- ---------- A refund of a purchase paid in installments ----------

-- An access paid in installments is ONE purchase with a payment per parcel,
-- and the webhook keys its grant by the installment, not by the parcel. The
-- refund of a parcel names the parcel: the installment it belongs to is the
-- fourth argument, and the grant keyed either way is revoked.
drop function public.revert_paid_invoice(text, text, text);

create or replace function public.revert_paid_invoice(
  target_provider text,
  target_provider_invoice_id text,
  target_kind text,
  target_purchase_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  revoked_grants integer := 0;
begin
  if auth.role() is distinct from 'service_role'
     or target_provider not in ('stripe', 'asaas')
     or nullif(btrim(target_provider_invoice_id), '') is null then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  select * into invoice_row
  from public.invoices
  where provider = target_provider::public.billing_provider
    and provider_invoice_id = target_provider_invoice_id
  for update;
  if not found then
    -- Not ours (a charge created outside the platform). Nothing to revert and
    -- nothing worth retrying: the caller treats this as success.
    return jsonb_build_object('ok', true, 'code', 'unknown_invoice');
  end if;
  if invoice_row.status = 'refunded' then
    return jsonb_build_object('ok', true, 'code', 'already_reverted');
  end if;

  update public.invoices
  set status = 'refunded'
  where id = invoice_row.id;

  update public.entitlement_grants
  set revoked_at = now(),
      revoke_reason = coalesce(nullif(btrim(target_kind), ''), 'refund')
  where revoked_at is null
    and (invoice_key = target_provider || ':' || target_provider_invoice_id
         or (nullif(btrim(target_purchase_ref), '') is not null
             and invoice_key = target_provider || ':' || btrim(target_purchase_ref)));
  get diagnostics revoked_grants = row_count;

  return jsonb_build_object(
    'ok', true,
    'code', 'reverted',
    'orgId', invoice_row.org_id,
    'grantsRevoked', revoked_grants
  );
end;
$$;

revoke all on function public.revert_paid_invoice(text, text, text, text) from public, anon, authenticated;

-- ---------- The notice before an access ends ----------

-- Claimed in the statement that marks it as sent (the rule of migration 0023):
-- a job that runs twice finds nothing left. A grant followed by a renewal is
-- not announced: the chained grant has its own end, announced in its turn.
create or replace function public.claim_access_end_notices(target_within interval default interval '15 days')
returns table (
  grant_id uuid,
  org_id uuid,
  plan_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with due as (
    select g.id
    from public.entitlement_grants g
    where g.revoked_at is null
      and g.end_notice_sent_at is null
      and g.expires_at is not null
      and g.expires_at > now()
      and g.expires_at <= now() + least(greatest(target_within, interval '1 day'), interval '60 days')
      and not exists (
        select 1 from public.entitlement_grants later
        where later.org_id = g.org_id
          and later.kind = g.kind
          and later.id <> g.id
          and later.revoked_at is null
          and (later.expires_at is null or later.expires_at > g.expires_at)
      )
    order by g.expires_at
    limit 200
    for update skip locked
  ),
  claimed as (
    update public.entitlement_grants g
    set end_notice_sent_at = now()
    from due
    where g.id = due.id
    returning g.id, g.org_id, g.plan_id, g.expires_at
  )
  select c.id, c.org_id, p.name, c.expires_at
  from claimed c
  join public.plans p on p.id = c.plan_id;
end;
$$;

revoke all on function public.claim_access_end_notices(interval) from public, anon, authenticated;

-- ---------- Settling an access that ended ----------

-- The grants whose term ran out and were not settled yet: the job tells the
-- member and revokes the CLI tokens when nothing else keeps the access. The
-- same fence: claimed once, marked in the statement that returns them.
create or replace function public.claim_access_endings()
returns table (
  grant_id uuid,
  org_id uuid,
  plan_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with due as (
    select g.id
    from public.entitlement_grants g
    where g.revoked_at is null
      and g.ended_handled_at is null
      and g.expires_at is not null
      and g.expires_at <= now()
    order by g.expires_at
    limit 200
    for update skip locked
  ),
  claimed as (
    update public.entitlement_grants g
    set ended_handled_at = now()
    from due
    where g.id = due.id
    returning g.id, g.org_id, g.plan_id, g.expires_at
  )
  select c.id, c.org_id, p.name, c.expires_at
  from claimed c
  join public.plans p on p.id = c.plan_id;
end;
$$;

revoke all on function public.claim_access_endings() from public, anon, authenticated;

-- ---------- Terms of use, version 2 ----------

update public.consent_terms
set is_active = false
where slug = 'terms' and version = 1 and is_active;

insert into public.consent_terms (slug, locale, version, title, body_md, is_active) values
('terms', 'pt-BR', 2, 'Termos de Uso', $md$
Estes termos regem o uso do flyee.club. Ao criar uma conta ou fazer uma compra, você concorda com eles.

## 1. Quem somos

O flyee.club é um clube de ferramentas para assistentes de IA de programação. É operado pela pessoa jurídica identificada no rodapé do site e no documento fiscal de cada compra ("flyee.club", "nós"). Você fala com a gente pelos canais da página de contato.

## 2. O que o flyee.club entrega

- Um harness e um catálogo de ferramentas (skills, workflows, frameworks e tools) que você instala no assistente de IA que já usa, pelo comando `npx flyee`.
- Atualizações dessas ferramentas enquanto o seu acesso estiver ativo.
- Aulas de uso e, conforme o seu plano, aulas avançadas, receitas, encontros ao vivo e voto no roadmap.

O flyee.club não fornece o assistente de IA nem créditos de IA. As ferramentas rodam no assistente que você contrata por conta própria (por exemplo Claude Code, Codex, Gemini CLI ou Cursor), e o custo desse uso é seu.

## 3. Conta

A conta é pessoal e pertence a uma única pessoa, com 18 anos ou mais. Você responde pelo que é feito com as suas credenciais e deve manter os dados da conta corretos.

## 4. Planos

- **Acesso** (kit): pagamento único, válido por 1 ano a contar da confirmação do pagamento, sem renovação automática. Libera o catálogo e as atualizações durante esse prazo. Para continuar depois, você compra o acesso de novo, e o novo prazo começa quando o anterior termina.
- **Assinatura**: mensal ou anual. Soma ao acesso as aulas avançadas, as receitas, os encontros e o voto no roadmap, enquanto estiver ativa.
- **Pro**: mensal ou anual. Soma à assinatura mais dispositivos e a camada "abrir o capô".

Os preços, o prazo do acesso, os limites de cada plano (como o número de dispositivos) e o que cada um inclui são os exibidos na página de planos no momento da compra. O preço da sua assinatura não muda durante o período já pago.

## 5. Entrega, token e dispositivos

As ferramentas são entregues pela linha de comando, depois que você conecta um dispositivo à sua conta. Para atualizar, o token do dispositivo precisa estar válido: ele se renova a cada atualização e, depois de 30 dias sem atualizar, é revalidado no painel. Cada plano tem um limite de dispositivos conectados ao mesmo tempo, e você pode desconectar um dispositivo no painel quando quiser.

## 6. Licença de uso

Enquanto o seu acesso estiver ativo, você recebe uma licença pessoal, não exclusiva e intransferível para instalar e usar as ferramentas nos seus próprios projetos e em projetos dos seus clientes. O que as ferramentas produzem é seu.

Não é permitido revender, redistribuir, publicar ou compartilhar as ferramentas, o token ou o acesso à conta, nem contornar os limites de dispositivos.

As cópias que você já instalou continuam funcionando depois que o acesso termina. O que termina é o direito de receber atualizações e de instalar em novos dispositivos.

## 7. Pagamento, renovação e cancelamento

As compras em reais são processadas pela Asaas (PIX ou cartão) e as compras em dólares pela Stripe (cartão). O acesso pode ser pago à vista ou parcelado no cartão, em reais; parcelado, ele continua sendo uma única compra, dividida em parcelas, e o prazo de 1 ano conta da confirmação do pagamento.

A assinatura renova automaticamente ao fim de cada período, até ser cancelada. Você pode cancelar no painel a qualquer momento. O cancelamento vale a partir do fim do período já pago e não gera reembolso proporcional. Um plano anual parcelado é uma única compra dividida em parcelas e não renova sozinho.

Se um pagamento falhar, o acesso é mantido por um prazo de tolerância, informado no painel, antes de ser suspenso.

## 8. Arrependimento e reembolso

Você pode desistir de uma compra em até 7 dias corridos a contar da contratação e receber o valor integral de volta, como prevê o art. 49 do Código de Defesa do Consumidor. Quando a página de planos anunciar um prazo de garantia maior, vale o prazo anunciado no momento da compra. O pedido é feito pelos canais de contato, e o reembolso encerra o acesso correspondente.

## 9. Disponibilidade e mudanças nas IAs

As ferramentas dependem de assistentes e serviços de terceiros que mudam com frequência. Trabalhamos para adaptá-las a essas mudanças, mas não garantimos que cada ferramenta funcione em todas as versões de todos os assistentes, nem um resultado específico. Cabe a você revisar o que as ferramentas produzem antes de usar.

## 10. Suspensão

Podemos suspender ou encerrar uma conta em caso de fraude, falta de pagamento, compartilhamento de acesso ou violação destes termos. Sempre que possível, avisamos antes.

## 11. Responsabilidade

Na extensão permitida pela lei, não respondemos por lucros cessantes, perda de dados ou danos indiretos decorrentes do uso das ferramentas. Nada nestes termos afasta direitos que a lei garante ao consumidor.

## 12. Privacidade

O tratamento de dados pessoais está descrito na Política de Privacidade, que faz parte destes termos.

## 13. Alterações

Podemos atualizar estes termos. Cada versão é numerada e datada, e uma mudança relevante é avisada por e-mail ou no painel antes de valer.

## 14. Lei e foro

Estes termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do consumidor.
$md$, true),

('terms', 'en', 2, 'Terms of Use', $md$
These terms govern the use of flyee.club. By creating an account or making a purchase, you agree to them.

## 1. Who we are

flyee.club is a club of tools for AI coding assistants. It is operated by the legal entity named in the site footer and on the tax document of each purchase ("flyee.club", "we"). You can reach us through the channels on the contact page.

## 2. What flyee.club delivers

- A harness and a catalog of tools (skills, workflows, frameworks and tools) that you install in the AI assistant you already use, with the `npx flyee` command.
- Updates to those tools while your access is active.
- How-to lessons and, depending on your plan, advanced lessons, recipes, live sessions and a vote on the roadmap.

flyee.club does not provide the AI assistant or AI credits. The tools run in the assistant you pay for yourself (for example Claude Code, Codex, Gemini CLI or Cursor), and the cost of that usage is yours.

## 3. Account

An account is personal and belongs to one person, aged 18 or older. You are responsible for what is done with your credentials and must keep your account details accurate.

## 4. Plans

- **Access** (kit): a one-time payment, valid for 1 year from the confirmation of the payment, with no automatic renewal. It unlocks the catalog and its updates for that term. To continue afterwards, you buy the access again, and the new term starts when the current one ends.
- **Membership**: monthly or yearly. While active, it adds advanced lessons, recipes, live sessions and the roadmap vote to the access.
- **Pro**: monthly or yearly. It adds more devices and the "under the hood" layer to the Membership.

Prices, the term of the access, each plan's limits (such as the number of devices) and what each plan includes are the ones shown on the pricing page at the time of purchase. The price of your subscription does not change during a period you already paid for.

## 5. Delivery, token and devices

The tools are delivered through the command line, after you connect a device to your account. To update, the device token must be valid: it renews with every update and, after 30 days without updating, it is revalidated in the dashboard. Each plan has a limit of devices connected at the same time, and you can disconnect a device in the dashboard whenever you want.

## 6. License

While your access is active, you receive a personal, non-exclusive and non-transferable license to install and use the tools in your own projects and in your clients' projects. What the tools produce is yours.

You may not resell, redistribute, publish or share the tools, the token or access to the account, or work around the device limits.

Copies you already installed keep working after your access ends. What ends is the right to receive updates and to install on new devices.

## 7. Payment, renewal and cancellation

Purchases in Brazilian reais are processed by Asaas (PIX or card) and purchases in US dollars by Stripe (card). In reais, the access may be paid at once or in card installments; split, it is still a single purchase, divided into installments, and the 1-year term counts from the confirmation of the payment.

A subscription renews automatically at the end of each period until it is canceled. You can cancel in the dashboard at any time. Cancellation takes effect at the end of the period already paid and does not generate a pro-rated refund. A yearly plan paid in installments is a single purchase split into installments and does not renew by itself.

If a payment fails, access is kept for a grace period, shown in the dashboard, before it is suspended.

## 8. Withdrawal and refunds

You may withdraw from a purchase within 7 calendar days of buying and receive a full refund. When the pricing page announces a longer guarantee window, the window announced at the time of purchase applies. Ask through the contact channels; a refund ends the corresponding access.

## 9. Availability and changes in the AIs

The tools depend on third-party assistants and services that change often. We work to adapt them to those changes, but we do not guarantee that every tool works on every version of every assistant, or any specific result. It is up to you to review what the tools produce before using it.

## 10. Suspension

We may suspend or close an account in case of fraud, non-payment, sharing of access or breach of these terms. Whenever possible, we warn you first.

## 11. Liability

To the extent the law allows, we are not liable for lost profits, loss of data or indirect damages arising from the use of the tools. Nothing in these terms removes rights that the law guarantees to consumers.

## 12. Privacy

How personal data is handled is described in the Privacy Policy, which is part of these terms.

## 13. Changes

We may update these terms. Each version is numbered and dated, and a material change is announced by e-mail or in the dashboard before it takes effect.

## 14. Law and venue

These terms are governed by the laws of Brazil. Consumers may bring a claim in the courts of their own domicile.
$md$, true);
