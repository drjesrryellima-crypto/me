# Onde o projeto está

Última atualização: 29/09/2026 (sistema completo — número no ar e alerta de crise no celular)

Documento pra retomar sem depender de memória. O `README.md` explica como cada
coisa funciona; este aqui diz **o que já está de pé, o que está travado e por quê**.

---

## Funcionando

**O ciclo completo está de pé** (22/09/2026): mensagem no WhatsApp → webhook na
Railway → assistente com IA → resposta entregue no celular. Provado ponta a ponta.

| O quê | Como conferir |
|---|---|
| Servidor no ar | abrir `/health` — responde `{"ok":true}` |
| Webhook da Meta | mandar `oi` pro +1 555 191 8167 |
| Gravação no Google Sheets | `npm run testar-planilha` |
| Assistente com IA (Claude) | `npm run conversar` |
| Envio pelo WhatsApp | `npm run testar-whatsapp <numero>` |
| Suíte de testes | `npm test` |

O bot grava na aba **Leads Bot** da planilha `CRM_Leads_Dr_Jesrryel - OFICIAL`,
com a coluna Estágio falando o vocabulário da aba FUNIL.

## Para colocar no ar

Roteiro guiado, passo a passo, com link direto pra cada tela (sem passar pela
lista de 5 apps / 5 contas / 5 planilhas) e o bloco de variáveis já montado:

**https://claude.ai/artifact/NU6Y72iNY9yJaH6Wk9ZM84**

Cobre: buscar os 5 valores → subir na Railway → registrar o webhook na Meta →
mandar a primeira mensagem. Não precisa de terminal. O que for digitado lá fica
no navegador — nada é enviado nem salvo depois que a aba fecha.

O roteiro foi escrito quando o sistema ainda usava o número de teste da Meta.
Hoje o remetente é o 7075: `WHATSAPP_PHONE_NUMBER_ID` = `1336481699545220`.

## O nono dígito — leia antes de debugar entrega

A Meta identifica número de celular brasileiro **sem o nono dígito**. O celular
+55 84 99968-7397 chega no webhook como `558499687397`, e é pra esse
identificador que o bot responde — que é o comportamento correto.

Só que a **lista de destinatários permitidos** (a do modo de teste) compara ao
pé da letra. Cadastrar o número completo não basta: o envio é recusado com
**131030**, dizendo que o destinatário não está na lista, mesmo estando.

**A solução foi cadastrar a versão sem o nono dígito.** Parece número errado e
não é.

Isso só afeta o modo de teste — em produção não existe lista de permitidos. Mas
enquanto o app não for publicado, todo número novo que for testar precisa entrar
nas duas formas, ou só na versão sem o nono.

## O alerta de crise chega no celular

Quando um paciente sinaliza risco, o bot acolhe, para de automatizar **e avisa o
médico no Telegram** — com o telefone e a frase exata. Testado em 29/09/2026.

Antes disso o alerta só existia no log: a peça que protege quem escreve às 3 da
manhã dependia de alguém estar lendo servidor.

| | |
|---|---|
| Bot do Telegram | `@alertas_jesrryel_bot` |
| Variável | `TELEGRAM_BOT_TOKEN` na Railway |

**Se um dia parar de chegar**, a ordem de checagem está no log, filtrando por
`telegram`. O caso mais provável: o Telegram só aceita mensagem de um bot para
quem já falou com ele — se o chat for apagado, é mandar `oi` para
`@alertas_jesrryel_bot` de novo, e o destino é redescoberto sozinho.

**Por que não SMS nem WhatsApp:** SMS pelo Zapier exige plano pago (testado), e
o WhatsApp não entrega mensagem iniciada pelo negócio fora da janela de 24h —
que às 3 da manhã está fechada. O Telegram não tem nenhuma das duas limitações.

**A frase do paciente vai para o Telegram, não para o log.** O médico precisa
das palavras exatas para julgar urgência; o log de um serviço de terceiro não.

## Do alerta até a resposta: um toque

O alerta do Telegram traz `Abrir conversa: https://wa.me/<numero>`. Um toque
abre a conversa. Antes eram quatro passos (selecionar, copiar, abrir o
WhatsApp, colar na busca) — de madrugada, às vezes num alerta de crise.

O número vai **sem** o nono dígito, como a Meta manda. É o formato que o
`wa.me` entende. Se alguém "consertar" o DDD ali, o link para de abrir — tem
teste travando isso (`test/link-whatsapp.test.js`).

**Mas o link abre no WhatsApp do celular, que é o 7397.** O paciente escreveu
para o 7075. Para responder pelo número certo existe o botão **Responder** no
painel (`/dashboard`): a mensagem sai pelo mesmo `WHATSAPP_PHONE_NUMBER_ID` da
assistente, então para o paciente é a mesma conversa.

Duas coisas que o Responder **não** faz, de propósito:

- **não tira o lead do HANDOFF.** A automação continua calada. Devolver a
  conversa para o bot é o outro botão, o Reativar.
- **não grava nada se o envio falhar.** Histórico com mensagem que não saiu faz
  o médico achar que respondeu.

O botão só aparece dentro da janela de 24h da Meta. Fora dela o texto livre é
recusado, e o painel diz isso em português em vez de devolver "131047
re-engagement message".

## Como ler a conversa que o paciente teve com o bot

Botão **Conversa**, na linha do lead no painel. Abre a conversa inteira: fala do
paciente, fala da assistente e o que você mesmo mandou pelo painel, cada uma
com rótulo e hora.

**Este é o único lugar onde essa conversa pode ser lida**, e isso não é
limitação do painel:

- o 7075 é número de **Cloud API**. Não tem app de WhatsApp instalado, e não
  pode ter — instalar derruba o webhook e a automação para.
- a Meta **não dá caixa de entrada** para número de API. O WhatsApp Manager
  mostra contagem de conversa e custo, não o texto.
- o log da Railway, **de propósito**, só guarda o tamanho das mensagens. É
  servidor de terceiro e conversa de paciente sobre saúde mental não fica
  escrita lá.
- o `wa.me` do alerta abre a conversa do **7397** (seu celular) com a pessoa —
  é outra conversa, começa vazia.

