-- ============================================================
-- Two plans, named after the club (2026-10-06):
--
--   The platform is called FlyeeClub. The one-time access is the plan called
--   "FlyeeClub": the one every call to action sells. The subscription is
--   "FlyeeClub Pro". The former Pro family leaves the storefront: its rows
--   stay (a plan is never deleted) but are inactive, so nothing is sold or
--   granted on them, and its depth layer ("abrir o capô") moves to FlyeeClub
--   Pro, so the lessons of that depth keep a plan that unlocks them.
--
--   Services sold on demand (mentoring, consulting) are not plans: they are
--   offers that lead to the contact form, recorded like the other offers.
--
-- Version 3 of the terms of use carries the names. A published text never
-- changes (guard_consent_term_text, migration 0001): version 2 is switched
-- off and version 3 is published.
-- ============================================================

-- ---------- The names ----------

update public.plans
set name = 'FlyeeClub',
    description = 'Todos os apps da loja, com as atualizações, por 1 ano. Pagamento único.'
where slug = 'kit';

update public.plans
set name = 'FlyeeClub',
    description = 'Every app in the store, with updates, for 1 year. One-time payment.'
where slug = 'kit-usd';

update public.plans
set name = 'FlyeeClub Pro',
    description = 'Tudo do FlyeeClub, mais guias avançados, receitas, encontros ao vivo, voto no que entra na loja e a camada abrir o capô.',
    limits = limits || '{"open_the_hood": 1}'::jsonb
where slug in ('club-mensal', 'club-anual');

update public.plans
set name = 'FlyeeClub Pro · Fundador',
    description = 'A assinatura anual do FlyeeClub Pro com o preço de fundador travado.',
    limits = limits || '{"open_the_hood": 1}'::jsonb
where slug = 'club-fundador-anual';

update public.plans
set name = 'FlyeeClub Pro',
    description = 'Everything in FlyeeClub, plus advanced guides, recipes, live sessions, a vote on what joins the store and the under-the-hood layer.',
    limits = limits || '{"open_the_hood": 1}'::jsonb
where slug in ('club-mensal-usd', 'club-anual-usd');

-- ---------- The former Pro leaves the storefront ----------

-- Inactive: the checkout, set_org_plan and grant_entitlement all refuse it,
-- and the grids never list it. The rows stay for the history of any
-- subscription or grant that names them.
update public.plans
set is_active = false,
    is_public = false
where slug in ('pro-mensal', 'pro-anual', 'pro-mensal-usd', 'pro-anual-usd');

-- ---------- A service offered on demand ----------

