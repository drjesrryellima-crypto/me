# Onde o projeto está

Última atualização: 29/09/2026 (app publicado, token permanente, volume persistente)

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

Enquanto o 7075 não sai, o roteiro usa o **número de teste da Meta**. Quando
liberar, é trocar `WHATSAPP_PHONE_NUMBER_ID` por `1336481699545220` e mais nada.

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

## Travado, e não é código

O número do consultório **+55 84 99838-7075** não consegue ser verificado na
Meta. O que já aconteceu, em ordem:

1. O número aparece na lista de remetentes do app, com nome e foto
2. Envio por ele é recusado com **erro 131037** — nome de exibição não aprovado
3. A conta dele (`964855363000657`) **não aparece** no Gerenciador do WhatsApp
4. A tela de verificação **não envia** SMS nem faz ligação
5. Tentativas mais recentes retornam **"WhatsApp indisponível"**

Nada disso se resolve mexendo no código. É estado da conta na Meta, e o caminho
é o suporte deles.

**O canal em si funciona:** uma mensagem de teste foi entregue com sucesso pelo
botão "Enviar mensagem" do painel da Meta, usando outro número.

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

## Pendências

**Antes de divulgar o número pra paciente**
- Decidir se o log deve continuar registrando a mensagem do paciente na íntegra
  (`[webhook] mensagem de <número>: "<texto>"`). Útil pra depurar, mas é
  conteúdo de saúde mental num log de terceiro.

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

**Da Meta (esperar ou abrir chamado)**
- Verificação do 7075
- Aprovação do nome de exibição
- Forma de pagamento — sem ela os follow-ups D+2/3/5/7 não saem
- Cadastrar os 4 templates de follow-up (os textos estão na aba TEMPLATES DE NUTRIÇÃO)

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