Duas coisas que a tela diz e que valem ler:

- **hora só aparece quando foi registrada.** Falas gravadas antes desta versão
  não têm hora, e o campo vem vazio em vez de mostrar a hora de agora — numa
  conversa clínica, inventar quando a pessoa falou algo não é detalhe.
- **guarda as últimas 40 falas.** Numa conversa mais longa que isso o começo
  não existe mais, e a tela avisa em vez de deixar você concluir que a conversa
  começou ali.

Abrir a conversa escreve no log `[dashboard] conversa de <numero> aberta (N
turnos)` — **que** houve acesso, nunca o que foi lido. É dado de saúde: o
registro de acesso é a favor, o conteúdo no log seria contra.

## O número do consultório está no ar

**+55 84 99838-7075** — recebe e envia pela API, testado em 29/09/2026.
**Aprovado pela Meta e totalmente ativo em 11/10/2026**, saindo do estado "em
análise" em que ficou desde o cadastro.

**Atende qualquer pessoa.** Confirmado com um número que nunca esteve em lista
de permissão nenhuma: escreveu e foi respondido. É a diferença entre "funciona
pra mim" e "funciona pra paciente" — e foi ela que o número de teste da Meta
nunca conseguiu cruzar.

| | |
|---|---|
| Conta (WABA) | `dr jesrryel` — `964855363000657` |
| Phone Number ID | `1336481699545220` |
| Nome visível | dr jesrryel |
| Status | Conectado, qualidade Alta |

O que destravou não foi uma ação isolada: entre 22 e 29/09 o app saiu de
"em desenvolvimento" para publicado, ganhou política de privacidade e CNPJ, e a
conta `964855363000657` — que não aparecia no Gerenciador do WhatsApp — voltou a
aparecer, com o número conectado.

**Para o token permanente enxergar este número**, a conta `dr jesrryel` precisa
estar atribuída ao usuário do sistema `AutomaçãoTriagem`, junto com o app. Só o
app não basta: o envio falha com 131005, que fala de permissão sem dizer qual.

### O que estava travado antes (histórico)

Vale guardar, porque descreve um estado que pode voltar em outro número:

1. O número aparecia na lista de remetentes, com nome e foto
2. Envio recusado com **131037** — nome de exibição não aprovado
3. A conta `964855363000657` **não aparecia** no Gerenciador do WhatsApp
4. A tela de verificação não enviava SMS nem fazia ligação
5. As últimas tentativas retornavam "WhatsApp indisponível"

Nenhum desses sintomas tinha a ver com o código.

## Qual repositório é este

Existem dois repositórios de bot de WhatsApp na conta. **O projeto é o `me`.**

| | `me` | `triagem-whatsapp` |
|---|---|---|
| Linguagem | Node.js | Python/Flask |
| Tamanho | ~2.000 linhas, 52 testes | 263 linhas, 1 commit, sem teste |
| Máquina de estados | sim | não |
| Assinatura da Meta | sim | não |
| Dedupe de reenvio | sim | não |
| Follow-ups D+2/3/5/7 | sim | não |
| CRM de 13 colunas + FUNIL | sim | grava linha solta |
| Painel de leads | sim | não |

O `triagem-whatsapp` (último push 19/09/2026) foi o protótipo anterior — a
primeira tentativa, antes do fluxo com qualificação, nutrição e handoff. Fica
guardado como histórico. **Na Railway, e em qualquer deploy, escolha `me`.**

As duas ausências que mais pesam no protótipo não são de conforto: sem
validação de assinatura, quem descobrir o endereço forja um alerta de crise;
sem dedupe, um reenvio da Meta joga a resposta do lead na coluna errada.

## O volume persistente

Criado e **verificado** em 29/09/2026. Montado em `/data`, que é para onde
`DATA_DIR` aponta.

A verificação não foi por log: foi uma conversa em andamento que sobreviveu a um
redeploy no meio dela — a assistente continuou de onde parou, em vez de
cumprimentar como se fosse a primeira vez. É o teste que mede o que o paciente
sentiria.

Sem ele, todo deploy apagava o estado dos leads, o histórico das conversas e a
memória de evento já processado.

**Um teste que NÃO serve:** olhar se `[flow] ... entrou em estado` mudou depois
de um "Oi". Quando a IA está conduzindo, um cumprimento não muda o estado de
propósito — ele fica em `NOVO` até o lead contar alguma coisa. `NOVO` ali não
distingue volume quebrado de estado que não mudou.

## O token do WhatsApp

**É permanente. Não vence.** Foi gerado em 29/09/2026 pelo usuário do sistema
`AutomaçãoTriagem` (ID `61594312449393`), no Business Manager.

Antes disso o projeto usava o token temporário do painel de desenvolvedor, e ele
derrubou o bot duas vezes em um dia:

| Código | O que aconteceu |
|---|---|
| `190` | venceu sozinho, 24h depois de gerado |
| `131005` | foi invalidado ao gerar outro token no painel |

Se um dia precisar gerar de novo (`business.facebook.com/settings/system-users`):

1. Selecione `AutomaçãoTriagem`
2. Confira que ele tem **os dois** ativos: o app `Recomeco Constancia CRM` **e** a
   conta de WhatsApp. Só o app não basta — o token sai sem permissão pro número
   e falha com 131005
3. **Gerar token** → app `Recomeco Constancia CRM` → validade **Nunca** →
   permissões `whatsapp_business_messaging` e `whatsapp_business_management`
4. Do painel da Meta **direto** pra variável `WHATSAPP_TOKEN` na Railway. O token
   aparece uma vez só, e não deve passar por chat, e-mail ou anotação

**Anular tokens**, na mesma tela, invalida na hora — é o que fazer se um vazar.

## A automação do n8n foi desligada (14/10/2026)

Existia um segundo sistema respondendo os pacientes: o workflow **`My workflow
6`** no n8n, ativo, 307 execuções, **enviando pelo mesmo `phoneNumberId` do
7075** (`1336481699545220`). Dois sistemas, um número, cada mensagem do
paciente virando resposta de dois lugares.

