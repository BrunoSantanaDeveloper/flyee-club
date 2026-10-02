-- Phase 7.3 of docs/PLANO-IMPLEMENTACAO.md (docs/TRACKING.md): the Meta Pixel
-- and GA4 also load in the member dashboard, under the same opt-out as the
-- public site (never on the admin consoles), so the privacy policy and the
-- cookie policy say so. A published text never changes
-- (guard_consent_term_text, migration 0001): version 1 is switched off and
-- version 2 is published, in both languages. Only the sentences about where
-- the trackers run differ from version 1; CONSENT_VERSION 4 in
-- apps/web/src/lib/analytics.ts brings the cookie notice back.

update public.consent_terms
set is_active = false
where slug in ('privacy', 'cookies') and version = 1 and is_active;

insert into public.consent_terms (slug, locale, version, title, body_md, is_active) values
('privacy', 'pt-BR', 2, 'Política de Privacidade', $md$
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
- **Consentimento**: enviar novidades por e-mail a quem pediu, e usar cookies de análise e de anúncios no site e no painel. O consentimento pode ser retirado a qualquer momento.

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

('privacy', 'en', 2, 'Privacy Policy', $md$
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
- **Consent**: sending news by e-mail to those who asked for it, and using analytics and advertising cookies on the site and in the dashboard. Consent can be withdrawn at any time.

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

('cookies', 'pt-BR', 2, 'Política de Cookies', $md$
Cookies são pequenos arquivos que o site grava no seu navegador. Esta política diz quais usamos e como recusar os que não são essenciais.

## 1. Cookies essenciais

Necessários para o site funcionar; não dependem de consentimento.

- **Sessão**: mantêm você conectado à sua conta.
- **Idioma**: guardam o idioma escolhido, por até um ano.
- **Preferência de cookies**: guardam a sua resposta ao aviso de cookies.
- **Cupom e origem**: guardam o cupom e a campanha do link pelo qual você chegou, para que continuem valendo até a compra.

## 2. Cookies de análise e de anúncios

No site público e no painel de integrante carregamos o Pixel da Meta e o Google Analytics, que gravam os cookies `_fbp`, `_fbc` e `_ga` para medir visitas, o uso do painel e o resultado das campanhas. Você pode recusá-los no aviso de cookies, a qualquer momento; a recusa fica guardada no seu navegador.

## 3. Medição no servidor

Além dos cookies, enviamos à Meta e ao Google, a partir do nosso servidor, os eventos das nossas próprias vendas (cadastro e compra), para saber quais campanhas funcionam. Esse envio se baseia no nosso legítimo interesse e não depende dos cookies acima.

## 4. O que não fazemos

O flyee CLI não usa cookies. Ele envia apenas eventos de uso com o nome e a versão das ferramentas, como descrito na Política de Privacidade.

## 5. Como controlar

Além do aviso de cookies, o seu navegador permite bloquear ou apagar cookies. Bloquear os essenciais impede o login.
$md$, true),

('cookies', 'en', 2, 'Cookie Policy', $md$
Cookies are small files the site stores in your browser. This policy says which ones we use and how to refuse the ones that are not essential.

## 1. Essential cookies

Required for the site to work; they do not depend on consent.

- **Session**: keep you signed in to your account.
- **Language**: remember the language you chose, for up to one year.
- **Cookie preference**: remember your answer to the cookie notice.
- **Coupon and origin**: remember the coupon and the campaign of the link you arrived through, so they still apply at purchase.

## 2. Analytics and advertising cookies

On the public site and in the member dashboard we load the Meta Pixel and Google Analytics, which set the `_fbp`, `_fbc` and `_ga` cookies to measure visits, dashboard use and campaign results. You can refuse them in the cookie notice at any time; the refusal is stored in your browser.

## 3. Server-side measurement

Besides cookies, we send Meta and Google, from our server, the events of our own sales (sign-up and purchase), to learn which campaigns work. This is based on our legitimate interest and does not depend on the cookies above.

## 4. What we do not do

The flyee CLI does not use cookies. It only sends usage events with the name and version of tools, as described in the Privacy Policy.

## 5. How to control them

Besides the cookie notice, your browser lets you block or delete cookies. Blocking the essential ones prevents sign-in.
$md$, true);