-- Consulting joins mentoring among the offers an event may name: the home
-- shows both to a paying member, and the clicks count like any other offer.
-- The function is the one of migration 0006 with one more value.
create or replace function public.product_event_sanitize(target_event text, target_properties jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  props jsonb := coalesce(target_properties, '{}'::jsonb);
  semver constant text := '^[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}(-[0-9A-Za-z.-]{1,20})?$';
  module_value text;
  trail_value text;
begin
  if jsonb_typeof(props) <> 'object' then
    return '{}'::jsonb;
  end if;

  module_value := lower(props ->> 'module');
  if module_value is not null and not exists (
    select 1 from public.catalog_modules m where m.slug = module_value
  ) then
    module_value := null;
  end if;

  trail_value := lower(props ->> 'trail');
  if trail_value is not null and not exists (
    select 1 from public.catalog_trails t where t.slug = trail_value
  ) then
    trail_value := null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'platform', case when props ->> 'platform' in ('web', 'cli', 'server') then props ->> 'platform' end,
    'module', module_value,
    'trail', trail_value,
    'version', case when props ->> 'version' ~ semver then props ->> 'version' end,
    'from_version', case when props ->> 'from_version' ~ semver then props ->> 'from_version' end,
    'to_version', case when props ->> 'to_version' ~ semver then props ->> 'to_version' end,
    'depth', case when props ->> 'depth' in ('usar', 'abrir_o_capo') then props ->> 'depth' end,
    'lesson_locale', case when props ->> 'lesson_locale' in ('pt-BR', 'en') then props ->> 'lesson_locale' end,
    'ai_tool', case
      when props ->> 'ai_tool' = any (enum_range(null::public.ai_tool)::text[]) then props ->> 'ai_tool'
    end,
    'os', case when props ->> 'os' in ('windows', 'macos', 'linux', 'other') then props ->> 'os' end,
    'cli_version', case when props ->> 'cli_version' ~ semver then props ->> 'cli_version' end,
    'core_version', case when props ->> 'core_version' ~ semver then props ->> 'core_version' end,
    'project_kind', case when props ->> 'project_kind' in ('own', 'client') then props ->> 'project_kind' end,
    'tier_from', case when props ->> 'tier_from' in ('none', 'kit', 'club', 'pro') then props ->> 'tier_from' end,
    'tier_to', case when props ->> 'tier_to' in ('none', 'kit', 'club', 'pro') then props ->> 'tier_to' end,
    'period', case when props ->> 'period' in ('once', 'monthly', 'yearly') then props ->> 'period' end,
    'offer', case
      when props ->> 'offer' in ('kit', 'club', 'pro', 'mentoring', 'consulting', 'founders') then props ->> 'offer'
    end,
    'reason', case
      when props ->> 'reason' in (
        'too_expensive', 'not_using', 'missing_tool', 'switched', 'technical', 'temporary', 'other',
        'token_expired', 'no_entitlement', 'device_limit', 'yanked', 'member', 'admin',
        'suspended', 'canceled', 'refund'
      ) then props ->> 'reason'
    end,
    'origin', case
      when props ->> 'origin' in (
        'home', 'revalidation', 'catalog', 'module', 'billing', 'menu', 'checkout', 'email', 'cli', 'site'
      ) then props ->> 'origin'
    end,
    'days_since_update', case
      when props ->> 'days_since_update' in ('0_7', '8_14', '15_24', '25_30', '31_plus')
        then props ->> 'days_since_update'
    end,
    -- The entry door, normalized exactly like the page-view counter (0005).
    'origem', case when props ? 'origem' then public.site_channel(props ->> 'origem') end
  ));
end;
$$;

revoke all on function public.product_event_sanitize(text, jsonb) from public, anon, authenticated;

-- ---------- Terms of use, version 3 ----------

update public.consent_terms
set is_active = false
where slug = 'terms' and version = 2 and is_active;

