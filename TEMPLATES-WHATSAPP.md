# Os 4 templates de follow-up — prontos pra colar

Os follow-ups de D+2, D+3, D+5 e D+7 caem **fora** da janela de 24h da Meta.
Fora dela não existe texto livre: só template aprovado. Por isso estes quatro.

Onde cadastrar: **Meta Business Suite → WhatsApp Manager → Modelos de mensagem
→ Criar modelo**.

---

## Decisões que tomei nos textos, e por quê

**Nenhum dos quatro tem variável.** Os textos antigos tinham `{{nome}}` e
`{{horários}}`. Cada variável é um lugar a mais pra Meta reprovar (variável no
começo ou no fim do corpo é reprovação automática) e um lugar a mais pra falhar
no envio: se o lead nunca disse o nome, o parâmetro vai vazio e a Meta recusa a
mensagem inteira. Sem variável, o template aprova mais rápido e não tem como
quebrar.

**Nenhum dos quatro manda link.** Isto é de propósito, e é o truque que resolve
o problema todo: **quando a pessoa responde, a janela de 24h reabre** — e aí o
bot pode mandar texto livre, link, o que for, sem template nenhum. Então o
template não precisa carregar o conteúdo. Ele só precisa fazer a pessoa
responder.

**Nenhum dos quatro promete resultado.** O texto antigo do D+5 dizia "dá pra
mudar essa história". Isso é promessa de resultado terapêutico: problema com a
Meta (política de saúde) e problema com o CFM (Res. 1.974/2011 proíbe promessa
de resultado em publicidade médica). Saiu.

**Todos abrem com "Bom dia!" e dizem quem está falando.** Desde 15/10/2026 o
bot se apresenta na primeira fala de qualquer conversa (ver `src/abertura.js`),
e um template que chega sem isso quebraria a regra justamente em quem nunca
conversou — que é quem mais precisa saber de quem é a mensagem.

O cumprimento é **fixo**, e isso é uma escolha, não descuido. Duas razões:

1. Variável no começo do corpo é **reprovação automática** na Meta. `{{1}}! Aqui
   é do consultório...` nem chega a ser avaliado.
2. Não precisa ser dinâmico: os seis saem às **9h de Mossoró**. O follow-up
   deste repositório roda às 9h (`FOLLOWUP_HORA`) e o disparo do Meta Ads
   também — confirmado no log dele em 15/10/2026:
   `[disparo] agendador: todo dia as 9h (Mossoro), modo REAL`.

**Se um dia o horário mudar para a tarde, o "Bom dia" vira mentira** e os seis
templates precisam ser recadastrados. É o preço de não ter variável, e vale a
pena — mas é a primeira coisa a lembrar ao mexer em `FOLLOWUP_HORA` ou em
`SEND_HOUR`.

**Nenhum dos quatro diz "psiquiatra".** Mesma resolução: você é pós-graduado,
não tem o título de especialista registrado. Anunciar especialidade que não se
tem é infração ética. Os textos falam do consultório, não de especialidade.

---

## 1. D+2 — conteúdo

| | |
|---|---|
| **Nome** | `followup_d2_conteudo` |
| **Categoria** | Marketing |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima — eu sou a assistente dele. Separei um material que conversa com o que você me contou. Se quiser dar uma olhada com calma, é só responder aqui que eu te envio.
```

---

## 2. D+3 — dúvida

| | |
|---|---|
| **Nome** | `followup_d3_duvida` |
| **Categoria** | Utilidade |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima — eu sou a assistente dele. Passando pra saber se ficou alguma dúvida sobre o que a gente conversou. Se quiser perguntar qualquer coisa, é só responder aqui — eu leio e te respondo.
```

> Categoria Utilidade porque é retorno a uma conversa que a própria pessoa
> começou. A Meta às vezes reclassifica pra Marketing sozinha. Se reclassificar,
> tudo bem: o template continua valendo, só muda o preço por mensagem.

---

## 3. D+5 — segundo conteúdo

| | |
|---|---|
| **Nome** | `followup_d5_conteudo` |
| **Categoria** | Marketing |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima — eu sou a assistente dele. Tem mais um material aqui que costuma ajudar quem está começando agora. Se fizer sentido pra você, me responde que eu te mando.
```

---

## 4. D+7 — convite pra conversa

| | |
|---|---|
| **Nome** | `followup_d7_conversa` |
| **Categoria** | Utilidade |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima — eu sou a assistente dele. Que tal marcarmos uma conversa de 15 minutos, com calma, pra tirar suas dúvidas? Me responde aqui com o período que funciona melhor pra você — manhã, tarde ou noite — e eu te passo os horários.
```

> Pergunta período, não horário específico, porque o bot não tem sua agenda. O
> texto antigo tinha uma variável de horários que **ninguém preenchia**: o
> código mandava literalmente `[preencher 3 horários]` pro paciente. Isso foi
> corrigido junto com este documento.

---

## Os leads do Meta Ads são outra conversa

Os quatro `followup_*` acima são do **funil**: gente que clicou no Instagram,
escreveu para o 7075 e conversou com a assistente. "Passando pra saber se ficou
alguma dúvida" faz sentido para elas.

Os leads do **Meta Ads** são outra origem: preencheram um formulário de anúncio
e **nunca escreveram** para o número. Quem recebe "ficou alguma dúvida?" sem
nunca ter conversado pensa "dúvida sobre o quê? quem é você?" — e confusão é o
que faz bloquear. Bloqueio e denúncia é o que derruba a nota do número; o envio
em si, não.

Por isso eles têm template próprio, e a diferença está na primeira linha: **diz
de onde veio o contato.** A pessoa lembra na hora. Quem não tem mais interesse
ignora ou responde PARAR, em vez de denunciar.