Ele foi **desativado, não apagado** — continua lá, parado, junto com os outros
cinco que já estavam desligados.

**Isto revisa o diagnóstico das 21 mensagens.** Na época a conclusão foi: o
paciente escreveu em pedaços e o bot respondeu cada pedaço. Isso é parte da
história, mas a duplicação foi descartada cedo demais — faltou olhar fora do
repositório. Com dois sistemas no mesmo número, as duas causas se somavam.

O que o workflow mandava, e que contradizia as regras do consultório:

| O que ele fazia | A regra |
|---|---|
| Dizia `R$ 350` sem o paciente perguntar | valor só quando perguntam |
| Explicava os programas junto do preço da consulta | programa nunca ao lado de dinheiro |
| Mandava o paciente para o celular pessoal (7397) | a resposta sai pelo 7075, botão Responder |
| Dizia "segunda a sábado, das 8h às 18h" | a agenda real tem intervalo de almoço |
| Tinha outro texto de crise | o aprovado está em `messages.js` |
| Não tinha PARAR, freio, nem teto de gastos | todos valem no bot |

**O conteúdo bom dele foi aproveitado** — ver `src/consultorio.js`: a descrição
detalhada dos programas, o que acontece na consulta, o retorno cobrado à parte
e a referência do Partage no endereço. As regras não mudaram; o que mudou foi a
substância do que o bot sabe dizer.

**Antes de procurar bug de duplicação no código, confira se não há outra
automação no ar.** O repositório não é o sistema inteiro.

## O projeto `bot-whatsapp` tem DOIS serviços

| Serviço | O que é |
|---|---|
| `me` | o bot deste repositório — webhook, assistente, painel, follow-up do funil |
| `whatsapp-leads-disparo` | **outro programa, em Python, que não está neste repositório** |

O `whatsapp-leads-disparo` dispara templates pagos para uma lista própria, todo
dia às 9h de Mossoró, com teto próprio de 50 por dia. Em 14/10/2026 ele saiu do
modo SIMULAÇÃO para o modo REAL e enviou 50 mensagens na primeira manhã,
usando os mesmos templates `followup_*` do funil.

**É intencional** — confirmado pelo Dr. Jesrryel em 14/10/2026. Não é bug, não
é duplicação do `me`, e não deve ser "consertado" por quem encontrar as linhas
`[disparo]` no log.

Duas consequências de ter dois remetentes no mesmo número:

- **o teto real do dia é a soma dos dois.** O `TETO_TEMPLATES_DIA` daqui (50)
  não enxerga o que o outro serviço mandou — são contagens separadas.
- **a nota de qualidade do 7075 é compartilhada.** Disparo para quem não pediu
  derruba a nota do número que o funil também usa. Acompanhar em WhatsApp
  Manager → Números de telefone; se cair para Média, é sinal para agir.

## O bot marca a consulta sozinho

Desde 15/10/2026, quem quer marcar não entra mais na sua fila. O bot lê a
agenda do Google, oferece três horários livres e cria o compromisso.

| Peça | O que faz |
|---|---|
| `src/vagas.js` | calcula os horários livres: faixas do consultório menos o que já está ocupado |
| `src/google-agenda.js` | lê a agenda e cria o compromisso |
| `src/escolha-vaga.js` | lê qual opção o paciente escolheu |
| `src/agendamento.js` | junta as três e devolve o texto |

**Para funcionar, duas coisas fora do código:**

1. a agenda `drjesrryelsilva@gmail.com` compartilhada com a conta de serviço
   `bot-whatsapp@project-30779c3d-8dbe-48db-927.iam.gserviceaccount.com`, com
   permissão de **fazer alterações nos eventos** (só ver não serve);
2. `GOOGLE_CALENDAR_ID` na Railway com o endereço dessa agenda.

Sem a variável o agendamento fica **desligado** e quem quer marcar volta a ser
encaminhado — de propósito: melhor a fila antiga do que chutar em qual agenda
escrever.

### O que o compromisso leva, e o que não leva

Vai nome, telefone e formato. **O motivo clínico não vai.** Agenda espelha em
celular, relógio e notificação na tela de bloqueio — o que a pessoa contou
sobre a saúde dela não viaja junto. Quem precisa do motivo abre o painel.

### Quatro armadilhas que os testes travam

- **fuso.** Mossoró é UTC-3 e o servidor roda em UTC. Consulta às 22h de terça
  já é quarta em UTC; sem tratar, o paciente recebe a confirmação do dia errado.
- **encostar não é sobrepor.** Evento que termina 14h não bloqueia a vaga das
  14h — senão todo almoço comia a primeira consulta da tarde.
- **a vaga precisa caber.** A última da manhã é 11h, não 12h.
- **"pode ser 2a feira" não é a opção 2.** É segunda-feira. Este marcava o
  horário errado sem ninguém notar.

### Quem ainda vai para você

Só quem pergunta **valor ou funcionamento dos programas** de acompanhamento —
é a conversa em que o preço é justificado, e é a regra que você definiu. Mais
o agendamento que falhar: a pessoa tentou marcar e o sistema não conseguiu,
então vira handoff com o motivo escrito.

## Onde fica cada coisa

A conta tem 6 projetos na Railway com nome sorteado, 7 contas de WhatsApp com
nomes quase iguais e 5 apps na Meta. Boa parte do tempo perdido veio de abrir a
coisa errada.

| O quê | Onde |
|---|---|
| Serviço na Railway | projeto **`bot-whatsapp`** (renomeado em 14/10/2026; era `hearty-success`), serviço `me`, endereço `me-production-a9ec.up.railway.app` |
| Conta de WhatsApp em uso | `Test WhatsApp Business Account` |
| Usuário do sistema | `AutomaçãoTriagem` |

**Não apague as outras contas de WhatsApp.** Uma delas guarda o 7075 — agora
aprovado e ativo (11/10/2026) — e apagar pode desvincular o número. A análise
da Meta ter terminado reduz o risco, não o elimina: desvincular um número
aprovado custa mais caro que desvincular um em análise, porque recuperar
significa refazer a aprovação.

