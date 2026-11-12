// Estrutura um ditado do dentista nos campos do prontuário.
// Recebe o texto livre transcrito no navegador e devolve os campos já separados
// (procedimentos, dente/região, anotações e sugestão de retorno em dias).
routerAdd(
  'POST',
  '/backend/v1/prontuario/estruturar',
  (e) => {
    const body = e.requestInfo().body || {}
    const texto = (body.texto || '').toString().trim()

    if (!texto) {
      throw new BadRequestError('Envie o texto ditado.')
    }
    if (texto.length > 4000) {
      throw new BadRequestError('O ditado passou de 4000 caracteres. Divida em partes.')
    }

    const instrucoes = [
      'Você é assistente de uma clínica odontológica brasileira e organiza o ditado de um dentista.',
      'Receberá um texto falado, informal, com erros de transcrição e repetições.',
      'Devolva SOMENTE um objeto JSON válido, sem markdown e sem comentários, com estas chaves:',
      '{"procedimentos": string, "dente_regiao": string, "anotacoes": string, "retorno_dias": number|null}',
      '',
      'Regras:',
      '- "procedimentos": o que foi executado no atendimento, em linguagem clínica objetiva e curta. Ex.: "Restauração em resina composta dente 16, face oclusal".',
      '- "dente_regiao": apenas os dentes ou a região citada, no formato FDI quando houver dente. Ex.: "16" ou "16, 17" ou "arcada superior". Vazio se não citado.',
      '- "anotacoes": conduta, queixa relatada, evolução, orientações dadas e próximos passos. Texto corrido, claro, sem repetir o procedimento.',
      '- "retorno_dias": número de dias de retorno se o dentista mencionar ("voltar em 7 dias", "retorno em uma semana" = 7, "em um mês" = 30). null se não mencionar.',
      '- Não invente informação que não esteja no ditado.',
      '- Corrija termos técnicos óbvios de transcrição (ex.: "canal" -> "tratamento endodôntico").',
      '- Responda em português do Brasil.',
    ].join('\n')

    const resposta = $ai.chat({
      model: 'fast',
      messages: [
        { role: 'system', content: instrucoes },
        { role: 'user', content: texto },
      ],
    })

    const bruto = resposta.choices[0].message.content || ''

    // O modelo pode devolver o JSON cercado por ```json ... ```
    let limpo = bruto.trim()
    const cerca = limpo.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (cerca) limpo = cerca[1].trim()

    let dados = null
    try {
      dados = JSON.parse(limpo)
    } catch (_) {
      // Se não veio JSON, devolve o texto inteiro como anotações para o
      // dentista revisar, em vez de perder o ditado.
      return e.json(200, {
        ok: true,
        estruturado: false,
        procedimentos: '',
        dente_regiao: '',
        anotacoes: texto,
        retorno_dias: null,
      })
    }

    return e.json(200, {
      ok: true,
      estruturado: true,
      procedimentos: typeof dados.procedimentos === 'string' ? dados.procedimentos : '',
      dente_regiao: typeof dados.dente_regiao === 'string' ? dados.dente_regiao : '',
      anotacoes: typeof dados.anotacoes === 'string' ? dados.anotacoes : '',
      retorno_dias:
        typeof dados.retorno_dias === 'number' && dados.retorno_dias > 0
          ? Math.round(dados.retorno_dias)
          : null,
    })
  },
  $apis.requireAuth(),
)
