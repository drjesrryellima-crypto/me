# Onde o projeto está

Última atualização: 21/09/2026

Documento pra retomar sem depender de memória. O `README.md` explica como cada
coisa funciona; este aqui diz **o que já está de pé, o que está travado e por quê**.

---

## Funcionando

| O quê | Como conferir |
|---|---|
| Gravação no Google Sheets | `npm run testar-planilha` |
| Assistente com IA (Claude) | `npm run conversar` |
| Envio pelo WhatsApp | `npm run testar-whatsapp <numero>` |
| Suíte de testes | `npm test` |

O bot grava na aba **Leads Bot** da planilha `CRM_Leads_Dr_Jesrryel - OFICIAL`,
com a coluna Estágio falando o vocabulário da aba FUNIL.

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

## Identificadores

| O quê | Valor |
|---|---|
| App na Meta | `1364610259160568` — "Recomeco Constancia C..." (Em desenvolvimento) |
| Número do consultório | +55 84 99838-7075 — ID `1336481699545220`, conta `964855363000657` |
| Número de teste da Meta | +1 555 324 4505 — ID `1350488121473466` |
| Celular pessoal (recebe teste) | +55 84 99668-7397 |
| Planilha CRM | `1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg` |
| Service account do Google | `bot-whatsapp@project-30779c3d-8dbe-48db-927.iam.gserviceaccount.com` |
| Projeto no Google Cloud | `project-30779c3d-8dbe-48db-927` |

## Pendências

**Da Meta (esperar ou abrir chamado)**
- Verificação do 7075
- Aprovação do nome de exibição
- Publicar o app (hoje está "Em desenvolvimento", o que restringe tudo)
- Forma de pagamento — sem ela os follow-ups D+2/3/5/7 não saem
- Cadastrar os 4 templates de follow-up (os textos estão na aba TEMPLATES DE NUTRIÇÃO)

**Do Dr. Jesrryel**
- Revisar o system prompt de `src/assistente.js` — é ele quem aprova o que a
  assistente pode dizer sobre saúde mental
- Apagar a linha de teste (telefone `5500000000000`) da aba Leads Bot

**Técnicas, quando a Meta liberar**
- Webhook + ngrok pra receber mensagem
- Deploy na Railway (ver seção "Deploy na Railway" do README) — o volume
  persistente precisa existir ANTES do primeiro deploy
- Corrigir o nome da aba `Leads Brutos Whatsapp` → `Leads Brutos WhatsApp`
  (com "A" maiúsculo), senão a automação antiga da Zapier não acha

## Arrumação que vale a pena, sem pressa

Há 5 planilhas de CRM, 5 apps na Meta e 5 contas de WhatsApp Business na conta.
Boa parte da confusão desta configuração veio disso — telas abrindo na conta
errada, número sumindo de listas. Vale identificar o que é usado de verdade e
arquivar o resto.
