import type { CatalogLocale } from "@/lib/catalog/links";

/**
 * The text of /instalar.md and /en/install.md: plain Markdown the member's AI
 * reads to install flyee (docs/PRODUCT.md, decisions of 2026-10-06 and
 * 2026-10-08: the member never uses the terminal, the AI runs every command).
 * The member pastes one sentence into the conversation and the AI follows this
 * page: it says what will happen, runs the login the member approves in the
 * browser, checks the result, installs the app the request calls for and goes
 * on in the same conversation, reading the
 * files flyee just wrote (the product's request of 2026-10-20, item 5: a new
 * conversation was a step the member does not need).
 *
 * Written in the code, in both languages (option 1 of 2026-10-08), so the copy
 * rules test reads every sentence (lib/i18n/copy-rules.test.ts): this file
 * holds text and nothing else. It uses only the commands the CLI 1.x has
 * (docs/CLI-CONTRACT.md, 8.2), written the way a command run by an AI needs
 * them:
 *  - `npx --yes`, because npx asks before downloading a package when it runs
 *    on a terminal, and some AIs run their commands on one; `flyee@latest` in
 *    every command, so the page never mixes two copies of the installer;
 *  - a time limit on what waits for the person (the login waits 5 minutes for
 *    the approval, a device code lives 10) or installs a program;
 *  - the notice BEFORE the login: a command in the foreground holds the AI's
 *    turn, so "tell them the browser opened" could only be said too late;
 *  - `add` with `--yes`, after one plain sentence: without a terminal the CLI
 *    answers its own question with "no", and the request is already the yes
 *    (the operator's decision of 2026-10-21, relayed by the product);
 *  - `catalog --json`, which changes nothing, to pick the app a job calls for
 *    when the project has no flyee block in its `AGENTS.md` yet;
 *  - `doctor` after an install, whose `programs` and `credentials` say, app
 *    by app, what is still missing;
 *  - `key set --browser`, which never asks for the key on the terminal and
 *    returns at once, leaving the page open for 15 minutes.
 * Every "otherwise" is written down, because an AI left to guess writes the
 * project files by hand, updates a Node.js another project depends on, changes
 * PowerShell's script policy or loops on a login nobody can approve. Most of
 * them came from three rounds of reading by AIs with no other context, in both
 * languages (2026-10-08).
 * It stays out of what only FlyeeClub Pro has (the page is public) and of the
 * account with no purchase (the installer's own messages speak of it).
 */

export type InstallGuideLinks = {
  /** The address of this page in the language it is read in. */
  install: string;
  /** The public store, where each app's page names it. */
  store: string;
  /**
   * The hosts a Claude Code session in the cloud has to allow for flyee to
   * work (lib/install-links.ts, `cloudAllowedHosts`): the site, and the
   * package storage while packages are served from it.
   */
  hosts: string[];
};

/** `a`, `a` e `b`, `a`, `b` e `c`: the hosts as the guide names them, in code. */
const listed = (hosts: string[], and: string) => {
  const named = hosts.map((host) => `\`${host}\``);
  return named.length < 2 ? named.join("") : `${named.slice(0, -1).join(", ")} ${and} ${named.at(-1)}`;
};