insert into public.consent_terms (slug, locale, version, title, body_md, is_active) values
('terms', 'pt-BR', 3, 'Termos de Uso', $md$
Estes termos regem o uso do FlyeeClub. Ao criar uma conta ou fazer uma compra, você concorda com eles.

## 1. Quem somos

O FlyeeClub é um clube de apps para assistentes de IA de programação. É operado pela pessoa jurídica identificada no rodapé do site e no documento fiscal de cada compra ("FlyeeClub", "nós"). Você fala com a gente pelos canais da página de contato.

## 2. O que o FlyeeClub entrega

- Um harness e uma loja de apps (skills, workflows, frameworks e tools) que você instala no assistente de IA que já usa, pelo comando `npx flyee`.
- Atualizações desses apps enquanto o seu acesso estiver ativo.
- Guias de uso e, conforme o seu plano, guias avançados, receitas, encontros ao vivo e voto no que entra na loja.

O FlyeeClub não fornece o assistente de IA nem créditos de IA. Os apps rodam no assistente que você contrata por conta própria (por exemplo Claude Code, Codex, Gemini CLI ou Cursor), e o custo desse uso é seu.

## 3. Conta

A conta é pessoal e pertence a uma única pessoa, com 18 anos ou mais. Você responde pelo que é feito com as suas credenciais e deve manter os dados da conta corretos.

## 4. Planos

- **FlyeeClub**: pagamento único, válido por 1 ano a contar da confirmação do pagamento, sem renovação automática. Libera a loja de apps e as atualizações durante esse prazo. Para continuar depois, você compra o acesso de novo, e o novo prazo começa quando o anterior termina.
- **FlyeeClub Pro**: assinatura mensal ou anual. Enquanto estiver ativa, soma ao FlyeeClub os guias avançados, as receitas, os encontros ao vivo, o voto no que entra na loja, a camada "abrir o capô" e mais dispositivos.

Os preços, o prazo do acesso, os limites de cada plano (como o número de dispositivos) e o que cada um inclui são os exibidos na página de planos no momento da compra. O preço da sua assinatura não muda durante o período já pago.

Mentoria e consultoria são serviços contratados à parte, sob demanda, com escopo e preço combinados pelos canais de contato. Eles não fazem parte de nenhum plano.

## 5. Entrega, token e dispositivos

Os apps são entregues pela linha de comando, depois que você conecta um dispositivo à sua conta. Para atualizar, o token do dispositivo precisa estar válido: ele se renova a cada atualização e, depois de 30 dias sem atualizar, é revalidado no painel. Cada plano tem um limite de dispositivos conectados ao mesmo tempo, e você pode desconectar um dispositivo no painel quando quiser.

## 6. Licença de uso

Enquanto o seu acesso estiver ativo, você recebe uma licença pessoal, não exclusiva e intransferível para instalar e usar os apps nos seus próprios projetos e em projetos dos seus clientes. O que os apps produzem é seu.

Não é permitido revender, redistribuir, publicar ou compartilhar os apps, o token ou o acesso à conta, nem contornar os limites de dispositivos.

As cópias que você já instalou continuam funcionando depois que o acesso termina. O que termina é o direito de receber atualizações e de instalar em novos dispositivos.

## 7. Pagamento, renovação e cancelamento

As compras em reais são processadas pela Asaas (PIX ou cartão) e as compras em dólares pela Stripe (cartão). O FlyeeClub pode ser pago à vista ou parcelado no cartão, em reais; parcelado, ele continua sendo uma única compra, dividida em parcelas, e o prazo de 1 ano conta da confirmação do pagamento.

O FlyeeClub Pro renova automaticamente ao fim de cada período, até ser cancelado. Você pode cancelar no painel a qualquer momento. O cancelamento vale a partir do fim do período já pago e não gera reembolso proporcional. Um plano anual parcelado é uma única compra dividida em parcelas e não renova sozinho.

Se um pagamento falhar, o acesso é mantido por um prazo de tolerância, informado no painel, antes de ser suspenso.

## 8. Arrependimento e reembolso

Você pode desistir de uma compra em até 7 dias corridos a contar da contratação e receber o valor integral de volta, como prevê o art. 49 do Código de Defesa do Consumidor. Quando a página de planos anunciar um prazo de garantia maior, vale o prazo anunciado no momento da compra. O pedido é feito pelos canais de contato, e o reembolso encerra o acesso correspondente.

## 9. Disponibilidade e mudanças nas IAs

Os apps dependem de assistentes e serviços de terceiros que mudam com frequência. Trabalhamos para adaptá-los a essas mudanças, mas não garantimos que cada app funcione em todas as versões de todos os assistentes, nem um resultado específico. Cabe a você revisar o que os apps produzem antes de usar.

## 10. Suspensão

Podemos suspender ou encerrar uma conta em caso de fraude, falta de pagamento, compartilhamento de acesso ou violação destes termos. Sempre que possível, avisamos antes.

## 11. Responsabilidade

Na extensão permitida pela lei, não respondemos por lucros cessantes, perda de dados ou danos indiretos decorrentes do uso dos apps. Nada nestes termos afasta direitos que a lei garante ao consumidor.

## 12. Privacidade

O tratamento de dados pessoais está descrito na Política de Privacidade, que faz parte destes termos.

## 13. Alterações

Podemos atualizar estes termos. Cada versão é numerada e datada, e uma mudança relevante é avisada por e-mail ou no painel antes de valer.

## 14. Lei e foro

Estes termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do consumidor.
$md$, true),