Renomear com prefixo (`[EM USO]`, `[NAO USAR]`) resolve a confusão sem risco
nenhum, e é o que vale fazer. O prefixo `[AGUARDANDO META]` não serve mais
para nada — nada está aguardando.

**Os outros projetos da Railway continuam com os nomes sorteados**
(`impartial-vibrancy`, `zealous-balance`, …), e um deles tem quatro serviços de
banco e não é o bot.

Esta tabela já dizia `bot-whatsapp` **antes** de o projeto ter sido renomeado —
a anotação era do plano, não do feito, e custou uma caçada por um projeto que
não existia com aquele nome. O nome agora confere; a lição não é sobre o nome.

### Como achar o projeto certo na Railway

Nome é pista, não prova: ele muda, e a anotação envelhece sem avisar. O que
decide é o **endereço público do serviço** — abre o projeto, clica no serviço e
confere se é `me-production-a9ec.up.railway.app`. Data do último deploy ajuda a
chutar a ordem, mas também não é prova: dois projetos podem ter subido no mesmo
dia.

## Identificadores

| O quê | Valor |
|---|---|
| App na Meta | `1364610259160568` — "Recomeco Constancia C..." (Em desenvolvimento) |
| Número do consultório | +55 84 99838-7075 — ID `1336481699545220`, conta `964855363000657` |
| Número de teste da Meta | +1 555 324 4505 — ID `1350488121473466` |
| Celulares do médico (números de teste) | +55 84 99968-7397 (`558499687397`) e +55 84 99709-6643 (`558497096643`) — os dois estão em `NUMEROS_DE_TESTE`. O 7397 está na lista da Meta cadastrado SEM o nono dígito: +55 84 9968-7397 |
| Número que responde | +1 555 191 8167 — ID `1319832967883574` |
| Servidor | https://me-production-a9ec.up.railway.app |
| Planilha CRM | `1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg` |
| Service account do Google | `bot-whatsapp@project-30779c3d-8dbe-48db-927.iam.gserviceaccount.com` |

### O follow-up agora nasce da planilha (18/10/2026)

Desde 18/10/2026 quem conversa com o paciente é o **fluxo do n8n**, não este
bot — decisão do médico. O webhook da Meta aponta para o n8n, e este serviço
não recebe mais mensagem nenhuma.

Isso deixou o follow-up sem fonte: os leads nasciam das conversas daqui. A
correção foi trocar só a FONTE, não o motor.

| Peça | Quem faz |
|---|---|
| Conversar e qualificar | n8n |
| Registrar o lead | n8n, na aba **FUNIL** da planilha |
| Mandar D+2/D+3/D+5/D+7 | este bot, lendo aquela aba |

`src/funil.js` lê a aba, descobre quem merece follow-up e coloca na fila. Dali
em diante é o motor de sempre (`followup-plano.js`): teto de mensagens pagas
por dia, freio por pessoa, PARAR, e **uma etapa por rodada**.

**Quem entra na fila:** `Estágio` = `Consulta Proposta` **e** `Escolha` vazia.
Ou seja: viu os dois programas e não respondeu. Quem escolheu "Programa" já
está com o médico; quem escolheu "Consulta" já recebeu as instruções. Mandar
"ficou alguma dúvida?" para esses dois é ruído.

**O relógio é a coluna `Data 1º Contato`**, porque o n8n não grava a data da
qualificação. É aproximação: quem demora uma semana para responder as três
perguntas tem o D+2 já vencido no dia em que qualifica. A tolerância de 3 dias
do `followup-plano.js` então **pula** aquelas etapas em vez de disparar uma
rajada — erra para menos, que é o lado certo de errar com mensagem paga.
Se um dia isso incomodar, a correção é o n8n gravar a data ao preencher
`Formato`.

**Quatro armadilhas, todas com teste que cai se a trava sumir:**

| Trava | O que acontece sem ela |
|---|---|
| Cabeçalho na linha **4**, não na 1 | as três primeiras linhas são título e legenda; lendo da 1, "CRM" vira nome de coluna e NENHUMA linha casa — follow-up mudo, sem erro |
| Não reancorar `catalogoEnviadoEm` | a cada leitura diária o relógio reiniciaria, o D+2 venceria sempre "amanhã" e nada sairia nunca |
| `PARADOS` vence a planilha | quem pediu PARAR continua listado lá; sem a trava, voltaria a receber mensagem paga — LGPD art. 18 |
| Número de teste fora | o médico testando entraria na fila paga |

A leitura falhar **não derruba a rodada**: o erro é engolido e quem já está na
fila continua sendo atendido pelo que está no disco.

**Nada sai enquanto os quatro templates não estiverem aprovados em
Portuguese (BR).** Ver TEMPLATES-WHATSAPP.md.

### Como o bot abre uma conversa

Desde 15/10/2026, a primeira fala do bot em qualquer conversa é:

> **Boa noite! Aqui é do consultório do Dr. Jesrryel Lima — eu sou a assistente dele** 💙

O cumprimento muda com a hora **de Mossoró** (UTC-3, sem horário de verão):
bom dia das 5h às 11h59, boa tarde das 12h às 17h59, boa noite das 18h às 4h59.
O servidor roda em UTC, então sem essa conta um "boa noite" de 21h sairia como
"bom dia" — justamente no horário em que mais paciente escreve.

Isso não é cortesia, é honestidade: a pessoa está contando coisa íntima no
WhatsApp de um consultório e precisa saber que do outro lado está uma
assistente automática, não o médico. Quem acha que fala com o médico escreve
coisas diferentes, e espera respostas que este canal não dá.

**Mora em um lugar só** (`src/abertura.js`, colado pelo `responderLead()` do
`flow.js`) porque toda fala do bot sai por ali: a IA, o roteiro fixo e os
handoffs. Eram onze pontas; em uma delas era questão de tempo até alguém
esquecer, e o pedido era "sempre". O texto enviado e o texto guardado no
histórico são o mesmo — senão o painel mostraria a conversa sem a apresentação
e não daria para saber se o bot se apresentou.

**Duas exceções, de propósito:**

