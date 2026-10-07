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

## O número do consultório está no ar

**+55 84 99838-7075** — recebe e envia pela API, testado em 29/09/2026.

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

## Onde fica cada coisa

A conta tem 6 projetos na Railway com nome sorteado, 7 contas de WhatsApp com
nomes quase iguais e 5 apps na Meta. Boa parte do tempo perdido veio de abrir a
coisa errada.

| O quê | Onde |
|---|---|
| Serviço na Railway | projeto renomeado para `bot-whatsapp`, serviço `me`, endereço `me-production-a9ec.up.railway.app` |
| Conta de WhatsApp em uso | `Test WhatsApp Business Account` |
| Usuário do sistema | `AutomaçãoTriagem` |

**Não apague as outras contas de WhatsApp.** Uma delas guarda o 7075, que está em
análise na Meta, e apagar pode desvincular o número. Renomear com prefixo
(`[EM USO]`, `[AGUARDANDO META]`, `[NAO USAR]`) resolve a confusão sem risco.

## Identificadores

| O quê | Valor |
|---|---|
| App na Meta | `1364610259160568` — "Recomeco Constancia C..." (Em desenvolvimento) |
| Número do consultório | +55 84 99838-7075 — ID `1336481699545220`, conta `964855363000657` |
| Número de teste da Meta | +1 555 324 4505 — ID `1350488121473466` |
| Celular pessoal (recebe teste) | +55 84 99968-7397 — na lista da Meta, cadastrado SEM o nono dígito: +55 84 9968-7397 |
| Número que responde | +1 555 191 8167 — ID `1319832967883574` |
| Servidor | https://me-production-a9ec.up.railway.app |
| Planilha CRM | `1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg` |
| Service account do Google | `bot-whatsapp@project-30779c3d-8dbe-48db-927.iam.gserviceaccount.com` |
| Projeto no Google Cloud | `project-30779c3d-8dbe-48db-927` |

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

**Causa raiz ainda não confirmada**, e o log daquele momento se perdeu: cada
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

**Da Meta — o que falta para os follow-ups**

Os follow-ups D+2/3/5/7 são a única parte do sistema que ainda não funciona, e
os dois motivos são de conta, não de código:

- **Forma de pagamento.** Fora da janela de 24h a Meta só aceita template
  pré-aprovado, e template é cobrado. Sem cartão cadastrado, não sai.
- **Os 4 templates precisam ser cadastrados e aprovados.** Os textos estão na
  aba TEMPLATES DE NUTRIÇÃO da planilha; os nomes aprovados vão nas variáveis
  `WHATSAPP_TEMPLATE_D2/D3/D5/D7`.

Enquanto as variáveis estiverem vazias, cada follow-up é pulado com aviso no
log — o resto do sistema continua funcionando normalmente.

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