Quem dispara para essa lista é o serviço `whatsapp-leads-disparo` (ver
ESTADO-DO-PROJETO.md), não o follow-up daqui.

### 5. Primeiro contato do Meta Ads

| | |
|---|---|
| **Nome** | `lead_ads_primeiro_contato` |
| **Categoria** | Utilidade |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima, em Mossoró — eu sou a assistente dele. Você deixou seu contato pedindo informações sobre acompanhamento em saúde mental. Posso te explicar por aqui como funciona o atendimento e responder o que você quiser saber — é só responder esta mensagem. Se preferir não receber mais, responda PARAR.
```

> Utilidade porque responde a um pedido que a própria pessoa fez no formulário.
> Se a Meta reclassificar para Marketing, continua valendo — só muda o preço.

> **Quando sai:** no primeiro disparo que alcança esse lead na fila — não no dia
> em que ele preencheu o formulário. Com teto de 50/dia, uma lista grande se
> espalha por vários dias, e a ordem é qualificado → recente → morno → frio.

### 6. Segundo toque do Meta Ads

| | |
|---|---|
| **Nome** | `lead_ads_segundo_toque` |
| **Categoria** | Marketing |
| **Idioma** | Português (BR) |

**Corpo:**

```
Bom dia! Aqui é do consultório do Dr. Jesrryel Lima, em Mossoró — eu sou a assistente dele. Faz um tempo que você deixou seu contato pedindo informações sobre acompanhamento em saúde mental. Se ainda fizer sentido pra você, me responde que eu te explico como funciona — presencial ou online. Se não fizer mais, responda PARAR que eu não te procuro de novo.
```

> **Quando sai: 3 dias depois do primeiro**, contados de quando a primeira
> mensagem saiu de verdade (`day0_at`), não do formulário — e **só para quem não
> respondeu nada**. Qualquer resposta marca o lead como `responded` e tira ele da
> fila; dali em diante quem conversa é a assistente. É D0 e D+3, não D0 e D+1:
> um dia depois é cedo para quem nunca escreveu para o número, e parece cobrança.
>
> Os dois passos valem para os **quatro** segmentos. O segmento escolhe a ORDEM
> da fila, nunca o texto (`SEQUENCES` em `templates.py`).

### O PARAR precisa valer nos dois lados

Os dois textos prometem PARAR. O bot deste repositório entende e para
(`src/descadastro.js`), mas **quem dispara para essa lista é outro programa,
com a lista dele**. Confirmado em 14/10/2026 que ele consulta quem pediu para
sair.

Isso não é detalhe: prometer PARAR e continuar mandando é pior que não
prometer — vira denúncia na certa, e é LGPD (art. 18). Se algum dia o disparo
mudar de dono ou de código, **esta é a primeira coisa a reconferir.**

## Depois que a Meta aprovar

Cada template aprovado vira uma variável na Railway:

| Template | Variável |
|---|---|
| `followup_d2_conteudo` | `WHATSAPP_TEMPLATE_D2` |
| `followup_d3_duvida` | `WHATSAPP_TEMPLATE_D3` |
| `followup_d5_conteudo` | `WHATSAPP_TEMPLATE_D5` |
| `followup_d7_conversa` | `WHATSAPP_TEMPLATE_D7` |

O valor é o **nome** do template (`followup_d2_conteudo`), não o texto.

Enquanto uma dessas variáveis estiver vazia, aquele follow-up é pulado com
aviso no log — não quebra nada.

**Antes de tudo isso:** a Meta exige forma de pagamento cadastrada na conta de
WhatsApp Business. Sem isso, template aprovado não envia (erro `131042`).

## Confira o IDIOMA de cada um, não só o nome

Para a Meta um template é **nome + idioma**, não só nome. O código pede todos
em `pt_BR` (`sendTemplate` em `src/whatsapp.js`). Um template com o texto em
português mas registrado como **English** não é encontrado: o envio é recusado
e aquele follow-up some sem nunca ter saído.

Aconteceu em 14/10/2026: os quatro foram criados e ficaram ativos, mas D+5 e
D+7 saíram marcados como English. Texto em português, idioma inglês — a lista
de templates mostra os dois "Ativo", e nada na tela diz que metade da sequência
não ia funcionar. Só apareceu porque o idioma estava num print.

A Meta não checa se o texto bate com o idioma declarado, então esse erro não dá
aviso nenhum. **Depois de criar, olhe a coluna Idioma da lista.** Os quatro
precisam dizer Portuguese (BR).

Corrigir é recriar o template com o mesmo nome em Portuguese (BR) — a versão em
inglês pode ficar lá, sem uso, e a variável na Railway continua a mesma.

---

## Descadastro: agora pode oferecer

Desde 04/10/2026 o bot reconhece **PARAR**, **SAIR**, **CANCELAR**,
**DESCADASTRAR**, **REMOVER**, **PARE** e **STOP**. Quem escreve uma dessas
recebe uma confirmação e não recebe mais nada.

Então os quatro templates podem ganhar esta linha no fim, se você quiser:

```
Se não quiser mais receber mensagens, é só responder PARAR.
```

Não é obrigatório no Brasil, mas ajuda na aprovação da Meta em categoria
Marketing — e agora é verdade, que é o que importa.

**Só funciona com a mensagem inteira.** "Quero parar de tomar o remédio" não
descadastra ninguém: a comparação é com o texto todo, nunca com um pedaço. Um
falso positivo aqui calaria para sempre alguém que estava pedindo ajuda.

## O conteúdo em si

**O conteúdo.** Os templates do D+2 e do D+5 prometem "um material".
Esse material precisa existir antes de o follow-up rodar, senão a pessoa
responde e não tem o que mandar.