('terms', 'en', 3, 'Terms of Use', $md$
These terms govern the use of FlyeeClub. By creating an account or making a purchase, you agree to them.

## 1. Who we are

FlyeeClub is a club of apps for AI coding assistants. It is operated by the legal entity named in the site footer and on the tax document of each purchase ("FlyeeClub", "we"). You can reach us through the channels on the contact page.

## 2. What FlyeeClub delivers

- A harness and a store of apps (skills, workflows, frameworks and tools) that you install in the AI assistant you already use, with the `npx flyee` command.
- Updates to those apps while your access is active.
- How-to guides and, depending on your plan, advanced guides, recipes, live sessions and a vote on what joins the store.

FlyeeClub does not provide the AI assistant or AI credits. The apps run in the assistant you pay for yourself (for example Claude Code, Codex, Gemini CLI or Cursor), and the cost of that usage is yours.

## 3. Account

An account is personal and belongs to one person, aged 18 or older. You are responsible for what is done with your credentials and must keep your account details accurate.

## 4. Plans

- **FlyeeClub**: a one-time payment, valid for 1 year from the confirmation of the payment, with no automatic renewal. It unlocks the app store and its updates for that term. To continue afterwards, you buy the access again, and the new term starts when the current one ends.
- **FlyeeClub Pro**: a monthly or yearly subscription. While active, it adds advanced guides, recipes, live sessions, the vote on what joins the store, the "under the hood" layer and more devices to FlyeeClub.

Prices, the term of the access, each plan's limits (such as the number of devices) and what each plan includes are the ones shown on the pricing page at the time of purchase. The price of your subscription does not change during a period you already paid for.

Mentoring and consulting are services booked separately, on demand, with a scope and a price agreed through the contact channels. They are not part of any plan.

## 5. Delivery, token and devices

The apps are delivered through the command line, after you connect a device to your account. To update, the device token must be valid: it renews with every update and, after 30 days without updating, it is revalidated in the dashboard. Each plan has a limit of devices connected at the same time, and you can disconnect a device in the dashboard whenever you want.

## 6. License

While your access is active, you receive a personal, non-exclusive and non-transferable license to install and use the apps in your own projects and in your clients' projects. What the apps produce is yours.

You may not resell, redistribute, publish or share the apps, the token or access to the account, or work around the device limits.

Copies you already installed keep working after your access ends. What ends is the right to receive updates and to install on new devices.

## 7. Payment, renewal and cancellation

Purchases in Brazilian reais are processed by Asaas (PIX or card) and purchases in US dollars by Stripe (card). In reais, FlyeeClub may be paid at once or in card installments; split, it is still a single purchase, divided into installments, and the 1-year term counts from the confirmation of the payment.

FlyeeClub Pro renews automatically at the end of each period until it is canceled. You can cancel in the dashboard at any time. Cancellation takes effect at the end of the period already paid and does not generate a pro-rated refund. A yearly plan paid in installments is a single purchase split into installments and does not renew by itself.

If a payment fails, access is kept for a grace period, shown in the dashboard, before it is suspended.

## 8. Withdrawal and refunds

You may withdraw from a purchase within 7 calendar days of buying and receive a full refund. When the pricing page announces a longer guarantee window, the window announced at the time of purchase applies. Ask through the contact channels; a refund ends the corresponding access.

## 9. Availability and changes in the AIs

The apps depend on third-party assistants and services that change often. We work to adapt them to those changes, but we do not guarantee that every app works on every version of every assistant, or any specific result. It is up to you to review what the apps produce before using it.

## 10. Suspension

We may suspend or close an account in case of fraud, non-payment, sharing of access or breach of these terms. Whenever possible, we warn you first.

## 11. Liability

To the extent the law allows, we are not liable for lost profits, loss of data or indirect damages arising from the use of the apps. Nothing in these terms removes rights that the law guarantees to consumers.

## 12. Privacy

How personal data is handled is described in the Privacy Policy, which is part of these terms.

## 13. Changes

We may update these terms. Each version is numbered and dated, and a material change is announced by e-mail or in the dashboard before it takes effect.

## 14. Law and venue

These terms are governed by the laws of Brazil. Consumers may bring a claim in the courts of their own domicile.
$md$, true);
