migrate(
  (app) => {
    const pacientesCol = app.findCollectionByNameOrId('pacientes')

    // Catálogo de medicamentos (cadastro em Configurações, somente administrador)
    const medicamentos = new Collection({
      name: 'medicamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 2, max: 200 },
        { name: 'apresentacao', type: 'text', max: 300 }, // ex.: "500mg, caixa 21 comprimidos"
        { name: 'posologia_padrao', type: 'text', max: 500 }, // ex.: "Tomar 1 comprimido a cada 8 horas por 7 dias"
        { name: 'ativo', type: 'bool' }, // nunca required (bool required = só aceita true)
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_medicamentos_nome ON medicamentos (nome)'],
    })
    app.save(medicamentos)

    // Receitas emitidas no prontuário do paciente
    // itens = [{ medicamento_id?, nome, apresentacao, posologia }]  (medicamento_id é null p/ medicamentos digitados fora do catálogo)
    // origem = 'manual' hoje; 'birdid' quando houver integração com certificado digital
    const receitas = new Collection({
      name: 'receitas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'paciente',
          type: 'relation',
          required: true,
          collectionId: pacientesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'autor',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'itens', type: 'json', required: true },
        { name: 'orientacoes', type: 'text', max: 2000 },
        { name: 'origem', type: 'select', values: ['manual', 'birdid'], maxSelect: 1 },
        { name: 'data', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_receitas_paciente ON receitas (paciente)',
        'CREATE INDEX idx_receitas_data ON receitas (data)',
      ],
    })
    app.save(receitas)

    // Seed idempotente: medicamentos comuns da odontologia com posologia pré-definida
    const exemplos = [
      {
        nome: 'Amoxicilina',
        apresentacao: '500mg, caixa com 21 cápsulas',
        posologia_padrao:
          'Tomar 1 cápsula de 8/8 horas (de manhã, à tarde e à noite) por 7 dias, preferencialmente após as refeições.',
      },
      {
        nome: 'Amoxicilina + Ácido Clavulânico',
        apresentacao: '875mg/125mg, caixa com 16 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido de 12/12 horas por 7 dias, preferencialmente após as refeições.',
      },
      {
        nome: 'Ibuprofeno',
        apresentacao: '600mg, caixa com 20 comprimidos',
        posologia_padrao:
          'Tomar 1 comprimido de 8/8 horas por 3 dias, após as refeições, em caso de dor ou inchaço.',
      },
      {
        nome: 'Paracetamol',
        apresentacao: '750mg, caixa com 20 comprimidos',
        posologia_padrao: 'Tomar 1 comprimido de 6/6 horas por 3 dias, em caso de dor.',
      },
      {
        nome: 'Nimesulida',
        apresentacao: '100mg, caixa com 12 comprimidos',
        posologia_padrao: 'Tomar 1 comprimido de 12/12 horas por 3 dias, após as refeições.',
      },
      {
        nome: 'Dexametasona',
        apresentacao: '4mg, caixa com 6 comprimidos',
        posologia_padrao: 'Tomar 1 comprimido ao dia, pela manhã, por 3 dias.',
      },
      {
        nome: 'Clorhexidina (bochecho)',
        apresentacao: 'Solução de bochecho 0,12%, frasco 150ml',
        posologia_padrao:
          'Fazer bochechos com 15ml, 2 vezes ao dia (manhã e noite), durante 7 dias. Não ingerir.',
      },
    ]

    const col = app.findCollectionByNameOrId('medicamentos')
    for (const m of exemplos) {
      // idempotente: não duplica se já existir medicamento com o mesmo nome
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
    try {
      app.delete(app.findCollectionByNameOrId('receitas'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('medicamentos'))
    } catch (_) {}
  },
)
