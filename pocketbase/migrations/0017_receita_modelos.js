migrate(
  (app) => {
    // Modelos de RECEITA prontos. O dentista escolhe um modelo e a receita ja vem
    // com medicamentos e orientacoes preenchidos, e ajusta antes de emitir.
    const receita_modelos = new Collection({
      name: 'receita_modelos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'pos_cirurgico',
            'antibiotico',
            'analgesico',
            'anti_inflamatorio',
            'bochecho',
            'ansiolitico',
            'outro',
          ],
        },
        { name: 'descricao', type: 'text' },
        { name: 'itens', type: 'json', maxSize: 100000 },
        { name: 'orientacoes', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_receita_modelos_cat ON receita_modelos (categoria)',
        'CREATE INDEX idx_receita_modelos_ativo ON receita_modelos (ativo)',
      ],
    })
    app.save(receita_modelos)

    const seed = [
      {
        nome: 'Pos-cirurgico padrao (extracao)',
        categoria: 'pos_cirurgico',
        descricao: 'Analgesico + anti-inflamatorio + bochecho para pos-operatorio de exodontia',
        itens: [
          {
            nome: 'Dipirona',
            apresentacao: '500mg, caixa com 20 comprimidos',
            posologia: 'Tomar 1 comprimido de 6/6 horas, em caso de dor, por 3 dias.',
          },
          {
            nome: 'Nimesulida',
            apresentacao: '100mg, caixa com 12 comprimidos',
            posologia: 'Tomar 1 comprimido de 12/12 horas, apos as refeicoes, por 3 dias.',
          },
          {
            nome: 'Clorhexidina (bochecho)',
            apresentacao: 'Solucao de bochecho 0,12%, frasco 150ml',
            posologia:
              'Fazer bochecho com 15ml, 2 vezes ao dia (manha e noite), a partir de 24 horas apos a cirurgia, por 7 dias.',
          },
        ],
        orientacoes:
          'Manter a gaze por 40 minutos. Nao fumar, nao usar canudo e nao fazer esforco fisico por 48 horas. Alimentacao fria e pastosa no primeiro dia. Aplicar gelo na face por 15 minutos a cada hora nas primeiras 24 horas.',
      },
      {
        nome: 'Antibiotico - Amoxicilina 7 dias',
        categoria: 'antibiotico',
        descricao: 'Antibioticoterapia padrao para infeccao odontologica',
        itens: [
          {
            nome: 'Amoxicilina',
            apresentacao: '500mg, caixa com 21 capsulas',
            posologia:
              'Tomar 1 capsula de 8/8 horas (manha, tarde e noite) por 7 dias, apos as refeicoes.',
          },
        ],
        orientacoes:
          'Tomar todos os dias no mesmo horario e nao interromper antes do fim, mesmo que os sintomas melhorem.',
      },
      {
        nome: 'Antibiotico - Amoxicilina com Clavulanato',
        categoria: 'antibiotico',
        descricao: 'Para infeccoes mais resistentes ou historico de falha terapeutica',
        itens: [
          {
            nome: 'Amoxicilina + Acido Clavulanico',
            apresentacao: '875mg/125mg, caixa com 16 comprimidos',
            posologia:
              'Tomar 1 comprimido de 12/12 horas por 7 dias, preferencialmente apos a refeicao.',
          },
        ],
        orientacoes: 'Tomar com alimento para melhor absorcao. Nao interromper antes do fim.',
      },
      {
        nome: 'Antibiotico - Alergia a penicilina (Clindamicina)',
        categoria: 'antibiotico',
        descricao: 'Alternativa para pacientes alergicos a penicilina',
        itens: [
          {
            nome: 'Clindamicina',
            apresentacao: '300mg, caixa com 16 capsulas',
            posologia: 'Tomar 1 capsula de 8/8 horas (manha, tarde e noite) por 7 dias.',
          },
        ],
        orientacoes:
          'Tomar com um copo cheio de agua, de preferencia com alimento, para reduzir desconforto gastrico.',
      },
      {
        nome: 'Analgesico simples',
        categoria: 'analgesico',
        descricao: 'Para dor leve a moderada',
        itens: [
          {
            nome: 'Paracetamol',
            apresentacao: '750mg, caixa com 20 comprimidos',
            posologia: 'Tomar 1 comprimido de 6/6 horas, em caso de dor, por ate 3 dias.',
          },
        ],
        orientacoes: 'Nao ultrapassar 4 comprimidos em 24 horas. Evitar bebida alcoolica.',
      },
      {
        nome: 'Anti-inflamatorio - Dexametasona 3 dias',
        categoria: 'anti_inflamatorio',
        descricao: 'Controle de edema em cirurgias',
        itens: [
          {
            nome: 'Dexametasona',
            apresentacao: '4mg, caixa com 6 comprimidos',
            posologia: 'Tomar 1 comprimido ao dia, pela manha, por 3 dias.',
          },
        ],
        orientacoes:
          'Tomar sempre pela manha. Nao usar em caso de diabetes descompensada sem orientacao medica.',
      },
      {
        nome: 'Bochecho - Clorhexidina 0,12%',
        categoria: 'bochecho',
        descricao: 'Antisseptico bucal para pos-operatorio',
        itens: [
          {
            nome: 'Clorhexidina (bochecho)',
            apresentacao: 'Solucao de bochecho 0,12%, frasco 150ml',
            posologia:
              'Fazer bochecho com 15ml, 2 vezes ao dia (manha e noite), por 7 dias. Nao diluir e nao enxaguar com agua depois.',
          },
        ],
        orientacoes:
          'Nao usar nas primeiras 24 horas apos cirurgia. Pode manchar a lingua e os dentes temporariamente.',
      },
    ]

    for (const m of seed) {
      try {
        app.findFirstRecordByData('receita_modelos', 'nome', m.nome)
      } catch (_) {
        const rec = new Record(receita_modelos)
        rec.set('nome', m.nome)
        rec.set('categoria', m.categoria)
        rec.set('descricao', m.descricao)
        rec.set('itens', m.itens)
        rec.set('orientacoes', m.orientacoes)
        rec.set('ativo', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('receita_modelos'))
    } catch (_) {}
  },
)