const PT_BR = (links: InstallGuideLinks): string[] => [
  "# Instalar o flyee",
  "",
  `Esta página foi escrita para a IA de quem está instalando o flyee: Claude Code, Codex, Gemini CLI, Cursor ou outra que rode comandos no computador da pessoa. Se você é essa IA, siga a página na ordem. Se você é a pessoa, cole na conversa com a sua IA: Instale o flyee seguindo ${links.install}`,
  "",
  "## O que o flyee faz",
  "",
  "O flyee é o instalador do FlyeeClub, uma loja de apps para a IA que a pessoa já usa. Ele conecta este computador à conta dela e escreve no projeto o que você precisa para usar os apps: um bloco no `AGENTS.md`, um apontador para ele nos arquivos de instruções que cada IA lê, a skill `flyee` e a pasta `.flyee`, onde os apps ficam. Ele não muda o que a pessoa escreveu nesses arquivos. Quem executa os apps é você, com o plano de IA da pessoa. O FlyeeClub não executa IA e não recebe o conteúdo do projeto: recebe só eventos de uso, como uma instalação ou uma atualização.",
  "",
  "## Antes de começar",
  "",
  "**Fale simples.** Fale com a pessoa em poucas frases, só sobre o que ela precisa fazer ou decidir e o resultado. Esta página é para você: não repita a ela comandos, arquivos, pastas, campos do JSON, versões ou o que você leu e conferiu, a menos que ela pergunte.",
  "",
  "1. A pessoa não usa o terminal: você roda todos os comandos. Ela só confirma na conversa, aprova a conexão no navegador e cola chaves numa página que o flyee abre no navegador dela.",
  "2. O pedido de instalação já é o sim: diga em uma frase o que vai fazer e siga. Pergunte só onde esta página pede um sim: o Node.js, o commit na nuvem.",
  "3. Rode os comandos na pasta do projeto em que ela quer usar os apps, escritos como estão aqui, mesmo quando uma mensagem do instalador escrever um deles de outro jeito. O `--yes` logo depois de `npx` baixa o instalador sem perguntar: sem ele, um terminal interativo fica esperando uma resposta. O `flyee@latest` pega sempre o instalador mais novo. No PowerShell do Windows, se o `npx` for recusado porque a execução de scripts está desativada, escreva `npx.cmd` no lugar dele, sem mudar essa configuração.",
  "4. Confira o Node.js com `node --version`. O flyee pede a versão 20 ou mais nova.",
  "   - Não há Node.js neste computador: diga isso à pessoa e, com o sim dela, instale a versão LTS pelo gerenciador de pacotes do sistema, com tempo limite de 10 minutos. Avise que o sistema pode pedir uma permissão numa janela. Se não houver gerenciador, ou se ele só tiver uma versão mais antiga que a 20, indique o instalador de https://nodejs.org e pare até ela avisar. Depois confira de novo. Se o comando ainda não aparecer, peça para ela fechar e abrir de novo o programa em que vocês conversam e repetir o pedido.",
  "   - Há um Node.js mais antigo: diga à pessoa a versão que encontrou, a que o flyee pede e que outro projeto deste computador pode depender da antiga. Só com o sim dela, atualize do mesmo jeito que esse Node.js foi instalado, e confira de novo. Sem o sim, pare.",
  "5. Rode `npx --yes flyee@latest doctor --json`, que não muda nada. No resultado, `connected` diz se este computador guarda uma conexão com a conta, e `adapters`, se os arquivos do flyee estão neste projeto:",
  '   - `connected` é `true` e todos os itens de `adapters` são `true`: o flyee já está aqui. Pule os passos e faça o que a pessoa pediu, como está em "Depois de instalar". Se ela pediu só para instalar o flyee, diga que ele já está instalado e pare.',
  "   - `connected` é `true` e algum item de `adapters` é `false`: o computador já está conectado e este projeto é novo. Se a pessoa pediu um app, ou algo que um app faz, pule os passos e instale o app, que isso escreve os arquivos do projeto. Se pediu só o flyee, siga os passos.",
  "   - `connected` é `false`: siga os passos.",
  "",
  "## Claude Code na nuvem",
  "",
  'Esta parte vale numa sessão do Claude Code na nuvem, aberta em claude.ai/code ou no app do Claude, onde a variável de ambiente `CLAUDE_CODE_REMOTE` é `true`. Fora dela, siga para "Passos".',
  "",
  `- A rede da sessão só chega aos endereços que o ambiente dela libera, e o flyee precisa de ${listed(links.hosts, "e")}. Se um comando do flyee responder \`error\` igual a \`host_not_allowed\`, mostre a \`message\` como veio: ela diz o endereço e o ajuste, que se faz uma vez. Se \`npx --yes flyee@latest doctor --json\` trouxer \`platform.reachable\` em \`false\`, mostre \`platform.message\`. O ajuste, que só a pessoa faz:`,
  "   1. Clicar no ambiente da sessão, em geral Default, no alto da sessão ou ao lado da caixa de mensagem, e escolher Editar ambiente de nuvem.",
  `   2. Em Acesso à rede, escolher Limitado e, em Domínios permitidos, escrever um endereço por linha: ${listed(links.hosts, "e")}.`,
  "   3. Deixar marcada a opção Permitir gerenciadores de pacotes, que mantém o npm, e clicar em Salvar alterações.",
  '- Quando a pessoa disser que fez, repita o comando que falhou, nesta mesma conversa. A sessão segue a regra nova em cerca de 1 minuto: se o comando falhar antes disso, espere e repita uma vez. Se falhar de novo, siga "Quando algo não sai como esperado".',
  "- Para conectar, use o login por código do passo 1: o navegador desta sessão não abre na frente da pessoa.",
  "- A página de uma chave também não abre na frente dela. Diga o nome da chave que falta e que ela pode guardá-la nas variáveis de ambiente desse mesmo ambiente, em Editar ambiente de nuvem, como `<NOME>=<valor>`, valendo a partir da próxima sessão. Nunca peça a chave na conversa.",
  "- Cada sessão começa num computador novo, com uma cópia nova do repositório, e o que o flyee escreve só chega à próxima sessão pelo repositório. Antes de terminar, peça o sim da pessoa numa frase e, com ele, faça o commit desses arquivos na branch de onde a próxima sessão vai começar, em geral a principal, e envie. Se o repositório for público, diga antes que os apps ficariam à vista de qualquer um. Não abra os arquivos para conferir: eles não guardam chave nem senha, e a conexão fica em `~/.flyee`, fora do projeto. O modo automático do Claude Code pode recusar, por cautela, gravar no repositório instruções vindas de fora: na primeira recusa, não tente de novo; peça que a pessoa troque o modo, ao lado da caixa de mensagem, por um que pede aprovação, e aprove o pedido que aparecer.",
  "- Numa sessão em que todos os itens de `adapters` do `doctor` vêm `true`, o flyee já está no projeto, mesmo com `connected` em `false`, e os apps instalados funcionam sem conexão. Conecte só para instalar ou atualizar um app. Se o login trouxer `device_limit_reached`, mostre `message` e `action_url` como vieram.",
  "",
  "## Passos",
  "",
  "1. Conecte o computador, de um destes dois jeitos. Se não souber qual, pergunte à pessoa se o navegador deste computador abre na frente dela. O login também escreve no projeto os arquivos do flyee.",
  "   - Com navegador: avise a pessoa de que o navegador vai abrir na página do FlyeeClub, para ela aprovar a conexão deste computador. Sem esperar resposta, rode `npx --yes flyee@latest login`, com tempo limite de 5 minutos, e espere o comando terminar. Só ela aprova.",
  "   - Sem navegador, ou com a pessoa longe da tela deste computador, como numa sessão SSH, num servidor ou num contêiner: rode `npx --yes flyee@latest login --device` de um jeito que deixe você ler a saída enquanto ele espera, por até 10 minutos (em segundo plano, se a sua ferramenta permitir). Passe à pessoa o endereço e o código que ele mostrar e continue lendo a saída até o comando terminar.",
  '2. Rode `npx --yes flyee@latest doctor --json` de novo. Está tudo certo quando `connected` é `true`, `platform.reachable` é `true` e todos os itens de `adapters` são `true`. Se algum deles vier `false`, veja "Quando algo não sai como esperado".',
  '3. Se a pessoa pediu um app, ou algo que um app faz, instale agora, nesta mesma conversa, como está em "Depois de instalar".',
  "4. Leia agora o bloco do flyee no `AGENTS.md` do projeto, que o login acabou de escrever, e siga nesta mesma conversa. Diga em uma frase que o flyee está pronto e o que ela pode pedir agora.",
  "",
  "## Depois de instalar",
  "",
  "Faça só o que a pessoa pediu. Os comandos valem nesta conversa e nas próximas, em que a skill `flyee` do projeto traz os mesmos. Todos respondem em JSON, menos o login, que mostra o endereço enquanto espera.",
  "",
  "- Instalar um app:",
  "   1. Escolha o app. Um nome que a pessoa deu vale como ela deu: um prefixo com dois pontos faz parte dele, não tire nem traduza. O nome de cada app está na página dele, em " +
    links.store +
    ". Se ela pediu um trabalho e não um app, escolha o app que faz esse trabalho pela lista do catálogo no bloco do flyee no `AGENTS.md` do projeto, ou por `npx --yes flyee@latest catalog --json`, que não muda nada.",
  '   2. Diga em uma frase simples qual app vai instalar e o que ele faz, como "Vou instalar o app X, que faz Y", e, sem esperar resposta, rode `npx --yes flyee@latest add <app> --yes --json`, com tempo limite de 10 minutos. Não liste permissões nem arquivos: fale de uma chave ou de um programa só quando a pessoa tiver de agir. O `--yes` do fim confirma a instalação: sem ele, nada é instalado. O comando instala também os programas que faltam.',
  "   3. Rode `npx --yes flyee@latest doctor --json`. Todos os itens de `adapters` devem vir `true`: se algum vier `false`, faça o login do passo 1, que escreve os arquivos. Em `programs` e em `credentials`, o campo `slug` diz de qual app é cada linha, e o resultado da instalação diz quais apps entraram. Nas linhas deles, um programa com `present` em `false` e uma chave com `set` em `false` são o que ainda falta: cuide só desses, como está nos dois itens abaixo.",
  "   4. Para usar o app, leia o `SKILL.md` dele em `.flyee/modules/<app>/skills/<skill>/SKILL.md`, uma pasta por skill, e siga nesta mesma conversa: a pessoa já pode pedir o que o app faz.",
  "- Uma chave de outro serviço que falta, uma de cada vez: avise a pessoa de que uma página vai abrir no navegador dela e rode `npx --yes flyee@latest key set <NOME> --browser --json`. O comando volta na hora, e a página fica aberta por 15 minutos para ela colar a chave. Quando ela disser que salvou, confira com `npx --yes flyee@latest key list --json`. Nunca peça a chave na conversa. Se ela colar uma chave na conversa, não use: diga para ela trocar essa chave no serviço que a emitiu e colar a nova na página, que você abre de novo com o mesmo comando. Se ela ainda não tem a chave, diga qual ficou faltando e siga: o app avisa quando precisar dela. Sem navegador neste computador, ou com a pessoa longe da tela dele, pare e diga isso a ela.",
  "- Um programa do sistema que continua faltando, como o ffmpeg: diga à pessoa o que vai instalar e, com o sim dela, rode `npx --yes flyee@latest need <programa> --yes --json`, com tempo limite de 10 minutos. Se o resultado trouxer `needs_member`, é o único passo que cabe à pessoa, como uma senha de administrador: mostre só esse passo e, quando ela disser que fez, rode o comando de novo.",
  "- Atualizar os apps: `npx --yes flyee@latest update --json`, com tempo limite de 10 minutos. Se vieram versões novas, leia de novo o bloco do flyee no `AGENTS.md` e o `SKILL.md` de cada app atualizado, porque a versão que você leu antes ficou para trás, e siga nesta mesma conversa.",
  "- Ver a conexão e os apps instalados: `npx --yes flyee@latest status --json`. Aqui `connected` diz se a plataforma ainda aceita a conexão.",
  "- Conectar este computador de novo: faça o login do passo 1, com navegador ou por código. Faça quando a pessoa pedir, mesmo que `connected` esteja `true`: a conexão nova troca a antiga. Confira com `npx --yes flyee@latest status --json`.",
  "",
  "## Quando algo não sai como esperado",
  "",
  "- O login não termina a tempo, ou termina e `connected` continua `false`: pergunte à pessoa se o navegador abriu na frente dela e se ela aprovou. Se abriu, rode o login de novo, uma vez. Se não abriu, use o login por código. Se falhar de novo, mostre a saída a ela e pare.",
  "- Depois do login, um item de `adapters` continua `false`: rode o login mais uma vez. Se continuar, mostre o resultado à pessoa e pare.",
  "- Outro comando passa do tempo limite: rode o mesmo comando de novo, uma vez. Se passar de novo, mostre a saída à pessoa e pare.",
  "- O sistema de permissões da sua ferramenta recusa um comando do flyee (no Claude Code, o modo automático): não procure outro caminho. Pergunte numa frase se pode fazer aquilo, dizendo o que é, e repita com o sim.",
  "- O resultado traz `ok` como `false` e a mensagem pede um novo login. O `error` costuma vir como `relogin` ou `not_logged`. Acontece depois de 30 dias sem atualizar ou quando o computador foi desconectado no painel: faça o login do passo 1, como está escrito nesta página e não como a mensagem o escreve, sem mostrar o `action_url`, e repita o que estava fazendo. Os apps instalados continuam funcionando enquanto isso.",
  "- Qualquer outro resultado com `ok` como `false`: mostre à pessoa `message` e `action_url` como vieram e pare. Quando ela disser que resolveu, repita o comando.",
  '- `platform.reachable` vem `false`: mostre à pessoa `platform.message` como veio. Se `platform.error` for `host_not_allowed`, a rede deste ambiente não chega à plataforma: peça o ajuste que a mensagem descreve, como está em "Claude Code na nuvem", espere ela dizer que fez e repita o comando. Com outro `platform.error`, a plataforma não respondeu: tente de novo quando ela pedir.',
  "",
  "Nunca cole tokens, chaves ou o conteúdo de `~/.flyee` na conversa, e nunca escreva à mão os arquivos que o flyee escreve.",
];

