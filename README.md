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
- **Validação da assinatura da Meta** (`X-Hub-Signature-256`) — rejeita POST que não veio da Meta
- **Dedupe de evento reenviado** — a Meta reenvia o mesmo evento quando o webhook demora ou falha; sem isso o lead pulava uma etapa do fluxo
- **Assistente com IA** (Claude API) — entende a resposta escrita de qualquer jeito, responde dúvida fora do roteiro e extrai o que o lead contou, em vez de assumir que "a mensagem 2 é sempre o motivo"
- **Dashboard de leads** (`/dashboard`): funil de qualificação, leads por dia, classificação, alerta de risco e a lista completa com busca e filtros

## O que você precisa fazer antes de rodar de verdade

### 1. Criar o app na Meta e obter as credenciais

1. Acesse [developers.facebook.com](https://developers.facebook.com) → crie um app tipo "Business".
2. Adicione o produto **WhatsApp** ao app.
3. No painel do WhatsApp, pegue:
   - **Token de acesso** (comece com o temporário pra testar; depois gere um permanente via System User)
   - **Phone Number ID**
   - **App Secret** (em Configurações → Básico) — é com ele que o servidor confere que o POST veio mesmo da Meta
4. Cole esses valores no arquivo `.env` (copie `.env.example` para `.env` primeiro).

> 🔒 **`WHATSAPP_APP_SECRET` não é opcional em produção.** Sem ele, o `/webhook` aceita POST de qualquer origem — dá pra inventar lead, forjar mensagem de um telefone que não é seu ou disparar um falso alerta de `RISCO/CRISE`. Pra teste local com `curl` o servidor deixa passar sem ele (e avisa no startup), mas nunca suba pra um endereço público assim.

> ⚠️ A aprovação para produção (poder mandar mensagem pra qualquer número, não só números de teste) exige verificação da empresa pela Meta — isso pode levar alguns dias. Comece testando com números de teste cadastrados no próprio painel.

### 2. Expor seu terminal pra internet (pra a Meta conseguir chamar seu webhook)

Como você vai rodar isso no seu computador, a Meta precisa de uma URL pública HTTPS pra enviar as mensagens. Use o [ngrok](https://ngrok.com):

```bash
# instale o ngrok (ex: via brew no Mac, ou baixe o binário)
ngrok http 3000
```

Isso te dá uma URL tipo `https://algumacoisa.ngrok-free.app`. Use `https://algumacoisa.ngrok-free.app/webhook` como **Callback URL** no painel da Meta, e o valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env` como **Verify Token**.

> ⚠️ **Importante sobre "rodar no terminal":** enquanto for a versão gratuita do ngrok, a URL muda toda vez que você reinicia — ou seja, o WhatsApp só vai funcionar enquanto seu computador estiver ligado, o terminal aberto, e a URL cadastrada na Meta for a mesma da sessão atual do ngrok. Pra ficar sempre no ar, veja a seção **[Deploy na Railway](#deploy-na-railway)**.

### 3. Configurar o Google Sheets

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto → ative a **Google Sheets API**.
2. Crie uma **Service Account** → gere uma chave JSON → salve como `credentials/service-account.json` nesta pasta.
3. O bot grava numa **aba própria** da planilha `CRM_Leads_Dr_Jesrryel - OFICIAL`
   (ID `1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg`), configurada em
   `GOOGLE_SHEET_TAB`. Tem que ser uma aba só dele: nas outras abas o telefone
   está em coluna diferente, e o upsert procura sempre na coluna A — apontar
   pra aba errada empilharia linha nova a cada mensagem em cima dos leads reais.

   A primeira linha da aba precisa ter estes 13 cabeçalhos, nesta ordem (a
   gravação é posicional — coluna A é telefone, B é nome, e assim por diante):

   ```
   Telefone | Nome | Estágio | Classificação | Risco | Motivo | Histórico | Formato | Follow-ups enviados | Notas | Primeiro contato | Última atualização | Estado (técnico)
   ```

   **Estágio** fala o vocabulário da aba FUNIL (Novo / Qualificação / Nutrição /
   Consulta Proposta / Desqualificado / Convertido), pra dar pra cruzar as duas.
   **Estado (técnico)** guarda o código cru (`FOLLOWUP_D2`) sem perder precisão.
   **Risco** marca `SIM` em quem foi sinalizado — é a coluna pra deixar fixa e colorida.

   | Estado do fluxo | Estágio no CRM |
   |---|---|
   | `NOVO` | Novo |
   | `AGUARDANDO_MOTIVO/HISTORICO/FORMATO` | Qualificação |
   | `CATALOGO_ENVIADO`, `FOLLOWUP_D2/D3/D5/D7`, `REENGAJAMENTO_MENSAL` | Nutrição |
   | `HANDOFF` | Consulta Proposta |
   | `DESQUALIFICADO` | Desqualificado |
   | `CLIENTE` | Convertido |

   **Três estágios o bot nunca escreve** — *Consulta Agendada*, *Convertido* e
   *Perdido* dependem do que acontece fora do WhatsApp. Continuam sendo
   preenchidos por pessoa, na aba FUNIL.

   **O encaixe imperfeito:** na aba FUNIL, "Consulta Proposta" significa que já
   ofereceram horários. Aqui significa só que a automação passou pra um humano —
   o que para intenção de compra dá no mesmo, mas para `RISCO/CRISE` não é
   estágio de venda nenhum. Quem desempata é a coluna **Risco**: *Consulta
   Proposta + Risco=SIM* se lê como "humano precisa agir agora, e não é sobre
   vender".
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

### 5. Testar a planilha antes de qualquer outra coisa

Antes de mexer com Meta, ngrok ou deploy, confirme só uma coisa: o bot consegue
escrever na planilha?

```bash
npm install
cp .env.example .env
# edite o .env: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID, GOOGLE_SHEET_TAB
npm run testar-planilha
```

Escreve um lead de teste (telefone `5500000000000`) na aba e diz o que aconteceu.
**Rode duas vezes:** a segunda tem que *atualizar* a mesma linha, não criar outra —
é assim que se prova que o upsert está achando o telefone na coluna A.

Quando falha, o script diz o motivo em vez de cuspir o erro cru da API. Os quatro
que acontecem de verdade:

| Sintoma | O que fazer |
|---|---|
| `Unable to parse range` | O nome da aba no `.env` não bate com o da planilha (maiúscula, acento, espaço) |
| `403 / permission` | A planilha não foi compartilhada com a service account como **Editor** |
| `DECODER routines::unsupported` | O JSON da credencial está corrompido — baixe de novo sem editar |
| `API has not been used` | A Google Sheets API não está ativada no projeto do Google Cloud |

Apague a linha de teste depois. Ela não atrapalha nada, mas polui.

### 6. Testar o envio pelo WhatsApp, isolado

Antes de webhook, ngrok e servidor no ar — o programa consegue falar com a
Meta e entregar mensagem?

```bash
npm run testar-whatsapp 5584999999999
```

Manda uma mensagem só, para o número informado (com DDI e DDD, só números).

Enquanto o app está em modo de teste, a Meta só entrega para números
cadastrados como destinatários de teste no painel — e, fora do modo de teste,
só para quem te mandou mensagem nas últimas 24h. Não é limitação do projeto.

Quando falha, o script desempacota o erro da Meta (que vem dentro do corpo da
resposta, não no status HTTP) e traduz os códigos que mais aparecem:

| Código | O que é |
|---|---|
| 190 | Token expirado — os temporários duram 24h |
| 131030 | Número de destino fora da lista de permitidos |
| 131047 | Passou da janela de 24h; só template pré-aprovado |
| 131026 | Destino sem WhatsApp ou sem conseguir receber |
| 133010 | Número remetente não registrado na API |
| 131037 | Nome de exibição ainda não aprovado — número novo recebe, mas não envia |
| 131042 | Falta forma de pagamento na conta do WhatsApp Business |
| 131031 | Conta bloqueada ou restringida pela Meta |

### 7. Instalar e rodar

```bash
npm install
cp .env.example .env
# edite o .env com suas credenciais reais
npm start
```

Em outro terminal, rode o `ngrok http 3000` e cadastre a URL na Meta (passo 2).

### 8. Testar sem gastar mensagem de verdade

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

## Deploy na Railway

Tira o sistema do "só funciona com o Mac ligado" e põe numa URL fixa, no ar 24/7.

### 1. Volume persistente — faça isto ANTES do primeiro deploy

**O disco da Railway é efêmero.** Todo deploy recria a máquina e leva junto tudo
que estava em disco. Sem um volume, cada deploy apagaria os leads, o histórico
das conversas e os ids de evento já processados — e o dedupe voltaria a deixar
passar reenvio da Meta.

No painel da Railway: **New → Volume**, monte em `/data`, e defina a variável:

```
DATA_DIR=/data
```

### 2. Subir o projeto

```bash
npm i -g @railway/cli
railway login
railway init          # ou: railway link, se o projeto já existe
railway up
```

O `railway.json` na raiz já define o `npm start`, o healthcheck em `/health` e
o restart automático em caso de falha.

### 3. Variáveis de ambiente

Copie do seu `.env` (menos `PORT` — a Railway injeta a dela) e some estas:

| Variável | Valor | Por quê |
|---|---|---|
| `DATA_DIR` | `/data` | Sem isso, deploy apaga os leads |
| `FOLLOWUP_TIMEZONE` | `America/Fortaleza` | Servidor roda em UTC; sem isso o follow-up sai 06:00 |
| `WHATSAPP_APP_SECRET` | o App Secret da Meta | Agora a URL é pública e fixa — não é mais opcional |
| `DASHBOARD_TOKEN` | uma senha longa | O painel expõe telefone e motivo de cada lead |

A credencial do Google é a única que não é um valor solto: no Mac ela é um
**arquivo**. Na Railway não existe "colocar um arquivo lá dentro", então use a
variável `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` com o **conteúdo** do JSON — e
deixe `GOOGLE_SERVICE_ACCOUNT_JSON` vazia:

```bash
# no Mac, pra gerar o valor a colar na Railway:
base64 -i credentials/service-account.json | pbcopy
```

Cole o resultado em `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`. Cru também funciona,
mas base64 é uma linha só — não tem quebra de linha pro painel web estragar.

### 4. Apontar a Meta pra URL nova

A Railway te dá uma URL fixa (`https://seu-app.up.railway.app`). No painel da
Meta, troque a Callback URL do ngrok por `https://seu-app.up.railway.app/webhook`.
Como a URL agora não muda mais, isso é a última vez que você mexe nisso.

### O que verificar depois do primeiro deploy

- `GET /health` responde `{"ok": true}`
- No log de boot **não aparece** nenhum dos avisos de ⚠️ (`WHATSAPP_APP_SECRET`,
  `DASHBOARD_TOKEN`, `ANTHROPIC_API_KEY`, credencial do Sheets)
- O log do follow-up mostra o fuso certo: `fuso America/Fortaleza`
- Faz um deploy novo e confere que os leads continuam lá — é o teste real do volume

---

## Assistente com IA

Sem `ANTHROPIC_API_KEY` no `.env`, o bot funciona pelo roteiro fixo de sempre.
Com a chave, a assistente assume a conversa — e o roteiro fixo vira a rede de
segurança.

### A ordem em que as coisas rodam

```
mensagem chega
  │
  ├─ 1. sinal de crise por palavra-chave  ──► HANDOFF urgente
  │      (determinístico, ANTES da IA, sempre)
  ├─ 2. intenção de compra por palavra-chave ──► HANDOFF
  ├─ 3. fora de escopo por palavra-chave  ──► DESQUALIFICADO
  │
  ├─ 4. assistente com IA ──► interpreta, responde, extrai motivo/histórico/formato
  │        │                  (e sinaliza risco como SEGUNDA camada)
  │        └─ devolveu null? ─┐
  │                           │
  └─ 5. roteiro fixo  ◄───────┘
```

**Por que a checagem de crise roda antes da IA e não dentro dela:** essa
checagem não pode depender de rede, de saldo na API, nem de o modelo ter lido a
frase do jeito certo. A IA *também* tem instrução de sinalizar risco — mas como
segunda camada, nunca como a única. Se ela perceber um risco que as
palavras-chave não pegaram, o handoff acontece do mesmo jeito.

### Quando a IA não é usada

A assistente devolve `null` e o roteiro fixo assume, sem o bot nunca ficar mudo,
em qualquer um destes casos:

- `ANTHROPIC_API_KEY` ausente, ou `ASSISTENTE_IA=off`
- Erro de rede, rate limit, chave inválida, saldo acabado
- Resposta vazia ou JSON inválido
- **Resposta barrada por compliance** — se escapar preço, "plano" ou "consulta
  psiquiátrica" numa resposta, ela é descartada e o texto fixo de
  `src/messages.js` vai no lugar

Essa última é deliberadamente redundante: o system prompt já proíbe tudo isso,
mas "o prompt manda" não é garantia de nada.

### Nos desfechos, quem fala é o texto fixo

Quando a intenção é risco, compra ou fora de escopo, o que vai pro lead é o
texto de `src/messages.js`, **não** o texto que a IA gerou. São os casos em que
a palavra exata importa (acolhimento de risco, desqualificação gentil) ou em que
um deslize custa caro (falar preço respondendo a "quanto custa"). A IA só fala
com as próprias palavras na conversa normal de qualificação.

### Conversar com ela antes de qualquer paciente ver

```bash
npm run conversar
```

Abre uma conversa no Terminal onde você escreve como se fosse um lead chegando
no WhatsApp. Nada vai pro WhatsApp nem pra planilha — é só a conversa, pra
revisar o tom e as regras antes do go-live.

Ao lado de cada resposta ele mostra **por que** ela saiu daquele jeito:

- `[RISCO — palavra-chave, sem consultar a IA]` — o gatilho determinístico pegou
- `[RISCO — sinalizado pela IA]` — a segunda camada pegou o que as palavras-chave não pegaram
- `[conversa normal]` — a assistente falando com as próprias palavras
- `[IA indisponível — caiu no roteiro fixo]` — o fallback entrou

E mostra a ficha que ela foi montando (motivo, histórico, formato,
classificação), pra você ver se ela está entendendo direito o que o lead disse.

### Custo

Roda em `claude-opus-5` por padrão. O system prompt fica em cache
(`cache_control`), então a partir da segunda mensagem de cada lead a maior parte
do contexto sai a ~10% do preço. O histórico da conversa é cortado nos últimos
12 turnos pra conta não crescer sem fim numa conversa longa.

Pra trocar de modelo, use `CLAUDE_MODEL` no `.env`.

---

## Testes automatizados

```bash
npm test
```

Cobre as partes onde um erro silencioso custa caro:

- **Detecção de sinal de crise** — um falso negativo aqui é um lead em risco tratado como lead comum
- **Casamento do telefone no upsert do Sheets** — se falhar, cada mensagem cria uma linha nova e a planilha vira um log em vez de um CRM
- **Assinatura da Meta** — incluindo corpo adulterado com assinatura antiga
- **Expiração dos ids de evento já processados**
- **Compliance da assistente** — preço, "plano" e "consulta psiquiátrica" barrados
- **Aplicação da resposta da IA** no funil — incluindo não apagar campo já preenchido e não reiniciar o relógio dos follow-ups
- **Colunas da planilha** — que a lista de colunas e o range gravado não saiam de sincronia, o que faria o dado cair na coluna errada sem ninguém notar

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

Os follow-ups (`src/followup.js`) já usam `sendTemplate` em vez de texto livre, então você
só vai precisar:
1. Cadastrar os textos de follow-up como templates no Meta Business Manager. Os textos em
   `src/messages.js` (`followupD2`, `followupD3`, `followupD5`, `followupD7`) servem de
   referência de conteúdo — `followupD3` e `followupD7` têm variáveis (nome, horários) que
   viram os parâmetros `{{1}}`, `{{2}}` etc. do template.
2. Esperar a aprovação (geralmente rápida, mas não é instantânea).
3. Colocar o nome de cada template aprovado em `WHATSAPP_TEMPLATE_D2` / `_D3` / `_D5` / `_D7`
   no `.env` (veja `.env.example`). Enquanto uma dessas variáveis não estiver preenchida, o
   follow-up correspondente fica pulado (com aviso no log) em vez de falhar.

## Antes de ir pra produção — checklist mínimo

- [ ] Testar a lista de frases de crise com variações reais (a lista atual em `src/triggers.js` é um ponto de partida — revise com a equipe clínica)
- [ ] Testar a lista de frases de intenção de compra com o vocabulário real dos seus leads
- [ ] Revisar o system prompt de `src/assistente.js` com o Dr. Jesrryel antes do go-live
- [ ] Definir `WHATSAPP_APP_SECRET` (sem ele o webhook aceita POST de qualquer um)
- [ ] Configurar `HANDOFF_ALERT_WEBHOOK_URL` pra você receber o alerta de handoff de verdade (não só no log do terminal)
- [ ] Decidir se vai continuar rodando localmente (computador sempre ligado) ou migrar pra um servidor/VPS
- [ ] Definir um `DASHBOARD_TOKEN` forte (o painel expõe telefone e motivo de cada lead)
- [ ] Rodar `npm test` e o checklist de aceite do briefing técnico antes do go-live real
