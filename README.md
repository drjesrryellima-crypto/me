# Fluxo de Atendimento WhatsApp — Recomeço / Constância

MVP funcional do fluxo de qualificação, catálogo, follow-up e handoff descrito no
briefing técnico. Testado localmente end-to-end (webhook → qualificação → handoff).
**Falta apenas plugar suas credenciais reais** para funcionar com o WhatsApp de verdade.

---

## O que já está pronto e testado

- Servidor webhook (Express) que recebe mensagens do WhatsApp
- Máquina de estados: boas-vindas → 3 perguntas de qualificação → catálogo
- Detecção de **sinal de crise** (prioridade máxima, testada)
- Detecção de **sinal de intenção de compra** (interrompe o fluxo em qualquer etapa, testada)
- Registro de cada lead em arquivo local (`data/leads.json`) + integração com Google Sheets
- Agendador dos follow-ups D+2, D+3, D+5, D+7
- Alerta de handoff (log no console + webhook opcional, ex: Slack/Zapier)
- **Dashboard de leads** (`/dashboard`): funil de qualificação, leads por dia, classificação, alerta de risco e a lista completa com busca e filtros

## O que você precisa fazer antes de rodar de verdade

### 1. Criar o app na Meta e obter as credenciais

1. Acesse [developers.facebook.com](https://developers.facebook.com) → crie um app tipo "Business".
2. Adicione o produto **WhatsApp** ao app.
3. No painel do WhatsApp, pegue:
   - **Token de acesso** (comece com o temporário pra testar; depois gere um permanente via System User)
   - **Phone Number ID**
4. Cole esses valores no arquivo `.env` (copie `.env.example` para `.env` primeiro).

> ⚠️ A aprovação para produção (poder mandar mensagem pra qualquer número, não só números de teste) exige verificação da empresa pela Meta — isso pode levar alguns dias. Comece testando com números de teste cadastrados no próprio painel.

### 2. Expor seu terminal pra internet (pra a Meta conseguir chamar seu webhook)

Como você vai rodar isso no seu computador, a Meta precisa de uma URL pública HTTPS pra enviar as mensagens. Use o [ngrok](https://ngrok.com):

```bash
# instale o ngrok (ex: via brew no Mac, ou baixe o binário)
ngrok http 3000
```

Isso te dá uma URL tipo `https://algumacoisa.ngrok-free.app`. Use `https://algumacoisa.ngrok-free.app/webhook` como **Callback URL** no painel da Meta, e o valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env` como **Verify Token**.

> ⚠️ **Importante sobre "rodar no terminal":** enquanto for a versão gratuita do ngrok, a URL muda toda vez que você reinicia — ou seja, o WhatsApp só vai funcionar enquanto seu computador estiver ligado, o terminal aberto, e a URL cadastrada na Meta for a mesma da sessão atual do ngrok. Pra ficar "sempre no ar" de verdade, o próximo passo natural é colocar isso num servidor/VPS (ex: Railway, Render, um EC2 pequeno) — não precisa fazer isso agora, mas é bom já saber que "rodar no terminal" tem esse limite.

### 3. Configurar o Google Sheets

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto → ative a **Google Sheets API**.
2. Crie uma **Service Account** → gere uma chave JSON → salve como `credentials/service-account.json` nesta pasta.
3. Crie uma planilha no Google Sheets com uma aba chamada `Leads` e a primeira linha com os cabeçalhos: `Telefone | Nome | Motivo | Classificação | Estado | Notas | Data`.
4. Compartilhe a planilha com o e-mail da service account (está dentro do JSON, campo `client_email`) com permissão de **Editor**.
5. Pegue o ID da planilha (fica na URL, entre `/d/` e `/edit`) e coloque em `GOOGLE_SHEET_ID` no `.env`.

### 4. Definir a senha do dashboard

O painel de leads mostra telefone e o motivo que cada pessoa contou — dado sensível
de saúde. Como o ngrok deixa essa URL pública, o dashboard **só sobe se você definir
uma senha**. No `.env`:

```
DASHBOARD_TOKEN=uma-senha-longa-e-aleatoria-que-so-voce-sabe
```

Sem isso, `/dashboard` responde 503 e o resto do sistema (webhook, follow-ups)
continua funcionando normalmente.

### 5. Instalar e rodar

```bash
npm install
cp .env.example .env
# edite o .env com suas credenciais reais
npm start
```

Em outro terminal, rode o `ngrok http 3000` e cadastre a URL na Meta (passo 2).

### 6. Testar sem gastar mensagem de verdade

Você pode simular uma mensagem chegando, sem depender do WhatsApp real, com:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{
        "contacts":[{"profile":{"name":"Teste"}}],
        "messages":[{"from":"5599999999999","text":{"body":"Oi, vi o anúncio de vocês"}}]
      }}]}]}'
```

Veja o estado do lead em `data/leads.json` e os logs no terminal.

---

## Dashboard de leads

Com o servidor rodando, abra:

```
http://localhost:3000/dashboard?token=SUA_SENHA
```

(a mesma senha que você colocou em `DASHBOARD_TOKEN`)

O que tem lá:

- **Alerta de risco/crise** no topo — quem foi marcado com `RISCO/CRISE` aparece
  primeiro, em vermelho, porque é o caso que não pode esperar
- **Indicadores**: total de leads, quantos estão em qualificação, quantos receberam
  o catálogo, quantos estão parados em handoff e a taxa de handoff
- **Funil de qualificação**: quantos leads chegaram a cada etapa da conversa
- **Onde os leads estão agora**: o estado atual de cada um
- **Leads novos por dia** nos últimos 14 dias
- **Classificação**: Recomeço x Constância
- **Tabela completa** com busca por telefone/nome/motivo e filtros por estado,
  classificação e risco

Os dados vêm do mesmo `data/leads.json` que o fluxo já grava — o dashboard só lê,
nunca escreve. A página se atualiza sozinha a cada 60 segundos.

**Sobre segurança:** o token é a única barreira, e ele viaja na URL. Se você for
deixar isso exposto por muito tempo num endereço público, o próximo passo é botar
um login de verdade na frente (ou não expor o `/dashboard` pra internet, acessando
só pelo `localhost` da máquina onde o servidor roda).

---

## Limitação importante: janela de 24 horas

A Meta só permite **texto livre** dentro de 24h desde a última mensagem que o lead te mandou.
Os follow-ups de D+2, D+3, D+5 e D+7 quase certamente vão cair **fora** dessa janela — nesse caso,
a API exige o uso de um **Message Template pré-aprovado** em vez de texto livre.

O código já está preparado para isso (`src/whatsapp.js` tem a função `sendTemplate`), mas você
vai precisar:
1. Cadastrar os textos de follow-up como templates no Meta Business Manager.
2. Esperar a aprovação (geralmente rápida, mas não é instantânea).
3. Trocar `sendText` por `sendTemplate` nas chamadas de follow-up em `src/followup.js`.

## Antes de ir pra produção — checklist mínimo

- [ ] Testar a lista de frases de crise com variações reais (a lista atual em `src/triggers.js` é um ponto de partida — revise com a equipe clínica)
- [ ] Testar a lista de frases de intenção de compra com o vocabulário real dos seus leads
- [ ] Configurar `HANDOFF_ALERT_WEBHOOK_URL` pra você receber o alerta de handoff de verdade (não só no log do terminal)
- [ ] Decidir se vai continuar rodando localmente (computador sempre ligado) ou migrar pra um servidor/VPS
- [ ] Definir um `DASHBOARD_TOKEN` forte (o painel expõe telefone e motivo de cada lead)
- [ ] Rodar os testes do checklist de aceite do briefing técnico antes do go-live real