| Caminho | Por quê |
|---|---|
| Resposta a risco | "Boa noite! ... 💙" na frente de "você não precisa atravessar isso sozinho(a)" muda o tom de tudo e empurra o 188 uma linha para baixo. O texto já diz "este canal é do consultório", que é a identificação que importa ali |
| Templates (follow-up D+2/D+3/D+5/D+7 e primeiro contato do disparo) | O texto está **registrado na Meta**, não no código. Mudar a abertura deles é editar o template no Meta Business Manager e esperar aprovação |

### Por que os seus números aparecem no painel

Tudo que está no painel entrou pelo 7075 — não existe outro caminho de entrada.
O webhook só recebe o que a Meta entrega para o número do consultório. Então uma
linha com `558497096643` quer dizer **aquele número escreveu para o 7075**, não
que a conversa aconteceu no celular pessoal.

Os dois celulares do médico (7397 e 6643) escreveram para o 7075 em testes, e o
bot os registrou como lead qualquer. Isso sujava três coisas: a conta de leads do
painel e da planilha, a fila de follow-up **pago** e os alertas no celular.

`NUMEROS_DE_TESTE` resolve. O bot continua respondendo — é disso que o teste
serve — mas para de tratar o teste como paciente:

| Onde | O que muda |
|---|---|
| Painel | fora da lista por padrão; reaparece marcado `(teste)` com a opção "mostrar meus números de teste", porque esconder não pode virar perder (ele ainda precisa poder reativar um teste travado em HANDOFF) |
| Planilha de CRM | não grava |
| Follow-up D+2/D+3/D+5/D+7 | não envia (é mensagem paga) |
| Alerta de handoff e de handoff parado | não dispara; só fica no log |
| HANDOFF / DESQUALIFICADO | **não entra**. Recebe o mesmo texto do paciente e segue conversando |

**A armadilha do silêncio permanente, que custou um susto.** HANDOFF e
DESQUALIFICADO deixam a automação calada de propósito — é para não atropelar o
humano que assumiu. Mas para um número de teste nenhum humano assume, porque o
alerta não dispara. O primeiro commit tratou do alerta e esqueceu do estado: o
teste caía em HANDOFF e ficava mudo **para sempre**, o bot esperando um humano e
o humano nunca avisado. Porta trancada e chave jogada fora no mesmo commit.

Aconteceu em 15/10/2026 às 05:02 e só apareceu às 08:15, quando o médico
escreveu de novo e não recebeu nada:

```
05:02:47  [alert] 558497096643 é número de teste — handoff registrado, ninguém avisado.
08:15:41  [flow] ... em estado HANDOFF — ignorada pela automação.
```

Agora `encaminharParaHumano` não move um número de teste para estado calado: ele
recebe o mesmo texto que o paciente receberia (é disso que o teste serve), a nota
fica registrada para o painel, e a conversa segue. O aviso de "voltou a escrever
em HANDOFF" também passou a respeitar a lista — era o último alerta que ainda
tocava o celular do médico por um teste dele.

**A armadilha do nono dígito.** O mesmo celular aparece em duas formas: como
está na agenda (`+55 84 99709-6643`, 13 dígitos) e como a Meta entrega no
`wa_id` (`558497096643`, 12 dígitos). Comparar texto com texto deixaria a lista
sem efeito nenhum — e sem quebrar nada, sem avisar nada. Por isso todo telefone
passa por `canonizar()` antes de ser comparado (`src/numeros-de-teste.js`).
| Projeto no Google Cloud | `project-30779c3d-8dbe-48db-927` |

## O teto de gastos é nosso, não da Meta

**A Meta não oferece teto de gastos para mensagem de WhatsApp.** O "limite de
gastos" do painel dela é de conta de **anúncios**. Para mensagem a cobrança é
por **limiar de faturamento**: ela avisa e cobra, não corta. Do lado dela não há
freio.

Do lado de cá há, desde 14/10/2026 (`src/orcamento.js`): **teto de 50 mensagens
pagas por dia**, ajustável por `TETO_TEMPLATES_DIA`.

Por que um teto global, se já existe o freio: o `src/freio.js` é **por pessoa**
(3 por minuto). Um laço disparando template para centenas de leads diferentes
passa por ele inteiro — cada um dentro do seu limite individual. É exatamente
esse o caso que vira conta surpresa, e é o que este teto pega.

O dia vira à **meia-noite local** (Mossoró), não à de UTC: a meia-noite de UTC
é 21h aqui, e o teto zerar ali daria orçamento novo de graça no meio da noite.

**Um `[orcamento] 🚨 TETO DIÁRIO ATINGIDO` é quase sempre bug.** O consultório
manda no máximo 4 follow-ups por lead, uma etapa por dia — 50 cobre volume
muito acima do real. Antes de aumentar o número, descubra por que ele foi
atingido.

Lead barrado pelo teto **não** é marcado como enviado: ele recebe o follow-up
amanhã, quando houver orçamento.

## O follow-up não dispara rajada ao ligar o pagamento

Enquanto os templates não estão configurados, cada etapa vencida era pulada
**sem registro**. O estrago estava armado para o dia em que o pagamento na Meta
fosse ligado: um lead com o catálogo enviado há 30 dias tem `dias = 30`, maior
que 2, 3, 5 **e** 7 — e receberia os quatro follow-ups na primeira rodada.
Mensagens pagas, atrasadas semanas, em rajada, para quem já tinha esfriado.

Mesma forma do episódio das 21 mensagens, com duas pioras: custa dinheiro e vai
para quem não está mais ouvindo.

Desde 14/10/2026 (`src/followup-plano.js`):

- **Uma etapa por rodada, por lead.** O agendador roda uma vez por dia; duas de
  uma vez não é conversa, é disparo.
- **Etapa atrasada mais de 3 dias é pulada, não enviada.** "Passando pra saber
  se ficou dúvida" três semanas depois não retoma conversa — só lembra a pessoa
  de que ela é uma linha numa planilha. O que foi pulado fica em
  `followupsPulados`, senão venceria de novo em toda rodada, para sempre.
- **O freio vale para template também.** Ele morava só no `enviar()` do
  `flow.js`, que este caminho não usa — era um buraco por onde uma rajada paga
  passaria inteira.

