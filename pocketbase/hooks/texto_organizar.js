// Organiza um texto livre ditado, de qualquer campo do sistema.
//
// O prontuário tem o seu próprio hook (prontuario_estruturar), que separa o
// ditado em procedimentos/anotações/dente. Os outros campos — queixa do
// agendamento, observação do orçamento, mensagem, receita — precisam de outra
// coisa: um texto ÚNICO, limpo e clínico, no lugar do que foi falado.
//
// Rota: POST /backend/v1/texto/organizar
// Corpo: { texto, contexto }
//   contexto = para que serve o campo, em palavras simples. Ex.: "queixa
//   principal do paciente no agendamento", "observação do orçamento".
routerAdd(
  'POST',
  '/backend/v1/texto/organizar',
  (e) => {
    const body = e.requestInfo().body || {}
    const texto = (body.texto || '').toString().trim()
    const contexto = (body.contexto || 'observação').toString().trim()

    if (!texto) {
      throw new BadRequestError('Envie o texto ditado.')
    }
    if (texto.length > 4000) {
      throw new BadRequestError('O ditado passou de 4000 caracteres. Divida em partes.')
    }

    const instrucoes = [
      'Você organiza textos ditados numa clínica odontológica brasileira.',
      'Quem dita é a dentista ou a recepção, falando rápido, com repetições e erros de transcrição.',
      `O texto será usado como: ${contexto}.`,
      '',
      'Devolva SOMENTE o texto final, pronto para gravar no campo. Sem JSON, sem aspas, sem markdown, sem comentários.',
      '',
      'Regras:',
      '- Escreva em português do Brasil, com clareza e concisão.',
      '- Corrija a pontuação e as repetições do falante.',
      '- Use termos clínicos corretos quando o sentido for óbvio (ex.: "canal" -> "tratamento endodôntico").',
      '- Preserve TODA a informação dita. Não invente nada e não acrescente condutas que não foram faladas.',
      '- Não comece com "Paciente relata que" se o ditado já começa assim; não repita a mesma ideia.',
      '- Se o texto tiver mais de uma ideia, separe em frases.',
      '- Tamanho parecido com o do ditado: encurte a fala, nunca o conteúdo.',
      '- NUNCA devolva vazio. Se o ditado não tiver sentido clínico, devolva o texto original apenas corrigido.',
    ].join('\n')

    const resposta = $ai.chat({
      model: 'fast',
      messages: [
        { role: 'system', content: instrucoes },
        { role: 'user', content: texto },
      ],
    })

    let organizado = (resposta.choices[0].message.content || '').trim()

    // O modelo pode devolver o texto cercado por ``` ... ```
    const cerca = organizado.match(/```[a-z]*\s*([\s\S]*?)```/)
    if (cerca) organizado = cerca[1].trim()

    // Tira aspas que o modelo às vezes coloca em volta do texto todo
    if (
      (organizado.startsWith('"') && organizado.endsWith('"')) ||
      (organizado.startsWith('“') && organizado.endsWith('”'))
    ) {
      organizado = organizado.slice(1, -1).trim()
    }

    // Rede de segurança: nunca devolver vazio — devolve o que a pessoa falou.
    if (!organizado) {
      return e.json(200, { ok: true, organizado: false, texto })
    }

    return e.json(200, { ok: true, organizado: true, texto: organizado })
  },
  $apis.requireAuth(),
)
