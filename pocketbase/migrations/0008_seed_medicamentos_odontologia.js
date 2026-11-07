migrate(
  (app) => {
    // Complemento do catálogo de medicamentos usados em odontologia.
    // Idempotente: cada medicamento só é inserido se ainda não existir
    // registro com o mesmo nome (não altera nem duplica os já existentes).
    const col = app.findCollectionByNameOrId('medicamentos')

    const novos = [
      {
        nome: 'Dipirona',
        apresentacao: '500mg, caixa com 20 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido de 6/6 horas por 3 dias, em caso de dor, com líquido (não mastigar).',
      },
      {
        nome: 'Azitromicina',
        apresentacao: '500mg, caixa com 3 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido ao dia, por 3 dias, de preferência no mesmo horário, independentemente das refeições.',
      },
      {
        nome: 'Clindamicina',
        apresentacao: '300mg, caixa com 16 cápsulas',
        posologia_padrao:
          'Tomar 1 cápsula de 8/8 horas (de manhã, à tarde e à noite) por 7 dias, com um copo cheio de água.',
      },
      {
        nome: 'Metronidazol',
        apresentacao: '250mg, caixa com 20 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido de 8/8 horas por 7 dias, durante ou logo após as refeições. Não ingerir bebida alcoólica durante o tratamento.',
      },
      {
        nome: 'Prednisona',
        apresentacao: '20mg, caixa com 20 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido ao dia, pela manhã, após o café, por 3 a 5 dias, conforme orientação do dentista.',
      },
    ]

    for (const m of novos) {
      const existentes = app.findRecordsByFilter('medicamentos', `nome = "${m.nome}"`, '', 1, 0)
      if (existentes.length > 0) continue
      const rec = new Record(col)
      rec.set('nome', m.nome)
      rec.set('apresentacao', m.apresentacao)
      rec.set('posologia_padrao', m.posologia_padrao)
      rec.set('ativo', true)
      app.save(rec)
    }
  },
  (app) => {
    // Reverte apenas os medicamentos desta migration, se ainda existirem
    const nomes = ['Dipirona', 'Azitromicina', 'Clindamicina', 'Metronidazol', 'Prednisona']
    for (const nome of nomes) {
      try {
        const existentes = app.findRecordsByFilter('medicamentos', `nome = "${nome}"`, '', 1, 0)
        for (const rec of existentes) app.delete(rec)
      } catch (_) {}
    }
  },
)