**Antes de ligar o pagamento**, vale abrir o painel e ver quantos leads estão em
`CATALOGO_ENVIADO` com data antiga. Eles serão marcados como pulados na primeira
rodada, sem receber nada — que é o certo, mas é bom saber que vai acontecer.

## O bot espera você terminar de escrever

Quem desabafa escreve em pedaços:

```
abri uma caixa hoje
tinha foto da minha avó
chorei que nem criança
```

São três linhas de um pensamento só. O bot respondia **as três**, separadamente
— e responder assim mostra que do outro lado não tem ninguém ouvindo, tem uma
máquina reagindo a estímulo.

Agora ele junta o que chegou, espera **8 segundos de silêncio** e responde uma
vez só (`src/agrupador.js`). Teto de **30 segundos** para quem não para de
escrever: silêncio para quem está em sofrimento é pior que uma resposta no meio.

Ajustável por `AGRUPADOR_ESPERA_MS` e `AGRUPADOR_ESPERA_MAXIMA_MS`.

**Sinal de crise e PARAR furam a fila.** Esperar 8 segundos de silêncio para
responder a quem disse que quer se matar é exatamente o tipo de otimização que
não se faz. O que já estava no buffer entra junto na mesma chamada, senão
ficaria pendurado num timer cancelado.

**O buffer é de memória, e tudo bem:** quem dispara é um timer deste processo,
então persistir não ajudaria. A mensagem em si não se perde — só a resposta,
numa janela de 8 segundos, se o processo reiniciar exatamente ali.

## O dia das 21 mensagens (07/10/2026)

Um paciente recebeu **21 mensagens do bot em 5 segundos**, no meio de uma
conversa sobre uma caixa de fotos de família que o tinha feito chorar. Várias
eram respostas diferentes à mesma fala dele; uma era a mensagem de
boas-vindas, fora de ordem; e uma dizia *"A consulta é de 1 hora e dá pra
parcelar no cartão, viu?"* — sem ninguém ter perguntado nada sobre dinheiro.

Três mudanças saíram disso. As duas primeiras são certezas; a terceira é um
freio que vale **seja qual for a causa**.

**1. Preço só quando perguntam — agora em código.** O prompt já proibia e o
modelo fez assim mesmo. `violaCompliance` recebe a fala do paciente e barra
qualquer menção a dinheiro na resposta quando ele não puxou o assunto. Falar
de preço num desabafo é pior que não responder: transforma a conversa em
balcão de vendas.

**2. O webhook lia só a PRIMEIRA mensagem do lote.** A Meta agrupa mensagens
que chegam juntas num POST só. Quem escrevia "oi" / "você está aí?" / "preciso
falar" tinha duas descartadas em silêncio — fora do histórico, fora do alerta,
inexistentes para o sistema. Agora o lote inteiro é processado, em ordem, cada
uma passando pelo dedupe.

**3. Freio de envio** (`src/freio.js`): no máximo **3 mensagens por pessoa por
minuto**. Não conserta a causa — garante que o pior caso seja constrangedor em
vez de assustador. O contador sobrevive a reinício, porque o reenvio da Meta
atravessa deploy.

**Um `[freio] 🚨 ENVIO BLOQUEADO` no log é SEMPRE bug.** Quando aparecer,
procure: reenvio da Meta por timeout, réplica duplicada do serviço, ou laço.

**Causa raiz confirmada em 11/10/2026: não era duplicação, era ritmo.** O
paciente mandou muitas mensagens seguidas e o bot respondeu uma por uma. As
duas hipóteses de duplicação foram descartadas — `Replicas` é **1**, e o
código não tem caminho que multiplique (um ponto de entrada, uma chamada de IA
por mensagem, sem retry, dedupe síncrono gravado em disco antes de processar).
O conserto é o agrupamento, na seção acima.

O que segue valeu mesmo assim, como rede: **causa raiz, à época, não confirmada**, e o log daquele momento se perdeu: cada
deploy da Railway tem seu próprio fluxo, e o das 13:10 ficou no deploy
anterior. Para ler um log antigo: aba **Deployments** → o deploy que estava
ativo na hora → **Deploy Logs**.

Suspeitas, em ordem: mais de uma instância do serviço atendendo o webhook
(cada uma com seu próprio `processados.json`), reenvio da Meta acumulado nos
vários deploys daquele dia, ou o arquivo de dedupe perdido.

**A próxima vez responde sozinha.** Toda linha de entrega agora leva a marca
do processo que a escreveu: `[webhook:a3f9c1] mensagem de ...`. **Dois códigos
diferentes na mesma janela são prova de instância duplicada**; um só descarta
a hipótese e aponta para reenvio.

**Vale conferir agora, sem esperar incidente:** Railway → serviço `me` →
**Settings** → procure **Replicas**. Tem que ser **1**. Com volume montado a
Railway normalmente impede mais de uma, mas é a verificação mais barata que
existe para a suspeita principal.

## "token inválido" no painel

O painel abre em `/dashboard?token=SUA_SENHA`, com a senha de `DASHBOARD_TOKEN`.

Se recusar, a própria mensagem diz qual é o caso. As duas causas reais:

1. **Caractere que o navegador corta ou transforma** na senha: `#`, `&`, `+`,
   `%`, espaço. Com `#`, tudo depois vira âncora e nem chega no servidor.
   **Use só letras, números e hífen.**
2. **Espaço sobrando** no valor salvo na Railway. Desde 07/10/2026 os dois
   lados são aparados antes de comparar — antes disso um espaço invisível
   derrubava o acesso e não havia como descobrir olhando a tela, porque os
   dois valores parecem idênticos.

Perdeu a senha? Não precisa recuperar: crie `DASHBOARD_TOKEN` de novo com um
valor novo em Variables e dê Deploy. Depois salve o link pronto, com o token,
nos favoritos do celular.

## O que a assistente sabe responder sozinha

Até 04/10/2026 ela não sabia quase nada: o prompt mandava não inventar
endereço, horário nem valor — e como esses fatos não estavam em lugar nenhum,
toda pergunta concreta virava handoff. O médico virou o FAQ do próprio
consultório.

