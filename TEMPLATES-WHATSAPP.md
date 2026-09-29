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
Oi! Aqui é do consultório do Dr. Jesrryel Lima. Separei um material que conversa com o que você me contou. Se quiser dar uma olhada com calma, é só responder aqui que eu te envio.
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
Oi! Passando pra saber se ficou alguma dúvida sobre o que a gente conversou. Se quiser perguntar qualquer coisa, é só responder aqui — eu leio e te respondo.
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
Oi! Tem mais um material aqui que costuma ajudar quem está começando agora. Se fizer sentido pra você, me responde que eu te mando.
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
Oi! Que tal marcarmos uma conversa de 15 minutos, com calma, pra tirar suas dúvidas? Me responde aqui com o período que funciona melhor pra você — manhã, tarde ou noite — e eu te passo os horários.
```

> Pergunta período, não horário específico, porque o bot não tem sua agenda. O
> texto antigo tinha uma variável de horários que **ninguém preenchia**: o
> código mandava literalmente `[preencher 3 horários]` pro paciente. Isso foi
> corrigido junto com este documento.

---

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

---

## Duas coisas que ficaram em aberto

**1. Descadastro.** Nenhum dos textos diz "responda PARAR para não receber
mais" — porque o bot não trata "PARAR". Prometer um botão que não existe é pior
que não oferecer. Hoje o descadastro é pelo e-mail da política de privacidade.
Se você quiser, dá pra fazer o bot reconhecer PARAR/SAIR e marcar o lead como
descadastrado — aí o texto passa a poder oferecer.

**2. O conteúdo em si.** Os templates do D+2 e do D+5 prometem "um material".
Esse material precisa existir antes de o follow-up rodar, senão a pessoa
responde e não tem o que mandar.