const EN = (links: InstallGuideLinks): string[] => [
  "# Install flyee",
  "",
  `This page is written for the AI of whoever is installing flyee: Claude Code, Codex, Gemini CLI, Cursor or another one that runs commands on the person's computer. If you are that AI, follow the page in order. If you are the person, paste this into the conversation with your AI: Install flyee by following ${links.install}`,
  "",
  "## What flyee does",
  "",
  "flyee is the installer of FlyeeClub, a store of apps for the AI the person already uses. It connects this computer to their account and writes into the project what you need to use the apps: a block in `AGENTS.md`, a pointer to it in the instruction files each AI reads, the `flyee` skill and the `.flyee` folder, where the apps live. It does not change what the person wrote in those files. You are the one who runs the apps, on the person's own AI plan. FlyeeClub never runs AI and never receives the content of the project: it receives only usage events, such as an install or an update.",
  "",
  "## Before you start",
  "",
  "**Keep it simple.** Talk to the person in a few sentences, only about what they need to do or decide and the result. This page is for you: do not repeat to them commands, files, folders, JSON fields, versions or what you read and checked, unless they ask.",
  "",
  "1. The person does not use the terminal: you run every command. They only confirm in the conversation, approve the connection in the browser and paste keys into a page that flyee opens in their browser.",
  "2. The request to install is already the yes: say in one sentence what you are about to do and go on. Ask only where this page asks for a yes: Node.js, the commit in the cloud.",
  "3. Run the commands in the folder of the project where they want to use the apps, written as they are here, even when a message of the installer writes one of them another way. The `--yes` right after `npx` downloads the installer without asking: without it, an interactive terminal waits for an answer. `flyee@latest` always gets the newest installer. On Windows PowerShell, if `npx` is refused because running scripts is disabled, write `npx.cmd` in its place, without changing that setting.",
  "4. Check Node.js with `node --version`. flyee needs version 20 or newer.",
  "   - There is no Node.js on this computer: tell the person and, with their yes, install the LTS version through the system's package manager, with a time limit of 10 minutes. Tell them the system may ask for permission in a window. If there is no package manager, or it only has a version older than 20, point them to the installer at https://nodejs.org and stop until they tell you. Then check again. If the command still does not show up, ask them to close and reopen the program you are talking in and to repeat the request.",
  "   - There is an older Node.js: tell the person the version you found, the one flyee needs, and that another project on this computer may depend on the old one. Only with their yes, update it the same way that Node.js was installed, and check again. Without their yes, stop.",
  "5. Run `npx --yes flyee@latest doctor --json`, which changes nothing. In the result, `connected` says whether this computer holds a connection to the account, and `adapters` whether flyee's files are in this project:",
  '   - `connected` is `true` and every item of `adapters` is `true`: flyee is already here. Skip the steps and do what the person asked, as described in "After installing". If they only asked to install flyee, tell them it is already installed and stop.',
  "   - `connected` is `true` and an item of `adapters` is `false`: the computer is already connected and this project is new. If the person asked for an app, or for something an app does, skip the steps and install the app, which writes the project's files. If they only asked for flyee, follow the steps.",
  "   - `connected` is `false`: follow the steps.",
  "",
  "## Claude Code in the cloud",
  "",
  'This part applies in a Claude Code session in the cloud, opened at claude.ai/code or in the Claude app, where the environment variable `CLAUDE_CODE_REMOTE` is `true`. Outside one, go on to "Steps".',
  "",
  `- The session's network only reaches the addresses its environment allows, and flyee needs ${listed(links.hosts, "and")}. If a flyee command answers \`error\` as \`host_not_allowed\`, show the \`message\` as it came: it names the address and the change, made once. If \`npx --yes flyee@latest doctor --json\` brings \`platform.reachable\` as \`false\`, show \`platform.message\`. The change, which only the person can make:`,
  "   1. Click the session's environment, usually Default, at the top of the session or next to the message box, and choose Edit cloud environment.",
  `   2. Under Network access, choose the level that takes a list of allowed domains (Custom or Limited, depending on the screen) and, under Allowed domains, write one address per line: ${listed(links.hosts, "and")}.`,
  "   3. Keep the package managers option checked, which keeps npm, and click Save changes.",
  '- When the person says it is done, repeat the command that failed, in this same conversation. The session follows the new rule within about a minute: if the command fails before that, wait and repeat it once. If it fails again, follow "When something does not go as expected".',
  "- To connect, use the login by code of step 1: this session's browser does not open in front of the person.",
  "- The page for a key does not open in front of them either. Tell them the name of the missing key and that they can keep it in the environment variables of that same environment, in Edit cloud environment, as `<NAME>=<value>`, which applies from the next session on. Never ask for the key in the conversation.",
  "- Each session starts on a new computer, with a new copy of the repository, and what flyee writes only reaches the next session through the repository. Before finishing, ask for the person's yes in one sentence and, with it, commit those files on the branch the next session will start from, usually the main one, and push it. If the repository is public, say first that the apps would be in view of anyone. Do not open the files to check them: they hold no key or password, and the connection lives in `~/.flyee`, outside the project. Claude Code's auto mode may refuse, out of caution, to write instructions that came from outside into the repository: at the first refusal, do not try again; ask the person to switch the mode, next to the message box, to one that asks for approval, and to approve the request that appears.",
  "- In a session where every item of `adapters` in the `doctor` result comes as `true`, flyee is already in the project, even with `connected` as `false`, and the installed apps work without a connection. Connect only to install or update an app. If the login brings `device_limit_reached`, show `message` and `action_url` as they came.",
  "",
  "## Steps",
  "",
  "1. Connect the computer, in one of these two ways. If you do not know which, ask the person whether this computer's browser opens in front of them. The login also writes flyee's files into the project.",
  "   - With a browser: tell the person the browser is about to open on the FlyeeClub page, for them to approve this computer's connection. Without waiting for an answer, run `npx --yes flyee@latest login`, with a time limit of 5 minutes, and wait for the command to finish. Only they approve it.",
  "   - With no browser, or with the person away from this computer's screen, as in an SSH session, on a server or in a container: run `npx --yes flyee@latest login --device` in a way that lets you read the output while it waits, for up to 10 minutes (in the background, if your tool allows it). Give the person the address and the code it shows and keep reading the output until the command finishes.",
  '2. Run `npx --yes flyee@latest doctor --json` again. All is well when `connected` is `true`, `platform.reachable` is `true` and every item of `adapters` is `true`. If one of them comes as `false`, see "When something does not go as expected".',
  '3. If the person asked for an app, or for something an app does, install it now, in this same conversation, as described in "After installing".',
  "4. Read now the flyee block in the project's `AGENTS.md`, which the login just wrote, and go on in this same conversation. Say in one sentence that flyee is ready and what they can ask for now.",
  "",
  "## After installing",
  "",
  "Do only what the person asked. The commands work in this conversation and in the next ones, where the project's `flyee` skill carries the same ones. All of them answer in JSON, except the login, which shows the address while it waits.",
  "",
  "- Install an app:",
  "   1. Choose the app. A name the person gave is used as they gave it: a prefix with a colon is part of it, do not drop it or translate it. The name of each app is on its page, at " +
    links.store +
    ". If they asked for a job and not for an app, choose the app that does that job from the catalog list in the flyee block of the project's `AGENTS.md`, or from `npx --yes flyee@latest catalog --json`, which changes nothing.",
  '   2. Say in one plain sentence which app you are about to install and what it does, like "I am installing the app X, which does Y", and, without waiting for an answer, run `npx --yes flyee@latest add <app> --yes --json`, with a time limit of 10 minutes. Do not list permissions or files: mention a key or a program only when the person has to act. The `--yes` at the end confirms the install: without it, nothing is installed. The command also installs the programs that are missing.',
  "   3. Run `npx --yes flyee@latest doctor --json`. Every item of `adapters` should come as `true`: if one comes as `false`, do the login of step 1, which writes the files. In `programs` and in `credentials`, the field `slug` says which app each line belongs to, and the result of the install says which apps came in. In their lines, a program with `present` as `false` and a key with `set` as `false` are what is still missing: take care of those only, as described in the two items below.",
  "   4. To use the app, read its `SKILL.md` at `.flyee/modules/<app>/skills/<skill>/SKILL.md`, one folder per skill, and go on in this same conversation: the person can already ask for what the app does.",
  "- A key of another service that is missing, one at a time: tell the person a page is about to open in their browser and run `npx --yes flyee@latest key set <NAME> --browser --json`. The command returns at once, and the page stays open for 15 minutes for them to paste the key. When they say it is saved, check with `npx --yes flyee@latest key list --json`. Never ask for the key in the conversation. If they paste a key into the conversation, do not use it: tell them to replace that key at the service that issued it and to paste the new one into the page, which you open again with the same command. If they do not have the key yet, say which one is still missing and move on: the app says so when it needs it. With no browser on this computer, or with the person away from its screen, stop and tell them so.",
  "- A system program that is still missing, such as ffmpeg: tell the person what you are about to install and, with their yes, run `npx --yes flyee@latest need <program> --yes --json`, with a time limit of 10 minutes. If the result brings `needs_member`, it is the one step that is theirs to take, such as an administrator password: show only that step and, when they say it is done, run the command again.",
  "- Update the apps: `npx --yes flyee@latest update --json`, with a time limit of 10 minutes. If new versions came, read again the flyee block in `AGENTS.md` and the `SKILL.md` of each updated app, because the version you read before is now behind, and go on in this same conversation.",
  "- See the connection and the installed apps: `npx --yes flyee@latest status --json`. Here `connected` says whether the platform still accepts the connection.",
  "- Connect this computer again: do the login of step 1, with a browser or by code. Do it when the person asks, even if `connected` is `true`: the new connection replaces the old one. Check with `npx --yes flyee@latest status --json`.",
  "",
  "## When something does not go as expected",
  "",
  "- The login does not finish in time, or it finishes and `connected` is still `false`: ask the person whether the browser opened in front of them and whether they approved. If it opened, run the login again, once. If it did not, use the login by code. If it fails again, show them the output and stop.",
  "- After the login, an item of `adapters` is still `false`: run the login once more. If it stays so, show the result to the person and stop.",
  "- Another command runs past its time limit: run the same command again, once. If it runs past it again, show the person the output and stop.",
  "- Your tool's permission system refuses a flyee command (in Claude Code, auto mode): do not look for another way. Ask in one sentence whether you may do it, saying what it is, and repeat it with their yes.",
  "- The result has `ok` as `false` and the message asks for a new login. The `error` usually comes as `relogin` or `not_logged`. It happens after 30 days without an update or when the computer was disconnected in the dashboard: do the login of step 1, as it is written on this page and not as the message writes it, without showing the `action_url`, and repeat what you were doing. Installed apps keep working in the meantime.",
  "- Any other result with `ok` as `false`: show the person `message` and `action_url` as they came and stop. When they say it is sorted, repeat the command.",
  '- `platform.reachable` comes as `false`: show the person `platform.message` as it came. If `platform.error` is `host_not_allowed`, this environment\'s network does not reach the platform: ask for the change the message describes, as in "Claude Code in the cloud", wait for them to say it is done and repeat the command. With another `platform.error`, the platform did not answer: try again when they ask.',
  "",
  "Never paste tokens, keys or the content of `~/.flyee` into the conversation, and never write by hand the files flyee writes.",
];

const GUIDES: Record<CatalogLocale, (links: InstallGuideLinks) => string[]> = { "pt-BR": PT_BR, en: EN };

/** The page, as Markdown, in one language. */
export function installGuide(locale: CatalogLocale, links: InstallGuideLinks): string {
  return `${GUIDES[locale](links).join("\n")}\n`;
}