Os fatos agora vivem em **`src/consultorio.js`** (valor avulso, duração,
pagamento, endereço, online) e **`src/agenda.js`** (faixas de atendimento).
O que não está lá, ela continua não afirmando.

| Pergunta | Quem responde |
|---|---|
| Valor da consulta avulsa | assistente — **só se perguntarem** |
| Duração, endereço, online/presencial | assistente |
| Formas de pagamento | assistente |
| Que horas / que dias atende | assistente, em **faixas** |
| Como funcionam Recomeço e Constância | assistente |
| **Preço** do Recomeço ou do Constância | **médico** |
| Quer fechar um programa | **médico** |
| Quer marcar consulta | **médico** |
| Qualquer coisa que ela não saiba | **médico** (`nao_sei`) |

**Ela fala em faixas, nunca em vagas.** Não enxerga a agenda real — prometer
"terça às 15h está livre" seria marcar em cima de paciente que já está lá.

**Edite as faixas no painel**, na seção "Horários que a assistente informa".
Valem no **próximo deploy**: o prompt é montado uma vez por processo para o
cache da API não ser jogado fora a cada mensagem.

**O lembrete do dia anterior é seu, não do sistema.** Não existe agendamento
gravado aqui, logo não existe nada para disparar lembrete. O texto fala do
lembrete como rotina do consultório, nunca como promessa do robô.

**A rede de compliance mudou junto** (`violaCompliance` em `assistente.js`).
Ela barrava qualquer menção a preço; se tivesse ficado assim, a resposta certa
("a consulta é R$ 350") seria barrada e o lead cairia no fluxo fixo — o recurso
anulado em silêncio. Hoje ela barra: valor diferente de R$ 350, preço de
programa, número de parcelas, "sem juros", "plano" e "consulta psiquiátrica".

## "O bot parou de responder" — leia isto primeiro

**Causa nova desde 04/10/2026: App Secret errado.** Com `WHATSAPP_APP_SECRET`
definido, todo POST da Meta é conferido. Se o valor colado estiver errado ou
for de outro app, **nada entra** — o bot fica mudo com todo mundo. O log diz
qual é o caso:

```
[webhook] ⚠️  POST REJEITADO: a assinatura não confere com o WHATSAPP_APP_SECRET
configurado. Se as mensagens pararam de chegar, é quase certo que o App Secret
colado está errado ou é de outro app — confira em developers.facebook.com → ...
```

Isso é **diferente** de:

```
[webhook] POST rejeitado: sem header x-hub-signature-256 — este POST não veio
da Meta (scanner, curl ou link)
```

O segundo é ruído da internet e não precisa de ação. O primeiro é configuração
quebrada. Até 04/10/2026 os dois saíam com a mesma frase.

App Secret do app: developers.facebook.com/apps/`1364610259160568`/settings/basic/



Quase sempre não parou: **o lead está em HANDOFF**, e aí a automação fica
calada de propósito. O log mostra assim:

```
[webhook] mensagem de 558497096643 (2 caracteres)
[flow] mensagem de 558497096643 chegou com o lead em estado HANDOFF
[flow] mensagem de 558497096643 em estado HANDOFF — ignorada pela automação.
```

Recebeu, processou, calou. É o comportamento certo: a conversa é sua, não do
bot. **Para devolver ao bot: botão Reativar, na linha do lead no painel.**

Isso vale também pra DESQUALIFICADO e CLIENTE.

Em 04/10/2026 esta mensagem custou uma investigação inteira porque a linha do
meio dizia *"entrou em estado HANDOFF"* a cada mensagem — como se houvesse
transição. Não havia: o lead já estava lá. A redação foi corrigida e tem teste
travando.

**Um lead que entrou em HANDOFF antes de 04/10/2026** não tem `handoffEm`, então
o vigia de handoff parado não re-alerta sobre ele (de propósito: um deploy não
pode virar avalanche de notificação). Se for o caso, Reativar e refazer.

## Descadastro (PARAR/SAIR)

A LGPD dá o direito de revogar o consentimento a qualquer momento (art. 18,
IX). Até 04/10/2026 o único caminho era o e-mail da política de privacidade —
que ninguém lê e ninguém usa. Na prática, não havia como sair.

Agora o bot atende **PARAR, PARE, SAIR, CANCELAR, DESCADASTRAR, REMOVER,
STOP** e "não quero mais receber". A pessoa recebe uma confirmação, o lead vai
para `DESCADASTRADO` e nada mais é enviado.

**A comparação é com a mensagem INTEIRA, nunca "contém".** "Não pare de me
ajudar", "a dor não para", "quero parar de tomar o remédio" não descadastram
ninguém. O custo de um falso positivo é calar para sempre quem estava pedindo
ajuda. Por isso **"para" sozinho ficou de fora**: é a palavra mais fácil de
aparecer solta numa conversa real.

**Crise ganha do descadastro.** Se a mensagem for sinal de risco, vira handoff
prioritário. Ninguém é descadastrado no meio de um pedido de socorro.

**Quem está em HANDOFF também consegue sair.** Era o único caminho de saída, e
ficava bloqueado justamente para quem mais tinha motivo de usá-lo.

**Nada é apagado.** Motivo, histórico e classificação continuam onde estão.
Apagar automaticamente destruiria registro que o consultório pode ser obrigado
a guardar. A exclusão de verdade continua sendo pedida pelo e-mail da política
e avaliada caso a caso.

**Se a pessoa voltar a escrever**, o bot NÃO responde — um robô que volta a
falar sozinho depois de "pare" é exatamente o que ela pediu para não acontecer.
Mas você é avisado no Telegram (`✉️ DESCADASTRADO VOLTOU A ESCREVER`), e pode
trazê-la de volta pelo botão **Reativar**. Só humano reabre essa porta.

Na planilha o estágio vira "Desqualificado" — imperfeito para quem só exerceu
um direito, mas é o valor que significa "não procurar". A verdade exata fica na
coluna "Estado (técnico)".

## Quando o paciente volta a escrever

A automação fica calada com quem está em HANDOFF. Até 04/10/2026 ela ficava
calada para os **dois** lados: o paciente não recebia resposta do bot e o
médico não era avisado de nada — a mensagem virava só uma linha de log. Para
quem estava do outro lado, indistinguível de ter sido esquecido.

