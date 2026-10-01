-- ============================================================
-- 0018_seed: the data the platform needs to exist on day one.
--
--   * the plan ladder, in BRL and USD. PRICES AND LIMITS ARE HYPOTHESES
--     (docs/PRODUCT.md): they live here as rows so the operator edits them in
--     /admin/billing, and nothing in the code repeats them;
--   * operational settings (CLI rate limits, lead window, support channels);
--   * the legal texts, version 1, in Portuguese and English.
--
-- Everything is `on conflict do nothing`: re-running this file never
-- overwrites what the operator changed.
-- ============================================================

-- ---------- Plans ----------

-- Entitlement keys, all in one place:
--   catalog_access      may install and update catalog modules
--   devices             machines connected at the same time
--   update_channel      reserved for a stable/latest split (everyone: latest)
--   advanced_lessons    the second depth of lessons
--   recipes             recipe workflows
--   roadmap_vote        voting on the roadmap
--   meetings            live sessions and their recordings
--   commercial_license  use in client projects
--   open_the_hood       the "abrir o capô" layer

insert into public.plans (slug, name, description, kind, family, tier, period, price_cents, currency, is_free, is_public, sort, limits) values
  (
    'gratuito', 'Gratuito', 'Conta sem compra: amostras grátis e a novidade por e-mail.',
    'recurring', 'free', null, 'monthly', 0, 'BRL', true, false, 0,
    '{"catalog_access": 0, "devices": 1, "update_channel": "latest", "advanced_lessons": 0, "recipes": 0, "roadmap_vote": 0, "meetings": 0, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'kit', 'Kit flyee', 'O catálogo inteiro, com atualização contínua. Pagamento único.',
    'access', 'kit', 'kit', null, 9700, 'BRL', false, true, 10,
    '{"catalog_access": 1, "devices": 1, "update_channel": "latest", "advanced_lessons": 0, "recipes": 0, "roadmap_vote": 0, "meetings": 0, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'club-mensal', 'Assinatura flyee', 'Tudo do kit, mais aulas avançadas, receitas, encontros e voto no roadmap.',
    'recurring', 'club', 'club', 'monthly', 6700, 'BRL', false, true, 20,
    '{"catalog_access": 1, "devices": 3, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'club-anual', 'Assinatura flyee', 'Tudo do kit, mais aulas avançadas, receitas, encontros e voto no roadmap.',
    'recurring', 'club', 'club', 'yearly', 59700, 'BRL', false, true, 21,
    '{"catalog_access": 1, "devices": 3, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'pro-mensal', 'flyee Pro', 'Tudo da assinatura, mais a licença comercial e a camada abrir o capô.',
    'recurring', 'pro', 'pro', 'monthly', 19700, 'BRL', false, true, 30,
    '{"catalog_access": 1, "devices": 5, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 1, "open_the_hood": 1}'
  ),
  (
    'pro-anual', 'flyee Pro', 'Tudo da assinatura, mais a licença comercial e a camada abrir o capô.',
    'recurring', 'pro', 'pro', 'yearly', 197000, 'BRL', false, true, 31,
    '{"catalog_access": 1, "devices": 5, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 1, "open_the_hood": 1}'
  ),
  -- The founders price: purchasable only through its link while the offer is
  -- open (platform_settings `founders`), never listed in the grids.
  (
    'club-fundador-anual', 'Assinatura flyee · Fundador', 'Assinatura anual com o preço de fundador travado.',
    'recurring', 'club', 'club', 'yearly', 49700, 'BRL', false, false, 22,
    '{"catalog_access": 1, "devices": 3, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'kit-usd', 'flyee Kit', 'The whole catalog, continuously updated. One-time payment.',
    'access', 'kit', 'kit', null, 2900, 'USD', false, true, 10,
    '{"catalog_access": 1, "devices": 1, "update_channel": "latest", "advanced_lessons": 0, "recipes": 0, "roadmap_vote": 0, "meetings": 0, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'club-mensal-usd', 'flyee Membership', 'Everything in the Kit, plus advanced lessons, recipes, live sessions and a vote on the roadmap.',
    'recurring', 'club', 'club', 'monthly', 1900, 'USD', false, true, 20,
    '{"catalog_access": 1, "devices": 3, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'club-anual-usd', 'flyee Membership', 'Everything in the Kit, plus advanced lessons, recipes, live sessions and a vote on the roadmap.',
    'recurring', 'club', 'club', 'yearly', 19000, 'USD', false, true, 21,
    '{"catalog_access": 1, "devices": 3, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 0, "open_the_hood": 0}'
  ),
  (
    'pro-mensal-usd', 'flyee Pro', 'Everything in the Membership, plus the commercial license and the under-the-hood layer.',
    'recurring', 'pro', 'pro', 'monthly', 4900, 'USD', false, true, 30,
    '{"catalog_access": 1, "devices": 5, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 1, "open_the_hood": 1}'
  ),
  (
    'pro-anual-usd', 'flyee Pro', 'Everything in the Membership, plus the commercial license and the under-the-hood layer.',
    'recurring', 'pro', 'pro', 'yearly', 49000, 'USD', false, true, 31,
    '{"catalog_access": 1, "devices": 5, "update_channel": "latest", "advanced_lessons": 1, "recipes": 1, "roadmap_vote": 1, "meetings": 1, "commercial_license": 1, "open_the_hood": 1}'
  )