Agora toda mensagem de alguém em HANDOFF dispara aviso no Telegram, com o link
da conversa e o texto da pessoa. Em caso de risco o cabeçalho muda para
`🚨 EM CRISE E ESCREVEU DE NOVO`.

**Rajada vira um aviso só** (janela de 10 minutos). Quem está em sofrimento
escreve "oi", "você está aí?", "preciso falar" em dois minutos — cinco
notificações seguidas ensinam a silenciar o alerta, e aí o de crise some junto.

**Mensagem nova reinicia o relógio do vigia.** A pessoa passou a esperar a
partir daquela mensagem, não desde o handoff original. Sem isso o vigia ou
acharia que ela espera há dias e dispararia na hora mentindo no tempo, ou a
daria por atendida e nunca mais olharia para ela.

Só HANDOFF avisa. DESQUALIFICADO pediu laudo e foi recusado; CLIENTE já é
paciente — nenhum dos dois é alguém esperando resposta agora.

## O handoff que ninguém atendeu

O alerta de crise dispara **uma vez**. Celular no silencioso, consulta em
andamento, notificação arrastada sem ler — e o sistema ficava calado para
sempre. O paciente ouviu "o Dr. Jesrryel vai te procurar" e esperava. Era o
pior modo de falha que sobrou: silencioso, e pior justamente em crise.

Agora um vigia checa de 10 em 10 minutos (`src/handoff-parado.js`) e insiste:

| | Espera | Repete até | Madrugada |
|---|---|---|---|
| Crise | 20 min | 6 vezes (~2h) | **avisa** |
| Handoff comum | 4h | 2 vezes | espera 8h |

Crise não respeita horário de silêncio — é o ponto do recurso. Handoff comum
respeita: acordar o médico às 3h por um lead gasta a confiança no alerta, e
alerta que a gente aprende a ignorar estraga justamente o de crise.

**Como o aviso para:** responder pelo painel já marca como atendido. Se você
respondeu pelo **seu celular**, o sistema não tem como ver — aí use o botão
**Atendido** na linha do lead. As linhas de quem ainda está esperando têm uma
barra vermelha à esquerda no painel.

O limite existe de propósito: se em duas horas ninguém apareceu, insistir mais
não resolve, e o paciente já recebeu o 188 na primeira mensagem.

## Pendências

**Antes de divulgar o número pra paciente**
- Definir `WHATSAPP_APP_SECRET` na Railway. **O painel avisa sozinho:** se
  estiver faltando, aparece uma tarja vermelha "Webhook desprotegido" no topo
  do `/dashboard`. Sem a variável, o endereço do webhook aceita mensagem de
  qualquer origem — dá pra forjar conversa de um telefone que não é do paciente
  e disparar falso alerta de crise.

  Onde pegar: developers.facebook.com → seu app → **Configurações → Básico** →
  App Secret (botão "Mostrar"). Cola direto na variável da Railway — não passa
  por chat nenhum.

  Variável criada **em branco** é o caso que mais engana: aparece configurada
  no painel da Railway e não protege nada. A tarja continua vermelha nesse caso,
  de propósito.

## O app está publicado

Publicado em 29/09/2026. Para isso a Meta exigiu três coisas que estavam
vazias: categoria, ícone e **URL de política de privacidade** — esta última
servida pelo próprio bot, em `/privacidade`.

Publicar é pré-requisito de tudo que vem depois: sem isso, mesmo o 7075
destravado não atenderia paciente.

**O que publicar NÃO resolve:** o número de teste da Meta só fala com os números
cadastrados na lista de destinatários permitidos. Essa trava é do número de
teste, não do modo do app. Quem a levanta é ter um número próprio em produção —
o 7075.

**Os follow-ups entraram no ar em 14/10/2026.** Eram a última parte do sistema
que não funcionava, e os dois motivos eram de conta, não de código. Os dois
caíram no mesmo dia:

- **Forma de pagamento cadastrada na Meta.** Fora da janela de 24h ela só
  aceita template pré-aprovado, e template é cobrado.
- **Os 4 templates aprovados e ativos**, com os nomes nas variáveis da Railway:

| Template | Variável |
|---|---|
| `followup_d2_conteudo` | `WHATSAPP_TEMPLATE_D2` |
| `followup_d3_duvida` | `WHATSAPP_TEMPLATE_D3` |
| `followup_d5_conteudo` | `WHATSAPP_TEMPLATE_D5` |
| `followup_d7_conversa` | `WHATSAPP_TEMPLATE_D7` |

O valor é o **nome** do template, não o texto. Variável vazia faz cada etapa
ser pulada com aviso no log, sem derrubar o resto.

**O disparo é uma vez por dia, às 9h de Mossoró** (`src/followup.js`, ajustável
por `FOLLOWUP_HORA`). Não é a cada mensagem: ligar as variáveis não manda nada
na hora, a primeira rodada é na manhã seguinte.

Os dois freios que valem aqui já estavam de pé antes: etapa vencida há mais de
3 dias é pulada em vez de enviada (sem rajada ao ligar o pagamento) e há teto de
50 mensagens pagas por dia. Ver as duas seções acima.

**Do Dr. Jesrryel**
- Revisar o system prompt de `src/assistente.js` — é ele quem aprova o que a
  assistente pode dizer sobre saúde mental
- Apagar a linha de teste (telefone `5500000000000`) da aba Leads Bot

**Técnicas — já dá pra fazer, não espera a Meta**
- Renomear as contas de WhatsApp com prefixo pra parar de confundir (sem apagar
  nenhuma — veja "Onde fica cada coisa")
- Corrigir o nome da aba `Leads Brutos Whatsapp` → `Leads Brutos WhatsApp`
  (com "A" maiúsculo), senão a automação antiga da Zapier não acha

## Arrumação que vale a pena, sem pressa

Há 5 planilhas de CRM, 5 apps na Meta e 5 contas de WhatsApp Business na conta.
Boa parte da confusão desta configuração veio disso — telas abrindo na conta
errada, número sumindo de listas. Vale identificar o que é usado de verdade e
arquivar o resto.