on conflict (slug) do nothing;

-- ---------- Settings ----------

insert into public.platform_settings (key, value, is_public) values
  -- Human support channels shown by the quick-support widget. Edited at
  -- /admin/support; empty until the operator fills them.
  ('support', '{}'::jsonb, true),
  -- The CLI delivery API: rate ceilings and the oldest CLI still served.
  ('cli', '{"rate": {"per_minute": 60, "per_hour": 600}, "downloads_per_day": 200, "events_per_hour": 600, "min_cli_version": "0.1.0", "latest_core_version": null, "deprecations": []}'::jsonb, false),
  -- Waitlist and newsletter sign-ups per network per hour.
  ('leads', '{"per_network_hour": 10}'::jsonb, false),
  -- The usage-triggered offer card. Shipped off; switched on once the rules
  -- have real usage to act on.
  ('upsell', '{"enabled": false}'::jsonb, true)
on conflict (key) do nothing;

-- ---------- Legal texts, version 1 ----------

insert into public.consent_terms (slug, locale, version, title, body_md, is_active) values
('terms', 'pt-BR', 1, 'Termos de Uso', $md$
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

- **Kit**: pagamento único. Libera o catálogo e as atualizações, sem prazo de validade.
- **Assinatura**: mensal ou anual. Soma ao kit as aulas avançadas, as receitas, os encontros e o voto no roadmap.
- **Pro**: mensal ou anual. Soma à assinatura a licença comercial.

Os preços, os limites de cada plano (como o número de dispositivos) e o que cada um inclui são os exibidos na página de planos no momento da compra. O preço da sua assinatura não muda durante o período já pago.

## 5. Entrega, token e dispositivos

As ferramentas são entregues pela linha de comando, depois que você conecta um dispositivo à sua conta. Para atualizar, o token do dispositivo precisa estar válido: ele se renova a cada atualização e, depois de 30 dias sem atualizar, é revalidado no painel. Cada plano tem um limite de dispositivos conectados ao mesmo tempo, e você pode desconectar um dispositivo no painel quando quiser.

## 6. Licença de uso

Enquanto o seu acesso estiver ativo, você recebe uma licença pessoal, não exclusiva e intransferível para instalar e usar as ferramentas nos seus próprios projetos. O uso em projetos de clientes exige a licença comercial do plano Pro.

Não é permitido revender, redistribuir, publicar ou compartilhar as ferramentas, o token ou o acesso à conta, nem contornar os limites de dispositivos.

As cópias que você já instalou continuam funcionando depois que o acesso termina. O que termina é o direito de receber atualizações e de instalar em novos dispositivos.

## 7. Pagamento, renovação e cancelamento

As compras em reais são processadas pela Asaas (PIX ou cartão) e as compras em dólares pela Stripe (cartão). A assinatura renova automaticamente ao fim de cada período, até ser cancelada.

Você pode cancelar no painel a qualquer momento. O cancelamento vale a partir do fim do período já pago e não gera reembolso proporcional. Um plano anual parcelado é uma única compra dividida em parcelas e não renova sozinho.

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

('terms', 'en', 1, 'Terms of Use', $md$
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

- **Kit**: a one-time payment. It unlocks the catalog and its updates, with no end date.
- **Membership**: monthly or yearly. It adds advanced lessons, recipes, live sessions and the roadmap vote to the Kit.
- **Pro**: monthly or yearly. It adds the commercial license to the Membership.

Prices, each plan's limits (such as the number of devices) and what each plan includes are the ones shown on the pricing page at the time of purchase. The price of your subscription does not change during a period you already paid for.

## 5. Delivery, token and devices

The tools are delivered through the command line, after you connect a device to your account. To update, the device token must be valid: it renews with every update and, after 30 days without updating, it is revalidated in the dashboard. Each plan has a limit of devices connected at the same time, and you can disconnect a device in the dashboard whenever you want.

## 6. License

While your access is active, you receive a personal, non-exclusive and non-transferable license to install and use the tools in your own projects. Using them in client projects requires the commercial license of the Pro plan.

You may not resell, redistribute, publish or share the tools, the token or access to the account, or work around the device limits.

Copies you already installed keep working after your access ends. What ends is the right to receive updates and to install on new devices.

## 7. Payment, renewal and cancellation

Purchases in Brazilian reais are processed by Asaas (PIX or card) and purchases in US dollars by Stripe (card). A subscription renews automatically at the end of each period until it is canceled.

You can cancel in the dashboard at any time. Cancellation takes effect at the end of the period already paid and does not generate a pro-rated refund. A yearly plan paid in installments is a single purchase split into installments and does not renew by itself.

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
$md$, true),

('privacy', 'pt-BR', 1, 'Política de Privacidade', $md$
Esta política explica quais dados pessoais o flyee.club trata, para quê e quais são os seus direitos. Ela segue a Lei Geral de Proteção de Dados (Lei 13.709/2018).

## 1. Quem é o controlador

O controlador é a pessoa jurídica que opera o flyee.club, identificada no rodapé do site e no documento fiscal de cada compra. Pedidos sobre privacidade são recebidos pelos canais da página de contato.

## 2. Que dados tratamos

- **Conta**: nome, e-mail e senha (guardada de forma cifrada). Se você entrar com Google ou GitHub, recebemos o nome, o e-mail e a foto do perfil.
- **Perfil**: o segmento que você declara, o assistente de IA que usa, o idioma e o fuso horário.
- **Cobrança**: CPF ou CNPJ, CEP, número do endereço e telefone, quando a compra é em reais. Os dados do cartão ficam com o processador de pagamento e não passam pelos nossos servidores.
- **Dispositivos**: para cada máquina conectada pelo flyee CLI, o nome que você deu, o sistema operacional, o assistente de IA, as versões do CLI e do harness e a lista de ferramentas instaladas com suas versões.
- **Uso**: eventos como "ferramenta instalada", "ferramenta executada" ou "atualização feita", com o nome da ferramenta e a versão. **Não coletamos o conteúdo do que você faz**: nem código, nem prompts, nem arquivos, nem as respostas da IA.
- **Acesso**: data, endereço IP e navegador de cada login, para a sua segurança.
- **Origem**: a página e a campanha pelas quais você chegou (parâmetros de link).
- **Lista de espera e novidades**: e-mail e, se informados, nome, segmento e idioma de quem se inscreve sem ter conta.

## 3. Para que usamos e com que base legal

- **Executar o contrato**: criar e manter a conta, entregar as ferramentas e as atualizações, processar pagamentos e dar suporte.
- **Cumprir obrigação legal**: emitir e guardar documentos fiscais.
- **Legítimo interesse**: proteger a conta e o serviço contra fraude e abuso, e medir de forma agregada como o clube é usado (por segmento, assistente e idioma) para decidir o que construir. Você pode se opor a esse uso pelos canais de contato.
- **Consentimento**: enviar novidades por e-mail a quem pediu, e usar cookies de análise e de anúncios no site. O consentimento pode ser retirado a qualquer momento.

## 4. Com quem compartilhamos

Apenas com fornecedores necessários para o serviço funcionar, sob contrato e com acesso limitado: Supabase (banco de dados, autenticação e arquivos), Vercel (hospedagem), Asaas e Stripe (pagamentos e documentos fiscais), Resend (envio de e-mail), Inngest (tarefas agendadas), Google (YouTube, onde ficam as aulas, e Google Analytics) e Meta (medição de anúncios).

Para análises internas, o operador pode consultar dados agregados da plataforma com o apoio de um provedor de IA (Anthropic ou Google), sem uso desses dados para treinar modelos, conforme os termos desses provedores.

Não vendemos dados pessoais.

## 5. Transferência internacional

Alguns desses fornecedores processam dados fora do Brasil, principalmente nos Estados Unidos. Nesses casos adotamos as garantias contratuais previstas na LGPD.

## 6. Por quanto tempo guardamos

- Dados da conta, do perfil e dos dispositivos: enquanto a conta existir.
- Eventos de uso: 13 meses na forma detalhada. Depois, apenas totais sem identificação.
- Documentos fiscais e registros de pagamento: pelo prazo que a lei exige.
- Inscrição na lista de espera sem confirmação: 7 dias. Depois de um pedido de descadastro: 6 meses, para garantir que o pedido seja respeitado.

## 7. Seus direitos

Você pode pedir confirmação do tratamento, acesso, correção, portabilidade, anonimização, eliminação, informação sobre compartilhamento e revogação do consentimento, e pode reclamar à Autoridade Nacional de Proteção de Dados. A exclusão da conta apaga também o histórico dela, com exceção do que a lei manda guardar.

## 8. Segurança

Cada conta é isolada no banco de dados, o tráfego é cifrado, o acesso da equipe é limitado e registrado, e a conta pode usar verificação em duas etapas. Guardamos apenas o resumo criptográfico dos tokens, nunca o token.

## 9. Acesso de suporte

Para resolver um problema que você relatou, a equipe pode acessar a sua conta por tempo limitado. Esse acesso exige um motivo, fica registrado no seu histórico de logins como acesso de suporte e não permite alterar credenciais, aceitar termos ou agir em seu nome.

## 10. Cookies

O uso de cookies está descrito na Política de Cookies.

## 11. Alterações

Cada versão desta política é numerada e datada. Uma mudança relevante é avisada por e-mail ou no painel antes de valer.
$md$, true),

('privacy', 'en', 1, 'Privacy Policy', $md$
This policy explains which personal data flyee.club processes, why, and what your rights are. It follows the Brazilian General Data Protection Law (LGPD, Law 13,709/2018).

## 1. Who the controller is

The controller is the legal entity that operates flyee.club, named in the site footer and on the tax document of each purchase. Privacy requests are received through the channels on the contact page.

## 2. What data we process

- **Account**: name, e-mail and password (stored encrypted). If you sign in with Google or GitHub, we receive your name, e-mail and profile picture.
- **Profile**: the segment you declare, the AI assistant you use, your language and time zone.
- **Billing**: for purchases in Brazilian reais, tax ID (CPF or CNPJ), postal code, address number and phone. Card details stay with the payment processor and never reach our servers.
- **Devices**: for each machine connected through the flyee CLI, the name you gave it, the operating system, the AI assistant, the CLI and harness versions, and the list of installed tools with their versions.
- **Usage**: events such as "tool installed", "tool executed" or "update done", with the tool name and version. **We do not collect the content of what you do**: no code, no prompts, no files, no AI responses.
- **Access**: date, IP address and browser of each sign-in, for your security.
- **Origin**: the page and campaign through which you arrived (link parameters).
- **Waitlist and news**: e-mail and, if provided, name, segment and language of people who sign up without an account.

## 3. Why we use it and on what legal basis

- **Performing the contract**: creating and keeping your account, delivering the tools and their updates, processing payments and providing support.
- **Legal obligation**: issuing and keeping tax documents.
- **Legitimate interest**: protecting the account and the service against fraud and abuse, and measuring in aggregate how the club is used (by segment, assistant and language) to decide what to build. You may object to this use through the contact channels.
- **Consent**: sending news by e-mail to those who asked for it, and using analytics and advertising cookies on the site. Consent can be withdrawn at any time.

## 4. Who we share it with

Only with providers required for the service to work, under contract and with limited access: Supabase (database, authentication and files), Vercel (hosting), Asaas and Stripe (payments and tax documents), Resend (e-mail delivery), Inngest (scheduled jobs), Google (YouTube, where the lessons are hosted, and Google Analytics) and Meta (ad measurement).

For internal analysis, the operator may query aggregate platform data with the help of an AI provider (Anthropic or Google), without that data being used to train models, under those providers' terms.

We do not sell personal data.

## 5. International transfers

Some of these providers process data outside Brazil, mainly in the United States. In those cases we adopt the contractual safeguards required by the LGPD.

## 6. How long we keep it

- Account, profile and device data: while the account exists.
- Usage events: 13 months in detailed form. After that, only totals with no identification.
- Tax documents and payment records: for the period the law requires.
- A waitlist sign-up that was never confirmed: 7 days. After an unsubscribe request: 6 months, to make sure the request is respected.

## 7. Your rights

You may ask for confirmation of processing, access, correction, portability, anonymization, deletion, information about sharing and withdrawal of consent, and you may complain to the Brazilian data protection authority (ANPD). Deleting the account also erases its history, except for what the law requires us to keep.

## 8. Security

Each account is isolated in the database, traffic is encrypted, staff access is limited and logged, and an account can use two-step verification. We store only the cryptographic digest of tokens, never the token.

## 9. Support access

To solve a problem you reported, the team may access your account for a limited time. That access requires a reason, is recorded in your sign-in history as support access, and cannot change credentials, accept terms or act on your behalf.

## 10. Cookies

The use of cookies is described in the Cookie Policy.

## 11. Changes

Each version of this policy is numbered and dated. A material change is announced by e-mail or in the dashboard before it takes effect.
$md$, true),

('cookies', 'pt-BR', 1, 'Política de Cookies', $md$
Cookies são pequenos arquivos que o site grava no seu navegador. Esta política diz quais usamos e como recusar os que não são essenciais.

## 1. Cookies essenciais

Necessários para o site funcionar; não dependem de consentimento.

- **Sessão**: mantêm você conectado à sua conta.
- **Idioma**: guardam o idioma escolhido, por até um ano.
- **Preferência de cookies**: guardam a sua resposta ao aviso de cookies.
- **Cupom e origem**: guardam o cupom e a campanha do link pelo qual você chegou, para que continuem valendo até a compra.

## 2. Cookies de análise e de anúncios

No site público carregamos o Pixel da Meta e o Google Analytics, que gravam os cookies `_fbp`, `_fbc` e `_ga` para medir visitas e o resultado das campanhas. Você pode recusá-los no aviso de cookies, a qualquer momento; a recusa fica guardada no seu navegador.

## 3. Medição no servidor

Além dos cookies, enviamos à Meta e ao Google, a partir do nosso servidor, os eventos das nossas próprias vendas (cadastro e compra), para saber quais campanhas funcionam. Esse envio se baseia no nosso legítimo interesse e não depende dos cookies acima.

## 4. O que não fazemos

O flyee CLI não usa cookies. Ele envia apenas eventos de uso com o nome e a versão das ferramentas, como descrito na Política de Privacidade.

## 5. Como controlar

Além do aviso de cookies, o seu navegador permite bloquear ou apagar cookies. Bloquear os essenciais impede o login.
$md$, true),

('cookies', 'en', 1, 'Cookie Policy', $md$
Cookies are small files the site stores in your browser. This policy says which ones we use and how to refuse the ones that are not essential.

## 1. Essential cookies

Required for the site to work; they do not depend on consent.

- **Session**: keep you signed in to your account.
- **Language**: remember the language you chose, for up to one year.
- **Cookie preference**: remember your answer to the cookie notice.
- **Coupon and origin**: remember the coupon and the campaign of the link you arrived through, so they still apply at purchase.

## 2. Analytics and advertising cookies

On the public site we load the Meta Pixel and Google Analytics, which set the `_fbp`, `_fbc` and `_ga` cookies to measure visits and campaign results. You can refuse them in the cookie notice at any time; the refusal is stored in your browser.

## 3. Server-side measurement

Besides cookies, we send Meta and Google, from our server, the events of our own sales (sign-up and purchase), to learn which campaigns work. This is based on our legitimate interest and does not depend on the cookies above.

## 4. What we do not do

The flyee CLI does not use cookies. It only sends usage events with the name and version of tools, as described in the Privacy Policy.

## 5. How to control them

Besides the cookie notice, your browser lets you block or delete cookies. Blocking the essential ones prevents sign-in.
$md$, true),

('cli-connection', 'pt-BR', 1, 'Conexão do flyee CLI', $md$
Ao conectar este dispositivo, você autoriza o flyee CLI a agir pela sua conta nesta máquina.

- **O que o CLI pode fazer**: ler o seu perfil e o seu plano, listar o catálogo, baixar as ferramentas liberadas pelo seu plano e enviar eventos de uso.
- **O que fica registrado**: o nome do dispositivo, o sistema operacional, o assistente de IA, as versões do CLI e do harness e as ferramentas instaladas com suas versões.
- **Eventos de uso**: instalação, execução e atualização de ferramentas, com o nome e a versão de cada uma. Nunca o conteúdo: nem código, nem prompts, nem arquivos.
- **Token**: a conexão vale por 30 dias e se renova a cada atualização. Depois de 30 dias sem atualizar, você revalida no painel.
- **Limite de dispositivos**: cada plano permite um número de dispositivos conectados ao mesmo tempo.
- **Como desfazer**: você desconecta este dispositivo no painel, em Configurações, ou com `npx flyee logout`. As ferramentas já instaladas continuam funcionando; elas só deixam de atualizar.
$md$, true),

('cli-connection', 'en', 1, 'flyee CLI connection', $md$
By connecting this device, you authorize the flyee CLI to act for your account on this machine.

- **What the CLI can do**: read your profile and your plan, list the catalog, download the tools your plan unlocks and send usage events.
- **What is recorded**: the device name, the operating system, the AI assistant, the CLI and harness versions, and the installed tools with their versions.
- **Usage events**: installing, running and updating tools, with the name and version of each one. Never the content: no code, no prompts, no files.
- **Token**: the connection is valid for 30 days and renews with every update. After 30 days without updating, you revalidate in the dashboard.
- **Device limit**: each plan allows a number of devices connected at the same time.
- **How to undo it**: disconnect this device in the dashboard, under Settings, or with `npx flyee logout`. Tools you already installed keep working; they only stop updating.
$md$, true),

('newsletter', 'pt-BR', 1, 'Novidades por e-mail', $md$
Aceito receber por e-mail as novidades do flyee.club: lançamentos de ferramentas, mudanças nas IAs que afetam o que eu uso e convites para encontros. Para isso são usados o meu e-mail e, se eu informar, o nome, o segmento e o idioma. O envio é feito pela Resend. Posso cancelar a qualquer momento pelo link presente em toda mensagem.
$md$, true),

('newsletter', 'en', 1, 'News by e-mail', $md$
I agree to receive flyee.club news by e-mail: tool launches, changes in the AIs that affect what I use, and invitations to live sessions. My e-mail is used for that and, if I provide them, my name, segment and language. Messages are sent through Resend. I can unsubscribe at any time using the link in every message.
$md$, true)
on conflict (slug, locale, version) do nothing;
